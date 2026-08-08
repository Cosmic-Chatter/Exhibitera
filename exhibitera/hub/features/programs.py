# Standard imports
import datetime
import json
import logging
import os
import time
import typing
from typing import Any
import uuid

# Exhibitera imports
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.tools as hub_tools

class Program:
    """A recurring event."""

    def __init__(self, details: dict):
        """Create a new program based on the provided details."""

        self.uuid: str = details.get("uuid", str(uuid.uuid4()))
        self.name: str = details.get("name", "New Program")

        self.description: str = details.get("description", "")
        self.thumbnail: str = details.get("thumbnail", "")
        self.trailer: str = details.get("trailer", "")

        self.location: str = details.get("location", "")
        self.duration: float | int = details.get("duration", 60) # minutes
        self.capacity: int | None = details.get("capacity", None)

        self.actions: dict = details.get("actions", {})

        self.last_update_datetime = details.get("last_update_datetime", datetime.datetime.now().isoformat())
        self.last_update_username = details.get("last_update_username", "")
        self.creation_datetime = details.get("creation_datetime", datetime.datetime.now().isoformat())
        self.creation_username = details.get("creation_username", "")

    def __repr__(self):
        return repr(f"[Program: {self.name}]")

    def update(self, updates: dict) -> None:
        """Update existing attributes with key/value pairs from a dictionary.

        Enforces type compatibility against current values or type annotations,
        supporting Union types like int | float and Optional types.
        """

        for key, value in updates.items():
            if hasattr(self, key):
                setattr(self, key, value)

        # Automatically update last_update_datetime if not explicitly passed
        if "last_update_datetime" not in updates:
            self.last_update_datetime = datetime.datetime.now().isoformat()


    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary representation of this program."""

        return {
            "actions": self.actions,
            "capacity": self.capacity,
            "creation_datetime": self.creation_datetime,
            "creation_username": self.creation_username,
            "description": self.description,
            "duration": self.duration,
            "last_update_datetime": self.last_update_datetime,
            "last_update_username": self.last_update_username,
            "location": self.location,
            "name": self.name,
            "thumbnail": self.thumbnail,
            "trailer": self.trailer,
            "uuid": self.uuid,
        }


def get_program(this_uuid: str, program_list: list[Program] | None = None) -> Program | None:
    """Return the Program matching the given UUID."""

    if program_list is None:
        program_list = hub_config.program_list

    for program in program_list:
        if getattr(program, "uuid", None) == this_uuid:
            return program


def create_program(details: dict[str, Any], username: str = "") -> Program:
    """Create a new program and add it to hub_config.program_list"""

    if username != "":
        details["creation_username"] = username
    with hub_config.programLock:
        new_program = Program(details)
        hub_config.program_list.append(new_program)
    hub_config.last_update_time = time.time()
    return new_program


def read_program_list() -> None:
    """Read programs.json and set up hub_config.program_list"""

    latest_update = datetime.datetime(year=2000, day=1, month=1)

    try:
        programs_file = ex_files.get_path(["programs", "programs.json"], user_file=True)
        with open(programs_file, "r", encoding="UTF-8") as file_object:
            programs = json.load(file_object)

        for program in programs:
            update_datetime = datetime.datetime.fromisoformat(program["last_update_datetime"])
            if update_datetime > latest_update:
                latest_update = update_datetime
            create_program(program)
    except FileNotFoundError:
        print("No stored programs to load")
    except json.decoder.JSONDecodeError:
        print("programs.json is incorrectly formatted or blank.")
        logging.error("programs.json is incorrectly formatted or blank.")
    hub_config.program_list_last_update_date = latest_update


def save_program_list() -> None:
    """Write the current program list to file"""

    program_file = ex_files.get_path(["programs", "programs.json"], user_file=True)

    with open(program_file, "w", encoding="UTF-8") as file_object:
        json.dump([x.get_dict() for x in hub_config.program_list], file_object, indent=2, sort_keys=True)


# Set up log file
log_path = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)
