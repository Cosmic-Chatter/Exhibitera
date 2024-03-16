"""Defines configuration variables that can be shared across classes, etc."""

# Standard imports
import datetime
import threading
from typing import Any, Union

# Path to the directory where the server is being launched from
APP_PATH: str = ""
# Path to the directory the code is actually running from (different from APP_PATH when using Pyinstaller)
EXEC_PATH: str = ""

debug: bool = False  # True means print various debug info
gallery_name: str = "Constellation"
port: int = 8000
ip_address: str = "localhost"
last_update_time: float = 0  # Will hold time.time() of last change to the server

software_version: float = 5
software_update_available: bool = False
software_update_available_version: str = ""

# Threading resources
polling_thread_dict: dict[str, threading.Timer] = {}
logLock: threading.Lock = threading.Lock()
galleryConfigurationLock: threading.Lock = threading.Lock()
trackingDataWriteLock: threading.Lock = threading.Lock()
trackerTemplateWriteLock: threading.Lock = threading.Lock()
scheduleLock: threading.Lock = threading.Lock()
issueLock: threading.Lock = threading.Lock()
exhibitsLock: threading.Lock = threading.Lock()
maintenanceLock: threading.Lock = threading.Lock()
issueMediaLock: threading.Lock = threading.Lock()

# Lists
componentList = []
projectorList = []
wakeOnLANList = []
synchronizationList = []  # Holds sets of displays that are being synchronized
componentDescriptions = {}  # Holds optional short descriptions of each component

# Group stuff
group_list: list[dict[str, Any]] = []
group_list_last_update_date = datetime.datetime.now().isoformat()

# Dictionary to keep track of warnings we have already presented
serverWarningDict = {}

# Issue stuff
issueList_last_update_date = datetime.datetime.now().isoformat()
issueList = []

# Schedule stuff
schedule_timers: list[threading.Timer] = []
json_schedule_list: list[dict] = []
json_next_event = []
scheduleList = []
nextEvent = {}
scheduleUpdateTime: float = 0
serverRebootTime = None
rebooting: bool = False  # This will be set to True from a background thread when it is time to reboot

# Exhibit stuff
current_exhibit: Union[str, None] = None  # The JSON file defining the current exhibit "name.json"
exhibit_configuration: Union[list[dict[str, Any]], None] = None
exhibit_list: list[str] = []

# User stuff
encryption_key: bytes | None = None
user_list: list = []
