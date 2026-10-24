# Standard modules
import time
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Depends

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.exhibitions as hub_exhibitions
import exhibitera.hub.tools as hub_tools
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/exhibition")


@router.post("/create", dependencies=[Depends(hub_users.require_permission("exhibits", "edit"))])
async def create_exhibition(name: str = Body(description="The name of the exhibition."),
                         clone_from: str | None = Body(default=None, description="The name of the exhibition to clone.")):
    """Create a new exhibition JSON file."""

    uuid_str = hub_exhibitions.create_exhibition(name, clone_from)
    return {"success": True, "reason": "", "uuid": uuid_str}


@router.post("/{uuid_str}/edit", dependencies=[Depends(hub_users.require_permission("exhibits", "edit"))])
async def edit_exhibition(uuid_str: str,
                       details: dict[str, Any] = Body(
                           description="A dictionary specifying the details of the exhibition.", embed=True)):
    """Update the given exhibition with the specified details."""

    path = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, '.json')], user_file=True)
    ex_files.write_json(details, path)
    hub_exhibitions.check_available_exhibitions()
    hub_config.last_update_time = time.time()

    return {"success": True, "reason": ""}


@router.post("/applyModifications", dependencies=[Depends(hub_users.require_permission("exhibits", "edit"))])
async def apply_exhibition_modifications():
    """Update any modifications to the current exhibition."""

    hub_exhibitions.update_exhibition_from_modifications()
    return {"success": True}


@router.get("/modifications", dependencies=[Depends(hub_users.require_permission("exhibits", "view"))])
async def get_exhibition_modifications():
    """Update any modifications to the current exhibition."""

    return {"success": True, "modifications": hub_config.exhibit_modifications}


@router.delete("/modifications", dependencies=[Depends(hub_users.require_permission("exhibits", "edit"))])
async def delete_exhibition_modifications(
        to_remove: list[str] = Body(description="Component UUIDs of modifications to remove", embed=True)
):
    """Delete the given modifications from the modification list."""

    hub_exhibitions.remove_modifications(to_remove)
    return {"success": True}


@router.delete("/{uuid_str}", dependencies=[Depends(hub_users.require_permission("exhibits", "edit"))])
async def delete_exhibition(uuid_str: str):
    """Delete the specified exhibition."""

    hub_exhibitions.delete_exhibition(uuid_str)
    return {"success": True, "reason": ""}


@router.post("/{uuid_str}/set", dependencies=[Depends(hub_users.require_permission("exhibits", "edit"))])
async def set_exhibition(uuid_str: str):
    """Set the specified exhibition as the current one."""

    hub_tools.update_system_configuration({"current_exhibit": uuid_str})
    success, reason = hub_exhibitions.load_exhibition(uuid_str)
    return {"success": success, "reason": reason}


@router.get("/available", dependencies=[Depends(hub_users.require_user)])
async def get_available_exhibitions():
    """Return a list of available exhibitions."""

    return {"success": True, "available_exhibits": hub_config.exhibit_list}


@router.get("/{uuid_str}/details", dependencies=[Depends(hub_users.require_user)])
async def get_exhibition_details(uuid_str: str):
    """Return the JSON for a particular exhibition."""

    exhibit_path = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, 'json')], user_file=True)
    result = ex_files.load_json(exhibit_path)
    if result is None:
        return {"success": False, "reason": "Exhibition does not exist."}
    return {"success": True, "exhibit": result}