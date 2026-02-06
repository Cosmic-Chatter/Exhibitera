# Standard modules
import logging
from functools import partial
import os
import shutil
import sys

# Third-party modules
import webview

# Exhibitera modules
import exhibitera.apps.config as apps_config


class ExhibiteraWebviewAPI:
    """Bindings to connect the app.html pywebview window to Python."""

    def __init__(self):
        pass

    def toggle_fullscreen(self):
        if apps_config.webview_fullscreen is True:
            apps_config.webview_fullscreen = False
        else:
            apps_config.webview_fullscreen = True

        show_app_window()


def show_webview_window(app: str,
                        parameters: dict[str, str] = None ,
                        reload: bool = False):
    """Create a window for the given app, or bring it to the front if it already exists.
    If reload=True, reload the window if it already exists.
    Pass query string parameters as a dict of key/value pairs
    """

    if app == 'app':
        show_app_window()
        return

    endpoints = {
        "dmx_control": "/dmx_control/index.html?standalone=true",
        "image_compare_setup": "/image_compare/setup.html",
        "infostation_setup": "/infostation/setup.html",
        "media_browser_setup": "/media_browser/setup.html",
        "media_player_setup": "/media_player/setup.html",
        "other_setup": "/other/setup.html",
        "survey_kiosk_setup": "/survey_kiosk/setup.html",
        "timelapse_viewer_setup": "/timelapse_viewer/setup.html",
        "timeline_explorer_setup": "/timeline_explorer/setup.html",
        "voting_kiosk_setup": "/voting_kiosk/setup.html",
        "word_cloud_input_setup": "/word_cloud/inout/setup.html",
        "word_cloud_viewer_setup": "/word_cloud/viewer/setup.html",
        "settings": ""
    }

    names = {
        "dmx_control": "DMX Control",
        "image_compare_setup": "Image Compare",
        "infostation_setup": "InfoStation",
        "media_browser_setup": "Media Browser",
        "media_player_setup": "Media Player",
        "other_setup": "Other App",
        "survey_kiosk_setup": "Survey Kiosk",
        "timelapse_viewer_setup": "Timelapse Viewer",
        "timeline_explorer_setup": "Timeline Explorer",
        "voting_kiosk_setup": "Voting Kiosk",
        "word_cloud_input_setup": "Word Cloud Input",
        "word_cloud_viewer_setup": "Word Cloud Viewer",
        "settings": "Configuration"
    }

    if app not in endpoints or app not in names:
        print('apps_webview.show_webview_window: Error: app ' + app + ' not recognized.')
        return

    # If reload=True, destroy any existing copy of this window
    if reload:
        for window in webview.windows:
            if window.title == 'Exhibitera Apps - ' + names[app]:
                window.destroy()

    # If not, create one
    name = 'Exhibitera Apps - ' + names[app]

    url = 'http://localhost:' + str(apps_config.defaults["system"]["port"]) + endpoints[app]
    if parameters is not None:
        url += '?'
        for key in parameters:
            url += key + '=' + parameters[key] + '&'

    new_window = webview.create_window(name, height=600,  width=800, menu=menu_items, url=url)

    new_window.events.closing += on_window_closing
    new_window.events.loaded += on_window_loaded

    return new_window

def show_app_window():
    """Show the main app window.

    Includes logic for going back and forth from fullscreen.
    """

    # Destroy any existing version of this app
    for window in webview.windows:
        if window.title == 'Exhibitera Apps':
            apps_config.block_closing = True
            window.destroy()

    url = 'http://localhost:' + str(apps_config.defaults["system"]["port"]) + "/app.html"

    api = ExhibiteraWebviewAPI()
    new_window = webview.create_window('Exhibitera Apps',
                          height=600, width=800,
                          fullscreen=apps_config.webview_fullscreen,
                          menu=None if apps_config.webview_fullscreen else menu_items,
                          js_api=api,
                          url=url)

    new_window.events.closing += on_window_closing
    new_window.events.loaded += on_window_loaded
    return new_window


def on_window_loaded():
    apps_config.block_closing = False


def on_window_closing():
    """ Called when a window is closing, to handle shutdown. """

    # Check if the root window is the only window left
    if apps_config.block_closing is True:
        return

    if len(webview.windows) == 2:
        print("Shutting down")
        apps_config.root_window.destroy()


def save_file(data, default_filename: str):
    """Create a file save dialog to get a file path and then save the given file."""

    result = webview.windows[0].create_file_dialog(dialog_type=webview.FileDialog.OPEN.SAVE,
                                                   save_filename=default_filename)
    if result is None:
        return

    with open(result[0], 'w', encoding='UTF-8') as f:
        f.write(data)


def clear_cache():
    """Clear the pywebview cache."""

    if sys.platform != "win32":
        return

    appdata = os.getenv('APPDATA')
    # The 'Default' profile is standard for pywebview
    base_path = os.path.join(appdata, 'pywebview', 'EBWebView', 'Default')

    # Folders to wipe for a 'fresh' UI without losing login sessions
    folders_to_clear = [
        os.path.join(base_path, 'Cache', 'Cache_Data'),
        os.path.join(base_path, 'Code Cache'),
        os.path.join(base_path, 'GPUCache')
    ]

    for target in folders_to_clear:
        if os.path.exists(target):
            try:
                shutil.rmtree(target)
            except Exception as e:
                logging.warning(f"clear_cache(): Could not clear {target}: {e}")


menu_items = [
    webview.menu.Menu(
        'Settings',
        [
            webview.menu.MenuAction('Show settings', partial(show_webview_window, 'settings', reload=True)),
            webview.menu.Menu('Configure',
          [
              webview.menu.MenuAction('DMX Control',
                                      partial(show_webview_window, 'dmx_control')),
              webview.menu.MenuAction('Image Compare',
                                      partial(show_webview_window, 'image_compare_setup')),
              webview.menu.MenuAction('InfoStation',
                                      partial(show_webview_window, 'infostation_setup')),
              webview.menu.MenuAction('Media Browser',
                                      partial(show_webview_window, 'media_browser_setup')),
              webview.menu.MenuAction('Media Player',
                                      partial(show_webview_window, 'media_player_setup')),
              webview.menu.MenuAction('Custom App',
                                      partial(show_webview_window, 'other_setup')),
              webview.menu.MenuAction('Survey Kiosk',
                                      partial(show_webview_window, 'survey_kiosk_setup')),
              webview.menu.MenuAction('Timelapse Viewer',
                                      partial(show_webview_window, 'timelapse_viewer_setup')),
              webview.menu.MenuAction('Timeline Explorer',
                                      partial(show_webview_window, 'timeline_explorer_setup')),
              webview.menu.MenuAction('Voting Kiosk',
                                      partial(show_webview_window, 'voting_kiosk_setup')),
              webview.menu.MenuAction('Word Cloud Input',
                                      partial(show_webview_window, 'word_cloud_input_setup')),
              webview.menu.MenuAction('Word Cloud Viewer',
                                      partial(show_webview_window, 'word_cloud_viewer_setup')),
          ])
        ]
    )
]