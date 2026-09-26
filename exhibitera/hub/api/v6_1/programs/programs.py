# Standard modules
import aiofiles
import datetime
import glob
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
import exhibitera.hub.features.schedules as hub_schedules
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/program")


@router.post("/create")
async def create_program(
        details: dict[str, Any] = Body(embed=True),
        cloned_from: str = Body(description="Whether this is a clone of another program", default=''),
        permission: dict = Depends(hub_users.require_permission("programs", "edit"))
):
    """Create a new program."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    program = hub_programs.create_program(details, cloned_from=cloned_from, username=permission["user"])
    with hub_config.programLock:
        hub_programs.save_program_list()
    hub_schedules.get_next_scheduled_action()

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


@router.get("/archive/list")
async def get_archived_programs(
        permission: dict = Depends(hub_users.require_permission("programs", "view"))
):
    """Return the list of archived programs."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    archive_file = ex_files.get_path(["programs", "archived.json"], user_file=True)

    with hub_config.programLock:
        archive_list = ex_files.load_json(archive_file)
        if archive_list is None:
            archive_list = []

    return {"success": True, "programs": archive_list}


@router.get("/{this_uuid}")
async def get_program_dict(this_uuid: str):
    """Return a dictionary describing the given program."""

    with hub_config.programLock:
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

    with hub_config.programLock:
        program = hub_programs.get_program(this_uuid)
        if program is None:
            return {"success": False, "reason": "invalid_uuid"}

        try:
            program.update(update)
        except TypeError as e:
            print(e)
            return {"success": False, "reason": "type_mismatch"}

        hub_programs.save_program_list()

    hub_config.program_list_last_update_date = datetime.datetime.now().isoformat()
    hub_schedules.get_next_scheduled_action()


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
    file_base = program_uuid + '_' + purpose
    filename = file_base + ext
    file_path = ex_files.get_path(["programs", "media", filename], user_file=True)

    # First remove any files with the same base (e.g., file_base.mov so we can upload file_base.mp4
    base_path = ex_files.get_path(["programs", "media", file_base + '.*'], user_file=True)
    for old_file in glob.glob(base_path):
        try:
            os.remove(old_file)
        except OSError:
            pass

    # Then, save the new file
    print(f"Saving uploaded file to {file_path}")
    with hub_config.programLock:
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()  # async read
            await out_file.write(content)  # async write

    return {"success": True, "filename": filename}


@router.post("/{program_uuid}/action")
async def update_program_action(
        program_uuid: str,
        permission: dict = Depends(hub_users.require_permission("programs", "edit")),
        action: dict = Body(description="The details of the action", embed=True)
):
    """Add or edit a program action."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    match = hub_programs.get_program(program_uuid)

    if match is None:
        return {"success": False, "reason": "invalid_uuid"}

    success, reason = match.add_action(action)
    if success is True:
        hub_programs.save_program_list()
    else:
        return {"success": False, "reason": reason}

    hub_config.program_list_last_update_date = datetime.datetime.now().isoformat()
    hub_schedules.get_next_scheduled_action()


    return {"success": True, "program": match.get_dict()}


@router.delete("/{program_uuid}/action/{action_uuid}")
async def delete_program_action(
        program_uuid: str,
        action_uuid: str,
        permission: dict = Depends(hub_users.require_permission("programs", "edit"))
):
    """Remove an action from a program."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    match = hub_programs.get_program(program_uuid)

    if match is None:
        return {"success": False, "reason": "invalid_uuid"}

    success = match.remove_action(action_uuid)
    if success is True:
        hub_programs.save_program_list()
    else:
        return {"success": False, "reason": "invalid_action"}

    hub_config.program_list_last_update_date = datetime.datetime.now().isoformat()
    hub_schedules.get_next_scheduled_action()


    return {"success": True, "program": match.get_dict()}


@router.get("/{this_uuid}/checkSchedules")
async def check_program_schedules(
        this_uuid: str,
        permission: dict = Depends(hub_users.require_permission("programs", "view"))
):
    """Return the names of any current/future schedules that reference this program."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    matches = hub_schedules.find_program_schedule_usage(this_uuid)
    return {"success": True, "schedules": matches}


@router.delete("/{this_uuid}")
async def delete_program(
        this_uuid: str,
        permission: dict = Depends(hub_users.require_permission("programs", "edit"))
):
    """Archive the given program and remove its media files."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    program = hub_programs.get_program(this_uuid)
    if program is None:
        return {"success": False, "reason": "invalid_uuid"}

    hub_schedules.remove_program_from_schedules(this_uuid)
    hub_programs.archive_program(this_uuid, permission["user"])
    hub_config.program_list_last_update_date = datetime.datetime.now().isoformat()
    hub_schedules.get_next_scheduled_action()

    return {"success": True}


@router.get("/{this_uuid}/restore")
async def restore_program(
        this_uuid: str,
        permission: dict = Depends(hub_users.require_permission("programs", "edit"))
):
    """Move the given program from the archive to the active program list."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    success = hub_programs.restore_program(this_uuid)
    hub_config.program_list_last_update_date = datetime.datetime.now().isoformat()
    return {"success": success}