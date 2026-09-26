# Standard imports
import datetime
import json
import logging
import os
import shutil
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


    def add_action(self, action: dict[str, Any]) -> (bool, str):
        """Add a new action to the program."""

        action_uuid = action.get('uuid', "")
        if action_uuid == "":
            return False, 'no_uuid'

        time_offset = action.get('time_offset', None)
        if time_offset is None:
            return False, 'no_time_offset'

        action['time_offset_in_seconds'] = time_offset * 60

        with hub_config.programLock:
            self.actions[action_uuid] = action

        return True, ""

    def remove_action(self, action_uuid: str) -> bool:
        """Remove the given action from the program."""

        try:
            with hub_config.programLock:
                del self.actions[action_uuid]
        except KeyError:
            return False
        return True

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


def create_program(details: dict[str, Any], cloned_from: str = "", username: str = "") -> Program:
    """Create a new program and add it to hub_config.program_list"""

    if username != "":
        details["creation_username"] = username
    with hub_config.programLock:
        new_program = Program(details)
        hub_config.program_list.append(new_program)
    if cloned_from != "" and cloned_from != new_program.uuid:
        # Copy any trailer and thumbnail to the new UUID
        if new_program.trailer != '':
            old_path = ex_files.get_path(["programs", "media", new_program.trailer], user_file=True)
            new_trailer = ex_files.with_extension(new_program.uuid + "_trailer", os.path.splitext(new_program.trailer)[1])
            new_path = ex_files.get_path(["programs", "media", new_trailer], user_file=True)
            with hub_config.programLock:
                shutil.copy(old_path, new_path)
                new_program.trailer = new_trailer
        if new_program.thumbnail != '':
            old_path = ex_files.get_path(["programs", "media", new_program.thumbnail], user_file=True)
            new_thumbnail = ex_files.with_extension(new_program.uuid + "_thumbnail", os.path.splitext(new_program.thumbnail)[1])
            new_path = ex_files.get_path(["programs", "media", new_thumbnail], user_file=True)
            with hub_config.programLock:
                shutil.copy(old_path, new_path)
                new_program.thumbnail = new_thumbnail

    hub_config.last_update_time = time.time()
    hub_config.program_list_last_update_date = datetime.datetime.now().isoformat()
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


def delete_program_media_file(files: list[str]) -> None:
    """Delete the given program media files (thumbnail/trailer) from disk."""

    for file in files:
        if not file:
            continue
        file_path = ex_files.get_path(["programs", "media", file], user_file=True)
        print("Deleting program media file:", file)
        with hub_config.programLock:
            try:
                os.remove(file_path)
            except OSError:
                pass


def remove_program(this_uuid: str) -> bool:
    """Remove a Program from hub_config.program_list and delete its media files."""

    program = get_program(this_uuid)
    if program is None:
        return False

    delete_program_media_file([program.thumbnail, program.trailer])

    with hub_config.programLock:
        hub_config.program_list = [x for x in hub_config.program_list if x.uuid != this_uuid]
        save_program_list()

    hub_config.last_update_time = time.time()
    hub_config.program_list_last_update_date = datetime.datetime.now().isoformat()
    return True


def archive_program(this_uuid: str, username: str) -> bool:
    """Move the given program from programs.json to programs/archived.json."""

    program = get_program(this_uuid)
    if program is None:
        return False

    archive_file = ex_files.get_path(["programs", "archived.json"], user_file=True)
    with hub_config.programLock:
        try:
            with open(archive_file, 'r', encoding="UTF-8") as file_object:
                try:
                    archive: list[dict] = json.load(file_object)
                except json.decoder.JSONDecodeError:
                    archive = []
        except FileNotFoundError:
            archive = []

        details = program.get_dict()
        now_date = datetime.datetime.now().isoformat()
        details["archiveDate"] = now_date
        details["last_update_datetime"] = now_date
        details["archivedUsername"] = username
        # Media is about to be deleted from disk, so don't keep dangling references
        details["thumbnail"] = ""
        details["trailer"] = ""

        archive.append(details)

        ex_files.write_json(archive, archive_file)

    # Deletes media files and removes from the active list/save
    remove_program(this_uuid)
    return True


def restore_program(this_uuid: str) -> bool:
    """Move the given program from the archive back to hub_config.program_list."""

    archive_file = ex_files.get_path(["programs", "archived.json"], user_file=True)

    with hub_config.programLock:
        archive_list = ex_files.load_json(archive_file)
        if archive_list is None:
            archive_list = []

        details: dict = next((x for x in archive_list if x["uuid"] == this_uuid), None)

    if details is None:
        return False

    # Drop archive-only fields before recreating the live program
    details = {k: v for k, v in details.items() if k not in ("archiveDate", "archivedUsername")}
    create_program(details)
    with hub_config.programLock:
        save_program_list()

        new_archive = [x for x in archive_list if x["uuid"] != this_uuid]
        ex_files.write_json(new_archive, archive_file)

    return True


# Set up log file
log_path = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)
