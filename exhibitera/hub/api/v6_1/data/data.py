# Standard modules
import logging
import os
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.tools as hub_tools
import exhibitera.hub.features.users as hub_users

# Set up log file
log_path: str = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

router = APIRouter(prefix='/data')


@router.delete("/{name}")
async def delete_data(request: Request, name: str):
    """Delete the specified data file."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}

    if name is None or name.strip() == "":
        return {"success": False, "reason": "'name' field is blank."}

    data_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)

    with ex_config.text_file_lock:
        return ex_files.delete_file(data_path)


@router.get("/list")
async def get_available_data():
    """Send a list of all the available data files."""

    data_path = ex_files.get_path(["data"], user_file=True)
    data_list = []
    for file in os.listdir(data_path):
        if file.lower().endswith(".txt"):
            data_list.append(file)
    return {"success": True,  "data": data_list}


@router.post("/{name}/append")
async def append_data(name: str,
                      data: dict[str, Any] = Body(description="The data to be appended.", embed=True),
                      ):
    """Record the submitted data to file."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}

    if name is None or name.strip() == "":
        return {"success": False, "reason": "'name' field is blank."}

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    success, reason = ex_files.write_json(data, file_path, append=True, indent=None)
    return {"success": success, "reason": reason}


@router.post("/{name}/rawText")
async def submit_raw_text(name: str,
                         text: str = Body(description='The data to write.'),
                         mode: str = Body(description="Pass 'a' to append or 'w' or overwrite.", default='a')):
    """Write the raw text to file."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}

    if mode != "a" and mode != "w":
        response = {"success": False,
                    "reason": "Invalid mode field: must be 'a' (append, [default]) or 'w' (overwrite)"}
        return response

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    success, reason = ex_files.write_text(text, file_path, mode=mode)
    return {"success": success, "reason": reason}


@router.get("/{name}/rawText")
async def get_raw_text(name: str):
    """Load the given file and return the raw text."""

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    result, success, reason = ex_files.get_text(file_path)
    return {"success": success, "reason": reason, "text": result}


@router.get("/{name}/csv")
async def get_tracker_data_csv(name: str):
    """Return the requested data file as a CSV string."""

    data_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    if not os.path.exists(data_path):
        return {"success": False, "reason": f"File {name}.txt does not exist!", "csv": ""}
    result = ex_files.create_csv(data_path)
    return {"success": True, "csv": result}