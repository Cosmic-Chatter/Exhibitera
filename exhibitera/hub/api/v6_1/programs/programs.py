# Standard modules
import aiofiles
import json
import os
from typing import Any, Optional
import uuid

# Third-party modules
from fastapi import APIRouter, Body, File, Request, UploadFile

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.programs as hub_programs
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/program")


@router.post("/create")
async def create_program(request: Request, details: dict[str, Any] = Body(embed=True)):
    """Create a new program."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("programs", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    program = hub_programs.create_program(details, username=authorizing_user)
    hub_programs.save_program_list()
    return {"success": True, "uuid": program.uuid}


@router.get("/")
@router.get("/location/{location}")
async def get_program_list(request: Request, location: Optional[str] = None):
    """Return the list of programs, optionally filtered by location."""

    if location:
        matched_programs = [
            x.get_dict() for x in hub_config.program_list if x.location == location
        ]
    else:
        matched_programs = [x.get_dict() for x in hub_config.program_list]

    return {"success": True, "program_list": matched_programs}


@router.get("/{this_uuid}")
async def get_program_list(request: Request, this_uuid: str):
    """Return a dictionary describing the given program."""

    match = hub_programs.get_program(this_uuid)

    if match is None:
        return {"success": False, "reason": "invalid_uuid", "program": {}}

    return {"success": True, "program": match.get_dict()}


@router.post("/{this_uuid}/update")
async def update_program(request: Request,
                         this_uuid: str,
                         update = Body(description="A dictionary of parameters to update matching the fields of hub_programs.Program.", embed=True)):
    """Update the given program with the provided details."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("programs", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    program = hub_programs.get_program(this_uuid)
    if program is None:
        return {"success": False, "reason": "invalid_uuid"}

    try:
        program.update(update)
    except TypeError as e:
        print(e)
        return {"success": False, "reason": "type_mismatch"}

    hub_programs.save_program_list()

    return {"success": True}