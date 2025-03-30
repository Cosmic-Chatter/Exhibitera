"""Helper functions for Hub."""

# Standard imports
import json
import logging
import os
import sys
import threading
import _thread
from typing import Any, Union

# Non-standard imports
import psutil

# Exhibitera imports
import config


def get_path(path_list: list[str], user_file: bool = False) -> str:
    """Return a path that takes into account whether the app has been packaged by Pyinstaller"""

    _path = os.path.join(config.APP_PATH, *path_list)
    if getattr(sys, 'frozen', False) and not user_file:
        # Handle the case of a Pyinstaller --onefile binary
        _path = os.path.join(config.EXEC_PATH, *path_list)

    return _path


def path_safe(path: list[str]) -> bool:
    """Ensure the given path doesn't escape the Exhibitera Apps directory.

    `path` should be a list of directories, which should not include any path separators.
    """

    if len(path) == 0:
        return False

    if path[0] not in ['content', 'data', 'definitions', 'thumbnails']:
        return False

    for item in path:
        if not isinstance(item, str):
            return False
        for char in ['/', '\\', '<', '>', ':', '"', '|', '?', '*']:
            if char in item:
                return False
        if item in ['.', '..']:
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


def clear_terminal() -> None:
    """Clear the terminal"""

    os.system('cls' if os.name == 'nt' else 'clear')


def deep_merge(source: dict, destination: dict):
    """ Merge  a series of nested dictionaries. Merge source INTO destination

    From https://stackoverflow.com/questions/20656135/python-deep-merge-dictionary-data/20666342#20666342
    """

    for key, value in source.items():
        if isinstance(value, dict):
            # get node or create one
            node = destination.setdefault(key, {})
            deep_merge(value, node)
        else:
            destination[key] = value
    return destination


def load_json(path: str) -> dict[str, Any] | None:
    """Load the requested JSON file from disk and return it as a dictionary."""

    if not os.path.exists(path):
        if config.debug:
            print(f"load_json: file does not exist: {path}")
        return None

    with config.galleryConfigurationLock:
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


def write_json(data,
               path: str,
               append: bool = False,
               indent: int | str | None = 2,
               newline: bool = False) -> tuple[bool, str]:
    """Take the given object and try to write it to a JSON file.

    Setting newline=True adds a newline character before the JSON is written
    """

    if append:
        mode = 'a'
    else:
        mode = 'w'

    success = True
    reason = ""

    try:
        with config.galleryConfigurationLock:
            with open(path, mode, encoding='UTF-8') as f:
                if newline is True:
                    f.write('\n')
                json.dump(data, f, indent=indent, sort_keys=True)
    except TypeError:
        success = False
        reason = "Data is not JSON serializable"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {path}"

    return success, reason


def load_system_configuration(from_dict: Union[dict[str, Any], None] = None) -> None:
    """Read system.json and set up ex_config."""

    if from_dict is None:
        config_path = get_path(["configuration", "system.json"], user_file=True)
        system = load_json(config_path)
    else:
        system = from_dict

    config.current_exhibit = system.get("current_exhibit", "Default")
    config.port = system.get("port", 8082)
    config.ip_address = system.get("ip_address", "localhost")
    config.gallery_name = system.get("gallery_name", "")
    config.debug = system.get("debug", False)

    if config.debug:
        logging.getLogger('uvicorn').setLevel(logging.DEBUG)
    else:
        logging.getLogger('uvicorn').setLevel(logging.ERROR)


def update_system_configuration(update: dict[str, Any]) -> None:
    """Take a dictionary of updates and use it to update system.json"""

    system_path = get_path(["configuration", "system.json"], user_file=True)
    new_config = load_json(system_path) | update  # Use new merge operator
    write_json(new_config, system_path)

    load_system_configuration(from_dict=new_config)


def start_debug_loop() -> None:
    """Begin printing debug information"""

    timer = threading.Timer(10, print_debug_details)
    timer.daemon = True
    timer.start()


def print_debug_details() -> None:
    """Print useful debug info to the console"""

    if config.debug is False:
        timer = threading.Timer(10, print_debug_details)
        timer.daemon = True
        timer.start()
        return

    print("================= Debug details =================")
    print(f"Active threads: {threading.active_count()}")
    print([x.name for x in threading.enumerate()])
    print(f"Memory used: {psutil.Process().memory_info().rss/1024/1024} Mb")
    print("=================================================", flush=True)

    timer = threading.Timer(10, print_debug_details)
    timer.daemon = True
    timer.start()


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


def check_file_structure() -> None:
    """Check to make sure we have the appropriate file structure set up"""

    schedules_dir = get_path(["schedules"], user_file=True)
    exhibits_dir = get_path(["exhibits"], user_file=True)

    misc_dirs = {"analytics": get_path(["analytics"], user_file=True),
                 "components": get_path(["components"], user_file=True),
                 "configuration": get_path(["configuration"], user_file=True),
                 "flexible-tracker": get_path(["flexible-tracker"], user_file=True),
                 "flexible-tracker/data": get_path(["flexible-tracker", "data"], user_file=True),
                 "flexible-tracker/templates": get_path(["flexible-tracker", "templates"], user_file=True),
                 "issues": get_path(["issues"], user_file=True),
                 "issues/media": get_path(["issues", "media"], user_file=True),
                 "static": get_path(["static"], user_file=True)}

    try:
        os.listdir(schedules_dir)
    except FileNotFoundError:
        print("Missing schedules directory. Creating now...")
        os.mkdir(schedules_dir)
    except PermissionError:
        print("Error: unable to create 'schedules' directory. Do you have write permission?")

    default_schedule_list = ["monday.json", "tuesday.json",
                             "wednesday.json", "thursday.json",
                             "friday.json", "saturday.json",
                             "sunday.json"]
    for file in default_schedule_list:
        file_path = os.path.join(schedules_dir, file)
        if not os.path.exists(file_path):
            print("Missing schedule file " + file + ". Creating now..." )
            try:
                with open(file_path, 'w', encoding="UTF-8") as f:
                    f.write("{}")
            except PermissionError:
                print("Error: unable to create file in 'schedules' directory. Do you have write permission?")

    try:
        os.listdir(exhibits_dir)
    except FileNotFoundError:
        print("Missing exhibits directory. Creating now...")
        try:
            os.mkdir(exhibits_dir)
            write_json({"name": "Default", "uuid": "Default", "components": [], "commands": []}, get_path(["exhibits", "Default.json"], user_file=True))
        except PermissionError:
            print("Error: unable to create 'exhibits' directory. Do you have write permission?")

    for key in misc_dirs:
        try:
            os.listdir(misc_dirs[key])
        except FileNotFoundError:
            print(f"Missing {key} directory. Creating now...")
            try:
                os.mkdir(misc_dirs[key])
            except PermissionError:
                print(f"Error: unable to create '{key}' directory. Do you have write permission?")


def with_extension(filename: str, ext: str) -> str:
    """Return the filename with the current extension replaced by the given one"""

    if ext.startswith("."):
        ext = ext[1:]

    return os.path.splitext(filename)[0] + "." + ext
