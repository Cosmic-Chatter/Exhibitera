# Third-party modules
from fastapi import APIRouter, Body, Depends

# Exhibitera modules
import exhibitera.hub.features.groups as hub_group
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/group")

@router.get("/{uuid_str}/name")
async def get_group_name(
        uuid_str: str
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


@router.get("/{uuid_str}/details", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def get_group_details(
        uuid_str: str
):
    """Return the details for the given group."""

    group = hub_group.get_group(uuid_str)

    if group is None:
        return {"success": False, "reason": "Group does not exist."}
    return {"success": True, "details": group}


@router.post("/create", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def create_group(
        name: str = Body(description="The name of the group to create"),
        description: str = Body(description="The description for the group to create.")
):
    """Create a group."""

    group = hub_group.create_group(name, description)
    return {"success": True, "uuid": group["uuid"]}


@router.post("/{uuid_str}/edit", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def edit_group(
        uuid_str: str,
        name: str = Body(description="The name of the group to create", default=None),
        description: str = Body(description="The description for the group to create.", default=None)
):
    """Edit a group"""

    success = hub_group.edit_group(uuid_str, name=name, description=description)
    return {"success": success}


@router.delete("/{uuid_str}", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def delete_group(
        uuid_str: str,
        authorizing_user: str = Depends(hub_users.require_user)
):
    """Archive the given group."""

    success = hub_group.archive_group(uuid_str, authorizing_user)
    if not success:
        return {"success": False, "reason": "does_not_exist"}
    return {"success": True}


@router.post("/{uuid_str}/restore", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def restore_group(
        uuid_str: str
):
    """Move the given group from the archive back to the group list."""

    success = hub_group.restore_group(uuid_str)
    return {"success": success}


@router.get("/archive/list", dependencies=[Depends(hub_users.require_permission("settings", "view"))])
async def get_archived_groups():
    """Return the list of archived groups."""

    return {"success": True, "groups": hub_group.get_archived_groups()}