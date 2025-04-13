# Standard modules
import os
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body

# Exhibitera modules
import exhibitera.common.files as ex_files

router = APIRouter(prefix='/data')


@router.get("/")
async def get_available_data():
    """Return a list of files in the /data directory."""

    return {"success": True, "files": ex_files.get_directory_contents(["data"])}


@router.post("/{name}/append")
async def append_data(name: str,
                      data: dict[str, Any] = Body(description="A dictionary of data to be written to file as JSON.", embed=True)):
    """Record the submitted data to file as JSON."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    success, reason = ex_files.write_json(data, file_path, append=True, indent=None)
    response = {"success": success, "reason": reason}
    return response


@router.post("/{name}/rawText")
async def write_raw_text(name: str,
                         text: str = Body(description='The data to write.'),
                         mode: str = Body(description="Pass 'a' to append or 'w' or overwrite.", default='a')):
    """Write the raw text to file.

    Set mode == 'a' to append or 'w' to overwrite the file.
    """

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    if mode != "a" and mode != "w":
        response = {"success": False,
                    "reason": "Invalid mode field: must be 'a' (append, [default]) or 'w' (overwrite)"}
        return response
    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')])
    success, reason = ex_files.write_text(text, file_path, mode=mode)
    response = {"success": success, "reason": reason}
    return response


@router.get("/{name}/rawText")
async def read_raw_text(name: str):
    """Load the given file and return the raw text."""

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    result, success, reason = ex_files.get_text(file_path)

    response = {"success": success, "reason": reason, "text": result}
    return response


@router.get("/{name}/csv")
async def get_tracker_data_csv(name: str):
    """Return the requested data file as a CSV string."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    if not name.lower().endswith(".txt"):
        name += ".txt"
    data_path = ex_files.get_path(["data", name], user_file=True)
    if not os.path.exists(data_path):
        return {"success": False, "reason": f"File {name}.txt does not exist!", "csv": ""}
    result = ex_files.create_csv(data_path)
    return {"success": True, "csv": result}
