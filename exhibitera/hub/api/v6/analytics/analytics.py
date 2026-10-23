# Standard modules
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.common.files as ex_files


router = APIRouter(prefix='/analytics')


@router.post("/{component_uuid}/append")
async def submit_analytics(component_uuid: str,
                           data: dict[str, Any] = Body(description="The analytics data to append to the file", embed=True)
                           ):
    """Write the provided analytics data to file."""

    if not ex_files.filename_safe(component_uuid):
        return {"success": False, "reason": "unsafe_filename"}


    file_path = ex_files.get_path(["analytics", ex_files.with_extension(component_uuid, "txt")], user_file=True)
    success, reason = ex_files.write_json(data, file_path, append=True)
    return {"success": success, "reason": reason}
