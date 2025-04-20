# Standard modules
from functools import lru_cache
import io

# Third-party modules
from fastapi import APIRouter, Body, Depends
from fastapi.responses import Response

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.apps.features.system as apps_system
import exhibitera.apps.features.utilities as apps_utilities
import exhibitera.apps.config as apps_config

router = APIRouter(prefix='/system')

@lru_cache()
def get_config():
    return apps_config


@router.get("/update")
async def send_update(config: apps_config = Depends(get_config)):
    """Get some key info for updating the component and web console."""

    response_dict = {
        "permissions": config.defaults["permissions"],
        "commands": config.commandList,
        "missingContentWarnings": config.missingContentWarningList
    }
    return response_dict


@router.get("/checkConnection")
async def check_connection():
    """Respond to request to confirm that the connection is active."""

    return {"success": True}


@router.get("/stats")
async def get_system_stats():
    """Return a summary of the current CPU, RAM, and storage usage."""

    return {"success": True, "system_stats": apps_utilities.get_system_stats()}


@router.get('/getPlatformDetails')
async def get_platform_details():
    """Return details on the current operating system."""

    return apps_system.get_platform_details()


@router.get('/getScreenshot', responses={200: {"content": {"image/png": {}}}}, response_class=Response)
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



@router.get("/configuration")
async def send_configuration(config: apps_config = Depends(get_config)):
    config_to_send = config.defaults.copy()

    # Add the current update availability to pass to Hub
    config_to_send["software_update"] = ex_config.software_update
    return config_to_send


@router.post("/configuration/update")
async def set_defaults(
        defaults: dict = Body(description="A dictionary matching the structure of config.json."),
        cull: bool = Body(description="Whether to replace the existing defaults with the provided ones.", default=False)):
    """Update the given configuration with the specified values"""

    apps_utilities.update_configuration(defaults, cull=cull)

    return {"success": True}


@router.get("/restart")
async def do_restart():
    apps_system.reboot()


@router.get("/shutdown")
async def do_shutdown():
    apps_system.shutdown()


@router.get("/wakeDisplay")
async def do_wake():
    apps_system.wake_display()


@router.get("/sleepDisplay")
async def do_sleep():
    apps_system.sleep_display()
