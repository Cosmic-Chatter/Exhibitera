# Standard modules
from functools import lru_cache, partial
import logging
import os
import shutil
import sys
import threading
from typing import Annotated, Any

# Non-standard modules
from fastapi import FastAPI, Body, Depends, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.common.utilities as ex_utilities
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.dmx as apps_dmx
import exhibitera.apps.features.files as apps_files
import exhibitera.apps.features.legacy as apps_legacy
import exhibitera.apps.features.utilities as apps_utilities
import exhibitera.apps.features.system as apps_system

# API Modules
from exhibitera.apps.api.files import files
from exhibitera.apps.api.definitions import definitions
from exhibitera.apps.api.system import system

# If we're not on Linux, prepare to use the webview
if sys.platform != 'linux':
    import webview
    import webview.menu as webview_menu

    import exhibitera.apps.features.apps_webview as apps_webview


ex_config.exec_path = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    ex_config.application_path = os.path.dirname(sys.executable)
else:
    ex_config.application_path = ex_config.exec_path


# Set up log file
log_path: str = ex_files.get_path(["apps.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

apps_files.check_directory_structure()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/common",
          StaticFiles(directory=ex_files.get_path(["..", 'common']), html=True),
          name="common")
app.mount("/dmx_control",
          StaticFiles(directory=ex_files.get_path(["dmx_control"]), html=True),
          name="dmx_control")
app.mount("/image_compare",
          StaticFiles(directory=ex_files.get_path(["image_compare"]), html=True),
          name="image_compare")
app.mount("/infostation",
          StaticFiles(directory=ex_files.get_path(["infostation"]), html=True),
          name="infostation")
app.mount("/other",
          StaticFiles(directory=ex_files.get_path(["other"]), html=True),
          name="other")
app.mount("/media_browser",
          StaticFiles(directory=ex_files.get_path(["media_browser"]), html=True),
          name="media_browser")
app.mount("/media_player",
          StaticFiles(directory=ex_files.get_path(["media_player"]), html=True),
          name="media_player")
app.mount("/timelapse_viewer",
          StaticFiles(directory=ex_files.get_path(["timelapse_viewer"]), html=True),
          name="timelapse_viewer")
app.mount("/timeline_explorer",
          StaticFiles(directory=ex_files.get_path(["timeline_explorer"]), html=True),
          name="timeline_explorer")
app.mount("/voting_kiosk",
          StaticFiles(directory=ex_files.get_path(["voting_kiosk"]), html=True),
          name="voting_kiosk")
app.mount("/word_cloud",
          StaticFiles(directory=ex_files.get_path(["word_cloud"]), html=True),
          name="word_cloud")
app.mount("/js",
          StaticFiles(directory=ex_files.get_path(["js"])),
          name="js")
app.mount("/css",
          StaticFiles(directory=ex_files.get_path(["css"])),
          name="css")
app.mount("/configuration",
          StaticFiles(directory=ex_files.get_path(
              ["configuration"], user_file=True)),
          name="configuration")
app.mount("/content",
          StaticFiles(directory=ex_files.get_path(
              ["content"], user_file=True)),
          name="content")
app.mount("/_fonts",
          StaticFiles(directory=ex_files.get_path(["_fonts"])),
          name="_fonts")
app.mount("/_static",
          StaticFiles(directory=ex_files.get_path(["_static"])),
          name="_static")
app.mount("/static",
          StaticFiles(directory=ex_files.get_path(
              ["static"], user_file=True)),
          name="static")
app.mount("/temp",
          StaticFiles(directory=ex_files.get_path(
              ["temp"], user_file=True)),
          name="temp")
app.mount("/thumbnails",
          StaticFiles(directory=ex_files.get_path(
              ["thumbnails"], user_file=True)),
          name="thumbnails")

app.include_router(definitions.router)
app.include_router(files.router)
app.include_router(system.router)


@lru_cache()
def get_config():
    return apps_config


@app.get("/", response_class=HTMLResponse)
async def root():
    return await serve_html("setup")


@app.get("/{file_name}.html", response_class=HTMLResponse)
async def serve_html(file_name):
    # First try a local file and then an Exhibitera file
    file_path = ex_files.get_path([file_name + ".html"], user_file=True)
    if not os.path.isfile(file_path):
        file_path = ex_files.get_path([file_name + ".html"], user_file=False)
    with open(file_path, "r", encoding='UTF-8') as f:
        page = str(f.read())
    return page


@app.get("/README.md", response_class=HTMLResponse)
async def serve_readme():
    # First try a local file and then an Exhibitera file
    file_path = ex_files.get_path(["README.md"])
    with open(file_path, "r") as f:
        file = str(f.read())
    return file


@app.get("/getUpdate")
async def send_update(config: apps_config = Depends(get_config)):
    """Get some key info for updating the component and web console."""

    response_dict = {
        "permissions": config.defaults["permissions"],
        "commands": config.commandList,
        "missingContentWarnings": config.missingContentWarningList
    }
    return response_dict


@app.get("/restart")
async def do_restart():
    apps_system.reboot()


@app.get("/sleepDisplay")
async def do_sleep():
    apps_system.sleep_display()


@app.get("/shutdown")
@app.get("/powerOff")
async def do_shutdown():
    apps_system.shutdown()


@app.get("/powerOn")
@app.get("/wakeDisplay")
async def do_wake():
    apps_system.wake_display()


@app.post("/data/{name}/append")
async def append_data(name: str,
                     data: dict[str, Any] = Body(description="A dictionary of data to be written to file as JSON.", embed=True)):
    """Record the submitted data to file as JSON."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    success, reason = ex_files.write_json(data, file_path, append=True, indent=None)
    response = {"success": success, "reason": reason}
    return response


@app.post("/data/{name}/rawText")
async def write_raw_text(name: str,
                         text: str = Body(description='The data to write.'),
                         mode: str = Body(description="Pass 'a' to append or 'w' or overwrite.", default='a')):
    """Write the raw text to file.

    Set mode == 'a' to append or 'w' to overwrite the file.
    """

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    if mode != "a" and mode != "w":
        response = {"success": False,
                    "reason": "Invalid mode field: must be 'a' (append, [default]) or 'w' (overwrite)"}
        return response
    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')])
    success, reason = ex_files.write_text(text, file_path, mode=mode)
    response = {"success": success, "reason": reason}
    return response


@app.get("/data/{name}/rawText")
async def read_raw_text(name: str):
    """Load the given file and return the raw text."""

    file_path = ex_files.get_path(["data", ex_files.with_extension(name, 'txt')], user_file=True)
    result, success, reason = ex_files.get_text(file_path)

    response = {"success": success, "reason": reason, "text": result}
    return response


@app.get("/data/{name}/csv")
async def get_tracker_data_csv(name: str):
    """Return the requested data file as a CSV string."""

    if not ex_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    if not name.lower().endswith(".txt"):
        name += ".txt"
    data_path = ex_files.get_path(["data", name], user_file=True)
    if not os.path.exists(data_path):
        return {"success": False, "reason": f"File {name}.txt does not exist!", "csv": ""}
    result = ex_files.create_csv(data_path)
    return {"success": True, "csv": result}


@app.get("/data/getAvailable")
async def get_available_data():
    """Return a list of files in the /data directory."""

    return {"success": True, "files": ex_files.get_directory_contents(["data"])}


@app.post("/system/configuration/update")
async def set_defaults(defaults: dict = Body(description="A dictionary matching the structure of config.json."),
                       cull: bool = Body(description="Whether to replace the existing defaults with the provided ones.",
                                         default=False)):
    """Update the given configuration with the specified values"""

    apps_utilities.update_configuration(defaults, cull=cull)

    return {"success": True}


# DMX actions

@app.get("/DMX/getAvailableControllers")
async def get_dmx_controllers():
    """Return a list of connected DMX controllers."""

    success, reason, controllers = apps_dmx.get_available_controllers()

    return {"success": success, "reason": reason, "controllers": controllers}


@app.get("/DMX/{universe_index}/debug")
async def debug_dmx_universe(universe_index: int):
    """Trigger the debug mode for the universe at the given index"""

    print(apps_config.dmx_universes, universe_index, type(universe_index))
    apps_config.dmx_universes[universe_index].controller.web_control()


@app.get("/DMX/configuration")
async def get_dmx_configuration():
    """Return the JSON DMX configuration file."""

    success, reason = apps_dmx.activate_dmx()
    config_dict = {
        "universes": [],
        "groups": []
    }
    if success is True:
        config_path = ex_files.get_path(
            ["configuration", "dmx.json"], user_file=True)
        config_dict = ex_files.load_json(config_path)

    return {"success": success, "reason": reason, "configuration": config_dict}


@app.get("/DMX/status")
async def get_dmx_status():
    """Return a dictionary with the current channel value for every channel in every fixture."""

    success, reason = apps_dmx.activate_dmx()

    result = {}

    for fixture in apps_config.dmx_fixtures:
        result[fixture.uuid] = fixture.get_all_channel_values()

    return {"success": success, "reason": reason, "status": result}


@app.post("/DMX/fixture/create")
async def create_dmx_fixture(name: str = Body(description="The name of the fixture."),
                             channels: list[str] = Body(description="A list of channel names."),
                             start_channel: int = Body(description="The first channel to allocate."),
                             universe: str = Body(description='The UUID of the universe this fixture belongs to.')):
    """Create a new DMX fixture"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    new_fixture = apps_dmx.get_universe(uuid_str=universe).create_fixture(name, start_channel, channels)
    apps_dmx.write_dmx_configuration()

    return {"success": True, "fixture": new_fixture.get_dict()}


@app.post("/DMX/fixture/edit")
async def edit_dmx_fixture(fixture_uuid: str = Body(description="The UUID of the fixture to edit."),
                           name: str = Body(description="The name of the fixture.", default=None),
                           channels: list[str] = Body(description="A list of channel names.", default=None),
                           start_channel: int = Body(description="The first channel to allocate.", default=None),
                           universe: str = Body(description='The UUID of the universe this fixture belongs to.')):
    """Edit an existing DMX fixture"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_universe(uuid_str=universe).get_fixture(fixture_uuid)
    fixture.update(name=name, start_channel=start_channel, channel_list=channels)
    apps_dmx.write_dmx_configuration()

    return {"success": True, "fixture": fixture.get_dict()}


@app.post("/DMX/fixture/remove")
async def remove_dmx_fixture(fixture_uuid: str = Body(description="The UUID of the fixture to remove.", embed=True)):
    """Remove the given DMX fixture from its universe and any groups"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(fixture_uuid)
    if fixture is None:
        print(f"/DMX/fixture/remove: Cannot remove fixture {fixture_uuid}. It does not exist.")
        return {"success": False, "reason": "Fixture does not exist."}
    fixture.delete()
    apps_dmx.write_dmx_configuration()

    return {"success": True}


@app.post("/DMX/fixture/{fixture_uuid}/setBrightness")
async def set_dmx_fixture_to_brightness(fixture_uuid: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given fixture to the specified brightness."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(fixture_uuid)
    fixture.set_brightness(value, duration)
    return {"success": True, "configuration": fixture.get_dict()}


@app.post("/DMX/fixture/{fixture_uuid}/setChannel")
async def set_dmx_fixture_channel(fixture_uuid: str,
                                  channel_name: str = Body(
                                      "The name of the chanel to set."),
                                  value: int = Body(
                                      description="The value to be set."),
                                  duration: float = Body(description="How long the transition should take.",
                                                         default=0)):
    """Set the given channel of the given fixture to the given value."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(fixture_uuid)
    fixture.set_channel(channel_name, value)
    return {"success": True, "configuration": fixture.get_dict()}


@app.post("/DMX/fixture/{fixture_uuid}/setColor")
async def set_dmx_fixture_to_color(fixture_uuid: str,
                                   color: list = Body(
                                       description="The color to be set."),
                                   duration: float = Body(description="How long the color transition should take.",
                                                          default=0)):
    """Set the given fixture to the specified color."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(fixture_uuid)
    if fixture is None:
        return {"success": False, "reason": "Figure does not exist."}
    fixture.set_color(color, duration)
    return {"success": True, "configuration": fixture.get_dict()}


@app.post("/DMX/group/create")
async def create_dmx_group(name: str = Body(description="The name of the group to create."),
                           fixture_list: list[str] = Body(description="The UUIDs of the fixtures to include.")):
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    new_group = apps_dmx.create_group(name)

    fixtures = []
    for fixture_uuid in fixture_list:
        fixtures.append(apps_dmx.get_fixture(fixture_uuid))
    new_group.add_fixtures(fixtures)
    apps_dmx.write_dmx_configuration()

    return {"success": True, "uuid": new_group.uuid}


@app.post("/DMX/group/{group_uuid}/edit")
async def edit_dmx_group(group_uuid: str,
                         name: str = Body(description="The new name for the group", default=""),
                         fixture_list: list[str] = Body(
                             description="A list of UUIDs for fixtures that should be included.", default=[])):
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)

    if group is None:
        return {"success": False, "reason": f"Group {group_uuid} does not exist."}

    if name != "":
        group.name = name

    if len(fixture_list) > 0:
        # First, remove any fixtures that are in the group, but not in fixture_list
        for fixture_uuid in group.fixtures.copy():
            if fixture_uuid not in fixture_list:
                group.remove_fixture(fixture_uuid)

        # Then, loop through fixture_list and add any that are not included in the group
        fixtures_to_add = []
        for fixture_uuid in fixture_list:
            if fixture_uuid not in group.fixtures:
                fixture = apps_dmx.get_fixture(fixture_uuid)
                if fixture is not None:
                    fixtures_to_add.append(fixture)

        if len(fixtures_to_add) > 0:
            group.add_fixtures(fixtures_to_add)
    apps_dmx.write_dmx_configuration()

    return {"success": True}


@app.get("/DMX/group/{group_uuid}/delete")
async def delete_dmx_group(group_uuid: str):
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    apps_dmx.get_group(group_uuid).delete()
    apps_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/createScene")
async def create_dmx_scene(group_uuid: str,
                           name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Create the given scene for the specified group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    uuid_str = group.create_scene(name, values, duration=duration)
    apps_dmx.write_dmx_configuration()
    return {"success": True, "uuid": uuid_str}


@app.post("/DMX/group/{group_uuid}/editScene")
async def create_dmx_scene(group_uuid: str,
                           uuid: str = Body(description="The UUID of the scene to edit."),
                           name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Edit the given scene for the specified group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)

    scene = group.get_scene(uuid_str=uuid)

    scene.name = name
    scene.duration = duration
    scene.set_values(values)

    apps_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/deleteScene")
async def create_dmx_scene(group_uuid: str,
                           uuid: str = Body(description="The UUID of the scene to edit.", embed=True)):
    """Delete the given scene for the specified group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.delete_scene(uuid)

    apps_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/setBrightness")
async def set_dmx_fixture_to_brightness(group_uuid: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given group to the specified brightness."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.set_brightness(value, duration)
    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/group/{group_uuid}/setChannel")
async def set_dmx_group_channel(group_uuid: str,
                                channel: str = Body(description="The channel to set."),
                                value: int = Body(description="The value to set.")):
    """Set the given channel to the specified value for every fixture in the group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.set_channel(channel, value)
    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/group/{group_uuid}/setColor")
async def set_dmx_group_to_color(group_uuid: str,
                                 color: list = Body(
                                     description="The color to be set."),
                                 duration: float = Body(description="How long the color transition should take.",
                                                        default=0)):
    """Set the given group to the specified color."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.set_color(color, duration)
    return {"success": True, "configuration": group.get_dict()}


@app.get("/DMX/group/{group_uuid}/getScenes")
async def get_dmx_group_scenes(group_uuid: str):
    """Return a list of the available scenes for the given group."""

    response = {"success": True, "scenes": []}

    config_path = ex_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        response["success"] = False
        response["reason"] = "no_config_file"
        return response

    config_dict = ex_files.load_json(config_path)
    groups = config_dict["groups"]
    matches = [group for group in groups if group.uuid == group_uuid]
    if len(matches) == 0:
        response["success"] = False
        response["reason"] = "group_not_found"
        return response
    group = matches[0]
    response["scenes"] = group["scenes"]
    return response


@app.get("/DMX/getScenes")
async def get_dmx_scenes():
    """Return a list of the available scenes across all groups."""

    response = {"success": True, "groups": []}

    config_path = ex_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        response["success"] = False
        response["reason"] = "no_config_file"
        return response

    config_dict = ex_files.load_json(config_path)
    groups = config_dict["groups"]

    for group_def in groups:
        group = {}
        group["uuid"] = group_def["uuid"]
        group["name"] = group_def["name"]
        scenes = []
        for scene_def in group_def["scenes"]:
            scene = {"uuid": scene_def["uuid"], "name": scene_def["name"]}
            scenes.append(scene)
        group["scenes"] = scenes
        response["groups"].append(group)

    return response


@app.get("/DMX/setScene/{scene_uuid}")
async def set_dmx_scene(scene_uuid: str):
    """Search for and run a DMX scene."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    _, group = apps_dmx.get_scene(scene_uuid)
    group.show_scene(scene_uuid)


@app.post("/DMX/group/{group_uuid}/showScene")
async def set_dmx_group_scene(group_uuid: str,
                              uuid: str = Body(
                                  description="The UUID of the scene to be run.",
                                  default="",
                                  embed=True)
                              ):
    """Run a scene for the given group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.show_scene(uuid)

    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/universe/create")
async def create_dmx_universe(name: str = Body(description="The name of the universe."),
                              controller: str = Body(description="The type of this controller (OpenBMX or uDMX)."),
                              device_details: dict[str, Any] = Body(
                                  description="A dictionary of hardware details for the controller.")):
    """Create a new DMXUniverse."""

    apps_dmx.activate_dmx()
    new_universe = apps_dmx.create_universe(name,
                                            controller=controller,
                                            device_details=device_details)
    apps_dmx.write_dmx_configuration()
    apps_config.dmx_active = True

    return {"success": True, "universe": new_universe.get_dict()}


@app.post("/DMX/universe/rename")
async def create_dmx_universe(uuid: str = Body(description="The UUID of the universe."),
                              new_name: str = Body(description="The new name to set.")):
    """Change the name for a universe."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    apps_dmx.get_universe(uuid_str=uuid).name = new_name
    apps_dmx.write_dmx_configuration()

    return {"success": True}


@app.delete("/DMX/universe/{universe_uuid}")
async def delete_dmx_universe(universe_uuid: str):
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    universe = apps_dmx.get_universe(uuid_str=universe_uuid)
    if universe is None:
        return {"success": False, "reason": "Universe does not exist"}
    universe.delete()
    return {"success": True}


@app.get('/app/closeSetupWizard')
def close_setup_wizard():
    """Destroy the setup wizard webview"""

    for window in webview.windows:
        if window.title == 'Exhibitera Apps Setup':
            window.destroy()


@app.post('/app/showWindow/{window}')
def show_webview_window(window: str,
                        reload: bool = Body(description="Should the window be reloaded if it already exists?",
                                            embed=True,
                                            default=False)):
    """Show the requested webview window"""

    apps_webview.show_webview_window(window, reload=reload)


@app.post('/app/saveFile')
def save_file_from_webview(data: str = Body(description='The string data to save to file'),
                           filename: str = Body(description="The default filename to provide",
                                                default="download.txt")):
    """Ask the webview to create a file save dialog."""

    apps_webview.save_file(data, filename)


def bootstrap_app(port):
    """Start the app without a config.json file.

    Need this stub to work around a limitation in pywebview (no kwargs)
    """

    start_app(port=port)


def start_app(port=None, with_webview: bool = True):
    """Start the webserver.

    If with_webview == True, start as a daemon thread so that when the webview closes, the app shuts down.
    """

    if with_webview is True:
        apps_config.server_process = threading.Thread(target=_start_server, daemon=True, kwargs={"port": port})
        apps_config.server_process.start()
    else:
        _start_server()


def _start_server(port=None):
    if port is None:
        port = int(apps_config.defaults["system"]["port"])

    # Must use only one worker, since we are relying on the apps_config module being in global
    uvicorn.run(app,
                host="",
                port=port,
                reload=False, workers=1)


def create_config():
    """Create a new configuration file."""

    if sys.platform == 'linux':
        # Linux apps can't use the GUI
        apps_utilities.handle_missing_defaults_file()
    else:
        print('config.json file not found! Bootstrapping server.')

        available_port = apps_utilities.find_available_port()

        webview.create_window('Exhibitera Apps Setup',
                              confirm_close=False,
                              height=720,
                              width=720,
                              min_size=(720, 720),
                              url='http://localhost:' + str(
                                  available_port) + '/first_time_setup.html')

        webview.start(func=bootstrap_app, args=available_port, private_mode=False)

def run():
    """Initialize the server"""

    defaults_path = ex_files.get_path(['configuration', 'config.json'], user_file=True)
    if os.path.exists(defaults_path):
        if apps_utilities.read_defaults() is False:
            create_config()
            apps_utilities.read_defaults()

        # Handle legacy operations
        apps_legacy.migrate_definition_thumbnails()
        apps_legacy.fix_appearance_to_style()

        # Check the GitHub server for an available software update
        ex_utilities.check_for_software_update('apps')

        # Activate Smart Restart
        apps_system.smart_restart_check()

        # Make sure we have a port available
        if "port" not in apps_config.defaults['system']:
            apps_config.defaults["system"]["port"] = apps_utilities.find_available_port()

        if apps_config.defaults['system']['standalone'] is True:
            print(f"Starting Exhibitera Apps on port {apps_config.defaults['system']['port']}.")
        else:
            print(
                f"Starting Exhibitera Apps for ID {apps_config.defaults['app']['id']} on port {apps_config.defaults['system']['port']}.")
    else:
        # We need to create an config.json file based on user input.
        create_config()

    if apps_config.defaults["system"].get("remote_display", True) is True:
        # Start the server but don't create a GUI window
        start_app(with_webview=False)
    else:
        # Create a GUI window and then start the server
        option_fullscreen = "fullscreen" in sys.argv

        if "port" not in apps_config.defaults['system']:
            apps_config.defaults["system"]["port"] = apps_utilities.find_available_port()

        app_window = webview.create_window('Exhibitera Apps',
                                           confirm_close=False,
                                           fullscreen=option_fullscreen,
                                           height=720,
                                           width=1280,
                                           min_size=(1280, 720),
                                           url='http://localhost:' + str(
                                               apps_config.defaults["system"]["port"]) + '/app.html')

        # Subscribe to event listeners
        app_window.events.closed += apps_webview.on_closed
        app_window.events.closing += apps_webview.on_closing
        app_window.events.shown += apps_webview.on_shown
        app_window.events.loaded += apps_webview.on_loaded
        app_window.events.minimized += apps_webview.on_minimized
        app_window.events.maximized += apps_webview.on_maximized
        app_window.events.restored += apps_webview.on_restored
        app_window.events.resized += apps_webview.on_resized
        app_window.events.moved += apps_webview.on_moved

        # Add menu bar if we are not going into fullscreen
        menu_items = None
        if not option_fullscreen:
            menu_items = [
                webview_menu.Menu(
                    'Settings',
                    [
                        webview_menu.MenuAction('Show settings', partial(apps_webview.show_webview_window, 'settings',
                                                                         {'reload': True})),
                        webview_menu.Menu('Configure',
                                          [
                                              webview_menu.MenuAction('DMX Control',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'dmx_control')),
                                              webview_menu.MenuAction('Image Compare',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'image_compare_setup')),
                                              webview_menu.MenuAction('InfoStation',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'infostation_setup')),
                                              webview_menu.MenuAction('Media Browser',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'media_browser_setup')),
                                              webview_menu.MenuAction('Media Player',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'media_player_setup')),
                                              webview_menu.MenuAction('Other App',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'other_setup')),
                                              webview_menu.MenuAction('Timelapse Viewer',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'timelapse_viewer_setup')),
                                              webview_menu.MenuAction('Timeline Explorer',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'timeline_explorer_setup')),
                                              webview_menu.MenuAction('Voting Kiosk',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'voting_kiosk_setup')),
                                              webview_menu.MenuAction('Word Cloud Input',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'word_cloud_input_setup')),
                                              webview_menu.MenuAction('Word Cloud Viewer',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'word_cloud_viewer_setup')),
                                          ])
                    ]
                )
            ]

        webview.start(func=start_app, menu=menu_items, private_mode=False)


if __name__ == "__main__":
    run()
