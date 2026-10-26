# Exhibitera Hub
# A centralized server for controlling museum exhibit components
# Written by Morgan Rehnberg, Adventure Science Center
# Released under the MIT license

# Standard modules
from contextlib import asynccontextmanager
import threading
from functools import lru_cache
import logging
import os
import sys
import time
from typing import Any, Union
import uvicorn

# Non-standard modules
import distro
from fastapi import Body, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import requests

# Exhibitera modules
from exhibitera.common.caching import RevalidatePagesMiddleware, file_response
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
from exhibitera.common.protocol_router import url_prefixes
import exhibitera.common.utilities as ex_utilities
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.exhibitions as hub_exhibitions
import exhibitera.hub.features.groups as hub_group
import exhibitera.hub.features.issues as hub_issues
import exhibitera.hub.features.legacy as hub_legacy
import exhibitera.hub.features.programs as hub_programs
import exhibitera.hub.features.projectors as hub_proj
import exhibitera.hub.features.schedules as hub_schedule
import exhibitera.hub.features.system as hub_system
import exhibitera.hub.tools as hub_tools
import exhibitera.hub.features.users as hub_users

# API modules
from exhibitera.hub.api.core import core as core_api

# Protocol, used by Apps
from exhibitera.hub.api.protocol import protocol as protocol_api

# Internal API, used by Hub's own web pages
from exhibitera.hub.api.internal.components import components as components_internal
from exhibitera.hub.api.internal.data import data as data_internal
from exhibitera.hub.api.internal.exhibitions import exhibitions as exhibitions_internal
from exhibitera.hub.api.internal.groups import groups as groups_internal
from exhibitera.hub.api.internal.issues import issues as issues_internal
from exhibitera.hub.api.internal.maintenance import maintenance as maintenance_internal
from exhibitera.hub.api.internal.programs import programs as programs_internal
from exhibitera.hub.api.internal.projectors import projectors as projectors_internal
from exhibitera.hub.api.internal.schedule import schedule as schedule_internal
from exhibitera.hub.api.internal.system import system as system_internal
from exhibitera.hub.api.internal.tracker import tracker as tracker_internal
from exhibitera.hub.api.internal.users import users as users_internal

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
        # We don't have a config file, so let's get info from the user to create one
        hub_system.command_line_setup()
    hub_users.check_for_root_admin()
    hub_users.check_for_first_user()
    hub_tools.load_system_configuration()

    # Handle legacy conversions
    hub_legacy.convert_legacy_projector_configuration()
    hub_legacy.convert_legacy_static_configuration()
    hub_legacy.convert_legacy_wol_configuration()
    hub_legacy.convert_schedule_targets_to_json()
    hub_legacy.convert_legacy_tracker_templates_to_json()
    hub_legacy.migrate_tracker_data()
    hub_legacy.add_programs_permission()

    hub_tools.start_debug_loop()
    hub_schedule.retrieve_json_schedule()
    hub_exhibitions.load_exhibition(hub_config.current_exhibit)

    # Build any existing issues and programs
    hub_issues.read_issue_list()
    hub_programs.read_program_list()

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

    logging.info("Server shutdown")


# Check whether we have packaged with Pyinstaller and set the appropriate root path.
ex_config.exec_path = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    ex_config.application_path = os.path.dirname(sys.executable)
else:
    ex_config.application_path = ex_config.exec_path


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
app.add_middleware(RevalidatePagesMiddleware)
app.openapi = exhibitera_schema


@app.exception_handler(hub_users.AuthError)
async def auth_error_handler(request: Request, exc: hub_users.AuthError):
    """Return failed authentication in the same shape as other API errors."""

    return JSONResponse({"success": False, "reason": exc.reason})

# Link API routers
app.include_router(core_api.router, prefix='/core')

protocol_api.router.include_in(app, url_prefixes)

# Internal API
for internal_router in [components_internal.router,
                        data_internal.router,
                        exhibitions_internal.router,
                        groups_internal.router,
                        issues_internal.router,
                        maintenance_internal.router,
                        programs_internal.router,
                        projectors_internal.router,
                        schedule_internal.router,
                        system_internal.router,
                        tracker_internal.router,
                        users_internal.router]:
    app.include_router(internal_router, prefix='/internal')


@lru_cache()
def get_config():
    return hub_config


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

# Folders of user files served to the web console. Issues and programs are served only from
# their media folders, since their parent folders also hold the issue and program lists.
for url_path, folder in [("/static", ["static"]),
                         ("/issues/media", ["issues", "media"]),
                         ("/programs/media", ["programs", "media"])]:
    directory = ex_files.get_path(folder, user_file=True)
    os.makedirs(directory, exist_ok=True)
    app.mount(url_path, StaticFiles(directory=directory), name=url_path.strip("/").replace("/", "_"))

# The files served from Hub's own folder. Nothing else in it is public: the folder also holds
# Hub's source code and, when running from source, its user data (including users and keys).
ROOT_FILES = {
    "index.html": "text/html",
    "tracker.html": "text/html",
    "config.js": "text/javascript",
    "manifest.json": "application/json",
}
ROOT_FOLDER = ex_files.get_path([""])


@app.get("/", include_in_schema=False)
async def serve_web_console(request: Request):
    return await serve_root_file(request, "index.html")


@app.get("/{filename}", include_in_schema=False)
async def serve_root_file(request: Request, filename: str):
    if filename not in ROOT_FILES:
        raise HTTPException(status_code=404)

    return file_response(request, os.path.join(ROOT_FOLDER, filename), ROOT_FILES[filename])


def run():
    ex_utilities.configure_logging("hub.log")
    logging.info("Server started")

    print("Checking file structure...")
    hub_system.check_file_structure()
    hub_legacy.convert_exhibit_files() # Run early before any exhibits are loaded
    print("Loading components...")
    hub_components.load_components()
    print("Loading exhibits...")
    hub_exhibitions.check_available_exhibitions()
    print("Loading configuration...")
    load_default_configuration()
    print("Loading users...")
    hub_users.load_users()
    print("Loading groups...")
    hub_group.load_groups()

    hub_proj.poll_projectors()
    hub_components.poll_wake_on_lan_devices()
    ex_utilities.check_for_software_update('hub')

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
