# Standard modules
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body

# Exhibitera modules
import exhibitera.common.files as ex_files

router = APIRouter(prefix='/data')

@router.post("/{name}/append")
async def append_data(name: str,
                      data: dict[str, Any] = Body(description="The data to be appended.", embed=True)
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
