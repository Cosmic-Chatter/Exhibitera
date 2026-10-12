# Standard imports
import datetime
import time
from typing import Any
import uuid

# Exhibitera imports
import exhibitera.common.files as ex_files
import exhibitera.hub.config as config
import exhibitera.hub.tools as hub_tools


def refresh_last_update():
    """Note that a new group update has occurred."""

    config.group_list_last_update_date = datetime.datetime.now().isoformat()
    config.last_update_time = time.time()


def create_group(name: str, description: str) -> dict[str, Any]:
    """Create a new group, add it to the list, and return its details."""

    if config.group_list is None:
        config.group_list = []

    uuid_str = str(uuid.uuid4())
    group = {
        "name": name,
        "description": description,
        "uuid": uuid_str
    }
    config.group_list.append(group)
    save_groups()
    refresh_last_update()

    return group


def edit_group(uuid_str: str, name: str | None = None, description: str | None = None) -> bool:
    """Try to edit a group and return whether the group was found."""

    match = False
    for group in config.group_list:
        if group["uuid"] == uuid_str:
            match = True
            if name is not None:
                group["name"] = name
            if description is not None:
                group["description"] = description
            break
    save_groups()
    refresh_last_update()
    return match


def _read_archive() -> list[dict[str, Any]]:
    """Return the contents of the group archive, or an empty list if it is missing or blank."""

    archive_file = ex_files.get_path(["configuration", "groups_archived.json"], user_file=True)

    archive = ex_files.load_json(archive_file)
    if archive is None:
        archive = []

    return archive


def _write_archive(archive: list[dict[str, Any]]) -> None:
    """Write the archive back to disk."""

    archive_file = ex_files.get_path(["configuration", "groups_archived.json"], user_file=True)
    ex_files.write_json(archive, archive_file)


def archive_group(uuid_str: str, username: str = "") -> bool:
    """Move the given group from groups.json to the archive. Return whether the group was found."""

    with config.groupLock:
        group = get_group(uuid_str)
        if group is None:
            return False

        details = group.copy()
        details["archiveDate"] = datetime.datetime.now().isoformat()
        details["archivedUsername"] = username

        archive = _read_archive()
        archive.append(details)
        _write_archive(archive)

        config.group_list = [x for x in config.group_list if x["uuid"] != uuid_str]
        save_groups()

    refresh_last_update()
    return True


def restore_group(uuid_str: str) -> bool:
    """Move the given group from the archive back to the group list."""

    with config.groupLock:
        archive = _read_archive()
        group = next((x for x in archive if x["uuid"] == uuid_str), None)
        if group is None:
            return False

        restored = {k: v for k, v in group.items() if k not in ("archiveDate", "archivedUsername")}

        if config.group_list is None:
            config.group_list = []
        if not any(x["uuid"] == uuid_str for x in config.group_list):
            config.group_list.append(restored)
        save_groups()

        _write_archive([x for x in archive if x["uuid"] != uuid_str])

    refresh_last_update()
    return True


def get_archived_groups() -> list[dict[str, Any]]:
    """Return the list of archived groups."""

    with config.groupLock:
        return _read_archive()


def get_group(uuid_str: str) -> dict[str, Any] | None:
    """Return the details of the specified group."""

    match = [x for x in config.group_list if x["uuid"] == uuid_str]

    if len(match) == 1:
        return match[0]
    return None


def save_groups():
    """Save the group list to groups.json"""

    groups_path = ex_files.get_path(["configuration", "groups.json"], user_file=True)
    ex_files.write_json(config.group_list, groups_path)


def load_groups():
    """Load groups.json and store it in apps_config."""

    groups_path = ex_files.get_path(["configuration", "groups.json"], user_file=True)
    config.group_list = ex_files.load_json(groups_path)
    refresh_last_update()
