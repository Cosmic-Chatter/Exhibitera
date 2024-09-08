# Standard modules
from functools import lru_cache, partial
import io
import logging
import mimetypes
import os
import platform
import shutil
import sys
import threading
from typing import Any
import uuid

# Third-party modules
from fastapi import FastAPI, Body, Depends, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTasks
import uvicorn

# Exhibitera modules
import config as const_config
import helper_dmx
import helper_files
import helper_system
import helper_utilities

# Api Modules 
from api.system_api import system_api
from api.definitions_api import definitions_api
# If we're not on Linux, prepare to use the webview
if sys.platform != 'linux':
    import webview
    import webview.menu as webview_menu

    import helper_webview

# Set up log file
log_path: str = helper_files.get_path(["apps.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

const_config.exec_path = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    const_config.application_path = os.path.dirname(sys.executable)
else:
    const_config.application_path = const_config.exec_path

helper_files.check_directory_structure()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/dmx_control",
          StaticFiles(directory=helper_files.get_path(["dmx_control"])),
          name="dmx_control")
app.mount("/InfoStation",
          StaticFiles(directory=helper_files.get_path(["InfoStation"])),
          name="InfoStation")
app.mount("/other",
          StaticFiles(directory=helper_files.get_path(["other"])),
          name="other")
app.mount("/media_browser",
          StaticFiles(directory=helper_files.get_path(["media_browser"])),
          name="media_browser")
app.mount("/media_player",
          StaticFiles(directory=helper_files.get_path(["media_player"])),
          name="media_player")
app.mount("/timelapse_viewer",
          StaticFiles(directory=helper_files.get_path(["timelapse_viewer"])),
          name="timelapse_viewer")
app.mount("/timeline_explorer",
          StaticFiles(directory=helper_files.get_path(["timeline_explorer"])),
          name="timeline_explorer")
app.mount("/voting_kiosk",
          StaticFiles(directory=helper_files.get_path(["voting_kiosk"])),
          name="voting_kiosk")
app.mount("/word_cloud",
          StaticFiles(directory=helper_files.get_path(["word_cloud"])),
          name="word_cloud")
app.mount("/js",
          StaticFiles(directory=helper_files.get_path(["js"])),
          name="js")
app.mount("/css",
          StaticFiles(directory=helper_files.get_path(["css"])),
          name="css")
app.mount("/configuration",
          StaticFiles(directory=helper_files.get_path(
              ["configuration"], user_file=True)),
          name="configuration")
app.mount("/content",
          StaticFiles(directory=helper_files.get_path(
              ["content"], user_file=True)),
          name="content")
app.mount("/_fonts",
          StaticFiles(directory=helper_files.get_path(["_fonts"])),
          name="_fonts")
app.mount("/_static",
          StaticFiles(directory=helper_files.get_path(["_static"])),
          name="_static")
app.mount("/static",
          StaticFiles(directory=helper_files.get_path(
              ["static"], user_file=True)),
          name="static")
app.mount("/temp",
          StaticFiles(directory=helper_files.get_path(
              ["temp"], user_file=True)),
          name="temp")
app.mount("/thumbnails",
          StaticFiles(directory=helper_files.get_path(
              ["thumbnails"], user_file=True)),
          name="thumbnails")

app.include_router(system_api.router)
app.include_router(definitions_api.router)
@lru_cache()
def get_config():
    return const_config


@app.get("/", response_class=HTMLResponse)
async def root():
    return await serve_html("setup")


@app.get("/{file_name}.html", response_class=HTMLResponse)
async def serve_html(file_name):
    # First try a local file and then a Exhibitera file
    file_path = helper_files.get_path([file_name + ".html"], user_file=True)
    if not os.path.isfile(file_path):
        file_path = helper_files.get_path([file_name + ".html"], user_file=False)
    with open(file_path, "r", encoding='UTF-8') as f:
        page = str(f.read())
    return page


@app.get("/README.md", response_class=HTMLResponse)
async def serve_readme():
    # First try a local file and then a Exhibitera file
    file_path = helper_files.get_path(["README.md"])
    with open(file_path, "r") as f:
        file = str(f.read())
    return file


@app.get("/getAvailableContent")
async def get_available_content(config: const_config = Depends(get_config)):
    """Return a list of all files in the content directory, plus some useful system info."""

    response = {"all_exhibits": helper_files.get_all_directory_contents(),
                "definitions": helper_files.get_available_definitions(),
                "thumbnails": helper_files.get_directory_contents("thumbnails"),
                "system_stats": helper_utilities.get_system_stats()}

    return response


@app.post('/files/getVideoDetails')
async def get_video_details(filename: str = Body(description='The filename of the file.', embed=True)):
    """Return a dictionary of useful information about a video file in the content directory."""

    if not helper_files.filename_safe(filename):
        return {"success": False, "details": "Invalid character in filename"}

    success, details = helper_files.get_video_file_details(filename)
    return {"success": success, "details": details}


@app.post('/files/convertVideoToFrames')
async def convert_video_to_frames(filename: str = Body(description='The filename of the file.'),
                                  file_type: str = Body(description='The output filetype to use.', default='jpg')):
    """Convert the given file to a set of frames."""

    if not helper_files.filename_safe(filename):
        return {"success": False, "reason": "Invalid character in filename"}

    success = helper_files.convert_video_to_frames(filename, file_type)

    return {"success": success}


@app.post('/files/thumbnailVideoFromFrames')
async def create_thumbnail_video_from_frames(
        filename: str = Body(description='The name of the output file, without an extension.'),
        frames: list[str] = Body(description='A list of the files to include'),
        duration: float = Body(description='The length of the output video in seconds.', default=5)):
    """Create a video thumbnail out of the given files."""

    if not helper_files.filename_safe(filename):
        return {"success": False, "reason": "Invalid character in filename"}

    success = helper_files.create_thumbnail_video_from_frames(frames, filename, duration)
    return {"success": success}


@app.post('/files/generateThumbnail')
def generate_thumbnail(source: str | list[str] = Body(description='The file(s) in content to generate thumbnails for'),
                       mimetype: str | list[str] = Body(
                           description='One of [image | video] that gives the mimetype of the file. Must have the same length as source.'),
                       width: int = Body(description="The pixel width of the thumbnails.",
                                         default=400)):
    """Generate new thumbnail(s) from files in teh content directory"""

    if isinstance(source, str):
        source = [source]
    if isinstance(mimetype, str):
        mimetype = [mimetype]

    if len(source) != len(mimetype):
        return {"success": False, "reason": "source and mimetype must have the same length."}

    request_success = True
    request_reason = ""
    for i in range(len(source)):
        file = source[i]
        file_mime = mimetype[i]

        success, reason = helper_files.create_thumbnail(file, file_mime, block=True, width=width)
        if success is False and reason == "ImportError":
            request_success = False
            request_reason = "FFmpeg not found"

    result = {"success": request_success}
    if request_reason != "":
        result["reason"] = request_reason
    return result


@app.post('/files/uploadThumbnail')
def upload_thumbnail(files: list[UploadFile] = File(),
                     config: const_config = Depends(get_config)):
    """Save uploaded files as thumbnails, formatting them appropriately."""

    for file in files:
        filename = file.filename

        if not helper_files.filename_safe(filename):
            continue

        temp_path = helper_files.get_path(["content", filename], user_file=True)
        with config.content_file_lock:
            # First write the file to content
            try:
                with open(temp_path, 'wb') as out_file:
                    shutil.copyfileobj(file.file, out_file)
            finally:
                file.file.close()
            # Next, generate a thumbnail
            helper_files.create_thumbnail(filename, 'image', block=True)
            # Finally, delete the source file
            os.remove(temp_path)
    return {"success": True}


@app.post('/files/createZip')
def create_zip(background_tasks: BackgroundTasks,
               files: list[str] = Body(description="A list of the files to be zipped. Files must be in the content directory."),
               zip_filename: str = Body(description="The filename of the zip file to be created.")):
    """Create a ZIP file containing the given files."""

    helper_files.create_zip(zip_filename, files)
    zip_path = helper_files.get_path(["temp", zip_filename], user_file=True)
    background_tasks.add_task(os.remove, zip_path)
    return FileResponse(zip_path, filename=zip_filename)

@app.get("/getDefaults")
async def send_defaults(config: const_config = Depends(get_config)):
    config_to_send = config.defaults.copy()

    # Add the current update availability to pass to Hub
    config_to_send["software_update"] = config.software_update

    config_to_send["availableContent"] = \
        {"all_exhibits": helper_files.get_all_directory_contents()}

    return config_to_send


@app.get('/uuid/new')
async def get_new_uuid():
    """Return a new uuid."""

    return {"success": True, "uuid": str(uuid.uuid4())}


@app.get("/getUpdate")
async def send_update(config: const_config = Depends(get_config)):
    """Get some key info for updating the component and web console."""

    response_dict = {
        "permissions": config.defaults["permissions"],
        "commands": config.commandList,
        "missingContentWarnings": config.missingContentWarningList
    }
    return response_dict


@app.get("/restart")
async def do_restart():
    helper_system.reboot()


@app.get("/sleepDisplay")
async def do_sleep():
    helper_system.sleep_display()


@app.get("/shutdown")
@app.get("/powerOff")
async def do_shutdown():
    helper_system.shutdown()


@app.get("/powerOn")
@app.get("/wakeDisplay")
async def do_wake():
    helper_system.wake_display()

@app.post("/file/delete")
async def delete_file(file: str | list[str] = Body(description="The file(s) to delete", embed=True)):
    """Delete the specified file(s) from the content directory"""

    if isinstance(file, list):
        for entry in file:
            helper_files.delete_file(entry)
    else:
        helper_files.delete_file(file)

    return {"success": True}


@app.post("/renameFile")
async def rename_file(current_name: str = Body(description="The file to be renamed."),
                      new_name: str = Body(description="The new name of the file.")):
    """Rename a file in the content directory."""

    if not helper_files.filename_safe(current_name) or not helper_files.filename_safe(new_name):
        return {"success": False, "reason": "Invalid character in filename"}

    return helper_files.rename_file(current_name, new_name)


@app.post("/data/write")
async def write_data(data: dict[str, Any] = Body(description="A dictionary of data to be written to file as JSON."),
                     name: str = Body(description="The name of the file to write,")):
    """Record the submitted data to file as JSON."""

    if not helper_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    file_path = helper_files.get_path(["data", name + ".txt"], user_file=True)
    success, reason = helper_files.write_json(data, file_path, append=True, compact=True)
    response = {"success": success, "reason": reason}
    return response


@app.post("/data/writeRawText")
async def write_raw_text(text: str = Body(description='The data to write.'),
                         mode: str = Body(description="Pass 'a' to append or 'w' or overwrite.", default='a'),
                         name: str = Body(description='The name of the file to write.')):
    """Write the raw text to file.

    Set mode == 'a' to append or 'w' to overwrite the file.
    """

    if not helper_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    if mode != "a" and mode != "w":
        response = {"success": False,
                    "reason": "Invalid mode field: must be 'a' (append, [default]) or 'w' (overwrite)"}
        return response
    success, reason = helper_files.write_raw_text(text, helper_files.with_extension(name, 'txt'), mode=mode)
    response = {"success": success, "reason": reason}
    return response


@app.post("/data/getRawText")
async def read_raw_text(name: str = Body(description='The name of the file to read.', embed=True)):
    """Load the given file and return the raw text."""

    if not helper_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    result, success, reason = helper_files.get_raw_text(helper_files.with_extension(name, 'txt'))

    response = {"success": success, "reason": reason, "text": result}
    return response


@app.post("/data/getCSV")
async def get_tracker_data_csv(name: str = Body(description='The name of the filename to return as a CSV', embed=True)):
    """Return the requested data file as a CSV string."""

    if not helper_files.filename_safe(name):
        return {"success": False, "reason": "Invalid character in filename"}

    if not name.lower().endswith(".txt"):
        name += ".txt"
    data_path = helper_files.get_path(["data", name], user_file=True)
    if not os.path.exists(data_path):
        return {"success": False, "reason": f"File {name}.txt does not exist!", "csv": ""}
    result = helper_files.create_csv(data_path)
    return {"success": True, "csv": result}


@app.get("/data/getAvailable")
async def get_available_data():
    """Return a list of files in the /data directory."""

    return {"success": True, "files": helper_files.get_available_data()}


@app.post("/gotoClip")
async def goto_clip(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Command the client to display the given clip number"""

    if "clipNumber" in data:
        config.commandList.append("gotoClip_" + str(data["clipNumber"]))


@app.post("/setAutoplay")
async def set_autoplay(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Command the client to change the state of autoplay"""

    if "state" in data:
        if data["state"] == "on":
            config.commandList.append("enableAutoplay")
        elif data["state"] == "off":
            config.commandList.append("disableAutoplay")
        elif data["state"] == "toggle":
            config.commandList.append("toggleAutoplay")


@app.post("/updateActiveClip")
async def update_active_clip(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Store the active media clip index"""

    if "index" in data:
        config.clipList["activeClip"] = data["index"]


@app.post("/updateClipList")
async def update_clip_list(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Store the current list of active media clips"""

    if "clipList" in data:
        config.clipList["clipList"] = data["clipList"]


@app.post("/uploadContent")
def upload_content(files: list[UploadFile] = File(),
                   config: const_config = Depends(get_config)):
    """Receive uploaded files and save them to disk"""

    for file in files:
        filename = file.filename

        if not helper_files.filename_safe(filename):
            print("upload_content: error: invalid filename: ", filename)
            continue

        file_path = helper_files.get_path(
            ["content", filename], user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with config.content_file_lock:
            try:
                with open(file_path, 'wb') as out_file:
                    shutil.copyfileobj(file.file, out_file)
            finally:
                file.file.close()

        mimetype = mimetypes.guess_type(file_path, strict=False)[0]
        if mimetype is not None:
            th = threading.Thread(target=helper_files.create_thumbnail, args=(filename, mimetype.split("/")[0]),
                                  daemon=True)
            th.start()
    return {"success": True}


@app.post("/setDefaults")
async def set_defaults(defaults: dict = Body(description="A dictionary matching the structure of config.json."),
                       cull: bool = Body(description="Whether to replace the existing defaults with the provided ones.",
                                         default=False)):
    """Update the given defaults with the specified values"""

    helper_utilities.update_defaults(defaults, cull=cull)

    return {"success": True}


# DMX actions

@app.get("/DMX/getAvailableControllers")
async def get_dmx_controllers():
    """Return a list of connected DMX controllers."""

    success, reason, controllers = helper_dmx.get_available_controllers()

    return {"success": success, "reason": reason, "controllers": controllers}


@app.get("/DMX/{universe_index}/debug")
async def debug_dmx_universe(universe_index: int):
    """Trigger the debug mode for the universe at the given index"""

    print(const_config.dmx_universes, universe_index, type(universe_index))
    const_config.dmx_universes[universe_index].controller.web_control()


@app.get("/DMX/getConfiguration")
async def get_dmx_configuration():
    """Return the JSON DMX configuration file."""

    success, reason = helper_dmx.activate_dmx()
    config_dict = {
        "universes": [],
        "groups": []
    }
    if success is True:
        config_path = helper_files.get_path(
            ["configuration", "dmx.json"], user_file=True)
        config_dict = helper_files.load_json(config_path)

    return {"success": success, "reason": reason, "configuration": config_dict}


@app.get("/DMX/getStatus")
async def get_dmx_status():
    """Return a dictionary with the current channel value for every channel in every fixture."""

    success, reason = helper_dmx.activate_dmx()

    result = {}

    for fixture in const_config.dmx_fixtures:
        result[fixture.uuid] = fixture.get_all_channel_values()

    return {"success": success, "reason": reason, "status": result}


@app.post("/DMX/fixture/create")
async def create_dmx_fixture(name: str = Body(description="The name of the fixture."),
                             channels: list[str] = Body(description="A list of channel names."),
                             start_channel: int = Body(description="The first channel to allocate."),
                             universe: str = Body(description='The UUID of the universe this fixture belongs to.')):
    """Create a new DMX fixture"""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    new_fixture = helper_dmx.get_universe(uuid_str=universe).create_fixture(name, start_channel, channels)
    helper_dmx.write_dmx_configuration()

    return {"success": True, "fixture": new_fixture.get_dict()}


@app.post("/DMX/fixture/edit")
async def edit_dmx_fixture(fixture_uuid: str = Body(description="The UUID of the fixture to remove."),
                           name: str = Body(description="The name of the fixture.", default=None),
                           channels: list[str] = Body(description="A list of channel names.", default=None),
                           start_channel: int = Body(description="The first channel to allocate.", default=None),
                           universe: str = Body(description='The UUID of the universe this fixture belongs to.')):
    """Edit an existing DMX fixture"""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = helper_dmx.get_universe(uuid_str=universe).get_fixture(fixture_uuid)
    fixture.update(name=name, start_channel=start_channel, channel_list=channels)
    helper_dmx.write_dmx_configuration()

    return {"success": True, "fixture": fixture.get_dict()}


@app.post("/DMX/fixture/remove")
async def remove_dmx_fixture(fixture_uuid: str = Body(description="The UUID of the fixture to remove.", embed=True)):
    """Remove the given DMX fixture from its universe and any groups"""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = helper_dmx.get_fixture(fixture_uuid)
    if fixture is None:
        print(f"/DMX/fixture/remove: Cannot remove fixture {fixture_uuid}. It does not exist.")
        return {"success": False, "reason": "Fixture does not exist."}
    fixture.delete()
    helper_dmx.write_dmx_configuration()

    return {"success": True}


@app.post("/DMX/fixture/{fixture_uuid}/setBrightness")
async def set_dmx_fixture_to_brightness(fixture_uuid: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given fixture to the specified brightness."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = helper_dmx.get_fixture(fixture_uuid)
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

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = helper_dmx.get_fixture(fixture_uuid)
    fixture.set_channel(channel_name, value)
    return {"success": True, "configuration": fixture.get_dict()}


@app.post("/DMX/fixture/{fixture_uuid}/setColor")
async def set_dmx_fixture_to_color(fixture_uuid: str,
                                   color: list = Body(
                                       description="The color to be set."),
                                   duration: float = Body(description="How long the color transition should take.",
                                                          default=0)):
    """Set the given fixture to the specified color."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = helper_dmx.get_fixture(fixture_uuid)
    if fixture is None:
        return {"success": False, "reason": "Figure does not exist."}
    fixture.set_color(color, duration)
    return {"success": True, "configuration": fixture.get_dict()}


@app.post("/DMX/group/create")
async def create_dmx_group(name: str = Body(description="The name of the group to create."),
                           fixture_list: list[str] = Body(description="The UUIDs of the fixtures to include.")):
    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    new_group = helper_dmx.create_group(name)

    fixtures = []
    for fixture_uuid in fixture_list:
        fixtures.append(helper_dmx.get_fixture(fixture_uuid))
    new_group.add_fixtures(fixtures)
    helper_dmx.write_dmx_configuration()

    return {"success": True, "uuid": new_group.uuid}


@app.post("/DMX/group/{group_uuid}/edit")
async def edit_dmx_group(group_uuid: str,
                         name: str = Body(description="The new name for the group", default=""),
                         fixture_list: list[str] = Body(
                             description="A list of UUIDs for fixtures that should be included.", default=[])):
    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = helper_dmx.get_group(group_uuid)

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
                fixture = helper_dmx.get_fixture(fixture_uuid)
                if fixture is not None:
                    fixtures_to_add.append(fixture)

        if len(fixtures_to_add) > 0:
            group.add_fixtures(fixtures_to_add)
    helper_dmx.write_dmx_configuration()

    return {"success": True}


@app.get("/DMX/group/{group_uuid}/delete")
async def delete_dmx_group(group_uuid: str):
    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    helper_dmx.get_group(group_uuid).delete()
    helper_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/createScene")
async def create_dmx_scene(group_uuid: str,
                           name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Create the given scene for the specified group."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = helper_dmx.get_group(group_uuid)
    uuid_str = group.create_scene(name, values, duration=duration)
    helper_dmx.write_dmx_configuration()
    return {"success": True, "uuid": uuid_str}


@app.post("/DMX/group/{group_uuid}/editScene")
async def create_dmx_scene(group_uuid: str,
                           uuid: str = Body(description="The UUID of the scene to edit."),
                           name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Edit the given scene for the specified group."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = helper_dmx.get_group(group_uuid)

    scene = group.get_scene(uuid_str=uuid)

    scene.name = name
    scene.duration = duration
    scene.set_values(values)

    helper_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/deleteScene")
async def create_dmx_scene(group_uuid: str,
                           uuid: str = Body(description="The UUID of the scene to edit.", embed=True)):
    """Delete the given scene for the specified group."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = helper_dmx.get_group(group_uuid)
    group.delete_scene(uuid)

    helper_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/setBrightness")
async def set_dmx_fixture_to_brightness(group_uuid: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given group to the specified brightness."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = helper_dmx.get_group(group_uuid)
    group.set_brightness(value, duration)
    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/group/{group_uuid}/setChannel")
async def set_dmx_group_channel(group_uuid: str,
                                channel: str = Body(description="The channel to set."),
                                value: int = Body(description="The value to set.")):
    """Set the given channel to the specified value for every fixture in the group."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = helper_dmx.get_group(group_uuid)
    group.set_channel(channel, value)
    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/group/{group_uuid}/setColor")
async def set_dmx_group_to_color(group_uuid: str,
                                 color: list = Body(
                                     description="The color to be set."),
                                 duration: float = Body(description="How long the color transition should take.",
                                                        default=0)):
    """Set the given group to the specified color."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = helper_dmx.get_group(group_uuid)
    group.set_color(color, duration)
    return {"success": True, "configuration": group.get_dict()}


@app.get("/DMX/group/{group_uuid}/getScenes")
async def get_dmx_group_scenes(group_uuid: str):
    """Return a list of the available scenes for the given group."""

    response = {"success": True, "scenes": []}

    config_path = helper_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        response["success"] = False
        response["reason"] = "no_config_file"
        return response

    config_dict = helper_files.load_json(config_path)
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

    config_path = helper_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        response["success"] = False
        response["reason"] = "no_config_file"
        return response

    config_dict = helper_files.load_json(config_path)
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

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    _, group = helper_dmx.get_scene(scene_uuid)
    group.show_scene(scene_uuid)


@app.post("/DMX/group/{group_uuid}/showScene")
async def set_dmx_group_scene(group_uuid: str,
                              uuid: str = Body(
                                  description="The UUID of the scene to be run.",
                                  default="",
                                  embed=True)
                              ):
    """Run a scene for the given group."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = helper_dmx.get_group(group_uuid)
    group.show_scene(uuid)

    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/universe/create")
async def create_dmx_universe(name: str = Body(description="The name of the universe."),
                              controller: str = Body(description="The type of this controller (OpenBMX or uDMX)."),
                              device_details: dict[str, Any] = Body(
                                  description="A dictionary of hardware details for the controller.")):
    """Create a new DMXUniverse."""

    helper_dmx.activate_dmx()
    new_universe = helper_dmx.create_universe(name,
                                              controller=controller,
                                              device_details=device_details)
    helper_dmx.write_dmx_configuration()
    const_config.dmx_active = True

    return {"success": True, "universe": new_universe.get_dict()}


@app.post("/DMX/universe/rename")
async def create_dmx_universe(uuid: str = Body(description="The UUID of the universe."),
                              new_name: str = Body(description="The new name to set.")):
    """Change the name for a universe."""

    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    helper_dmx.get_universe(uuid_str=uuid).name = new_name
    helper_dmx.write_dmx_configuration()

    return {"success": True}


@app.get("/DMX/universe/{universe_uuid}/delete")
async def delete_dmx_universe(universe_uuid: str):
    success, reason = helper_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    helper_dmx.get_universe(uuid_str=universe_uuid).delete()

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

    helper_webview.show_webview_window(window, reload=reload)


@app.post('/app/saveFile')
def save_file_from_webview(data: str = Body(description='The string data to save to file'),
                           filename: str = Body(description="The default filename to provide",
                                                default="download.txt")):
    """Ask the webview to create a file save dialog."""

    helper_webview.save_file(data, filename)


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
        const_config.server_process = threading.Thread(target=_start_server, daemon=True, kwargs={"port": port})
        const_config.server_process.start()
    else:
        _start_server()


def _start_server(port=None):
    if port is None:
        port = int(const_config.defaults["system"]["port"])

    # Must use only one worker, since we are relying on the config module being in global)
    uvicorn.run(app,
                host="",
                port=port,
                reload=False, workers=1)


def create_config():
    """Create a new configuration file."""

    if sys.platform == 'linux':
        # Linux apps can't use the GUI
        helper_utilities.handle_missing_defaults_file()
    else:
        print('config.json file not found! Bootstrapping server.')

        available_port = helper_utilities.find_available_port()

        webview.create_window('Exhibitera Apps Setup',
                              confirm_close=False,
                              height=720,
                              width=720,
                              min_size=(720, 720),
                              url='http://localhost:' + str(
                                  available_port) + '/first_time_setup.html')

        webview.start(func=bootstrap_app, args=available_port)


if __name__ == "__main__":
    defaults_path = helper_files.get_path(['configuration', 'config.json'], user_file=True)
    if os.path.exists(defaults_path):
        if helper_utilities.read_defaults() is False:
            create_config()
            helper_utilities.read_defaults()

        # Check for missing content thumbnails and create them
        helper_files.create_missing_thumbnails()

        # Check the GitHub server for an available software update
        helper_utilities.check_for_software_update()

        # Activate Smart Restart
        helper_system.smart_restart_check()

        # Make sure we have a port available
        if "port" not in const_config.defaults['system']:
            const_config.defaults["system"]["port"] = helper_utilities.find_available_port()

        if const_config.defaults['system']['standalone'] is True:
            print(f"Starting Exhibitera Apps on port {const_config.defaults['system']['port']}.")
        else:
            print(
                f"Starting Exhibitera Apps for ID {const_config.defaults['app']['id']} on port {const_config.defaults['system']['port']}.")
    else:
        # We need to create a config.json file based on user input.
        create_config()

    if const_config.defaults["system"].get("remote_display", True) is True:
        # Start the server but don't create a GUI window
        start_app(with_webview=False)
    else:
        # Create a GUI window and then start the server
        option_fullscreen = "fullscreen" in sys.argv

        if "port" not in const_config.defaults['system']:
            const_config.defaults["system"]["port"] = helper_utilities.find_available_port()

        app_window = webview.create_window('Exhibitera Apps',
                                           confirm_close=False,
                                           fullscreen=option_fullscreen,
                                           height=720,
                                           width=1280,
                                           min_size=(1280, 720),
                                           url='http://localhost:' + str(
                                               const_config.defaults["system"]["port"]) + '/app.html')

        # Subscribe to event listeners
        app_window.events.closed += helper_webview.on_closed
        app_window.events.closing += helper_webview.on_closing
        app_window.events.shown += helper_webview.on_shown
        app_window.events.loaded += helper_webview.on_loaded
        app_window.events.minimized += helper_webview.on_minimized
        app_window.events.maximized += helper_webview.on_maximized
        app_window.events.restored += helper_webview.on_restored
        app_window.events.resized += helper_webview.on_resized
        app_window.events.moved += helper_webview.on_moved

        # Add menu bar if we are not going into fullscreen
        menu_items = None
        if not option_fullscreen:
            menu_items = [
                webview_menu.Menu(
                    'Settings',
                    [
                        webview_menu.MenuAction('Show settings', partial(helper_webview.show_webview_window, 'settings',
                                                                         {'reload': True})),
                        webview_menu.Menu('Configure',
                                          [
                                              webview_menu.MenuAction('DMX Control',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'dmx_control')),
                                              webview_menu.MenuAction('InfoStation',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'infostation_setup')),
                                              webview_menu.MenuAction('Media Browser',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'media_browser_setup')),
                                              webview_menu.MenuAction('Media Player',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'media_player_setup')),
                                              webview_menu.MenuAction('Other App',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'other_setup')),
                                              webview_menu.MenuAction('Timelapse Viewer',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'timelapse_viewer_setup')),
                                              webview_menu.MenuAction('Timeline Explorer',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'timeline_explorer_setup')),
                                              webview_menu.MenuAction('Voting Kiosk',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'voting_kiosk_setup')),
                                              webview_menu.MenuAction('Word Cloud Input',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'word_cloud_input_setup')),
                                              webview_menu.MenuAction('Word Cloud Viewer',
                                                                      partial(helper_webview.show_webview_window,
                                                                              'word_cloud_viewer_setup')),
                                          ])
                    ]
                )
            ]

        webview.start(func=start_app, menu=menu_items)
