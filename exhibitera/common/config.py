"""Configuration variables common to both Hub and Apps"""

import threading

# Path to the directory where the server is being launched from
application_path: str = ""
# Path to the directory the code is actually running from (different from APP_PATH when using Pyinstaller)
exec_path: str = ""

debug: bool = False

software_version: dict[str, int] = {}
software_update: dict[str, bool | dict[str, int]] = {
    "update_available": False,
    "current_version": software_version,
    "available_version": software_version
}
software_update_timer: threading.Timer | None = None
outdated_os: bool = False

# Lock files
json_file_lock: threading.Lock = threading.Lock()
text_file_lock: threading.Lock = threading.Lock()
binary_file_lock: threading.Lock = threading.Lock()