"""Functions enabling the Exhibitera Flexible Tracker."""

# Standard modules
import configparser
import csv
import io
import json
import logging
import os
from typing import Union

# Exhibitera modules
import config
import exhibitera_tools as c_tools


def create_CSV(file_path: Union[str, os.PathLike], filename: str = "") -> str:
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
    return JSON_list_to_CSV(dict_list, filename=filename)


def create_template(file_path: Union[str, os.PathLike], template: dict) -> bool:
    """Given a template dictionary, write it to file"""

    parser = configparser.ConfigParser()
    parser.read_dict(template)
    with config.trackerTemplateWriteLock:
        try:
            with open(file_path, "w", encoding="UTF-8") as f:
                parser.write(f)
            return True
        except PermissionError:
            return False


def get_layout_definition(name: str, kind: str = "flexible-tracker") -> tuple[dict, bool, str]:
    """Load a given INI file and return a dictionary defining a tracker template."""

    layout = configparser.ConfigParser(delimiters="=")
    layout_definition = {}
    success = True
    reason = ""
    try:
        template_path = c_tools.get_path([kind, "templates", name], user_file=True)
        layout.read(template_path)
        layout_definition = {s: dict(layout.items(s)) for s in layout.sections()}
    except configparser.DuplicateSectionError:
        success = False
        reason = "There are two sections with the same name!"

    return layout_definition, success, reason


def get_raw_text(name: str, kind: str = 'flexible-tracker') -> tuple[str, bool, str]:
    """Return the contents of a text file."""

    file_path = c_tools.get_path([kind, "data", name], user_file=True)
    success = True
    reason = ""
    result = ""

    try:
        with config.trackingDataWriteLock:
            with open(file_path, "r", encoding='UTF-8') as f:
                result = f.read()
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} not found."
    except PermissionError:
        success = False
        reason = f"You do not have read permission for the file {file_path}"

    return result, success, reason


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


def JSON_list_to_CSV(dict_list: list, filename: str = "") -> str:
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

    if filename != "":
        with open(filename, 'w', encoding="UTF-8", newline="") as f:
            f.write(result)
    return result


def write_JSON(data: dict, file_path: Union[str, os.PathLike]) -> tuple[bool, str]:
    """Take a dictionary, convert it to JSON and append it to the appropriate file."""

    success = True
    reason = ""

    try:
        with config.trackingDataWriteLock:
            with open(file_path, "a", encoding='UTF-8') as f:
                json_str = json.dumps(data)
                f.write(json_str + "\n")
    except TypeError:
        success = False
        reason = "Data is not JSON serializable"
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {file_path}"

    return success, reason


def write_raw_text(data: str, name: str, kind: str = "flexible-tracker", mode: str = "a") -> tuple[bool, str]:
    """Write an un-formatted string to file"""

    file_path = c_tools.get_path([kind, "data", name], user_file=True)
    success = True
    reason = ""

    if mode != "a" and mode != "w":
        return False, "Mode must be either 'a' (append, [default]) or 'w' (overwrite)"

    try:
        with config.trackingDataWriteLock:
            with open(file_path, mode, encoding="UTF-8") as f:
                f.write(data + "\n")
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {file_path}"

    return success, reason


# Set up log file
log_path = c_tools.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)