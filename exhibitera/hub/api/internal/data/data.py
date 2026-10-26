# Standard modules
import os
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Depends

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.tools as hub_tools
import exhibitera.hub.features.users as hub_users


router = APIRouter(prefix='/data')


@router.delete("/{name}", dependencies=[Depends(hub_users.require_permission("analytics", "edit"))])
async def delete_data(
        name: str
):
    """Delete the specified data file."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}

    data_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)

    with ex_config.text_file_lock:
        return ex_files.delete_file(data_path)


@router.get("/list", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
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
                      data: dict[str, Any] = Body(description="The data to be appended.", embed=True)
                      ):
    """Record the submitted data to file."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    success, reason = ex_files.write_json(data, file_path, append=True, indent=None)
    return {"success": success, "reason": reason}


@router.get("/{name}/csv", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
async def get_tracker_data_csv(name: str):
    """Return the requested data file as a CSV string."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}

    data_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    if not os.path.exists(data_path):
        return {"success": False, "reason": f"File {name}.txt does not exist!", "csv": ""}
    result = ex_files.create_csv(data_path)
    return {"success": True, "csv": result}
