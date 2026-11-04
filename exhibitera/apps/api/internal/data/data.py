# Standard modules
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Query

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.common.config as ex_config

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
    return {"success": success, "reason": reason}


@router.get("/{name}/rawText")
async def read_raw_text(name: str):
    """Load the given file and return the raw text."""

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    result, success, reason = ex_files.get_text(file_path)

    return {"success": success, "reason": reason, "text": result}


@router.get("/{name}/summary")
async def get_data_summary(name: str,
                           start: str | None = Query(None, description="Count records from this time."),
                           end: str | None = Query(None, description="Count records until this time.")):
    """Return the data file's columns, the times of its first and last records, and how many are in the range."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}
    try:
        start_time, end_time = ex_files.parse_time_range(start, end)
    except ValueError:
        return {"success": False, "reason": "invalid_time"}

    records = ex_files.load_records(ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True))
    if records is None:
        return {"success": False, "reason": "unknown_file"}
    return {"success": True, **ex_files.summarize_records(records, start_time, end_time)}


@router.get("/{name}/csv")
async def get_tracker_data_csv(name: str,
                               start: str | None = Query(None, description="Include records from this time."),
                               end: str | None = Query(None, description="Include records until this time."),
                               columns: list[str] | None = Query(None, description="Include only these columns.")):
    """Return the requested data file as a CSV string.

    The records can be limited to a time range and to the given columns.
    """

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}
    try:
        start_time, end_time = ex_files.parse_time_range(start, end)
    except ValueError:
        return {"success": False, "reason": "invalid_time"}

    data_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    records = ex_files.load_records(data_path)
    if records is None:
        return {"success": False, "reason": f"File {name}.txt does not exist!", "csv": ""}
    records = ex_files.select_columns(ex_files.records_in_range(records, start_time, end_time), columns)
    return {"success": True, "csv": ex_files.json_list_to_csv(records)}


@router.delete("/{name}")
async def delete_data(name: str):
    """Delete the specified data file."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}

    if name is None or name.strip() == "":
        return {"success": False, "reason": "'name' field is blank."}

    data_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)

    with ex_config.text_file_lock:
        return ex_files.delete_file(data_path)
