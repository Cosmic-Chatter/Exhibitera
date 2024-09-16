"""Defines configuration variables that can be shared across various modules that use the helper.py module"""

import datetime
import threading
from typing import Any, Union

# Path to the directory where the server is being launched from
application_path: str = ""
# Path to the directory the code is actually running from (different from APP_PATH when using Pyinstaller)
exec_path: str = ""

# Defaults (loaded from config.json)
defaults: dict[str, Any] = {}
uuid: str = ''  # Loaded from configuration/uuid.txt

commandList: list[str] = []  # List of queued commands to send to the client
missingContentWarningList: list[dict] = []  # Holds a list of warning about missing content
NEXT_EVENT: Union[tuple[datetime.time, list[str]], None] = None  # A tuple with the next event to occur and the time is happens
schedule: list[tuple[datetime.time, str]] = []  # List of upcoming actions and their times
thumbnail_archive: dict[str, Any] | None = None
HELPER_SOFTWARE_VERSION: float = 5.1
debug: bool = True

# DMX resources
dmx_universes: list = []
dmx_groups: list = []
dmx_fixtures = []
dmx_active: bool = False

smart_restart: dict[str: Any] = {
    "mode": "patient",  # off | aggressive | patient
    "interval": 60,  # seconds between pings of the server
    "last_contact_datetime": datetime.datetime(year=3000, month=1, day=1),
    "threshold": 3600,  # seconds since last_contact_datetime
    "active_hours_start": "6 am",
    "active_hours_end": "10 pm",
}

software_update: dict[str, Any] = {
    "update_available": False,
    "current_version": str(HELPER_SOFTWARE_VERSION),
    "available_version": str(HELPER_SOFTWARE_VERSION)
}
software_update_timer: threading.Timer | None = None

# If we are serving the HTML file from over the network, this will be set
# to True. If the HTML file has been loaded locally, it will stay False
HELPING_REMOTE_CLIENT: bool = False

# Threading resources
server_process: threading.Thread
defaults_file_lock: threading.Lock = threading.Lock()
content_file_lock: threading.Lock = threading.Lock()
thumbnail_lock: threading.Lock = threading.Lock()
