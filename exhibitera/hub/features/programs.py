# Standard imports
import datetime
import json
import logging
import os
import time
from typing import Any
import uuid

# Exhibitera imports
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.tools as hub_tools

class Program:
    """A recurring event."""

    def __init__(self, details: dict):
        """Create a new program based on the provided details."""

        self.uuid: str = details.get("uuid", str(uuid.uuid4()))
        self.name: str = details.get("name", "New Program")
        self.location: str = details.get("location", "")
        self.duration: float = details.get("duration", 60) # minutes
        self.capacity: float | None = details.get("capacity", None)
        self.actions: dict = details.get("actions", {})

    def __repr__(self):
        return repr(f"[Program: {self.name}]")

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary representation of this program."""

        return {
            "actions": self.actions,
            "capacity": self.capacity,
            "duration": self.duration,
            "location": self.location,
            "name": self.name,
            "uuid": self.uuid,
        }


# Set up log file
log_path = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)
