"""Functions enabling the Exhibitera Flexible Tracker."""

# Standard modules
import logging
import os

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.tools as hub_tools


def get_layout_definition(template_uuid: str, kind: str = "flexible-tracker") -> tuple[dict, bool, str]:
    """Load a given JSON file and return a dictionary defining a tracker template."""

    template_path = ex_files.get_path(
        [kind, "templates", ex_files.with_extension(template_uuid, 'json')],
        user_file=True)

    if not os.path.exists(template_path):
        return {}, False, 'does_not_exist'

    layout_definition = ex_files.load_json(template_path)

    return layout_definition, True, ''


def get_raw_text(name: str, kind: str = 'flexible-tracker') -> tuple[str, bool, str]:
    """Return the contents of a text file."""

    file_path = ex_files.get_path([kind, "data", name], user_file=True)
    success = True
    reason = ""
    result = ""

    try:
        with hub_config.trackingDataWriteLock:
            with open(file_path, "r", encoding='UTF-8') as f:
                result = f.read()
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} not found."
    except PermissionError:
        success = False
        reason = f"You do not have read permission for the file {file_path}"

    return result, success, reason


def write_raw_text(data: str, name: str, kind: str = "flexible-tracker", mode: str = "a") -> tuple[bool, str]:
    """Write an un-formatted string to file"""

    file_path = ex_files.get_path([kind, "data", name], user_file=True)
    success = True
    reason = ""

    if mode != "a" and mode != "w":
        return False, "Mode must be either 'a' (append, [default]) or 'w' (overwrite)"

    try:
        with hub_config.trackingDataWriteLock:
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
log_path = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)