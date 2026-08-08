# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.hub.features.groups as hub_group
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/group")

@router.get("/{uuid_str}/details")
async def get_group_details(request: Request, uuid_str: str):
    """Return the details for the given group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    group = hub_group.get_group(uuid_str)

    if group is None:
        return {"success": False, "reason": "Group does not exist."}
    return {"success": True, "details": group}


@router.post("/create")
async def create_group(request: Request,
                       name: str = Body(description="The name of the group to create"),
                       description: str = Body("The description for the group to create.")):
    """Create a group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    group = hub_group.create_group(name, description)
    return {"success": True, "uuid": group["uuid"]}


@router.post("/{uuid_str}/edit")
async def edit_group(request: Request,
                     uuid_str: str,
                     name: str = Body(description="The name of the group to create", default=None),
                     description: str = Body(description="The description for the group to create.", default=None)):
    """Edit a group"""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success = hub_group.edit_group(uuid_str, name=name, description=description)
    return {"success": success}


@router.delete("/{uuid_str}")
async def delete_group(request: Request, uuid_str: str):
    """Delete the given group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_group.delete_group(uuid_str)
    return {"success": True}