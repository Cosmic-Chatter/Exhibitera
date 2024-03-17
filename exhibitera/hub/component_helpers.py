"""Helper classes for BaseComponent and its derivatives."""

# Standard imports
import datetime
import threading
import time
from typing import Union

# Exhibitera imports
import config


class ComponentStatusManager:

    def __init__(self, category):

        self.category: str = category
        if self.category == "static":
            self.status = "STATIC"
        else:
            self.status = "OFFLINE"

        self.last_contact_datetime: Union[datetime.datetime, None] = None
        self.last_interaction_datetime: Union[datetime.datetime, None] = None
        self.timer_reference: Union[threading.Timer, None] = None

    def update_last_contact_datetime(self, interaction: bool = False):

        self.last_contact_datetime = datetime.datetime.now()

        if interaction:
            self.last_interaction_datetime = datetime.datetime.now()
            self.set_status("ACTIVE")
        else:
            self.set_status("ONLINE")

    def set_status(self, status):
        if self.status != status:
            config.last_update_time = time.time()

        self.status = status
        self.start_timer(status)

    def expire_timer(self, mode):
        """When the timer expires, change the status and start a new timer, if needed."""

        if mode == "ACTIVE":
            self.set_status("ONLINE")
            self.start_timer("ONLINE")
        elif mode == "ONLINE":
            self.set_status("WAITING")
            self.start_timer("WAITING")
        elif mode == "WAITING":
            self.set_status("OFFLINE")

        return

    def start_timer(self, mode):
        timer_durations = {
            "ACTIVE": 10,
            "ONLINE": 30,
            "WAITING": 30
        }
        if mode in timer_durations:
            if self.timer_reference is not None and self.timer_reference.is_alive():
                self.timer_reference.cancel()
            self.timer_reference = threading.Timer(timer_durations[mode], self.expire_timer, args=[mode])
            self.timer_reference.start()

