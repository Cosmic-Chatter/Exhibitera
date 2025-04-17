# Exhibitera Hub
# A centralized server for controlling museum exhibit components
# Written by Morgan Rehnberg, Adventure Science Center
# Released under the MIT license

# Standard modules
from contextlib import asynccontextmanager
import datetime
import threading
from functools import lru_cache
import logging
import os
import sys
import time
import traceback
from typing import Any, Union
import uvicorn

# Non-standard modules
import distro
from fastapi import Body, FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
import requests

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.exhibits as hub_exhibit
import exhibitera.hub.features.groups as hub_group
import exhibitera.hub.features.issues as hub_issues
import exhibitera.hub.features.legacy as hub_legacy
import exhibitera.hub.features.projectors as hub_proj
import exhibitera.hub.features.schedules as hub_schedule
import exhibitera.hub.features.system as hub_system
import exhibitera.hub.tools as hub_tools
import exhibitera.hub.features.users as hub_users

# API modules
from exhibitera.hub.api.components import components
from exhibitera.hub.api.groups import groups
from exhibitera.hub.api.issues import issues
from exhibitera.hub.api.maintenance import maintenance
from exhibitera.hub.api.projectors import projectors
from exhibitera.hub.api.schedule import schedule
from exhibitera.hub.api.system import system
from exhibitera.hub.api.users import users

# Set up the automatic documentation
def exhibitera_schema():
    # Cached version
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Exhibitera Hub",
        version=str(hub_config.software_version),
        description="Hub coordinates communication between Exhibitera components and provides a web-based interface for controlling them. It also provides tools for collecting qualitative and quantitative data, tracking maintenance, and logging exhibit issues.",
        routes=app.routes,
    )
    openapi_schema["info"] = {
        "title": "Exhibitera Hub",
        "version": str(hub_config.software_version),
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


def load_default_configuration() -> None:
    """Initialize the server in a default state."""

    # Load the current software version
    hub_config.software_version = ex_files.load_json((ex_files.get_path(["_static", "semantic_version.json"]))).get("version", {})

    # Check if there is a configuration file
    config_path = ex_files.get_path(["configuration", "system.json"], user_file=True)
    if not os.path.exists(config_path):
        # We don't have a apps_config file, so let's get info from the user to create one
        hub_system.command_line_setup()
    hub_users.check_for_root_admin()
    hub_tools.load_system_configuration()

    # Handle legacy conversions
    hub_legacy.convert_legacy_projector_configuration()
    hub_legacy.convert_legacy_static_configuration()
    hub_legacy.convert_legacy_wol_configuration()
    hub_legacy.convert_schedule_targets_to_json()
    hub_legacy.convert_legacy_tracker_templates_to_json()

    hub_tools.start_debug_loop()
    hub_schedule.retrieve_json_schedule()
    hub_exhibit.read_exhibit_configuration(hub_config.current_exhibit)

    # Build any existing issues
    hub_issues.read_issue_list()

    # Save the current software version in .last_ver
    last_ver_path = ex_files.get_path(["configuration", ".last_ver"], user_file=True)
    with open(last_ver_path, 'w', encoding='UTF-8') as f:
        f.write(str(hub_config.software_version))


def quit_handler(*args) -> None:
    """Handle cleanly shutting down the server."""

    for key in hub_config.polling_thread_dict:
        hub_config.polling_thread_dict[key].cancel()

    for component in hub_config.componentList:
        component.clean_up()
        component.save()
    for component in hub_config.projectorList:
        component.clean_up()
        component.save()
    for component in hub_config.wakeOnLANList:
        component.clean_up()
        component.save()

    with hub_config.logLock:
        logging.info("Server shutdown")


def error_handler(*exc_info) -> None:
    """Catch errors and log them to file"""

    text = "".join(traceback.format_exception(*exc_info)).replace('"', "'").replace("\n", "<newline>")
    with hub_config.logLock:
        logging.error(f'"{text}"')
    print(f"Error: see hub.log for more details ({datetime.datetime.now()})")


def check_for_outdated_os() -> tuple[bool, str]:
    """Check if the OS release is out of date.

    This is a very limited check based on Ubuntu and Windows
    """

    message = "This OS version may be unsupported in the next version of Exhibitera."

    if sys.platform == 'linux':
        # Check for outdated Ubuntu
        if distro.id() != 'ubuntu':
            # We are only checking for Ubuntu right now
            return False, ""

        # Ubuntu LTS versions are supported for 5 years
        version_parts = distro.version_parts(best=True)
        major = int(version_parts[0])
        minor = int(version_parts[1])
        if major % 2 != 0 or minor != 4:
            # LTS releases are always even year + 04, such as 22.04
            return True, message
        now = datetime.datetime.now()
        now_year = int(now.strftime("%y"))
        if now_year - major >= 5:
            # LTS releases are supported for 5 years
            return True, message

    if sys.platform == 'win32':
        return False, ""

    return False, ""


def check_for_software_update() -> None:
    """Download the version file from GitHub and check if there is an update"""

    print("Checking for update... ", end="")
    hub_config.software_update_available = False

    local_dict = ex_files.load_json(ex_files.get_path(["_static", "semantic_version.json"]))
    if local_dict is None:
        print("error. The semantic version file is corrupt and cannot be read.")
        return

    remote_dict = None
    try:
        version_url = "https://raw.githubusercontent.com/Cosmic-Chatter/Exhibitera/main/exhibitera/hub/_static/semantic_version.json"
        response = requests.get(version_url, timeout=2)
        response.raise_for_status()
        remote_dict = response.json()
    except requests.RequestException as e:
        print("cannot connect to update server")
    except ValueError as e:
        print("cannot connect to update server")

    if remote_dict is not None:
        # Compare the local and remote versions to check for an update
        if remote_dict["version"]["major"] > local_dict["version"]["major"]:
            hub_config.software_update_available = True
        elif remote_dict["version"]["major"] < local_dict["version"]["major"]:
            hub_config.software_update_available = False
        else:
            # Major versions equal
            if remote_dict["version"]["minor"] > local_dict["version"]["minor"]:
                hub_config.software_update_available = True
            elif remote_dict["version"]["minor"] < local_dict["version"]["minor"]:
                hub_config.software_update_available = False
            else:
                # Major & minor versions equal
                if remote_dict["version"]["patch"] > local_dict["version"]["patch"]:
                    hub_config.software_update_available = True
                elif remote_dict["version"]["patch"] <= local_dict["version"]["patch"]:
                    hub_config.software_update_available = False

        if hub_config.software_update_available:
            print("update available!")
            hub_config.software_update_available_version = remote_dict["version"]
        else:
            print("the server is up to date.")

    # Check to see if the OS is out of date
    outdated, message = check_for_outdated_os()
    hub_config.outdated_os = outdated

    # Reset the timer to check for an update tomorrow
    if hub_config.software_update_timer is not None:
        hub_config.software_update_timer.cancel()
    hub_config.software_update_timer = threading.Timer(86400, check_for_software_update)
    hub_config.software_update_timer.daemon = True
    hub_config.software_update_timer.start()


# Check whether we have packaged with Pyinstaller and set the appropriate root path.
ex_config.exec_path = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    ex_config.application_path = os.path.dirname(sys.executable)
else:
    ex_config.application_path = ex_config.exec_path

# Set up log file
log_path: str = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

sys.excepthook = error_handler

with hub_config.logLock:
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

# Link API routers
app.include_router(components.router)
app.include_router(groups.router)
app.include_router(issues.router)
app.include_router(maintenance.router)
app.include_router(projectors.router)
app.include_router(schedule.router)
app.include_router(system.router)
app.include_router(users.router)


@lru_cache()
def get_config():
    return hub_config


@app.post("/exhibit/create")
async def create_exhibit(request: Request,
                         name: str = Body(description="The name of the exhibit."),
                         clone_from: str | None = Body(default=None, description="The name of the exhibit to clone.")):
    """Create a new exhibit JSON file."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    uuid_str = hub_exhibit.create_new_exhibit(name, clone_from)
    return {"success": True, "reason": "", "uuid": uuid_str}


@app.post("/exhibit/{uuid_str}/edit")
async def edit_exhibit(request: Request,
                       uuid_str: str,
                       details: dict[str, Any] = Body(
                           description="A dictionary specifying the details of the exhibit.", embed=True)):
    """Update the given exhibit with the specified details."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    path = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, '.json')], user_file=True)
    ex_files.write_json(details, path)
    hub_exhibit.check_available_exhibits()
    hub_config.last_update_time = time.time()

    return {"success": True, "reason": ""}


@app.delete("/exhibit/{uuid_str}")
async def delete_exhibit(request: Request, uuid_str: str):
    """Delete the specified exhibit."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_exhibit.delete_exhibit(uuid_str)
    return {"success": True, "reason": ""}


@app.post("/exhibit/{uuid_str}/set")
async def set_exhibit(uuid_str: str):
    """Set the specified exhibit as the current one."""

    hub_tools.update_system_configuration({"current_exhibit": uuid_str})
    success, reason = hub_exhibit.read_exhibit_configuration(uuid_str)
    return {"success": success, "reason": reason}


@app.get("/exhibit/getAvailable")
async def get_available_exhibits():
    """Return a list of available exhibits."""

    return {"success": True, "available_exhibits": hub_config.exhibit_list}


@app.get("/exhibit/{uuid_str}/details")
async def get_exhibit_details(uuid_str: str):
    """Return the JSON for a particular exhibit."""

    exhibit_path = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, 'json')], user_file=True)
    result = ex_files.load_json(exhibit_path)
    if result is None:
        return {"success": False, "reason": "Exhibit does not exist."}
    return {"success": True, "exhibit": result}


# Flexible Tracker actions
@app.post("/tracker/{tracker_type}/createTemplate")
async def create_tracker_template(request: Request,
                                  tracker_type: str,
                                  template: dict[str, Any] = Body(description='A dictionary containing the template'),
                                  tracker_uuid: str = Body(description='The UUID for the template we are creating.')):
    """Write the given tracker template to file"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    template_path = ex_files.get_path(
        [tracker_type, "templates", ex_files.with_extension(tracker_uuid, 'json')],
        user_file=True)
    success, reason = ex_files.write_json(template, template_path)
    return {"success": success, "reason": reason}


@app.post("/tracker/{tracker_type}/deleteData")
async def delete_tracker_data(request: Request, data: dict[str, Any], tracker_type: str):
    """Delete the specified tracker data file."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("analytics", "edit", token=token)
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
    data_path = ex_files.get_path([tracker_type, "data", name], user_file=True)
    success = True
    reason = ""
    with hub_config.trackingDataWriteLock:
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


@app.delete("/tracker/{tracker_type}/{tracker_uuid}/deleteTemplate")
async def delete_tracker_template(request: Request, tracker_type: str, tracker_uuid: str):
    """Delete the specified tracker template."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    file_path = ex_files.get_path([tracker_type, "templates", ex_files.with_extension(tracker_uuid, 'json')], user_file=True)
    with hub_config.trackerTemplateWriteLock:
        response = hub_tools.delete_file(file_path)
    return response


@app.get("/tracker/{tracker_type}/getAvailableData")
async def get_available_tracker_data(tracker_type: str):
    """Send a list of all the available data files for the given tracker group."""

    data_path = ex_files.get_path([tracker_type, "data"], user_file=True)
    data_list = []
    for file in os.listdir(data_path):
        if file.lower().endswith(".txt"):
            data_list.append(file)
    response = {"success": True,
                "data": data_list}
    return response


@app.get("/tracker/{tracker_type}/getAvailableTemplates")
async def get_available_tracker_templates(tracker_type: str):
    """Send a list of all the available templates for the given tracker group (usually flexible-tracker)."""

    template_list = []
    template_path = ex_files.get_path([tracker_type, "templates"], user_file=True)
    for file in os.listdir(template_path):
        if file.lower().endswith(".json"):
            file_path = ex_files.get_path([tracker_type, "templates", file], user_file=True)
            template = ex_files.load_json(file_path)
            template_list.append({"name": template["name"], "uuid": template["uuid"]})

    return template_list


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
    data_path = ex_files.get_path([tracker_type, "data", name], user_file=True)
    if not os.path.exists(data_path):
        return {"success": False, "reason": f"File {data['name']}.txt does not exist!", "csv": ""}
    result = ex_files.create_csv(data_path)
    return {"success": True, "csv": result}


@app.get("/tracker/{tracker_type}/{template_uuid}")
async def get_tracker_template(tracker_type: str, template_uuid: str):
    """Load the requested tracker template and return it as a dictionary."""

    template_path = ex_files.get_path([tracker_type, "templates", ex_files.with_extension(template_uuid, "json")])
    template = ex_files.load_json(template_path)
    if template is None:
        success = False
    else:
        success = True

    return {"success": success, "template": template}


@app.post("/tracker/{tracker_type}/getRawText")
async def get_tracker_raw_text(data: dict[str, Any], tracker_type: str):
    """Load the contents of the appropriate file and return them."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response

    file_path = ex_files.get_path([tracker_type, "data", ex_files.with_extension(data["name"], 'txt')], user_file=True)
    result, success, reason = ex_files.get_text(file_path)
    response = {"success": success, "reason": reason, "text": result}
    return response


@app.post("/tracker/submitAnalytics")
async def submit_analytics(data: dict[str, Any]):
    """Write the provided analytics data to file."""

    if "data" not in data or 'name' not in data:
        return {"success": False, "reason": "Request missing 'data' or 'name' field."}

    file_path = ex_files.get_path(["analytics", ex_files.with_extension(data["name"], "txt")], user_file=True)
    success, reason = ex_files.write_json(data["data"], file_path, append=True)
    return {"success": success, "reason": reason}


@app.post("/tracker/{tracker_type}/submitData")
async def submit_tracker_data(data: dict[str, Any], tracker_type: str):
    """Record the submitted data to file."""

    if "data" not in data or "name" not in data:
        return {"success": False, "reason": "Request missing 'data' or 'name' field."}

    file_path = ex_files.get_path([tracker_type, "data", ex_files.with_extension(data["name"], 'txt')], user_file=True)
    success, reason = ex_files.write_json(data["data"], file_path, append=True, indent=None)
    return {"success": success, "reason": reason}


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
    file_path = ex_files.get_path([tracker_type, "data", ex_files.with_extension(data["name"], 'txt')], user_file=True)
    success, reason = ex_files.write_text(data["text"],file_path, mode)
    response = {"success": success, "reason": reason}
    return response


app.mount("/common",
          StaticFiles(directory=ex_files.get_path(["..", 'common']), html=True),
          name="common")
app.mount("/css",
          StaticFiles(directory=ex_files.get_path(["css"])),
          name="css")
app.mount("/js",
          StaticFiles(directory=ex_files.get_path(["js"])),
          name="js")
app.mount("/_static",
          StaticFiles(directory=ex_files.get_path(["_static"])),
          name="_static")
try:
    app.mount("/static", StaticFiles(directory=ex_files.get_path(["static"], user_file=True)),
              name="static")
except RuntimeError:
    # Directory does not exist, so create it
    os.mkdir(ex_files.get_path(["static"], user_file=True))
    app.mount("/static", StaticFiles(directory=ex_files.get_path(["static"], user_file=True)),
              name="static")
try:
    app.mount("/issues", StaticFiles(directory=ex_files.get_path(["issues"], user_file=True)),
              name="issues")
except RuntimeError:
    # Directory does not exist, so create it
    os.mkdir(ex_files.get_path(["issues"], user_file=True))
    app.mount("/issues", StaticFiles(directory=ex_files.get_path(["issues"], user_file=True)),
              name="issues")
app.mount("/",
          StaticFiles(directory=ex_files.get_path([""]), html=True),
          name="root")

def run():
    print("Checking file structure...")
    hub_tools.check_file_structure()
    hub_legacy.convert_exhibit_files() # Run early before any exhibits are loaded
    print("Loading components...")
    hub_exhibit.load_components()
    print("Loading exhibits...")
    hub_exhibit.check_available_exhibits()
    print("Loading configuration...")
    load_default_configuration()
    print("Loading users...")
    hub_users.load_users()
    print("Loading groups...")
    hub_group.load_groups()

    hub_proj.poll_projectors()
    hub_exhibit.poll_wake_on_lan_devices()
    check_for_software_update()

    log_level = "warning"
    if ex_config.debug:
        log_level = "debug"

    print(f"\nLaunching Exhibitera Hub for {hub_config.gallery_name}.")
    print(f"To access the server, visit http://{hub_config.ip_address}:{hub_config.port}")

    # Must use only one worker, since we are relying on the apps_config module being in global
    uvicorn.run(app,
                host="",  # Accept connections on all interfaces
                log_level=log_level,
                port=int(hub_config.port),
                reload=False, workers=1)

if __name__ == "__main__":
    run()