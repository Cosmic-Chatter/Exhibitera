"""Helper functions for Hub."""

# Standard imports
import logging
import os
import threading
from typing import Any

# Non-standard imports
import psutil

# Exhibitera imports
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config


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


def load_system_configuration(from_dict: dict[str, Any] | None = None) -> None:
    """Read system.json and set up apps_config."""

    if from_dict is None:
        config_path = ex_files.get_path(["configuration", "system.json"], user_file=True)
        system = ex_files.load_json(config_path)
    else:
        system = from_dict

    hub_config.current_exhibit = system.get("current_exhibit", "Default")
    hub_config.port = system.get("port", 8082)
    hub_config.ip_address = system.get("ip_address", "localhost")
    hub_config.gallery_name = system.get("gallery_name", "")
    ex_config.debug = system.get("debug", False)

    if ex_config.debug:
        logging.getLogger('uvicorn').setLevel(logging.DEBUG)
    else:
        logging.getLogger('uvicorn').setLevel(logging.ERROR)


def update_system_configuration(update: dict[str, Any]) -> None:
    """Take a dictionary of updates and use it to update system.json"""

    system_path = ex_files.get_path(["configuration", "system.json"], user_file=True)
    new_config = ex_files.load_json(system_path) | update  # Use new merge operator
    ex_files.write_json(new_config, system_path)

    load_system_configuration(from_dict=new_config)


def start_debug_loop() -> None:
    """Begin printing debug information"""

    timer = threading.Timer(10, print_debug_details)
    timer.daemon = True
    timer.start()


def print_debug_details() -> None:
    """Print useful debug info to the console"""

    if ex_config.debug is False:
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
