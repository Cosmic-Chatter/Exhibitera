# Standard imports
import datetime
import time
from typing import Any
import uuid

# Exhibitera imports
import config
import exhibitera_tools as c_tools


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


def edit_group(uuid_str, name: str | None = None, description: str | None = None) -> bool:
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


def delete_group(uuid_str: str):
    """Delete a group from the group_list"""

    config.group_list = [x for x in config.group_list if x["uuid"] != uuid_str]
    save_groups()
    refresh_last_update()


def get_group(uuid_str: str) -> dict[str, Any] | None:
    """Return the details of the specified group."""

    match = [x for x in config.group_list if x["uuid"] == uuid_str]

    if len(match) == 1:
        return match[0]
    return None


def save_groups():
    """Save the group list to groups.json"""

    groups_path = c_tools.get_path(["configuration", "groups.json"], user_file=True)
    c_tools.write_json(config.group_list, groups_path)


def load_groups():
    """Load groups.json and store it in config."""

    groups_path = c_tools.get_path(["configuration", "groups.json"], user_file=True)
    config.group_list = c_tools.load_json(groups_path)
    refresh_last_update()
