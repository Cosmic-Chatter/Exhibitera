# Standard modules
import aiofiles
import json
import os
from typing import Any, Optional
import uuid

# Third-party modules
from fastapi import APIRouter, Body, Depends, File, UploadFile

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.programs as hub_programs
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/program")


@router.post("/create")
async def create_program(
        details: dict[str, Any] = Body(embed=True),
        permission: dict = Depends(hub_users.require_permission("programs", "edit"))
):
    """Create a new program."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    program = hub_programs.create_program(details, username=authorizing_user)
    hub_programs.save_program_list()
    return {"success": True, "uuid": program.uuid}


@router.get("/")
@router.get("/location/{location}")
async def get_program_list(location: Optional[str] = None):
    """Return the list of programs, optionally filtered by location."""

    if location:
        matched_programs = [
            x.get_dict() for x in hub_config.program_list if x.location == location
        ]
    else:
        matched_programs = [x.get_dict() for x in hub_config.program_list]

    return {"success": True, "program_list": matched_programs}


@router.get("/{this_uuid}")
async def get_program_list(this_uuid: str):
    """Return a dictionary describing the given program."""

    match = hub_programs.get_program(this_uuid)

    if match is None:
        return {"success": False, "reason": "invalid_uuid", "program": {}}

    return {"success": True, "program": match.get_dict()}


@router.post("/{this_uuid}/update")
async def update_program(
        this_uuid: str,
        update = Body(description="A dictionary of parameters to update matching the fields of hub_programs.Program.", embed=True),
        permission: dict = Depends(hub_users.require_permission("programs", "edit"))
):
    """Update the given program with the provided details."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

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


@router.post("/uploadMedia")
async def upload_program_media(
        file: UploadFile = File(),
        program_uuid: str = Body(description="The UUID of the program this media file is for."),
        purpose: str = Body(description="The purpose of this file. One of ['thumbnail', 'trailer']."),
        permission: dict = Depends(hub_users.require_permission("programs", "edit"))
):
    """Upload a program media file."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    if not ex_files.filename_safe(program_uuid) or not ex_files.filename_safe(purpose):
        return {"success": False, "reason": 'unsafe_filename'}

    program = hub_programs.get_program(program_uuid)
    if program is None:
        return {"success": False, "reason": "invalid_uuid"}

    ext = os.path.splitext(file.filename)[1]
    filename = program_uuid + '_' + purpose + ext
    file_path = ex_files.get_path(["programs", "media", filename], user_file=True)
    print(f"Saving uploaded file to {file_path}")
    with hub_config.programLock:
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()  # async read
            await out_file.write(content)  # async write

    return {"success": True, "filename": filename}
