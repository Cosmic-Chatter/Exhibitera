# Standard imports
import datetime
import logging
import os
import platform
import sys
import threading
from typing import Any

# Non-standard imports
import dateutil.parser
import distro
import requests

# Exhibitera imports
import exhibitera.common.files as ex_files
import exhibitera.common.utilities as ex_utilities
import exhibitera.apps.config as apps_config

# Set up log file
log_path: str = ex_files.get_path(["apps.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)


def reboot():
    """Send an OS-appropriate command to restart the computer"""

    reboot_allowed = apps_config.defaults["permissions"].get("restart", True)
    if reboot_allowed:
        print("Rebooting...")
        if sys.platform == "darwin":  # MacOS
            os.system("osascript -e 'tell app \"System Events\" to restart'")
        elif sys.platform == "linux":
            os.system("systemctl reboot -i")
        elif sys.platform == "win32":
            os.system("shutdown -t 0 -r")
    else:
        print("Restart requested but not permitted by current permissions.")


def shutdown():
    """Send an OS-appropriate command to shut down the computer.

    If shutdown is not allowed, call sleep_display() to put the display to sleep"""

    shutdown_allowed = apps_config.defaults["permissions"].get("shutdown", False)
    sleep_allowed = apps_config.defaults["permissions"].get("sleep", False)

    if shutdown_allowed:
        print("Shutting down...")
        if sys.platform == "darwin":  # MacOS
            os.system("osascript -e 'tell app \"System Events\" to shutdown'")
        elif sys.platform == "linux":
            os.system("systemctl shutdown -i")
        elif sys.platform == "win32":
            os.system("shutdown -t 0 -s")
    elif sleep_allowed:
        print("Shutdown requested but not permitted. Sleeping displays...")
        sleep_display()
    else:
        logging.info( "Shutdown requested but not permitted by configuration.")


def sleep_display():
    if apps_config.defaults["permissions"].get("sleep", False):
        if sys.platform == "darwin":  # MacOS
            os.system("pmset displaysleepnow")
        elif sys.platform == "linux":
            os.system("xset dpms force off")
        elif sys.platform == "win32":
            nircmd_path = ex_files.get_path(["nircmd.exe"])
            os.system(nircmd_path + " monitor async_off")
    else:
        logging.info("Sleep requested but not permitted by configuration.")


def smart_restart_act():
    """Attempt to process a restart by following the rules"""

    if apps_config.smart_restart["mode"] == "off":
        print("Smart Restart off")
        logging.info("Smart Restart (mode: %s): Restart denied (Smart Restart is off)", apps_config.smart_restart["mode"])
        return
    elif apps_config.smart_restart["mode"] == "aggressive":
        # In aggressive mode, we reboot right away
        logging.info("Smart Restart (mode: %s): restarting now.", apps_config.smart_restart["mode"])
        reboot()
    elif apps_config.smart_restart["mode"] == "patient":
        # In patient mode, we only restart when not in active hours
        now = datetime.datetime.now()
        active_start = dateutil.parser.parse(apps_config.smart_restart["active_hours_start"])
        active_end = dateutil.parser.parse(apps_config.smart_restart["active_hours_end"])

        if now < active_start or now > active_end:
            logging.info("Smart Restart (mode: %s): restarting now.", apps_config.smart_restart["mode"])
            reboot()
        else:
            logging.info("Smart Restart (mode: %s): Restart denied (in active hours). Active hours: %s - %s",
                         apps_config.smart_restart["mode"],
                         active_start,
                         active_end)
            print("Patient reboot denied by active hours")


def smart_restart_check():
    """Restart the PC if we have lost connection to Hub. This is often because the Wi-Fi has dropped."""

    # Start the next cycle immediately, so that a subsequent error can't disable Smart Restart
    timer = threading.Timer(apps_config.smart_restart["interval"], smart_restart_check)
    timer.daemon = True
    timer.start()

    if apps_config.defaults["system"]["standalone"] is True:
        return

    # Then, ping the server
    headers = {'Content-type': 'application/json'}

    server_address = f'http://{apps_config.defaults["control_server"]["ip_address"]}:{apps_config.defaults["control_server"]["port"]}'
    error = False
    try:
        _ = requests.get(server_address + '/system/checkConnection', headers=headers, timeout=5)
    except (ConnectionError, requests.exceptions.RequestException):
        error = True

    if not error:
        apps_config.smart_restart["last_contact_datetime"] = datetime.datetime.now()
    else:
        # Connection check failed, so let's see how long it has been
        sec_since_last_contact = (datetime.datetime.now() - apps_config.smart_restart["last_contact_datetime"]).total_seconds()
        logging.warning("Connection check failed. Seconds since last connection: %s", sec_since_last_contact)
        print(f"Smart Restart: connection check to address {server_address} failed. Seconds since last connection: {sec_since_last_contact}")
        if sec_since_last_contact > apps_config.smart_restart["threshold"]:
            # A reboot may be necessary
            logging.warning("Smart Restart: Threshold exceeded, recommending reboot.")
            smart_restart_act()


def wake_display():
    """Wake the display up or power it on"""

    if sys.platform == "darwin":  # MacOS
        os.system("caffeinate -u -t 2")
    elif sys.platform == "linux":
        os.system("xset dpms force on")
    elif sys.platform == "win32":
        nircmd_path = ex_files.get_path(["nircmd.exe"])
        os.system(nircmd_path + " sendkeypress ctrl")


def get_platform_details() -> dict[str, Any]:
    """Retrieve basic information about the platform."""

    details = {
        "architecture": platform.architecture()[0],
        "os_version": platform.release()
    }

    os_name = sys.platform
    if os_name == "darwin":
        os_name = 'macOS'
    elif os_name == "win32":
        os_name = "Windows"
    details["os"] = os_name

    outdated, message = ex_utilities.check_for_outdated_os()
    if outdated:
        details["outdated"] = True
        details["outdated_message"] = message

    return details
