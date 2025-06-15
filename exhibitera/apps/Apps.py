# Standard modules
from functools import lru_cache, partial
import logging
import os
import sys
import threading

# Non-standard modules
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.common.utilities as ex_utilities
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.files as apps_files
import exhibitera.apps.features.legacy as apps_legacy
import exhibitera.apps.features.utilities as apps_utilities
import exhibitera.apps.features.system as apps_system

# API modules
from exhibitera.apps.api.v6.data import data as data_v6
from exhibitera.apps.api.v6.definitions import definitions as definitions_v6
from exhibitera.apps.api.v6.dmx import dmx as dmx_v6
from exhibitera.apps.api.v6.files import files as files_v6
from exhibitera.apps.api.v6.system import system as system_v6

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
app.mount("/survey_kiosk",
          StaticFiles(directory=ex_files.get_path(["survey_kiosk"]), html=True),
          name="survey_kiosk")
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

# Link API routers
app.include_router(data_v6.router, prefix='/v6')
app.include_router(definitions_v6.router, prefix='/v6')
app.include_router(dmx_v6.router, prefix='/v6')
app.include_router(files_v6.router, prefix='/v6')
app.include_router(system_v6.router, prefix='/v6')


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

    If with_webview is True, start as a daemon thread so that when the webview closes, the app shuts down.
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

        # Load the current software version
        apps_config.software_version = ex_files.load_json(
            (ex_files.get_path(["_static", "semantic_version.json"]))).get("version", {})

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
                                              webview_menu.MenuAction('Survey Kiosk',
                                                                      partial(apps_webview.show_webview_window,
                                                                              'survey_kiosk_setup')),
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
