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
    if data.get("helper_address", "") != "":
        data["helperAddress"] = data["helper_address"]
        del data["helper_address"]
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

