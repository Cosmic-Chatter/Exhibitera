# Standard modules
import copy
import errno
import getpass
import psutil
import os
import socket
import uuid
import shutil
import sys
from typing import Any, Union

# Non-standard modules
from PIL import ImageGrab
from PIL.Image import Image
import requests

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.common.utilities as ex_utilities
import exhibitera.apps.config as apps_config


def get_system_stats() -> dict[str, Union[int, float]]:
    """Return a dictionary with disk space, CPU load, and RAM amount"""

    result = {}

    # Get the percentage the disk is full
    total, used, free = shutil.disk_usage(os.path.abspath(ex_config.application_path))

    result["disk_pct_free"] = round((free / total) * 100)
    result["disK_free_GB"] = round(free / (2 ** 30))  # GB

    # Get CPU load (percent used in the last 1, 5, 15 min) Doesn't work on Windows
    if sys.platform != "win32":
        cpu_load = [x / psutil.cpu_count() * 100 for x in psutil.getloadavg()]
        result["cpu_load_pct"] = round(cpu_load[1])
    else:
        result["cpu_load_pct"] = 0

    # Get memory usage
    result["ram_used_pct"] = round(psutil.virtual_memory().percent)

    return result


def read_defaults() -> bool:
    """Load config.json and set up Exhibitera Apps based on its contents."""

    defaults_path = ex_files.get_path(["configuration", "config.json"], user_file=True)
    apps_config.defaults = ex_files.load_json(defaults_path)
    if apps_config.defaults is None:
        return False

    if "smart_restart" in apps_config.defaults:
        apps_config.smart_restart["mode"] = apps_config.defaults["smart_restart"]["state"]
        apps_config.smart_restart["interval"] = float(apps_config.defaults["smart_restart"]["interval"])
        apps_config.smart_restart["threshold"] = float(apps_config.defaults["smart_restart"]["threshold"])
    if "active_hours" in apps_config.defaults["system"]:
        apps_config.smart_restart["active_hours_start"] = apps_config.defaults["system"]["active_hours"]["start"]
        apps_config.smart_restart["active_hours_end"] = apps_config.defaults["system"]["active_hours"]["end"]

    return True


def update_configuration(data: dict[str, Any], cull: bool = False):
    """Take a dictionary 'data' and write relevant parameters to disk if they have changed.

    If cull == True, remove any entries not included in 'data'
    """

    prior_defaults = copy.deepcopy(apps_config.defaults)

    if prior_defaults is not None and "app" in prior_defaults and "uuid" in prior_defaults["app"]:
        uuid_str = prior_defaults["app"]["uuid"]
    else:
        uuid_str = str(uuid.uuid4())
    if cull is True or prior_defaults is None:
        # Replace the current dictionary with the new one
        new_defaults = data
    else:
        # Merge the new dictionary into the current one
        new_defaults = copy.deepcopy(prior_defaults)
        ex_utilities.deep_merge(data, new_defaults)
    new_defaults["app"]["uuid"] = uuid_str

    if new_defaults == prior_defaults:
        if ex_config.debug:
            print("apps_utilities.update_defaults: no changes to write.")
        return

    apps_config.defaults = new_defaults
    defaults_path = ex_files.get_path(["configuration", "config.json"], user_file=True)
    ex_files.write_json(apps_config.defaults, defaults_path)

    if ex_config.debug:
        print("apps_utilities.update_defaults: update written.")


def capture_screenshot() -> Image | None:
    """Capture a screenshot of the primary display."""

    try:
        image = ImageGrab.grab().convert("RGB")
    except Exception as e:
        print("capture_screenshot: error:", e)
        image = None
    return image


def command_line_setup_print_gui() -> None:
    """Helper to print the header content for the setup tool"""

    ex_utilities.clear_terminal()
    print("################################################################################")
    print("                      Welcome to Exhibitera Apps!")
    print("")
    print("Exhibitera Apps is a collection of software that helps you put your digital")
    print("content front-and-center. It's a powerful yet intuitive way to build guest-")
    print("facing digital interactives for use on the museum floor.")
    print("")
    print("Since this is your first time running Apps in this directory, we need to set up")
    print("a few things before you can get started. If you don't know the answer, or wish")
    print("to accept the default, just press the enter key.")
    print("################################################################################")
    print("")


def handle_missing_defaults_file():
    """Create a stub defaults.ini file and launch setup.html for configuration"""

    """Prompt the user for several pieces of information on first-time setup"""

    defaults = {
        "app": {},
        "control_server": {},
        "permissions": {},
        "system": {
            "remote_display": True
        }
    }

    command_line_setup_print_gui()

    print("Press Enter to continue...")
    _ = input()

    command_line_setup_print_gui()

    print("--- Exhibitera Hub ---")
    print("")
    print("Exhibitera Hub helps you configure and control multiple")
    print("interactives from anywhere in your museum. With Hub, you can:")
    print("  - See the status of every interactive using Apps.")
    print("  - Power on or off many types of projectors.")
    print("  - Create daily schedules that automatically power on or off devices, change")
    print("    digital signage, or even switch interactives.")
    print("  - Collect and log evaluation data and analytics.")
    print("  - Track exhibit maintenance.")
    print("")

    control_server = input("Use Hub [Y/N] (default: N): ").strip()
    if control_server.lower() == "y":
        defaults["system"]["standalone"] = False
    else:
        defaults["system"]["standalone"] = True

    if defaults["system"]["standalone"] is False:
        while True:
            command_line_setup_print_gui()
            print("--- Exhibitera Hub ---")
            print("")
            ip = input("Enter Hub's static IP address (default=localhost): ").strip()
            if ip == "":
                ip = "localhost"
            port = input("Enter Hub's port (default=8082): ").strip()
            if port == "":
                port = 8082
            defaults["control_server"]["ip_address"] = ip
            defaults["control_server"]["port"] = int(port)

            command_line_setup_print_gui()
            print("--- Exhibitera Hub ---")
            print("")
            print('Log in to confirm that you have permission to add components to Hub.')
            user = input('Username: ').strip()
            password = getpass.getpass(prompt="Password: ")
            try:
                result = requests.post(f"http://{ip}:{port}/user/login", json={"credentials": (user, password)}).json()

                if result.get("success", False) is True:
                    # Check if user has required permission
                    if result["user"]["permissions"]["settings"] == 'edit':
                        break
                    print("This user has insufficient permissions. The user must have the Settings")
                    print("permission of 'edit'. ")
                    choice = input("Try again (Y) or continue without Hub (N)? (default: Y): ").strip()
                    if choice != "" and choice != "Y":
                        break
                else:
                    print("The username or password is incorrect.")
                    choice = input("Try again (Y) or continue without Hub (N)? (default: Y): ").strip()
                    if choice != "" and choice != "Y":
                        break
            except requests.exceptions.ConnectionError:
                print("Cannot connect to Exhibitera Hub. Make sure the IP address and port are correct,")
                print("and that Hub is running.")
                choice = input("Try again (Y) or continue without Hub (N)? (default: Y): ").strip()
                if choice != "" and choice != "Y":
                    break

    command_line_setup_print_gui()

    print("--- Select a port ---")
    print("")
    print("After completing setup, you will access Exhibitera Apps using the web address")
    print("http://localhost:[port]. Which network port would you like to use?")
    default_port = find_available_port()

    port_to_use = input(f"Enter port (default={default_port}): ").strip()
    if port_to_use == "":
        port_to_use = default_port
    defaults["system"]["port"] = int(port_to_use)

    if defaults["system"]["standalone"] is False:
        command_line_setup_print_gui()
        print("--- Component Details ---")
        print("")
        print(" Since we're using Hub, we need to identify this component. Each app")
        print("instance needs an ID, which uniquely identifies this component.")
        print("A good ID might be something like 'Sports Intro Video'.")

        this_id = ""
        while this_id == "":
            this_id = input("Enter ID: ").strip()
        defaults["app"]["id"] = this_id

        command_line_setup_print_gui()

        print("--- Screenshots ---")
        print("")
        print("Through the web console on Exhibitera Hub, you can peek at the")
        print("current state of the app by viewing a screenshot. These screenshots are  not")
        print("stored and never leave your local network.")
        print("")

        print("Exhibitera Apps will now check for permission to capture screenshots.")
        _ = input("Press Enter to continue...")
        _ = capture_screenshot()

    update_configuration(defaults, cull=True)


def find_available_port(start: int = 8000) -> int:
    """Find the next available port and return it."""

    this_port = start
    port_available = False
    while port_available is False:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("127.0.0.1", this_port))
            port_available = True
        except socket.error as e:
            if e.errno == errno.EADDRINUSE:
                this_port += 1
            else:
                # Something else raised the socket.error exception
                print(e)

        s.close()
    return this_port
