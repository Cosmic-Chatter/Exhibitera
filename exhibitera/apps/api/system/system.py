# Standard modules
import io

# Third-party modules
from fastapi import APIRouter
from fastapi.responses import Response

# Exhibitera modules
import exhibitera.apps.features.system as apps_system
import exhibitera.apps.features.utilities as apps_utilities

router = APIRouter()


@router.get('/system/getPlatformDetails')
async def get_platform_details():
    """Return details on the current operating system."""

    return apps_system.get_platform_details()


@router.get('/system/getScreenshot', responses={200: {"content": {"image/png": {}}}}, response_class=Response)
async def get_screenshot():
    """Capture a screenshot and return it as a JPEG response."""

    image = apps_utilities.capture_screenshot()
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