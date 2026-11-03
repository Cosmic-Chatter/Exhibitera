# Shared file functions for Hub and Apps

# Standard modules
import csv
import datetime
import io
import json
import logging
import mimetypes
import os
import pathlib
import re
import shutil
import sys
from typing import Any, Iterable
import urllib
import uuid
import zipfile

# Third-party modules
import requests

# Exhibitera modules
import exhibitera.common.config as config


def get_path(path_list: list[str], user_file: bool = False) -> str:
    """Return a path that takes into account whether the app has been packaged by Pyinstaller"""

    _path = os.path.join(config.application_path, *path_list)
    if getattr(sys, 'frozen', False):
        # Handle the case of a Pyinstaller --onefile binary

        if user_file:
            if sys.platform == 'darwin':
                # macOS-specific Application Support path
                base_dir = os.path.join(os.path.expanduser("~"), "Library", "Application Support", config.user_data_folder_name)
                os.makedirs(base_dir, exist_ok=True)
                _path = os.path.join(base_dir, *path_list)
        else:
            _path = os.path.join(config.exec_path, *path_list)
    return _path


def with_extension(filename: str, ext: str) -> str:
    """Return the filename with the current extension replaced by the given one"""

    if ext.startswith("."):
        ext = ext[1:]

    return os.path.splitext(filename)[0] + "." + ext


def path_safe(path: list[str]) -> bool:
    """Ensure the given path doesn't escape the user files directory.

    `path` should be a list of directories, which should not include any path separators.
    """

    if len(path) == 0:
        return False

    if path[0] not in ['content', 'data', 'definitions', 'static', 'thumbnails']:
        return False

    for item in path:
        if not isinstance(item, str):
            return False

        # Trim any leading or trailing whitespace
        item = item.strip()

        for char in ['/', '\\', '<', '>', ':', '"', '|', '?', '*']:
            if char in item:
                return False
        if item in ['', '.', '..']:
            return False

    return True


def filename_safe(filename: str) -> bool:
    """Ensure the filename doesn't escape to another directory or is malformed.

    Note that this should not be used on paths, which will obviously include some
    of these cases.
    """

    if not isinstance(filename, str):
        return False

    # Trim any leading or trailing whitespace
    filename = filename.strip()

    if filename in ['', '.', '..']:
        return False

    # Check if the filename is too long (common filesystem limit is 255 characters)
    if len(filename) > 255:
        return False

    for char in ['/', '\\', '<', '>', ':', '"', '|', '?', '*']:
        if char in filename:
            return False

    # Check for reserved Windows filenames (case-insensitive)
    if filename.upper() in ["CON", "PRN", "AUX", "NUL",
                            *(f"COM{i}" for i in range(1, 10)),
                            *(f"LPT{i}" for i in range(1, 10))]:
        return False

    return True


def load_records(file_path: str | os.PathLike, exclude_keys: Iterable[str] = ()) -> list[dict[str, Any]] | None:
    """Load the records from a data file, one JSON object per line, leaving out the given keys.

    Return None if the file doesn't exist.
    """

    records = []
    try:
        with open(file_path, 'r', encoding="UTF-8") as f:
            for line in f.readlines():
                try:
                    record = json.loads(line)
                    if isinstance(record, dict):
                        for key in exclude_keys:
                            record.pop(key, None)
                    records.append(record)
                except json.decoder.JSONDecodeError:
                    print("createCSV: error: skipping line with invalid JSON: " + line)
                    pass
    except FileNotFoundError:
        return None
    return records


def create_csv(file_path: str | os.PathLike, filename: str = "", exclude_keys: Iterable[str] = ()) -> str:
    """Load a tracker text file and convert it to a CSV, leaving out the given keys"""

    records = load_records(file_path, exclude_keys)
    if records is None:
        return ""
    return json_list_to_csv(records, filename=filename)


# Subsets of records, for downloading part of a dataset

# Local times, as records store them: a date, a time to the minute, or a time with seconds, without a time zone
TIME_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}(?P<time>T\d{2}:\d{2}(?P<seconds>:\d{2}(\.\d+)?)?)?")


def parse_time(text: str) -> tuple[datetime.datetime, datetime.timedelta]:
    """Return the given local time and how precisely it was given: a day, a minute, or exactly.

    Raise ValueError if it isn't a date or time in one of the forms of TIME_PATTERN.
    """

    match = TIME_PATTERN.fullmatch(text)
    if match is None:
        raise ValueError(f"Invalid time: {text!r}")
    time = datetime.datetime.fromisoformat(text)  # Raises ValueError for impossible times, such as month 13
    if match["time"] is None:
        return time, datetime.timedelta(days=1)
    if match["seconds"] is None:
        return time, datetime.timedelta(minutes=1)
    return time, datetime.timedelta(0)


def parse_time_range(start: str | None, end: str | None) -> tuple[datetime.datetime | None, datetime.datetime | None]:
    """Return the given local times as the start and the end of a range, either of which may be None.

    The end includes the whole of the day or minute it gives, so "2026-10-03" includes all of 3 October and
    "2026-10-03T16:45" includes 16:45:59. Raise ValueError if either time isn't valid.
    """

    start_time = parse_time(start)[0] if start else None
    end_time = None
    if end:
        end_time, precision = parse_time(end)
        if precision:
            end_time += precision - datetime.timedelta(microseconds=1)
    return start_time, end_time


def record_time(record: dict[str, Any]) -> datetime.datetime | None:
    """Return when the given record was made, from its Date, or None if it doesn't have a valid one."""

    try:
        return datetime.datetime.fromisoformat(str(record["Date"]))
    except (KeyError, TypeError, ValueError):
        return None


def records_in_range(records: list[dict[str, Any]],
                     start: datetime.datetime | None,
                     end: datetime.datetime | None) -> list[dict[str, Any]]:
    """Return the records made within the given range. With a range, records without a time are left out."""

    if start is None and end is None:
        return records
    result = []
    for record in records:
        time = record_time(record)
        if time is None:
            continue
        if (start is None or time >= start) and (end is None or time <= end):
            result.append(record)
    return result


def select_columns(records: list[dict[str, Any]], columns: Iterable[str] | None) -> list[dict[str, Any]]:
    """Return the records with only the given columns, or unchanged if columns is None."""

    if columns is None:
        return records
    columns = set(columns)
    return [{key: value for key, value in record.items() if key in columns} for record in records]


def summarize_records(records: list[dict[str, Any]],
                      start: datetime.datetime | None = None,
                      end: datetime.datetime | None = None) -> dict[str, Any]:
    """Return the records' columns, Date first, the times of the first and last records, and how many are in the range."""

    columns = get_unique_keys(records)
    if "Date" in columns:
        columns.remove("Date")
        columns.insert(0, "Date")
    times = [time for time in (record_time(record) for record in records) if time is not None]
    return {"columns": columns,
            "first": min(times).isoformat() if times else None,
            "last": max(times).isoformat() if times else None,
            "count": len(records_in_range(records, start, end))}


# Spreadsheet apps treat a cell starting with one of these as a formula
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def escape_csv_cell(value):
    """Return the value with a leading ' if a spreadsheet app would otherwise treat it as a formula.

    Exported data can include text typed by visitors, which mustn't run when staff open the file.
    """

    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return "'" + value
    return value


def json_list_to_csv(dict_list: list, filename: str = "") -> str:
    """Convert a list JSON dicts to a comma-separated string"""

    # First, identify any keys that have lists as their value
    all_keys = {}
    keys = get_unique_keys(dict_list)
    for key in keys:
        # This function will return an empty list if the value is not a list,
        # and a list of all unique values if it is.
        unique_keys = get_unique_values(dict_list, key)
        if len(unique_keys) > 0:
            all_keys[key] = unique_keys
        else:
            all_keys[key] = None

    # Next, reformat the dict_list so that keys with a list have those values
    # flattened into the main dict level
    reformed_dict_list = []
    for this_dict in dict_list:
        new_dict = {}
        for key, value in this_dict.items():
            if all_keys[key] is None:  # Simple key
                value_to_write = this_dict[key]
                if isinstance(value_to_write, str):
                    value_to_write = value_to_write.replace("\n", " ")
                new_dict[escape_csv_cell(key)] = escape_csv_cell(value_to_write)
            else:
                for sub_key in all_keys[key]:
                    new_dict[escape_csv_cell(key + " - " + sub_key)] = sub_key in this_dict[key]
        reformed_dict_list.append(new_dict)

    # Build the CSV, optionally write it to disk, and then return it
    try:
        with io.StringIO(newline='') as f:
            columns = get_unique_keys(reformed_dict_list)
            # Each row starts with when it was recorded
            if "Date" in columns:
                columns.remove("Date")
                columns.insert(0, "Date")
            csv_writer = csv.DictWriter(f, columns)
            csv_writer.writeheader()
            csv_writer.writerows(reformed_dict_list)
            result = f.getvalue()
    except IndexError:
        print("JSON_list_to_CSV: Error: Nothing to write")
        result = ""

    result = result.strip()

    if filename != "":
        with open(filename, 'w', encoding="UTF-8", newline="") as f:
            f.write(result)
    return result


def get_unique_keys(dict_list: list) -> list:
    """Return a set of unique keys from a list of dicts, sorted for consistency."""

    return sorted(list(set().union(*(d.keys() for d in dict_list))))


def get_unique_values(dict_list: list, key: str) -> list:
    """For a given key, search the list of dicts for all unique values, expanding lists."""

    unique_values = set()

    for this_dict in dict_list:
        if key in this_dict and isinstance(this_dict[key], list):
            for value in this_dict[key]:
                unique_values.add(value)

    return list(unique_values)


def is_url(filename: str) -> bool:
    """Identify if the given filename is a URL."""

    if not isinstance(filename, str):
        return False

    parsed = urllib.parse.urlparse(filename)
    return parsed.scheme in ["http", "https", "file", "ftp", "imap", "nntp"]


def get_file_size(path: str) -> (int, str):
    """Return the size of the specified file.

    Returns a tuple of (size_in_bytes, human_readable)
    """

    file_size = os.path.getsize(path)  # in bytes
    return file_size, convert_bytes_to_readable(file_size)


def convert_bytes_to_readable(file_size: int | float) -> str:
    """Convert the given file size in bytes to a human-readable string."""

    if file_size > 1e12:
        size_text = str(round(file_size / 1e12 * 100) / 100) + ' TB'
    elif file_size > 1e9:
        size_text = str(round(file_size / 1e9 * 100) / 100) + ' GB'
    elif file_size > 1e6:
        size_text = str(round(file_size / 1e6 * 10) / 10) + ' MB'
    elif file_size > 1e3:
        size_text = str(round(file_size / 1e3)) + ' kB'
    else:
        size_text = str(file_size) + ' bytes'

    return size_text


def get_mimetype(filename: str) -> str:
    """Return the kind of media file given by filename."""

    extension = os.path.splitext(filename)[1].lower()[1:]  # form of "jpg"

    # First, try the mimetypes module
    mimetype_guess, _ = mimetypes.guess_type(filename)
    try:
        mimetype = mimetype_guess.split("/")[0]
    except AttributeError:
        mimetype = ""

    # Check for 3D models
    if extension in ["fbx", "glb", "obj", "stl", "usdz"]:
        return "model"

    if mimetype is not None and mimetype != "":
        return mimetype

    return ""


def load_json(path: str) -> dict[str, Any] | list | None:
    """Load the requested JSON file from disk and return it as a dictionary."""

    if not os.path.exists(path):
        if config.debug:
            logging.error(f"load_json: file does not exist: {path}")
        return None

    with config.json_file_lock:
        try:
            with open(path, 'r', encoding='UTF-8') as f:
                result = json.load(f)
        except (OSError, IOError, UnicodeDecodeError) as e:
            logging.error(f"load_json: Failed to read file {path}: {e}")
            result = None
        except json.decoder.JSONDecodeError as e:
            logging.error(f"load_json: Invalid JSON in file {path}: {e}")
            result = None
    return result


def write_json(data: dict[str, Any] | list,
               path: str | os.PathLike,
               append: bool = False,
               indent: int | str | None = 2) -> tuple[bool, str]:
    """Take the given dictionary and try to write it to a JSON file.

    Unless appending, the file is replaced atomically: if the write is interrupted,
    the file keeps its previous contents rather than being left empty or truncated.
    """

    success = True
    reason = ""

    # Serialize first, so that bad data can't damage the existing file
    try:
        json_str = json.dumps(data, indent=indent, sort_keys=True) + "\n"
    except TypeError:
        logging.error(f"write_json: Data is not JSON serializable ({path})")
        return False, "Data is not JSON serializable"

    try:
        with config.json_file_lock:
            if append:
                with open(path, 'a', encoding='UTF-8') as f:
                    f.write(json_str)
            else:
                replace_file_contents(path, json_str)
    except FileNotFoundError:
        success = False
        reason = f"File {path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {path}"

    if not success:
        logging.error(f"write_json: {reason}")
    return success, reason


def replace_file_contents(path: str | os.PathLike, text: str) -> None:
    """Atomically replace the contents of the file at path with text.

    The text is written to a hidden temporary file in the same directory, which then
    replaces the original in a single step.
    """

    directory, filename = os.path.split(os.fspath(path))
    temp_path = os.path.join(directory, f".{filename}.{uuid.uuid4().hex}.tmp")

    try:
        with open(temp_path, 'w', encoding='UTF-8') as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())  # Make sure the data is on disk before the swap
        if os.path.exists(path):
            shutil.copymode(path, temp_path)
        os.replace(temp_path, path)
    except BaseException:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


def write_text(data: str, file_path: str, mode: str = "a") -> tuple[bool, str]:
    """Write an unformatted string to file"""

    if not filename_safe(pathlib.Path(file_path).name):
        return False, "Invalid character in filename"

    success = True
    reason = ""

    if mode != "a" and mode != "w":
        return False, "Mode must be either 'a' (append, [default]) or 'w' (overwrite)"

    try:
        with config.text_file_lock:
            with open(file_path, mode, encoding="UTF-8") as f:
                f.write(data + "\n")
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {file_path}"

    return success, reason


def get_text(file_path: str) -> tuple[str, bool, str]:
    """Return the contents of a text file."""

    if not filename_safe(pathlib.Path(file_path).name):
        return "", False, "Invalid character in filename"

    result = ""
    success = True
    reason = ""

    try:
        with config.text_file_lock:
            with open(file_path, "r", encoding='UTF-8') as f:
                result = f.read()
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} not found."
    except PermissionError:
        success = False
        reason = f"You do not have read permission for the file {file_path}"

    return result, success, reason


def create_zip(zip_filename: str, files_to_zip: [str]) -> bool:
    """Create a zip archive of the given files"""

    zip_filename = with_extension(zip_filename, 'zip')

    with zipfile.ZipFile(get_path(["temp", zip_filename], user_file=True), 'w') as myzip:
        for file in files_to_zip:
            file_path = get_path(["content", file], user_file=True)
            if os.path.exists(file_path):
                myzip.write(file_path, arcname=file)

    return True


def get_directory_contents(directory: list[str]) -> list:
    """Return the contents of a directory."""

    content_path = get_path(directory, user_file=True)
    contents = os.listdir(content_path)
    return [x for x in contents if x[0] != "."]  # Don't return hidden files


def download_file(url: str, path_to_save: str) -> bool:
    """Download the file at the given url and save it to disk."""

    try:
        with requests.get(url, stream=True, timeout=10) as r:
            try:
                # Check that we received a good response
                r.raise_for_status()
            except requests.HTTPError:
                return False

            with open(path_to_save, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
    except requests.exceptions.ReadTimeout:
        print("download_file: timeout retrieving ", url)
        return False

    return True


def delete_file(file_path) -> dict:
    """Delete the specified file and return a dictionary with the result"""

    response = {"success": False}
    try:
        os.remove(file_path)
        response["success"] = True
    except FileNotFoundError:
        response["reason"] = f"File {file_path} does not exist"
    except PermissionError:
        response["reason"] = f"You do not have permission for the file f{file_path}"
    return response
