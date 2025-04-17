"""Defines configuration variables that can be shared across classes, etc."""

# Standard imports
import datetime
import threading
from typing import Any


debug: bool = False  # True means print various debug info
gallery_name: str = "Exhibitera"
port: int = 8000
ip_address: str = "localhost"
last_update_time: float = 0  # Will hold time.time() of last change to the server

software_version: dict[str, int] = {}
software_update_available: bool = False
software_update_available_version: str = ""
software_update_timer: threading.Timer | None = None  # Timer reference to check for an update once daily
outdated_os: bool = False

# Threading resources
polling_thread_dict: dict[str, threading.Timer] = {}
logLock: threading.Lock = threading.Lock()
galleryConfigurationLock: threading.Lock = threading.Lock()
trackingDataWriteLock: threading.Lock = threading.Lock()
trackerTemplateWriteLock: threading.Lock = threading.Lock()
scheduleLock: threading.Lock = threading.Lock()
issueLock: threading.Lock = threading.Lock()
exhibitionsLock: threading.Lock = threading.Lock()
maintenanceLock: threading.Lock = threading.Lock()
issueMediaLock: threading.Lock = threading.Lock()

# Lists
componentList: list = []
projectorList: list = []
wakeOnLANList: list = []
componentDescriptions: dict = {}  # Holds optional short descriptions of each component

# Group stuff
group_list: list[dict[str, Any]] = []
group_list_last_update_date: str = datetime.datetime.now().isoformat()

# Dictionary to keep track of warnings we have already presented
serverWarningDict: dict = {}

# Issue stuff
issueList_last_update_date: str = datetime.datetime.now().isoformat()
issueList: list = []

# Schedule stuff
schedule_timers: list[threading.Timer] = []
json_schedule_list: list[dict] = []
json_next_event: list[dict] = []
scheduleUpdateTime: float = 0

# Exhibitions stuff
current_exhibit: str | None = "Default"  # The JSON file defining the current exhibition without the json extension
exhibit_configuration: dict[str, Any] | None = None
exhibit_list: list[str] = []

# User stuff
encryption_key: bytes | None = None
user_list: list = []
user_display_name_cache: dict[str, str] = {}
