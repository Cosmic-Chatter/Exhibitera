# Third-party modules
from fastapi import APIRouter, Body, Depends

# Exhibitera modules
import exhibitera.hub.features.groups as hub_group
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/group")

@router.get("/{uuid_str}/name")
async def get_group_name(
        uuid_str: str,
):
    """Return the name of the group."""

    group = hub_group.get_group(uuid_str)
    if group is not None:
        return {"success": True, "name": group.get("name", uuid_str)}

    # Check if it's in an archived group
    archive = hub_group.get_archived_groups()
    group = next((x for x in archive if x["uuid"] == uuid_str), None)

    if group is not None:
        return {"success": True, "name": group.get("name", uuid_str) + " (archived)"}

    return {"success": False, "name": uuid_str}


@router.get("/{uuid_str}/details")
async def get_group_details(
        uuid_str: str,
        permission: dict = Depends(hub_users.require_permission("settings", "edit"))
):
    """Return the details for the given group."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    group = hub_group.get_group(uuid_str)

    if group is None:
        return {"success": False, "reason": "Group does not exist."}
    return {"success": True, "details": group}


@router.post("/create")
async def create_group(
        name: str = Body(description="The name of the group to create"),
        description: str = Body(description="The description for the group to create."),
        permission: dict = Depends(hub_users.require_permission("settings", "edit"))
):
    """Create a group."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    group = hub_group.create_group(name, description)
    return {"success": True, "uuid": group["uuid"]}


@router.post("/{uuid_str}/edit")
async def edit_group(
        uuid_str: str,
        name: str = Body(description="The name of the group to create", default=None),
        description: str = Body(description="The description for the group to create.", default=None),
        permission: dict = Depends(hub_users.require_permission("settings", "edit"))
):
    """Edit a group"""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    success = hub_group.edit_group(uuid_str, name=name, description=description)
    return {"success": success}


@router.delete("/{uuid_str}")
async def delete_group(
        uuid_str: str,
        permission: dict = Depends(hub_users.require_permission("settings", "edit"))
):
    """Archive the given group."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    success = hub_group.archive_group(uuid_str, permission["user"])
    if not success:
        return {"success": False, "reason": "does_not_exist"}
    return {"success": True}


@router.get("/{uuid_str}/restore")
async def restore_group(
        uuid_str: str,
        permission: dict = Depends(hub_users.require_permission("settings", "edit"))
):
    """Move the given group from the archive back to the group list."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    success = hub_group.restore_group(uuid_str)
    return {"success": success}


@router.get("/archive/list")
async def get_archived_groups(
        permission: dict = Depends(hub_users.require_permission("settings", "view"))
):
    """Return the list of archived groups."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    return {"success": True, "groups": hub_group.get_archived_groups()}