# Standard modules
import time
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.exhibits as hub_exhibit
import exhibitera.hub.features.exhibitions as hub_exhibitions
import exhibitera.hub.tools as hub_tools
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/exhibition")


@router.post("/create")
async def create_exhibition(request: Request,
                         name: str = Body(description="The name of the exhibition."),
                         clone_from: str | None = Body(default=None, description="The name of the exhibition to clone.")):
    """Create a new exhibition JSON file."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    uuid_str = hub_exhibitions.create_exhibition(name, clone_from)
    return {"success": True, "reason": "", "uuid": uuid_str}


@router.post("/{uuid_str}/edit")
async def edit_exhibition(request: Request,
                       uuid_str: str,
                       details: dict[str, Any] = Body(
                           description="A dictionary specifying the details of the exhibition.", embed=True)):
    """Update the given exhibition with the specified details."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    path = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, '.json')], user_file=True)
    ex_files.write_json(details, path)
    hub_exhibitions.check_available_exhibitions()
    hub_config.last_update_time = time.time()

    return {"success": True, "reason": ""}


@router.delete("/{uuid_str}")
async def delete_exhibition(request: Request, uuid_str: str):
    """Delete the specified exhibition."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_exhibitions.delete_exhibition(uuid_str)
    return {"success": True, "reason": ""}


@router.post("/{uuid_str}/set")
async def set_exhibition(uuid_str: str):
    """Set the specified exhibition as the current one."""

    hub_tools.update_system_configuration({"current_exhibit": uuid_str})
    success, reason = hub_exhibitions.load_exhibition(uuid_str)
    return {"success": success, "reason": reason}


@router.get("/available")
async def get_available_exhibitions():
    """Return a list of available exhibitions."""

    return {"success": True, "available_exhibits": hub_config.exhibit_list}


@router.get("/{uuid_str}/details")
async def get_exhibition_details(uuid_str: str):
    """Return the JSON for a particular exhibition."""

    exhibit_path = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, 'json')], user_file=True)
    result = ex_files.load_json(exhibit_path)
    if result is None:
        return {"success": False, "reason": "Exhibition does not exist."}
    return {"success": True, "exhibit": result}