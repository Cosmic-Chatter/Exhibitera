# Standard modules
import io
import platform
import sys

# Third-party modules
from fastapi import APIRouter
from fastapi.responses import Response

# Exhibitera modules
import helper_system
import helper_utilities

router = APIRouter()


@router.get('/system/getPlatformDetails')
async def get_platform_details():
    """Return details on the current operating system."""

    return helper_system.get_platform_details()


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