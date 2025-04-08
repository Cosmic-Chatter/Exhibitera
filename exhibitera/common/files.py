# Shared file functions for Hub and Apps

# Standard modules
import csv
import io
import json
import logging
import mimetypes
import os
import sys
from typing import Any
import urllib

import exhibitera.common.config as config


def get_path(path_list: list[str], user_file: bool = False) -> str:
    """Return a path that takes into account whether the app has been packaged by Pyinstaller"""

    _path = os.path.join(config.application_path, *path_list)
    if getattr(sys, 'frozen', False) and not user_file:
        # Handle the case of a Pyinstaller --onefile binary
        _path = os.path.join(config.exec_path, *path_list)
    return _path


def with_extension(filename: str, ext: str) -> str:
    """Return the filename with the current extension replaced by the given one"""

    if ext.startswith("."):
        ext = ext[1:]

    return os.path.splitext(filename)[0] + "." + ext


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


def create_csv(file_path: str | os.PathLike, filename: str = "") -> str:
    """Load a tracker text file and convert it to a CSV"""

    dict_list = []
    try:
        with open(file_path, 'r', encoding="UTF-8") as f:
            for line in f.readlines():
                try:
                    dict_list.append(json.loads(line))
                except json.decoder.JSONDecodeError:
                    print("createCSV: error: skipping line with invalid JSON: " + line)
                    pass
    except FileNotFoundError:
        return ""
    return json_list_to_csv(dict_list, filename=filename)


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
                new_dict[key] = value_to_write
            else:
                for sub_key in all_keys[key]:
                    new_dict[key + " - " + sub_key] = sub_key in this_dict[key]
        reformed_dict_list.append(new_dict)

    # Build the CSV, optionally write it to disk, and then return it
    try:
        with io.StringIO(newline='') as f:
            csv_writer = csv.DictWriter(f, get_unique_keys(reformed_dict_list))
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
        except (OSError, IOError) as e:
            logging.error(f"load_json: Failed to read file {path}: {e}")
            result = None
        except json.decoder.JSONDecodeError as e:
            logging.error(f"load_json: Invalid JSON in file {path}: {e}")
            result = None
    return result


def write_json(data: dict[str, Any] | list,
               path: str | os.PathLike,
               append: bool = False,
               indent: int | str | None = 2):
    """Take the given dictionary and try to write it to a JSON file."""

    success = True
    reason = ""

    if append:
        mode = 'a'
    else:
        mode = 'w'

    try:
        with config.json_file_lock:
            with open(path, mode, encoding='UTF-8') as f:
                json_str = json.dumps(data, indent=indent, sort_keys=True)
                f.write(json_str + "\n")
    except TypeError:
        success = False
        reason = "Data is not JSON serializable"
    except FileNotFoundError:
        success = False
        reason = f"File {path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {path}"

    return success, reason


# Set up log file
log_path: str = get_path(["common.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)