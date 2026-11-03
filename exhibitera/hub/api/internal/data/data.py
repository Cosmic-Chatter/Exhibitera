# Standard modules
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Depends, Query

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


@router.get("/{name}/summary", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
async def get_data_summary(name: str,
                           start: str | None = Query(None, description="Count records from this time."),
                           end: str | None = Query(None, description="Count records until this time.")):
    """Return the data file's columns, the times of its first and last records, and how many are in the range."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}
    try:
        start_time, end_time = ex_files.parse_time_range(start, end)
    except ValueError:
        return {"success": False, "reason": "invalid_time"}

    records = ex_files.load_records(ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True))
    if records is None:
        return {"success": False, "reason": "unknown_file"}
    return {"success": True, **ex_files.summarize_records(records, start_time, end_time)}


@router.get("/{name}/csv", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
async def get_tracker_data_csv(name: str,
                               start: str | None = Query(None, description="Include records from this time."),
                               end: str | None = Query(None, description="Include records until this time."),
                               columns: list[str] | None = Query(None, description="Include only these columns.")):
    """Return the requested data file as a CSV string.

    The records can be limited to a time range, given to the minute, and to the given columns.
    """

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}
    try:
        start_time, end_time = ex_files.parse_time_range(start, end)
    except ValueError:
        return {"success": False, "reason": "invalid_time"}

    data_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    records = ex_files.load_records(data_path)
    if records is None:
        return {"success": False, "reason": f"File {name}.txt does not exist!", "csv": ""}
    records = ex_files.select_columns(ex_files.records_in_range(records, start_time, end_time), columns)
    return {"success": True, "csv": ex_files.json_list_to_csv(records),
            "filename": ex_files.with_extension(name, "csv")}
