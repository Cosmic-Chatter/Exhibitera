"""The Exhibitera Core API is a limited API subset guaranteed to remain compatible
in future Exhibitera versions. It is designed for third-party app developers.
"""

# Standard modules
import logging
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.apps.features.system as apps_system

log_path: str = ex_files.get_path(["apps.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

router = APIRouter()


@router.get("/checkConnection")
async def check_connection():
    """Respond to request to confirm that the connection is active."""

    return {"success": True}


@router.post("/data/{name}/rawText")
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


@router.get("/data/{name}/rawText")
async def get_raw_text(name: str):
    """Load the given file and return the raw text."""

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    result, success, reason = ex_files.get_text(file_path)
    return {"success": success, "reason": reason, "text": result}


@router.get("/system/restart")
async def do_restart():
    apps_system.reboot()


@router.get("/system/shutdown")
async def do_shutdown():
    apps_system.shutdown()


@router.get("/system/wakeDisplay")
async def do_wake():
    apps_system.wake_display()


@router.get("/system/sleepDisplay")
async def do_sleep():
    apps_system.sleep_display()