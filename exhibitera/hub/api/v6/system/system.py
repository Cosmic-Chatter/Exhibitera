# Standard modules
from typing import Any

# Third-party modules
from fastapi import APIRouter, Request

# Exhibitera modules
import exhibitera.hub.features.components as hub_components

router = APIRouter(prefix='/system')

@router.get("/checkConnection")
async def check_connection():
    """Confirm that the connection is active and provide the supported API levels"""

    return {"success": True,
            "supported_apis": ['/core', '/v6'],
            "supported_api_levels": [0, 6]}


@router.post("/ping")
async def handle_ping(data: dict[str, Any], request: Request):
    """Respond to an incoming heartbeat signal with ahy updates."""

    if "uuid" not in data:
        response = {"success": False,
                    "reason": "Request missing 'uuid' field."}
        return response

    hub_components.update_exhibit_component_status(data, request.client.host)

    component = hub_components.get_exhibit_component(data['uuid'])
    dict_to_send = component.config.copy()
    dict_to_send["id"] = component.id

    if len(dict_to_send["commands"]) > 0:
        # Clear the command list now that we are sending
        component.config["commands"] = []
    return dict_to_send
