"""Defines configuration variables that can be shared across various modules that use the helper.py module"""

import threading
from typing import Any


# Defaults (loaded from config.json)
defaults: dict[str, Any] = {}
uuid: str = ''

commandList: list[str] = []  # List of queued commands to send to the client
thumbnail_archive: dict[str, Any] | None = None
software_version: dict[str, int] = {}

# DMX resources
dmx_universe = None
dmx_groups: list = []
dmx_fixtures = []
dmx_scenes = []
dmx_active: bool = False

smart_restart: dict[str: Any] = {
    "mode": "patient",  # off | aggressive | patient
    "interval": 60,  # seconds between pings of the server
    "last_contact_datetime": None,  # None until Hub is first reached
    "threshold": 3600,  # seconds since last_contact_datetime
    "active_hours_start": "6 am",
    "active_hours_end": "10 pm",
}

software_update: dict[str, Any] = {
    "update_available": False,
    "current_version": software_version,
    "available_version": software_version
}
software_update_timer: threading.Timer | None = None

# Threading resources
server_process: threading.Thread
thumbnail_lock: threading.Lock = threading.Lock()

# Pywebview resources
block_closing = True
root_window = None
webview_fullscreen = False
