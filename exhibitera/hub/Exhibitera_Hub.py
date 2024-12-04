# Exhibitera Hub
# A centralized server for controlling museum exhibit components
# Written by Morgan Rehnberg, Adventure Science Center
# Released under the MIT license

# Standard modules
import asyncio
from contextlib import asynccontextmanager
import datetime
import threading
import uuid
from functools import lru_cache
import json
import logging
import os
import shutil
import socket
import sys
import time
import traceback
from typing import Any, Union
import urllib.request
import uvicorn

# Non-standard modules
import aiofiles
import dateutil.parser
from fastapi import Body, FastAPI, File, Response, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

# Exhibitera modules
import config as ex_config
import exhibitera_exhibit as ex_exhibit
import exhibitera_group as ex_group
import exhibitera_issues as ex_issues
import exhibitera_legacy as ex_legacy
import exhibitera_maintenance as ex_maint
import exhibitera_projector as ex_proj
import exhibitera_schedule as ex_sched
import exhibitera_tools as ex_tools
import exhibitera_tracker as ex_track
import exhibitera_users as ex_users


# Set up the automatic documentation
def exhibitera_schema():
    # Cached version
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Exhibitera Hub",
        version=str(ex_config.software_version),
        description="Hub coordinates communication between Exhibitera components and provides a web-based interface for controlling them. It also provides tools for collecting qualitative and quantitative data, tracking maintenance, and logging exhibit issues.",
        routes=app.routes,
    )
    openapi_schema["info"] = {
        "title": "Exhibitera Hub",
        "version": str(ex_config.software_version),
        "description": "Hub coordinates communication between Exhibitera components and provides a web-based interface for controlling them. It also provides tools for collecting qualitative and quantitative data, tracking maintenance, and logging exhibit issues.",
        "contact": {
            "name": "Morgan Rehnberg",
            "url": "https://cosmicchatter.org/constellation/constellation.html",
            "email": "MRehnberg@adventuresci.org"
        },
        "license": {
            "name": "MIT License",
            "url": "https://opensource.org/licenses/MIT"
        },
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema


def send_webpage_update():
    """Collect the current exhibit status, format it, and send it back to the web client to update the page."""

    update_dict = {}

    component_dict_list = []
    for item in ex_config.componentList:
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
        if "error" in item.config:
            temp["error"] = item.config["error"]
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        if "autoplay_audio" in item.config:
            temp["autoplay_audio"] = item.config["autoplay_audio"]
        component_dict_list.append(temp)

    for item in ex_config.projectorList:
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

    for item in ex_config.wakeOnLANList:
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
    update_dict["gallery"] = {"current_exhibit": ex_config.current_exhibit,
                              "availableExhibits": ex_config.exhibit_list,
                              "galleryName": ex_config.gallery_name,
                              "softwareVersion": str(ex_config.software_version),
                              "softwareVersionAvailable": ex_config.software_update_available_version,
                              "updateAvailable": str(ex_config.software_update_available).lower()}

    update_dict["issues"] = {"issueList": [x.details for x in ex_config.issueList],
                             "lastUpdateDate": ex_config.issueList_last_update_date}

    update_dict["groups"] = {"group_list": ex_config.group_list,
                             "last_update_date": ex_config.group_list_last_update_date}

    with ex_config.scheduleLock:
        update_dict["schedule"] = {"updateTime": ex_config.scheduleUpdateTime,
                                   "schedule": ex_config.json_schedule_list,
                                   "nextEvent": ex_config.json_next_event}

    return update_dict


def command_line_setup_print_gui() -> None:
    """Helper to print the header content for the setup tool"""

    ex_tools.clear_terminal()
    print("##########################################################")
    print("Welcome to Exhibitera Hub!")
    print("")
    print("This appears to be your first time running Hub.")
    print("In order to set up your configuration, let's answer a few")
    print("questions. If you don't know the answer, or wish to")
    print("accept the default, just press the enter key.")
    print("")


def command_line_setup() -> None:
    """Prompt the user for several pieces of information on first-time setup"""

    settings_dict = {}

    command_line_setup_print_gui()
    ex_config.gallery_name = input("Enter a name for the gallery (default: Exhibitera): ").strip()
    if ex_config.gallery_name == "":
        ex_config.gallery_name = "Exhibitera"
    settings_dict["gallery_name"] = ex_config.gallery_name

    command_line_setup_print_gui()
    default_ip = socket.gethostbyname(socket.gethostname())
    ip_address = input(f"Enter this computer's static IP address (default: {default_ip}): ").strip()
    if ip_address == "":
        ip_address = default_ip
    settings_dict["ip_address"] = ip_address

    command_line_setup_print_gui()
    default_port = 8082
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((ip_address, default_port)) != 0:
                # Port is free
                break
            else:
                default_port += 1
    port = input(f"Enter the desired port (default: {default_port}): ").strip()
    if port == "":
        port = default_port
    else:
        port = int(port)
    settings_dict["port"] = port

    settings_dict["current_exhibit"] = "Default"
    # Create this exhibit file if it doesn't exist
    if not os.path.exists(ex_tools.get_path(["exhibits", "Default.json"], user_file=True)):
        ex_exhibit.create_new_exhibit("default", None)

    # Write new system config to file
    config_path = ex_tools.get_path(["configuration", "system.json"], user_file=True)
    ex_tools.write_json(settings_dict, config_path)

    command_line_setup_print_gui()
    print("Setup is complete! Exhibitera Hub will now start.")
    print("")


def load_default_configuration() -> None:
    """Initialize the server in a default state."""

    # Check if there is a configuration file
    config_path = ex_tools.get_path(["configuration", "system.json"], user_file=True)
    if not os.path.exists(config_path):
        # We don't have a config file, so let's get info from the user to create one
        command_line_setup()
    ex_users.check_for_root_admin()
    ex_tools.load_system_configuration()

    # Handle legacy conversions
    ex_legacy.convert_legacy_projector_configuration()
    ex_legacy.convert_legacy_static_configuration()
    ex_legacy.convert_legacy_WOL_configuration()
    ex_legacy.convert_schedule_targets_to_json()

    ex_tools.start_debug_loop()
    ex_sched.retrieve_json_schedule()
    ex_exhibit.read_descriptions_configuration()
    # ex_proj.read_projector_configuration()
    # ex_exhibit.read_wake_on_LAN_configuration()
    # ex_exhibit.read_static_components_configuration()
    ex_exhibit.read_exhibit_configuration(ex_config.current_exhibit)

    # Update the components that their configuration may have changed
    for component in ex_config.componentList:
        component.update_configuration()

    # Build any existing issues
    ex_issues.read_issue_list()

    # Save the current software version in .last_ver
    last_ver_path = ex_tools.get_path(["configuration", ".last_ver"], user_file=True)
    with open(last_ver_path, 'w', encoding='UTF-8') as f:
        f.write(str(ex_config.software_version))


def quit_handler(*args) -> None:
    """Handle cleanly shutting down the server."""

    for key in ex_config.polling_thread_dict:
        ex_config.polling_thread_dict[key].cancel()

    for component in ex_config.componentList:
        component.clean_up()
        component.save()
    for component in ex_config.projectorList:
        component.clean_up()
        component.save()
    for component in ex_config.wakeOnLANList:
        component.clean_up()
        component.save()

    with ex_config.logLock:
        logging.info("Server shutdown")

    # with ex_config.galleryConfigurationLock:
    #     with ex_config.scheduleLock:
    #         with ex_config.trackingDataWriteLock:
    #             sys.exit(exit_code)


def error_handler(*exc_info) -> None:
    """Catch errors and log them to file"""

    text = "".join(traceback.format_exception(*exc_info)).replace('"', "'").replace("\n", "<newline>")
    with ex_config.logLock:
        logging.error(f'"{text}"')
    print(f"Error: see hub.log for more details ({datetime.datetime.now()})")


def check_for_software_update() -> None:
    """Download the version.txt file from GitHub and check if there is an update"""

    print("Checking for update... ", end="")
    ex_config.software_update_available = False
    try:
        for line in urllib.request.urlopen(
                "https://raw.githubusercontent.com/Cosmic-Chatter/Exhibitera/main/exhibitera/hub/version.txt",
                timeout=2):
            line_str = line.decode('utf-8')
            if float(line_str) > ex_config.software_version:
                ex_config.software_update_available = True
                ex_config.software_update_available_version = line_str.strip()
                break
    except urllib.error.HTTPError:
        print("cannot connect to update server")
    except urllib.error.URLError:
        print("cannot connect to update server")
    if ex_config.software_update_available:
        print("update available!")
    else:
        print("the server is up to date.")

    # Reset the timer to check for an update tomorrow
    if ex_config.software_update_timer is not None:
        ex_config.software_update_timer.cancel()
    ex_config.software_update_timer = threading.Timer(86400, check_for_software_update)
    ex_config.software_update_timer.daemon = True
    ex_config.software_update_timer.start()


# Check whether we have packaged with Pyinstaller and set the appropriate root path.
ex_config.EXEC_PATH = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    ex_config.APP_PATH = os.path.dirname(sys.executable)
else:
    ex_config.APP_PATH = ex_config.EXEC_PATH

# Set up log file
log_path: str = ex_tools.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)
# signal.signal(signal.SIGINT, quit_handler)
# signal.signal(signal.SIGTERM, quit_handler)
sys.excepthook = error_handler

with ex_config.logLock:
    logging.info("Server started")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    yield
    # Clean up actions
    quit_handler()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.openapi = exhibitera_schema


@lru_cache()
def get_config():
    return ex_config


# User account actions

@app.post("/user/login")
def log_in(response: Response,
           request: Request,
           credentials: tuple[str, str] = Body(description="A tuple containing the username and password.",
                                               default=("", "")),
           token: str = Body(description="An authentication cookie.", default="")
           ):
    """Authenticate the user and return the permissions and an authentication token."""

    if token == "":
        token = request.cookies.get("authToken", "")

    success, user_uuid = ex_users.authenticate_user(token=token, credentials=credentials)
    if success is False:
        return {"success": False, "reason": "authentication_failed"}

    user = ex_users.get_user(uuid_str=user_uuid)
    response_dict = {"success": True, "user": user.get_dict()}
    if token == "":
        token = ex_users.encrypt_token(user_uuid)
        if ex_config.debug:
            print(token)
        response.set_cookie(key="authToken", value=token, max_age=int(3e7))  # Expire cookie in approx 1 yr
        response_dict['authToken'] = token
    return response_dict


@app.post("/user/create")
def create_user(request: Request,
                username: str = Body(description="The username"),
                password: str = Body(description="The password for the account to create."),
                display_name: str = Body(description="The name of the account holder."),
                permissions: dict | None = Body(description="A dictionary of permissions for the new account.",
                                                default=None)):
    """Create a new user account."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("users", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success, user_dict = ex_users.create_user(username, display_name, password, permissions=permissions)

    response = {"success": success, "user": user_dict}
    if success is False:
        response["reason"] = "username_taken"
    return response


@app.post("/user/{uuid_str}/edit")
def edit_user(request: Request,
              uuid_str: str,
              username: str | None = Body(description="The username", default=None),
              password: str | None = Body(description="The password for the account to create.", default=None),
              display_name: str | None = Body(description="The name of the account holder.", default=None),
              permissions: dict | None = Body(description="A dictionary of permissions for the new account.",
                                              default=None)):
    """Edit the given user."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("users", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    user = ex_users.get_user(uuid_str=uuid_str)
    if user is None:
        return {"success": False, "reason": "user_does_not_exist"}

    if username is not None and username != user.username:
        if ex_users.check_username_available(username) is True:
            user.username = username
        else:
            return {"success": False, "reason": "username_taken"}

    if display_name is not None:
        user.display_name = display_name
    if password is not None:
        user.password_hash = ex_users.hash_password(password)
    if permissions is not None:
        user.permissions = permissions
    ex_users.save_users()

    return {"success": success, "user": user.get_dict()}


@app.post("/user/{uuid_str}/delete")
def delete_user(request: Request,
                uuid_str: str):
    """Delete the given user"""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("users", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    return {"success": ex_users.delete_user(uuid_str)}


@app.post("/users/list")
def list_users(permissions: dict[str, str] = Body(description="A dictionary of permissions to match.",
                                                  default={},
                                                  embed=True)):
    """Return a list of users matching the provided criteria"""

    matched_users = []

    for user in ex_config.user_list:
        error = False
        for key in permissions:

            if user.check_permission(key, permissions[key]) is False:
                error = True
        if not error:
            matched_users.append(user.get_dict())

    return {"success": True, "users": matched_users}


@app.get("/user/{user_uuid}/getDisplayName")
def get_user_display_name(user_uuid: str):
    """Get the display name for a user account."""

    display_name = ex_users.get_user_display_name(user_uuid)
    if display_name is None:
        return {"success": False, "reason": "user_does_not_exist"}
    return {"success": True, "display_name": display_name}


@app.post('/user/{user_uuid}/changePassword')
def change_user_password(user_uuid: str,
                         current_password: str = Body(description="The plaintext of the current password."),
                         new_password: str = Body(description="The plaintext of the password to set.")):
    """Change the password for the given user"""

    user = ex_users.get_user(uuid_str=user_uuid)

    # First, check that the current password is correct
    if ex_users.hash_password(current_password) != user.password_hash:
        return {"success": False, "reason": "authentication_failed"}

    # Then, update the password
    if user.uuid != "admin":
        user.password_hash = ex_users.hash_password(new_password)
        ex_users.save_users()
    else:
        ex_users.create_root_admin(new_password)

    return {"success": True}


# Exhibit component actions

class Exhibit(BaseModel):
    name: str = Field(
        description="The name of the exhibit"
    )


class ExhibitComponent(BaseModel):
    id: str = Field(
        description="A unique identifier for this component",
        title="ID"
    )


@app.get("/component/{uuid_str}/groups")
async def get_component_groups(uuid_str: str):
    """Return the list of groups the given component belongs to."""

    # Don't authenticate, as we use this as part of the component auth process

    component = ex_exhibit.get_exhibit_component(component_uuid=uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist", "groups": []}

    return {"success": True, "groups": component.groups}


@app.post("/component/{uuid_str}/edit")
async def edit_component(request: Request,
                         uuid_str: str,
                         id: str | None = Body(description="The ID of the component.", default=None),
                         groups: list[str] | None = Body(description="The groups of the component.", default=None),
                         description: str | None = Body(description="A short description of the component.",
                                                        default=None)):
    """Edit the given component."""

    # Must get the component first, so we can use the groups to check for permissions
    component = ex_exhibit.get_exhibit_component(component_uuid=uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("components", "edit",
                                                                       groups=component.groups, token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if id is not None:
        component.id = id
    if groups is not None:
        component.groups = groups
    if description is not None:
        component.config["description"] = description
    component.save()
    ex_config.last_update_time = time.time()
    return {"success": True}


@app.post("/component/{component_id}/setDefinition")
async def set_component_definition(component_id: str,
                                   component_uuid: str = Body(description="The UUID of the component to modify."),
                                   definition_uuid: str = Body(
                                       description="The UUID of the definition file to be set.")):
    """Set the definition for the component."""

    ex_exhibit.update_exhibit_configuration({"definition": definition_uuid},
                                            component_id=component_id,
                                            component_uuid=component_uuid)

    return {"success": True}


@app.get("/group/{uuid_str}/getDetails")
async def get_group_details(request: Request, uuid_str: str):
    """Return the details for the given group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    group = ex_group.get_group(uuid_str)

    if group is None:
        return {"success": False, "reason": "Group does not exist."}
    return {"success": True, "details": group}


@app.post("/group/create")
async def create_group(request: Request,
                       name: str = Body(description="The name of the group to create"),
                       description: str = Body("The description for the group to create.")):
    """Create a group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    group = ex_group.create_group(name, description)
    return {"success": True, "uuid": group["uuid"]}


@app.post("/group/{uuid_str}/edit")
async def edit_group(request: Request,
                     uuid_str: str,
                     name: str = Body(description="The name of the group to create", default=None),
                     description: str = Body(description="The description for the group to create.", default=None)):
    """Edit a group"""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success = ex_group.edit_group(uuid_str, name=name, description=description)
    return {"success": success}


@app.get("/group/{uuid_str}/delete  ")
async def delete_group(request: Request, uuid_str: str):
    """Return the details for the given group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_group.delete_group(uuid_str)
    return {"success": True}


@app.post("/exhibit/create")
async def create_exhibit(request: Request,
                         exhibit: Exhibit,
                         clone_from: Union[str, None] = Body(default=None,
                                                             description="The name of the exhibit to clone.")):
    """Create a new exhibit JSON file."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_exhibit.create_new_exhibit(exhibit.name, clone_from)
    return {"success": True, "reason": ""}


@app.post("/exhibit/delete")
async def delete_exhibit(request: Request, exhibit: Exhibit = Body(embed=True)):
    """Delete the specified exhibit."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_exhibit.delete_exhibit(exhibit.name)
    return {"success": True, "reason": ""}


@app.post("/exhibit/queueCommand")
async def queue_command(component: ExhibitComponent,
                        command: str = Body(description="The command to be sent to the specified component")):
    """Queue the specified command for the exhibit component to retrieve."""

    ex_exhibit.get_exhibit_component(component_id=component.id).queue_command(command)
    return {"success": True, "reason": ""}


@app.post("/exhibit/queueWOLCommand")
async def queue_WOL_command(component: ExhibitComponent,
                            command: str = Body(description="The command to be sent to the specified component")):
    """Queue the Wake on Lan command for the exhibit component to retrieve."""

    ex_exhibit.get_wake_on_LAN_component(component_id=component.id).queue_command(command)
    return {"success": True, "reason": ""}


@app.post("/exhibit/removeComponent")
async def remove_component(component: ExhibitComponent = Body(embed=True)):
    """Queue the specified command for the exhibit component to retrieve."""

    to_remove = ex_exhibit.get_exhibit_component(component_id=component.id)
    print("Removing component:", component.id)
    to_remove.remove()
    return {"success": True, "reason": ""}


@app.post("/exhibit/set")
async def set_exhibit(exhibit: Exhibit = Body(embed=True)):
    """Set the specified exhibit as the current one."""

    print("Changing exhibit to:", exhibit.name)
    ex_tools.update_system_configuration({"current_exhibit": exhibit.name})
    ex_exhibit.read_exhibit_configuration(exhibit.name)

    # Update the components that the configuration has changed
    for component in ex_config.componentList:
        component.update_configuration()
    return {"success": True, "reason": ""}


@app.get("/exhibit/getAvailable")
async def get_available_exhibits():
    """Return a list of available exhibits."""

    return {"success": True, "available_exhibits": ex_config.exhibit_list}


@app.post("/exhibit/getDetails")
async def get_exhibit_details(name: str = Body(description='The name of the exhibit to fetch.', embed=True)):
    """Return the JSON for a particular exhibit."""

    if not name.endswith('.json'):
        name += '.json'
    exhibit_path = ex_tools.get_path(["exhibits", name], user_file=True)
    result = ex_tools.load_json(exhibit_path)
    if result is None:
        return {"success": False, "reason": "Exhibit does not exist."}
    return {"success": True, "exhibit": result}


# Flexible Tracker actions
@app.post("/tracker/{tracker_type}/createTemplate")
async def create_tracker_template(request: Request, data: dict[str, Any], tracker_type: str):
    """Create a new tracker template, overwriting if necessary."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "name" not in data or "template" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' or 'template' field."}
        return response
    name = data["name"]
    if not name.lower().endswith(".ini"):
        name += ".ini"
    file_path = ex_tools.get_path([tracker_type, "templates", name], user_file=True)
    success = ex_track.create_template(file_path, data["template"])
    response = {"success": success}
    return response


@app.post("/tracker/{tracker_type}/deleteData")
async def delete_tracker_data(request: Request, data: dict[str, Any], tracker_type: str):
    """Delete the specified tracker data file."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    name = data["name"]
    if name is None or name.strip() == "":
        response = {"success": False,
                    "reason": "'name' field is blank."}
        return response
    if not name.lower().endswith(".txt"):
        name += ".txt"
    data_path = ex_tools.get_path([tracker_type, "data", name], user_file=True)
    success = True
    reason = ""
    with ex_config.trackingDataWriteLock:
        try:
            os.remove(data_path)
        except PermissionError:
            success = False
            reason = f"You do not have write permission for the file {data_path}"
        except FileNotFoundError:
            success = True  # This error results in the user's desired action!
            reason = f"File does not exist: {data_path}"
    if reason != "":
        print(reason)
    response = {"success": success,
                "reason": reason}
    return response


@app.post("/tracker/{tracker_type}/deleteTemplate")
async def delete_tracker_template(request: Request, data: dict[str, Any], tracker_type: str):
    """Delete the specified tracker template."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    file_path = ex_tools.get_path([tracker_type, "templates", data["name"] + ".ini"], user_file=True)
    with ex_config.trackerTemplateWriteLock:
        response = ex_tools.delete_file(file_path)
    return response


@app.get("/tracker/{tracker_type}/getAvailableData")
async def get_available_tracker_data(tracker_type: str):
    """Send a list of all the available data files for the given tracker group."""

    data_path = ex_tools.get_path([tracker_type, "data"], user_file=True)
    data_list = []
    for file in os.listdir(data_path):
        if file.lower().endswith(".txt"):
            data_list.append(file)
    response = {"success": True,
                "data": data_list}
    return response


@app.get("/tracker/{tracker_type}/getAvailableDefinitions")
async def get_available_tracker_definitions(tracker_type: str):
    """Send a list of all the available definitions for the given tracker group (usually flexible-tracker)."""

    definition_list = []
    template_path = ex_tools.get_path([tracker_type, "templates"], user_file=True)
    for file in os.listdir(template_path):
        if file.lower().endswith(".ini"):
            definition_list.append(file)

    return definition_list


@app.post("/tracker/{tracker_type}/getDataAsCSV")
async def get_tracker_data_csv(data: dict[str, Any], tracker_type: str):
    """Return the requested data file as a CSV string."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    name = data["name"]
    if not name.lower().endswith(".txt"):
        name += ".txt"
    data_path = ex_tools.get_path([tracker_type, "data", name], user_file=True)
    if not os.path.exists(data_path):
        return {"success": False, "reason": f"File {data['name']}.txt does not exist!", "csv": ""}
    result = ex_track.create_CSV(data_path)
    return {"success": True, "csv": result}


@app.post("/tracker/{tracker_type}/getLayoutDefinition")
async def get_tracker_layout_definition(data: dict[str, Any], tracker_type: str):
    """Load the requested INI file and return it as a dictionary."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response

    layout_definition, success, reason = ex_track.get_layout_definition(data["name"] + ".ini", kind=tracker_type)

    response = {"success": success,
                "reason": reason,
                "layout": layout_definition}
    return response


@app.post("/tracker/{tracker_type}/getRawText")
async def get_tracker_raw_text(data: dict[str, Any], tracker_type: str):
    """Load the contents of the appropriate file and return them."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    result, success, reason = ex_track.get_raw_text(ex_tools.with_extension(data["name"], 'txt'), tracker_type)
    response = {"success": success, "reason": reason, "text": result}
    return response


@app.post("/tracker/submitAnalytics")
async def submit_analytics(data: dict[str, Any]):
    """Write the provided analytics data to file."""

    if "data" not in data or 'name' not in data:
        response = {"success": False,
                    "reason": "Request missing 'data' or 'name' field."}
        return response
    file_path = ex_tools.get_path(["analytics", data["name"] + ".txt"], user_file=True)
    success, reason = ex_track.write_JSON(data["data"], file_path)
    response = {"success": success, "reason": reason}
    return response


@app.post("/tracker/{tracker_type}/submitData")
async def submit_tracker_data(data: dict[str, Any], tracker_type: str):
    """Record the submitted data to file."""

    if "data" not in data or "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'data' or 'name' field."}
        return response
    file_path = ex_tools.get_path([tracker_type, "data", ex_tools.with_extension(data["name"], 'txt')], user_file=True)
    success, reason = ex_track.write_JSON(data["data"], file_path)
    response = {"success": success, "reason": reason}
    return response


@app.post("/tracker/{tracker_type}/submitRawText")
async def submit_tracker_raw_text(data: dict[str, Any], tracker_type: str):
    """Write the raw text in data['text'] to file.

    Set data['mode'] == 'a' to append or 'w' to overwrite the file.
    """

    if "text" not in data or "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'text' or 'name' field."}
        return response
    mode = data.get("mode", "a")
    if mode != "a" and mode != "w":
        response = {"success": False,
                    "reason": "Invalid mode field: must be 'a' (append, [default]) or 'w' (overwrite)"}
        return response
    success, reason = ex_track.write_raw_text(data["text"],
                                              ex_tools.with_extension(data["name"], 'txt'),
                                              kind=tracker_type,
                                              mode=mode)
    response = {"success": success, "reason": reason}
    return response


# Issue actions
@app.post("/issue/create")
async def create_issue(request: Request, details: dict[str, Any] = Body(embed=True)):
    """Create a new issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_issues.create_issue(details, username=authorizing_user)
    ex_issues.save_issue_list()
    return {"success": True}


@app.get("/issue/{issue_id}/delete")
async def delete_issue(request: Request, issue_id: str):
    """Delete an issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_issues.remove_issue(issue_id)
    return {"success": True, "reason": ""}


@app.get("/issue/{issue_id}/archive")
async def archive_issue(request: Request, issue_id: str):
    """Move the given issue to the archive."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_issues.archive_issue(issue_id, authorizing_user)
    return {"success": True}


@app.get("/issue/{issue_id}/restore")
async def restore_issue(request: Request, issue_id: str):
    """Move the given issue from the archive to the issue list."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_issues.restore_issue(issue_id)
    return {"success": True}


@app.post("/issue/deleteMedia")
async def delete_issue_media(request: Request,
                             filenames: list[str] = Body(description="The filenames to be deleted."),
                             owner: Union[str, None] = Body(default=None,
                                                            description="The ID of the Issue this media file belonged to.")):
    """Delete the media files linked to an issue and remove the reference."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_issues.delete_issue_media_file(filenames, owner=owner)
    return {"success": True}


@app.post("/issue/edit")
async def edit_issue(request: Request,
                     details: dict[str, Any] = Body(description="The details to be changed.", embed=True)):
    """Make changes to an existing issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "id" in details:
        ex_issues.edit_issue(details, authorizing_user)
        ex_issues.save_issue_list()
        response_dict = {"success": True}
    else:
        response_dict = {
            "success": False,
            "reason": "'details' must include property 'id'"
        }
    return response_dict


@app.get("/issue/list/{match_id}")
async def get_issue_list(request: Request, match_id: str):
    """Return a list of open issues."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if match_id != "__all":
        matched_issues = []
        for issue in ex_config.issueList:
            if match_id in issue.details["relatedComponentIDs"]:
                matched_issues.append(issue.details)
    else:
        matched_issues = [x.details for x in ex_config.issueList]

    response = {
        "success": True,
        "issueList": matched_issues
    }
    return response


@app.get("/issue/archive/list/{match_id}")
async def get_archived_issues(request: Request, match_id: str):
    """Return a list of open issues."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    archive_file = ex_tools.get_path(["issues", "archived.json"], user_file=True)

    with ex_config.issueLock:
        try:
            with open(archive_file, 'r', encoding='UTF-8') as file_object:
                archive_list = json.load(file_object)
        except (FileNotFoundError, json.JSONDecodeError):
            archive_list = []

    if match_id != "__all":
        matched_issues = []
        for issue in archive_list:
            if match_id in issue["relatedComponentIDs"]:
                matched_issues.append(issue)
    else:
        matched_issues = archive_list

    response = {
        "success": True,
        "issues": matched_issues
    }
    return response


@app.get("/issue/{issue_id}/getMedia")
async def get_issue_media(request: Request, issue_id: str):
    """Return a list of media files connected to the given ID."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    issue = ex_issues.get_issue(issue_id)

    if issue is None:
        return {"success": False, "reason": f"Issue does not exist: {issue_id}"}

    return {"success": True, "media": issue.details["media"]}


@app.post("/issue/uploadMedia")
async def upload_issue_media(request: Request, files: list[UploadFile] = File()):
    """Upload issue media files."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    filenames = []
    for file in files:
        ext = os.path.splitext(file.filename)[1]
        filename = str(uuid.uuid4()) + ext
        filenames.append(filename)
        file_path = ex_tools.get_path(["issues", "media", filename], user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with ex_config.issueMediaLock:
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content)  # async write
    return {"success": True, "filenames": filenames}


# Maintenance actions
@app.post("/maintenance/deleteRecord")
async def delete_maintenance_record(request: Request, data: dict[str, Any]):
    """Delete the specified maintenance record."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "id" not in data:
        return {"success": False, "reason": "Request missing 'id' field."}

    file_path = ex_tools.get_path(["maintenance-logs", data["id"] + ".txt"], user_file=True)
    with ex_config.maintenanceLock:
        response = ex_tools.delete_file(file_path)
    ex_config.last_update_time = time.time()
    return response


@app.get("/maintenance/getAllStatuses")
async def get_all_maintenance_statuses(request: Request):
    """Send a list of all the maintenance statuses for known components"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    record_list = []
    maintenance_path = ex_tools.get_path(["maintenance-logs"], user_file=True)
    for file in os.listdir(maintenance_path):
        if file.lower().endswith(".txt"):
            with ex_config.maintenanceLock:
                file_path = os.path.join(maintenance_path, file)
                record_list.append(ex_maint.get_maintenance_report(file_path))
    response_dict = {"success": True,
                     "records": record_list}
    return response_dict


@app.post("/maintenance/getStatus")
async def get_maintenance_status(request: Request, data: dict[str, Any]):
    """Return the specified maintenance status"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "id" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' field."}
        return response
    file_path = ex_tools.get_path(["maintenance-logs", data["id"] + ".txt"], user_file=True)
    with ex_config.maintenanceLock:
        response_dict = ex_maint.get_maintenance_report(file_path)
    return response_dict


@app.post("/maintenance/updateStatus")
async def update_maintenance_status(request: Request,
                                    component_id: str = Body(description='The ID of the component to update.'),
                                    notes: str = Body(description="Text notes about this component."),
                                    status: str = Body(description="The status of the component.")):
    """Update the given maintenance status."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    file_path = ex_tools.get_path(["maintenance-logs", component_id + ".txt"], user_file=True)
    record = {"id": component_id,
              "date": datetime.datetime.now().isoformat(),
              "status": status,
              "notes": notes}
    with ex_config.maintenanceLock:
        try:
            with open(file_path, 'a', encoding='UTF-8') as f:
                f.write(json.dumps(record) + "\n")
            success = True
            reason = ""
            ex_config.last_update_time = time.time()
        except FileNotFoundError:
            success = False
            reason = f"File path {file_path} does not exist"
        except PermissionError:
            success = False
            reason = f"You do not have write permission for the file {file_path}"

    if success is True:
        ex_exhibit.get_exhibit_component(component_id=component_id).config["maintenance_status"] = status

    return {"success": success, "reason": reason}


@app.post("/projector/create")
async def create_projector(request: Request,
                           id: str = Body(description="The ID of the projector to add."),
                           groups: list[str] = Body(description="The groups of the projector to add."),
                           ip_address: str = Body(description="The IP address for the projector."),
                           password: str = Body(description="The PJLink password", default="")):
    """Create a new projector."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    proj = ex_exhibit.add_projector(id, groups, ip_address, password=password)

    return {"success": True, "uuid": proj.uuid}


@app.post("/projector/{uuid_str}/edit")
async def edit_projector(request: Request,
                         uuid_str: str,
                         id: str | None = Body(description="The ID of the projector to add.", default=None),
                         groups: list[str] | None = Body(description="The groups of the projector to add.",
                                                         default=None),
                         description: str | None = Body(description="A short description of this projector.",
                                                        default=None),
                         ip_address: str | None = Body(description="The IP address for the projector.", default=None),
                         password: str | None = Body(description="The PJLink password", default=None)):
    """Edit the given projector."""

    # Get the projector first, so we can use the groups to authenticate
    proj = ex_exhibit.get_projector(projector_uuid=uuid_str)
    if proj is None:
        return {"success": False, "reason": "Projector does not exist"}

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("components", "edit",
                                                                       groups=proj.groups, token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if id is not None:
        proj.id = id
    if groups is not None:
        proj.groups = groups
    if ip_address is not None:
        proj.ip_address = ip_address
    if password is not None:
        proj.password = password
    if description is not None:
        proj.config["description"] = description
    proj.save()
    ex_config.last_update_time = time.time()
    return {"success": True}


@app.post("/projector/queueCommand")
async def queue_projector_command(component: ExhibitComponent,
                                  command: str = Body(
                                      description="The command to be sent to the specified projector.")):
    """Send a command to the specified projector."""

    ex_exhibit.get_exhibit_component(component_id=component.id).queue_command(command)
    return {"success": True, "reason": ""}


@app.post("/component/static/create")
async def create_static_component(request: Request,
                                  id: str = Body(description="The ID of the projector to add."),
                                  groups: list[str] = Body(description="The groups of the projector to add.")):
    """Create a new static component."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    component = ex_exhibit.add_exhibit_component(id, groups, 'static')

    return {"success": True, "uuid": component.uuid}


@app.post("/component/static/{uuid_str}/edit")
async def edit_static_component(request: Request,
                                uuid_str: str,
                                id: str | None = Body(description="The ID of the static component.", default=None),
                                description: str | None = Body(description="A short description of this component.",
                                                               default=None),
                                groups: list[str] | None = Body(description="The groups of the static component.",
                                                                default=None)):
    """Edit the given static component."""

    # Load the component first, so we can use the groups to authenticate
    component = ex_exhibit.get_exhibit_component(component_uuid=uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("components", "edit",
                                                                       groups=component.groups, token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if id is not None:
        component.id = id
    if groups is not None:
        component.groups = groups
    if description is not None:
        component.config["description"] = description
    component.save()
    ex_config.last_update_time = time.time()
    return {"success": True}


@app.post("/component/WOL/create")
async def create_wake_on_LAN_component(request: Request,
                                       id: str = Body(description="The ID of the projector to add."),
                                       groups: list[str] = Body(description="The groups of the projector to add."),
                                       mac_address: str = Body(description="The MAC address of the machine to wake."),
                                       ip_address: str = Body(description="The static IP address of the machine.",
                                                              default="")):
    """Create a new wake on LAN component."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    component = ex_exhibit.add_wake_on_LAN_device(id, groups, mac_address, ip_address=ip_address)

    return {"success": True, "uuid": component.uuid}


@app.post("/component/WOL/{uuid_str}/edit")
async def edit_wake_on_LAN_component(request: Request,
                                     uuid_str: str,
                                     id: str | None = Body(description="The ID of the projector to add.", default=None),
                                     groups: list[str] | None = Body(description="The groups of the projector to add.",
                                                                     default=None),
                                     description: str | None = Body(
                                         description="A short description of this component.", default=None),
                                     mac_address: str = Body(description="The MAC address of the machine to wake."),
                                     ip_address: str = Body(description="The static IP address of the machine.",
                                                            default="")):
    """Edit the given wake on LAN component."""

    # Load the component first, so we can use the groups to authenticate
    component = ex_exhibit.get_wake_on_LAN_component(component_uuid=uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("components", "edit",
                                                                       groups=component.groups, token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if id is not None:
        component.id = id
    if groups is not None:
        component.groups = groups
    if mac_address is not None:
        component.mac_address = mac_address
    if ip_address is not None:
        component.ip_address = ip_address
    if description is not None:
        component.config["description"] = description
    component.save()
    ex_config.last_update_time = time.time()

    return {"success": True}


# Schedule actions
@app.post("/schedule/convert")
async def convert_schedule(
        request: Request,
        date: str = Body(description="The date of the schedule to create, in the form of YYYY-MM-DD."),
        convert_from: str = Body(description="The name of the schedule to clone to the new date.")):
    """Convert between date- and day-specific schedules."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    with ex_config.scheduleLock:
        shutil.copy(ex_tools.get_path(["schedules", convert_from.lower() + ".json"], user_file=True),
                    ex_tools.get_path(["schedules", date + ".json"], user_file=True))

    ex_config.last_update_time = time.time()
    # Reload the schedule from disk
    ex_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with ex_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": ex_config.scheduleUpdateTime,
                         "schedule": ex_config.json_schedule_list,
                         "nextEvent": ex_config.json_next_event}
    return response_dict


@app.post("/schedule/create")
async def create_schedule(request: Request,
                          entries: dict[str, dict] = Body(
                              description="A dict of dicts that each define one entry in the schedule."),
                          name: str = Body(description="The name for the schedule to be created.")):
    """Create a new schedule from an uploaded CSV file"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success, schedule = ex_sched.create_schedule(ex_tools.with_extension(name, 'json'), entries)
    ex_sched.retrieve_json_schedule()
    return {"success": success, "schedule": schedule}


@app.post("/schedule/getSecondsFromMidnight")
async def get_seconds_from_midnight(time_str: str = Body(description="The time to parse.", embed=True)):
    """Return the number of seconds from midnight for the given natural language time.

    This ensures that the value in the browser is consistent with how Python will process.
    """

    return {"success": True, "seconds": ex_sched.seconds_from_midnight(time_str)}


@app.get("/schedule/{schedule_name}/getCSV")
async def get_schedule_as_csv(request: Request,
                              schedule_name: str):
    """Return the requested schedule as a CSV."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success, csv = ex_sched.convert_schedule_to_csv(schedule_name + '.json')
    return {"success": success, "csv": csv}


@app.get("/schedule/{schedule_name}/getJSONString")
async def get_schedule_as_json_string(request: Request,
                                      schedule_name: str):
    """Return the requested schedule as a JSON, excluding unnecessary fields."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success, schedule = ex_sched.load_json_schedule(schedule_name + '.json')
    result = {}

    for key in list(schedule.keys()):
        result[key] = {
            "time": schedule[key].get("time", ""),
            "action": schedule[key].get("action", ""),
            "target": schedule[key].get("target", ""),
            "value": schedule[key].get("value", ""),
        }
    return {"success": success, "json": json.dumps(result, indent=2, sort_keys=True)}


@app.post("/schedule/deleteAction")
async def delete_schedule_action(request: Request,
                                 schedule_name: str = Body(description="The schedule to delete the action from."),
                                 schedule_id: str = Body(
                                     description="The unique identifier of the action to be deleted.")):
    """Delete the given action from the specified schedule."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_sched.delete_json_schedule_event(schedule_name + ".json", schedule_id)
    ex_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with ex_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": ex_config.scheduleUpdateTime,
                         "schedule": ex_config.json_schedule_list,
                         "nextEvent": ex_config.json_next_event}
    return response_dict


@app.post("/schedule/deleteSchedule")
async def delete_schedule(request: Request,
                          name: str = Body(description="The name of the schedule to delete.", embed=True)):
    """Delete the given schedule."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    with ex_config.scheduleLock:
        json_schedule_path = ex_tools.get_path(["schedules", name + ".json"], user_file=True)
        os.remove(json_schedule_path)
    ex_config.last_update_time = time.time()

    # Reload the schedule from disk
    ex_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with ex_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": ex_config.scheduleUpdateTime,
                         "schedule": ex_config.json_schedule_list,
                         "nextEvent": ex_config.json_next_event}
    return response_dict


@app.get("/schedule/refresh")
async def refresh_schedule(request: Request):
    """Reload the schedule from disk and return it."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    ex_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with ex_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": ex_config.scheduleUpdateTime,
                         "schedule": ex_config.json_schedule_list,
                         "nextEvent": ex_config.json_next_event}
    return response_dict


@app.get("/schedule/availableDateSpecificSchedules")
async def get_date_specific_schedules(request: Request):
    """Retrieve a list of available date-specific schedules"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    return {"success": True, "schedules": ex_sched.get_available_date_specific_schedules()}


@app.get("/schedule/{schedule_name}/get")
async def get_specific_schedule(request: Request, schedule_name: str):
    """Retrieve the given schedule and return it as a dictionary."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if not schedule_name.endswith('.json'):
        schedule_name += '.json'
    success, schedule = ex_sched.load_json_schedule(schedule_name)

    return {"success": success, "schedule": schedule}


@app.post("/schedule/update")
async def update_schedule(
        request: Request,
        name: str = Body(),
        time_to_set: str = Body(description="The time of the action to set, expressed in any normal way."),
        action_to_set: str = Body(description="The action to set."),
        target_to_set: list[dict] | dict | None = Body(default=None, description="The details of the component(s) that should be acted upon."),
        value_to_set: str = Body(default="", description="A value corresponding to the action."),
        schedule_id: str = Body(description="A unique identifier corresponding to the schedule entry.")):
    """Write a schedule update to disk.

    This command handles both adding a new scheduled action and editing an existing action
    """

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = ex_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    # Make sure we were given a valid time to parse
    try:
        dateutil.parser.parse(time_to_set)
    except dateutil.parser._parser.ParserError:
        response_dict = {"success": False,
                         "reason": "Time not valid"}
        return response_dict

    ex_sched.update_json_schedule(name + ".json", {
        schedule_id: {"time": time_to_set, "action": action_to_set,
                      "target": target_to_set, "value": value_to_set}})

    error = False
    error_message = ""

    response_dict = {}
    if not error:
        # Reload the schedule from disk
        ex_sched.retrieve_json_schedule()

        # Send the updated schedule back
        with ex_config.scheduleLock:
            response_dict["updateTime"] = ex_config.scheduleUpdateTime
            response_dict["schedule"] = ex_config.json_schedule_list
            response_dict["nextEvent"] = ex_config.json_next_event
            response_dict["success"] = True
    else:
        response_dict["success"] = False
        response_dict["reason"] = error_message
    return response_dict


# System actions

@app.get("/system/getVersion")
async def get_version():
    """Return the current version of Hub"""

    return {"success": True, "version": ex_config.software_version}


@app.get("/system/checkConnection")
async def check_connection():
    """Respond to request to confirm that the connection is active"""

    return {"success": True}


@app.get("/system/{target}/getConfiguration")
async def get_json_configuration(target: str):
    """Return the requested JSON configuration."""

    config_path = ex_tools.get_path(["configuration", f"{target}.json"], user_file=True)
    configuration = ex_tools.load_json(config_path)
    if configuration is not None:
        return {"success": True, "configuration": configuration}
    return {"success": False, "reason": "File does not exist."}


@app.get("/system/getHelpText")
async def get_help_text():
    """Send the contents of README.md"""
    try:
        readme_path = ex_tools.get_path(["README.md"])
        with open(readme_path, 'r', encoding='UTF-8') as f:
            text = f.read()
        response = {"success": True, "text": text}
    except FileNotFoundError:
        with ex_config.logLock:
            logging.error("Unable to read README.md")
        response = {"success": False, "reason": "Unable to read README.md"}
    except PermissionError:
        # For some reason, Pyinstaller insists on placing the README in a directory of the same name on Windows.
        try:
            readme_path = ex_tools.get_path(["README.md", "README.md"])
            with open(readme_path, 'r', encoding='UTF-8') as f:
                text = f.read()
            response = {"success": True, "text": text}
        except (FileNotFoundError, PermissionError):
            with ex_config.logLock:
                logging.error("Unable to read README.md")
            response = {"success": False, "reason": "Unable to read README.md"}

    return response


@app.get('/system/getSoftwareVersion')
async def get_version():
    """Send the current software version."""

    response = {
        "success": True,
        "version": str(ex_config.software_version)
    }
    return response


@app.post("/system/ping")
async def handle_ping(data: dict[str, Any], request: Request):
    """Respond to an incoming heartbeat signal with ahy updates."""

    if "uuid" not in data:
        response = {"success": False,
                    "reason": "Request missing 'uuid' field."}
        return response

    ex_exhibit.update_exhibit_component_status(data, request.client.host)

    component = ex_exhibit.get_exhibit_component(component_uuid=data['uuid'])
    dict_to_send = component.config.copy()

    if len(dict_to_send["commands"]) > 0:
        # Clear the command list now that we are sending
        component.config["commands"] = []
    return dict_to_send


@app.post("/system/{target}/updateConfiguration")
async def update_configuration(target: str,
                               configuration=Body(description="A JSON object specifying the configuration.",
                                                  embed=True)):
    """Write the given object to the matching JSON file as the configuration."""

    if target == "system":
        ex_tools.update_system_configuration(configuration)
    else:
        config_path = ex_tools.get_path(["configuration", f"{target}.json"], user_file=True)
        ex_tools.write_json(configuration, config_path)

        if target == "descriptions":
            ex_exhibit.read_descriptions_configuration()
            ex_config.last_update_time = time.time()

    return {"success": True}


@app.get('/system/updateStream')
async def send_update_stream(request: Request):
    """Create a server-side event stream to send updates to the client."""

    async def event_generator():
        last_update_time = None
        while True:
            # If client closes connection, stop sending events
            if await request.is_disconnected():
                break

            # Checks for new updates and return them to client
            if ex_config.last_update_time != last_update_time:
                last_update_time = ex_config.last_update_time

                yield {
                    "event": "update",
                    "id": str(last_update_time),
                    "retry": 5000,  # milliseconds
                    "data": json.dumps(send_webpage_update(), default=str)
                }
            await asyncio.sleep(0.5)  # seconds

    return EventSourceResponse(event_generator())


app.mount("/js",
          StaticFiles(directory=ex_tools.get_path(["js"])),
          name="js")
app.mount("/css",
          StaticFiles(directory=ex_tools.get_path(["css"])),
          name="css")
try:
    app.mount("/static", StaticFiles(directory=ex_tools.get_path(["static"], user_file=True)),
              name="static")
except RuntimeError:
    # Directory does not exist, so create it
    os.mkdir(ex_tools.get_path(["static"], user_file=True))
    app.mount("/static", StaticFiles(directory=ex_tools.get_path(["static"], user_file=True)),
              name="static")
try:
    app.mount("/issues", StaticFiles(directory=ex_tools.get_path(["issues"], user_file=True)),
              name="issues")
except RuntimeError:
    # Directory does not exist, so create it
    os.mkdir(ex_tools.get_path(["issues"], user_file=True))
    app.mount("/issues", StaticFiles(directory=ex_tools.get_path(["issues"], user_file=True)),
              name="issues")
app.mount("/",
          StaticFiles(directory=ex_tools.get_path([""]), html=True),
          name="root")

if __name__ == "__main__":
    print("Checking file structure...")
    ex_tools.check_file_structure()
    print("Loading exhibits...")
    ex_exhibit.check_available_exhibits()
    print("Loading configuration...")
    load_default_configuration()
    print("Loading users...")
    ex_users.load_users()
    print("Loading groups...")
    ex_group.load_groups()
    print("Loading components...")
    ex_exhibit.load_components()
    ex_proj.poll_projectors()
    ex_exhibit.poll_wake_on_LAN_devices()
    check_for_software_update()

    log_level = "warning"
    if ex_config.debug:
        log_level = "debug"

    print(f"\nLaunching Exhibitera Hub for {ex_config.gallery_name}.")
    print(f"To access the server, visit http://{ex_config.ip_address}:{ex_config.port}")

    # Must use only one worker, since we are relying on the config module being in global
    uvicorn.run(app,
                host="",  # Accept connections on all interfaces
                log_level=log_level,
                port=int(ex_config.port),
                reload=False, workers=1)
