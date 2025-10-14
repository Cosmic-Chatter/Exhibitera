# Standard modules
import asyncio
import json
import logging
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Request
from sse_starlette.sse import EventSourceResponse

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.system as hub_system
import exhibitera.hub.tools as hub_tools

# Set up log file
log_path: str = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

def get_webpage_update():
    """Collect the current exhibit status and send it back to the web client to update the page."""

    update_dict = {}

    component_dict_list = []
    for item in hub_config.componentList:
        temp = {"class": "exhibitComponent",
                "exhibiteraAppID": item.config["app_id"],
                "helperAddress": item.helperAddress,
                "id": item.id,
                "ip_address": item.ip_address,
                "groups": item.groups,
                "lastContactDateTime": item.last_contact_datetime,
                "latency": item.latency,
                "platform_details": item.platform_details,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "status": item.current_status(),
                "uuid": item.uuid}
        if "content" in item.config:
            temp["content"] = item.config["content"]
        if "definition" in item.config:
            temp["definition"] = item.config["definition"]
        if "notifications" in item.config:
            temp["notifications"] = item.config["notifications"]
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        component_dict_list.append(temp)

    for item in hub_config.projectorList:
        temp = {"class": "projector",
                "groups": item.groups,
                "id": item.id,
                "ip_address": item.ip_address,
                "latency": item.latency,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "password": item.password,
                "protocol": item.connection_type,
                "state": item.state,
                "status": item.state["status"],
                "uuid": item.uuid}
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        component_dict_list.append(temp)

    for item in hub_config.wakeOnLANList:
        temp = {"class": "wolComponent",
                "id": item.id,
                "groups": item.groups,
                "ip_address": item.ip_address,
                "latency": item.latency,
                "mac_address": item.mac_address,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "status": item.state["status"],
                "uuid": item.uuid}
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        component_dict_list.append(temp)

    update_dict["components"] = component_dict_list
    update_dict["gallery"] = {"current_exhibit": hub_config.current_exhibit,
                              "exhibit_modified": len(hub_config.exhibit_modifications.get("components", [])) != 0,
                              "available_exhibits": hub_config.exhibit_list,
                              "name": hub_config.gallery_name,
                              "outdated_os": hub_config.outdated_os,
                              "software_version": hub_config.software_version,
                              "software_update": ex_config.software_update}

    update_dict["issues"] = {"issue_list": [x.details for x in hub_config.issue_list],
                             "lastUpdateDate": hub_config.issue_list_last_update_date}

    update_dict["groups"] = {"group_list": hub_config.group_list,
                             "last_update_date": hub_config.group_list_last_update_date}

    with hub_config.scheduleLock:
        update_dict["schedule"] = {"updateTime": hub_config.scheduleUpdateTime,
                                   "schedule": hub_config.json_schedule_list,
                                   "nextEvent": hub_config.json_next_event}

    return update_dict

router = APIRouter(prefix='/system')

@router.get("/checkConnection")
async def check_connection():
    """Respond to request to confirm that the connection is active"""

    return {"success": True}


@router.get("/configuration/{target}")
async def get_json_configuration(target: str):
    """Return the requested JSON configuration."""

    if not ex_files.filename_safe(target):
        return {"success": False, "reason": "unsafe_filename"}

    config_path = ex_files.get_path(["configuration", ex_files.with_extension(target, "json")], user_file=True)
    configuration = ex_files.load_json(config_path)
    if configuration is  None:
        return {"success": False, "reason": "File does not exist."}
    return {"success": True, "configuration": configuration}


@router.get("/getHelpText")
async def get_help_text():
    """Send the contents of README.md"""
    try:
        readme_path = ex_files.get_path(["README.md"])
        with open(readme_path, 'r', encoding='UTF-8') as f:
            text = f.read()
        response = {"success": True, "text": text}
    except FileNotFoundError:
        with hub_config.logLock:
            logging.error("Unable to read README.md")
        response = {"success": False, "reason": "Unable to read README.md"}
    except PermissionError:
        # For some reason, Pyinstaller insists on placing the README in a directory of the same name on Windows.
        try:
            readme_path = ex_files.get_path(["README.md", "README.md"])
            with open(readme_path, 'r', encoding='UTF-8') as f:
                text = f.read()
            response = {"success": True, "text": text}
        except (FileNotFoundError, PermissionError):
            with hub_config.logLock:
                logging.error("Unable to read README.md")
            response = {"success": False, "reason": "Unable to read README.md"}

    return response


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

    if len(dict_to_send["commands"]) > 0:
        # Clear the command list now that we are sending
        component.config["commands"] = []
    return dict_to_send


@router.post("/configuration/{target}/update")
async def update_system_configuration(target: str,
                                      configuration=Body(description="A JSON object specifying the configuration.", embed=True)):
    """Write the given object to the matching JSON file as the configuration."""

    if target == "system":
        hub_tools.update_system_configuration(configuration)
    else:
        if not ex_files.filename_safe(target):
            return {"success": False, "reason": "unsafe_filename"}
        config_path = ex_files.get_path(["configuration", ex_files.with_extension(target, "json")], user_file=True)
        ex_files.write_json(configuration, config_path)

    return {"success": True}


@router.get('/updateStream')
async def send_update_stream(request: Request):
    """Create a server-side event stream to send updates to the client."""

    async def event_generator():
        last_update_time = None
        while True:
            # If client closes connection, stop sending events
            if await request.is_disconnected():
                break

            # Checks for new updates and return them to client
            if hub_config.last_update_time != last_update_time:
                last_update_time = hub_config.last_update_time

                yield {
                    "event": "update",
                    "id": str(last_update_time),
                    "retry": 5000,  # milliseconds
                    "data": json.dumps(get_webpage_update(), default=str)
                }
            await asyncio.sleep(0.5)  # seconds

    return EventSourceResponse(event_generator())