# Standard modules
from functools import lru_cache, partial
import io
import logging
import mimetypes
import os
import platform
import shutil
import sys
import threading
from typing import Any
import uuid
import helper_utilities
from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter()

@router.get('/system/getPlatformDetails')
async def get_platform_details():
    """Return details on the current operating system."""

    details = {
        "architecture": platform.architecture()[0],
        "os_version": platform.release()
    }

    plat = sys.platform
    if plat == "darwin":
        plat = 'macOS'
    elif plat == "win32":
        plat = "Windows"
    details["os"] = plat

    return details
@router.get('/system/getScreenshot', responses={200: {"content": {"image/png": {}}}}, response_class=Response)
async def get_screenshot():
    """Capture a screenshot and return it as a JPEG response."""

    image = helper_utilities.capture_screenshot()
    byte_array = io.BytesIO()
    image.save(byte_array, format='JPEG', quality=85)
    byte_array = byte_array.getvalue()
    return Response(content=byte_array,
                    media_type="image/jpeg",
                    headers={
                        "Pragma-directive": "no-cache",
                        "Cache-directive": "no-cache",
                        "Cache-control": "no-cache",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    })