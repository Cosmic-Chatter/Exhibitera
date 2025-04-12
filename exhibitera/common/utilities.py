"""Utility functions common to Hub and Apps"""

# Standard modules
import datetime
import os
import sys
import threading

# Non-standard modules
import distro
import requests

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files


def clear_terminal() -> None:
    """Clear the terminal"""

    os.system('cls' if os.name == 'nt' else 'clear')


def check_for_software_update(application: str):
    """Download the version file from GitHub and check if there is an update.

    application should be one of 'apps' or 'hub'
    """

    print("Checking for update... ", end="")
    ex_config.software_update["update_available"] = False

    local_dict = ex_files.load_json(ex_files.get_path(["_static", "semantic_version.json"]))
    if local_dict is None:
        print("error. The semantic version file is corrupt and cannot be read.")
        return

    ex_config.software_update["current_version"] = local_dict["version"]
    remote_dict = None
    try:
        if application == "apps":
            version_url = "https://raw.githubusercontent.com/Cosmic-Chatter/Exhibitera/main/exhibitera/apps/_static/semantic_version.json"
        else:
            version_url = "https://raw.githubusercontent.com/Cosmic-Chatter/Exhibitera/main/exhibitera/hub/_static/semantic_version.json"
        response = requests.get(version_url, timeout=2)
        response.raise_for_status()
        remote_dict = response.json()
    except requests.RequestException as e:
        print("cannot connect to update server")
    except ValueError as e:
        print("cannot connect to update server")

    if remote_dict is not None:
        ex_config.software_update["available_version"] = remote_dict["version"]

        # Compare the local and remote versions to check for an update
        if remote_dict["version"]["major"] > local_dict["version"]["major"]:
            ex_config.software_update["update_available"] = True
        elif remote_dict["version"]["major"] < local_dict["version"]["major"]:
            ex_config.software_update["update_available"] = False
        else:
            # Major versions equal
            if remote_dict["version"]["minor"] > local_dict["version"]["minor"]:
                ex_config.software_update["update_available"] = True
            elif remote_dict["version"]["minor"] < local_dict["version"]["minor"]:
                ex_config.software_update["update_available"] = False
            else:
                # Major & minor versions equal
                if remote_dict["version"]["patch"] > local_dict["version"]["patch"]:
                    ex_config.software_update["update_available"] = True
                elif remote_dict["version"]["patch"] <= local_dict["version"]["patch"]:
                    ex_config.software_update["update_available"] = False

        if ex_config.software_update["update_available"]:
            print("update available!")
        else:
            print("the server is up to date.")

    # Check to see if the OS is out of date
    outdated, message = check_for_outdated_os()
    ex_config.outdated_os = outdated

    # Reset the timer to check for an update tomorrow
    if ex_config.software_update_timer is not None:
        ex_config.software_update_timer.cancel()
    ex_config.software_update_timer = threading.Timer(86400, check_for_software_update)
    ex_config.software_update_timer.daemon = True
    ex_config.software_update_timer.start()


def check_for_outdated_os() -> tuple[bool, str]:
    """Check if the OS release is out of date.

    This is a very limited check based on Ubuntu and Windows
    """

    message = "This OS version may be unsupported in the next version of Exhibitera."

    if sys.platform == 'linux':
        # Check for outdated Ubuntu
        if distro.id() != 'ubuntu':
            # We are only checking for Ubuntu right now
            return False, ""

        # Ubuntu LTS versions are supported for 5 years
        version_parts = distro.version_parts(best=True)
        major = int(version_parts[0])
        minor = int(version_parts[1])
        if major % 2 != 0 or minor != 4:
            # LTS releases are always even year + 04, such as 22.04
            return True, message
        now = datetime.datetime.now()
        now_year = int(now.strftime("%y"))
        if now_year - major >= 5:
            # LTS releases are supported for 5 years
            return True, message

    if sys.platform == 'win32':
        return False, ""

    return False, ""


def deep_merge(source: dict, destination: dict) -> dict:
    """Merge  a series of nested dictionaries. Merge source INTO destination

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
