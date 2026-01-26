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
import exhibitera.hub.features.components as hub_components

log_path: str = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

router = APIRouter()

@router.post("/ping")
async def handle_ping(data: dict[str, Any], request: Request):
    """Respond to an incoming heartbeat signal with ahy updates."""

    if data.get("uuid", "") == "":
        response = {"success": False,
                    "reason": "Request missing required 'uuid' field."}
        return response

    if not isinstance(data["uuid"], str):
        response = {"success": False,
                    "reason": "'uuid' field should be a UUID4 string."}
        return response

    # Translate API fields
    data["exhibiteraAppID"] = "external"
    data["api_level"] = 0
    if data.get("current_interaction", "") != "":
        data["currentInteraction"] = data["current_interaction"]
        del data["current_interaction"]

    hub_components.update_exhibit_component_status(data, request.client.host)

    component = hub_components.get_exhibit_component(data['uuid'])
    dict_to_send = {
        "commands": component.config.get("commands", []),
        "definition": component.config.get("definition", None),
        "success": True,
        }

    if len(dict_to_send["commands"]) > 0:
        # Clear the command list now that we are sending
        component.config["commands"] = []

    return dict_to_send


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