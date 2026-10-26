"""The Exhibitera protocol: the endpoints that Apps calls on Hub.

Apps computers may run an older version than Hub, so each protocol version is a fixed contract. Each
endpoint is registered for every protocol version that supports it (see ProtocolRouter). Endpoints that
Hub's own pages also use are defined in the internal API and registered here as well, so that each has
only one implementation.
"""

# Standard modules
from typing import Any

# Third-party modules
from fastapi import Body, Depends, Request, Response

# Exhibitera modules
import exhibitera.common.files as ex_files
from exhibitera.common.protocol_router import ProtocolRouter
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.users as hub_users
from exhibitera.hub.api.internal.data import data as data_internal
from exhibitera.hub.api.internal.programs import programs as programs_internal
from exhibitera.hub.api.internal.system import system as system_internal
from exhibitera.hub.api.internal.users import users as users_internal

router = ProtocolRouter(["6", "6.1"])


# System

router.get("/system/checkConnection")(system_internal.check_connection)


@router.post("/system/ping")
async def handle_ping(data: dict[str, Any], request: Request):
    """Respond to an incoming heartbeat signal with ahy updates."""

    if "uuid" not in data:
        response = {"success": False,
                    "reason": "Request missing 'uuid' field."}
        return response

    # The uuid names the component's file on disk
    if not ex_files.filename_safe(data["uuid"]):
        return {"success": False, "reason": "unsafe_uuid"}

    hub_components.update_exhibit_component_status(data, request.client.host)

    component = hub_components.get_exhibit_component(data['uuid'])
    dict_to_send = component.config.copy()
    dict_to_send["id"] = component.id

    if len(dict_to_send["commands"]) > 0:
        # Clear the command list now that we are sending
        component.config["commands"] = []
    return dict_to_send


# Components

@router.get("/component/{uuid_str}/groups")
async def get_component_groups(uuid_str: str):
    """Return the list of groups the given component belongs to."""

    # Don't authenticate, as we use this as part of the component auth process

    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist", "groups": []}

    return {"success": True, "groups": component.groups}


# Analytics and data

@router.post("/analytics/{component_uuid}/append")
async def submit_analytics(component_uuid: str,
                           data: dict[str, Any] = Body(description="The analytics data to append to the file", embed=True)
                           ):
    """Write the provided analytics data to file."""

    if not ex_files.filename_safe(component_uuid):
        return {"success": False, "reason": "unsafe_filename"}

    file_path = ex_files.get_path(["analytics", ex_files.with_extension(component_uuid, "txt")], user_file=True)
    success, reason = ex_files.write_json(data, file_path, append=True)
    return {"success": success, "reason": reason}


router.post("/data/{name}/append")(data_internal.append_data)


@router.post("/data/{name}/rawText")
async def submit_raw_text(name: str,
                         text: str = Body(description='The data to write.'),
                         mode: str = Body(description="Pass 'a' to append or 'w' to overwrite.", default='a')):
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

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "unsafe_filename"}

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    result, success, reason = ex_files.get_text(file_path)
    return {"success": success, "reason": reason, "text": result}


# Users

@router.post("/user/login")
def log_in(response: Response,
           request: Request,
           credentials: tuple[str, str] = Body(description="A tuple containing the username and password.",
                                               default=("", "")),
           token: str = Body(description="An authentication cookie.", default=""),
           handoff: str = Body(description="A one-time code from /user/loginHandoff.", default="")
           ):
    """Authenticate the user and return the permissions and, for a new login, a limited authentication token.

    The token only works for logging in and changing the user's own password.
    """

    return users_internal.respond_to_login(response, request, credentials, token, handoff, from_apps=True)


@router.post('/user/{user_uuid}/changePassword', until="6")
def change_user_password_v6(user_uuid: str,
                            current_password: str = Body(description="The plaintext of the current password."),
                            new_password: str = Body(description="The plaintext of the password to set.")):
    """Change the password for the given user.

    Released Apps 6.0 doesn't send a login, so this only checks the current password.
    """

    user = hub_users.get_user(uuid_str=user_uuid)

    # First, check that the current password is correct
    if hub_users.hash_password(current_password) != user.password_hash:
        return {"success": False, "reason": "authentication_failed"}

    # Then, update the password
    if user.uuid != "admin":
        user.password_hash = hub_users.hash_password(new_password)
        hub_users.save_users()
    else:
        hub_users.create_root_admin(new_password)

    return {"success": True}


router.post('/user/{user_uuid}/changePassword', since="6.1",
            dependencies=[Depends(hub_users.require_apps_user)])(users_internal.change_user_password)


# Programs, for Apps setup pages and kiosks

router.get("/program/", since="6.1")(programs_internal.get_program_list)
router.get("/program/location/{location}", since="6.1")(programs_internal.get_program_list)


@router.get("/program/locations", since="6.1")
async def get_program_locations():
    """Return a list of available program locations (which are all the available groups)."""

    locations = [{"uuid": d["uuid"], "name": d["name"]} for d in hub_config.group_list]

    return {"success": True, "locations": locations}


# Registered after /program/locations, which it would otherwise match
router.get("/program/{this_uuid}", since="6.1")(programs_internal.get_program_dict)
