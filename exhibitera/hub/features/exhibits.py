# Standard imports
import datetime
import json
import logging
import threading
import time
import uuid
from typing import Any, Union
import os

# Non-standard imports
import icmplib
import requests
import wakeonlan

# Exhibitera imports
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.maintenance as ex_maint
import exhibitera.hub.tools as c_tools
import exhibitera.hub.features.projector_control as projector_control


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

    def set_status(self, status: str):
        if self.status != status:
            hub_config.last_update_time = time.time()

        self.status = status
        self.start_timer(status)

    def expire_timer(self, mode: str):
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

    def start_timer(self, mode: str):
        timer_durations = {
            "ACTIVE": 10,
            "ONLINE": 30,
            "WAITING": 30
        }
        if mode in timer_durations:
            if self.timer_reference is not None and self.timer_reference.is_alive():
                self.timer_reference.cancel()
            self.timer_reference = threading.Timer(timer_durations[mode], self.expire_timer, args=[mode])
            self.timer_reference.daemon = True
            self.timer_reference.start()


class BaseComponent:
    """A basic Exhibitera component."""

    def __init__(self, id_: str, groups: list[str],
                 description: str | None = None,
                 ip_address: str | None = None,
                 last_contact_datetime: str = "",
                 mac_address: str | None = None,
                 maintenance_log: dict[str, Any] | None = None,
                 uuid_str: str = ""):

        now_date = datetime.datetime.now()

        if uuid_str == "":
            uuid_str = str(uuid.uuid4())

        self.id: str = id_
        self.groups: list[str] = groups
        self.uuid = uuid_str

        self.ip_address = ip_address
        self.mac_address = mac_address
        self.WOL_broadcast_address: str = "255.255.255.255"
        self.WOL_port: int = 9

        self.latency: Union[None, float] = None  # Latency between Hub and the device in ms
        self.latency_timer: Union[threading.Timer, None] = None

        if last_contact_datetime == "" or last_contact_datetime == "None":
            self.last_contact_datetime = now_date
        else:
            self.last_contact_datetime = datetime.datetime.fromisoformat(last_contact_datetime)

        if maintenance_log is not None:
            self.maintenance_log = maintenance_log
        else:
            self.maintenance_log = {
                "current": {
                    "date": str(now_date),
                    "status": "On floor, not working",
                    "notes": ""
                },
                "history": []
            }

        self.config: dict[str, Any] = {"permissions": {},
                                       "app_name": "",
                                       "commands": [],
                                       "maintenance_status": ""
                                       }
        if description is not None:
            self.config["description"] = description
        else:
            self.config["description"] = hub_config.componentDescriptions.get(id_, "")

    def __repr__(self):
        return repr(f"[BaseComponent ID: {self.id} Groups: {self.groups} UUID: {self.uuid}]")

    def clean_up(self):
        """Stop any timers so the class instance can be safely removed."""

        if self.latency_timer is not None:
            self.latency_timer.cancel()

    def remove(self):
        """Remove the component from Hub tracking.

        If another ping is received, the component will be re-added.
        """

        self.clean_up()
        if isinstance(self, ExhibitComponent):
            hub_config.componentList = [x for x in hub_config.componentList if x.uuid != self.uuid]
        elif isinstance(self, Projector):
            hub_config.projectorList = [x for x in hub_config.projectorList if x.uuid != self.uuid]
        elif isinstance(self, WakeOnLANDevice):
            hub_config.wakeOnLANList = [x for x in hub_config.wakeOnLANList if x.uuid != self.uuid]
        path = ex_files.get_path(["components", self.uuid + '.json'], user_file=True)
        os.remove(path)

    def seconds_since_last_contact(self) -> float:
        """The number of seconds since the last successful contact with the component."""

        diff = datetime.datetime.now() - self.last_contact_datetime
        return diff.total_seconds()

    def update_last_contact_datetime(self):

        self.last_contact_datetime = datetime.datetime.now()
        hub_config.last_update_time = time.time()

    def poll_latency(self):
        """If we have an IP address, ping the host to measure its latency."""

        if self.ip_address is not None:
            try:
                ping = icmplib.ping(self.ip_address, privileged=False, count=1, timeout=1)
                if ping.is_alive:
                    self.latency = ping.avg_rtt
                else:
                    self.latency = None
            except icmplib.exceptions.SocketPermissionError:
                if "wakeOnLANPrivilege" not in hub_config.serverWarningDict:
                    hub_config.serverWarningDict["wakeOnLANPrivilege"] = True
                self.latency = None
            except icmplib.exceptions.NameLookupError:
                self.latency = None
            except Exception as e:
                print(f"poll_latency: {self.id}: an unknown exception occurred", e)
                self.latency = None

        self.latency_timer = threading.Timer(10, self.poll_latency)
        self.latency_timer.name = f"{self.id} latency timer"
        self.latency_timer.daemon = True
        self.latency_timer.start()

    def get_maintenance_report(self) -> dict[str, Any]:
        """Return a summary of this component's maintenance status."""

        segments = ex_maint.segment_entries(self.maintenance_log["history"])
        summary = ex_maint.summarize_segments(segments)

        return {"date": self.maintenance_log["current"]["date"],
                "status": self.maintenance_log["current"]["status"],
                "notes": self.maintenance_log["current"]["notes"],
                "working_pct": summary["working"],
                "not_working_pct": summary["not_working"],
                "on_floor_pct": summary["on_floor"],
                "off_floor_pct": summary["off_floor"]}

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary representation of this component.

        Include only attributes that are likely to be the same if this component is restored at a later date.
        """

        return {
            "uuid": self.uuid,
            "id": self.id,
            "groups": self.groups,
            "description": self.config["description"],
            "last_contact_datetime": str(self.last_contact_datetime),
            "mac_address": self.mac_address,
            "maintenance_log": self.maintenance_log
        }

    def save(self):
        """Write the component to disk"""
        if ex_config.debug:
            print("Saving component to disk: ", self.id, self.uuid)
        path = ex_files.get_path(["components", self.uuid + '.json'], user_file=True)
        ex_files.write_json(self.get_dict(), path)


class ExhibitComponent(BaseComponent):
    """Holds basic data about a component in the exhibit"""

    def __init__(self, id_: str,
                 groups: list[str],
                 category: str = 'dynamic',
                 description: str | None = None,
                 last_contact_datetime: str = "",
                 maintenance_log: dict[str, Any] | None = None,
                 uuid_str: str = ""):

        # category='dynamic' for components that are connected over the network
        # category='static' for components added from galleryConfiguration.ini

        super().__init__(id_, groups,
                         description=description,
                         last_contact_datetime=last_contact_datetime,
                         maintenance_log=maintenance_log,
                         uuid_str=uuid_str)

        self.category = category
        self.helperAddress: str = ""  # full IP and port of helper
        self.platform_details: dict = {}

        self.config["definition"] = ""
        self.config["app_id"] = ""

        self.status_manager = ComponentStatusManager(category)

        if category != "static":
            self.update_configuration()
            self.poll_latency()
        else:
            self.last_contact_datetime = None

        # Check if we have specified a Wake on LAN device matching this id
        # If yes, subsume it into this component
        wol = get_wake_on_lan_component(component_id=self.id)
        if wol is not None:
            self.mac_address = wol.mac_address
            self.config["permissions"]["shutdown"] = True
            hub_config.wakeOnLANList = [x for x in hub_config.wakeOnLANList if x.id != wol.id]

    def __repr__(self):
        return repr(f"[ExhibitComponent ID: {self.id} Group: {self.groups} UUID: {self.uuid}]")

    def update_last_contact_datetime(self, interaction: bool = False):

        super().update_last_contact_datetime()
        self.status_manager.update_last_contact_datetime(interaction=interaction)

    def set_helper_address(self, address: str):
        """Set the helper IP address, modifying it first, if necessary"""

        # If address includes 'localhost', '127.0.0.1', etc., replace it with the actual IP address
        # so that we can reach it.
        address = address.replace('localhost', self.ip_address)
        address = address.replace('127.0.0.1', self.ip_address)
        address = address.replace('::1', self.ip_address)

        self.helperAddress = address

    def current_status(self) -> str:
        """Return the current status of the component

        Options: [OFFLINE, SYSTEM ON, ONLINE, ACTIVE, WAITING, STATIC]
        """

        return self.status_manager.status

    def update_configuration(self):
        """Update the component's configuration based on current exhibit configuration."""

        if hub_config.exhibit_configuration is None or self.category == 'static':
            return

        update_made = False
        try:
            component_config = ([x for x in hub_config.exhibit_configuration["components"] if x["id"] == self.id])[0]

            if "definition" in component_config and self.config["definition"] != component_config["definition"]:
                self.config["definition"] = component_config["definition"]
                update_made = True
            if "app_name" in component_config and self.config["app_name"] != component_config["app_name"]:
                self.config["app_name"] = component_config["app_name"]
                update_made = True
        except IndexError:
            # This component is not specified in the current exhibit configuration
            self.config["definition"] = ""

        self.config["current_exhibit"] = os.path.splitext(hub_config.current_exhibit)[0]

        if update_made:
            hub_config.last_update_time = time.time()

    def queue_command(self, command: str):
        """Queue a command to be sent to the component on the next ping"""

        if self.category == "static":
            return

        if (command in ["power_on", "wakeDisplay"]) and (self.mac_address is not None):
            self.wake_with_LAN()
        elif command in ['shutdown', 'restart']:
            if self.helperAddress == '' or self.helperAddress is None:
                logging.error(f"{self.id}: error: {command} requested but helper address is blank.")
                if ex_config.debug:
                    print(f"{self.id}: error: {command} requested but helper address is blank.")
                return
            # Send these commands directly to the helper
            if ex_config.debug:
                print(f"{self.id}: command sent to helper: {command}")
            logging.info(f"{self.id}: command sent to helper: {command}")
            if not self.helperAddress.startswith('http://'):
                address = 'http://' + self.helperAddress + '/' + command
            else:
                address = self.helperAddress + '/' + command

            requests.get(address)
        else:
            # Queue all other commands for the next ping
            if ex_config.debug:
                print(f"{self.id}: command queued: {command}")
            self.config["commands"].append(command)
            if ex_config.debug:
                print(f"{self.id}: pending commands: {self.config['commands']}")

    def wake_with_LAN(self):
        """Send a magic packet waking the device."""

        if self.mac_address is not None:
            print(f"Sending wake on LAN packet to {self.id}")
            with hub_config.logLock:
                logging.info(f"Sending wake on LAN packet to {self.id}")
            try:
                wakeonlan.send_magic_packet(self.mac_address,
                                            ip_address=self.WOL_broadcast_address,
                                            port=self.WOL_port)
            except ValueError as e:
                print(f"Wake on LAN error for component {self.id}: {str(e)}")
                with hub_config.logLock:
                    logging.error(f"Wake on LAN error for component {self.id}: {str(e)}")

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary representation of this component.

        Include only attributes that are likely to be the same if this component is restored at a later date.
        """

        the_dict = super().get_dict()
        the_dict["class"] = "ExhibitComponent"
        the_dict["category"] = self.category

        return the_dict


class WakeOnLANDevice(BaseComponent):
    """Holds basic information about a wake on LAN device and facilitates waking it"""

    def __init__(self, id_: str,
                 groups: list[str],
                 mac_address: str,
                 ip_address: str = None,
                 description: str | None = None,
                 last_contact_datetime: str = "",
                 maintenance_log: dict[str, Any] | None = None,
                 uuid_str: str = ""):

        super().__init__(id_, groups,
                         description=description,
                         ip_address=ip_address,
                         last_contact_datetime=last_contact_datetime,
                         mac_address=mac_address,
                         maintenance_log=maintenance_log,
                         uuid_str=uuid_str)

        self.WOL_broadcast_address = "255.255.255.255"
        self.WOL_port = 9

        self.config["permissions"]["power_on"] = True
        self.config["app_name"] = "wol_only"

        self.state = {"status": "UNKNOWN"}
        self.last_contact_datetime = datetime.datetime(2020, 1, 1)
        self.poll_latency()

    def __repr__(self):
        return repr(f"[WakeOnLANDevice ID: {self.id} Group: {self.groups} UUID: {self.uuid}]")

    def queue_command(self, cmd: str):

        """Wrapper function to match other exhibit components"""

        if cmd in ["power_on", "wakeDisplay"]:
            self.wake()

    def wake(self):

        """Function to send a magic packet waking the device"""

        print(f"Sending wake on LAN packet to {self.id}")
        with hub_config.logLock:
            logging.info(f"Sending wake on LAN packet to {self.id}")
        try:
            wakeonlan.send_magic_packet(self.mac_address,
                                        ip_address=self.WOL_broadcast_address,
                                        port=self.WOL_port)
        except ValueError as e:
            print(f"Wake on LAN error for component {self.id}: {str(e)}")
            with hub_config.logLock:
                logging.error(f"Wake on LAN error for component {self.id}: {str(e)}")

    def update(self):

        """If we have an IP address, ping the host to see if it is awake"""

        if self.ip_address is not None:
            try:
                ping = icmplib.ping(self.ip_address, privileged=False, count=1)
                prior_status = self.state["status"]
                if ping.is_alive:
                    self.state["status"] = "SYSTEM ON"
                    self.last_contact_datetime = datetime.datetime.now()
                elif self.seconds_since_last_contact() > 60:
                    self.state["status"] = "OFFLINE"
                if prior_status != self.state["status"]:
                    hub_config.last_update_time = time.time()
            except icmplib.exceptions.SocketPermissionError:
                if "wakeOnLANPrivilege" not in hub_config.serverWarningDict:
                    print(
                        "Warning: to check the status of Wake on LAN devices, you must run Hub with administrator privileges.")
                    with hub_config.logLock:
                        logging.info(f"Need administrator privilege to check Wake on LAN status")
                    hub_config.serverWarningDict["wakeOnLANPrivilege"] = True
        else:
            self.state["status"] = "UNKNOWN"

    def get_dict(self):
        """Return a dictionary representation of this component.

        Include only attributes that are likely to be the same if this component is restored at a later date.
        """

        the_dict = super().get_dict()
        the_dict["class"] = "WakeOnLANDevice"
        the_dict["WOL_broadcast_address"] = self.WOL_broadcast_address
        the_dict["WOL_port"] = self.WOL_port

        return the_dict


class Projector(BaseComponent):
    """Holds basic data about a projector."""

    def __init__(self,
                 id_: str,
                 groups: list[str],
                 ip_address: str,
                 connection_type: str,
                 description: str | None = None,
                 last_contact_datetime: str = "",
                 mac_address: str = None,
                 make: str = None,
                 maintenance_log: dict[str, Any] | None = None,
                 password: str = None,
                 uuid_str: str = ""):

        super().__init__(id_, groups,
                         description=description,
                         ip_address=ip_address,
                         last_contact_datetime=last_contact_datetime,
                         mac_address=mac_address,
                         maintenance_log=maintenance_log,
                         uuid_str=uuid_str)

        self.password = password  # Password to access PJLink
        self.connection_type = connection_type
        self.make = make

        self.last_contact_datetime = datetime.datetime(2020, 1, 1)

        self.config["permissions"] = {"sleep": True}
        self.config["app_name"] = "projector"

        self.state = {"status": "OFFLINE"}

        self.update()
        self.poll_latency()

    def __repr__(self):
        return repr(f"[Projector ID: {self.id} Group: {self.groups} UUID: {self.uuid}]")

    def update(self):

        """Contact the projector to get the latest state"""

        error = False
        try:
            connection = projector_control.pjlink_connect(self.ip_address, password=self.password)
            self.state["model"] = projector_control.pjlink_send_command(connection, "get_model")
            self.state["power_state"] = projector_control.pjlink_send_command(connection, "power_state")
            self.state["lamp_status"] = projector_control.pjlink_send_command(connection, "lamp_status")
            self.state["error_status"] = projector_control.pjlink_send_command(connection, "error_status")

            self.update_last_contact_datetime()
        except Exception as e:
            # print(e)
            error = True

        prior_status = self.state["status"]
        if error and (self.seconds_since_last_contact() > 60):
            self.state = {"status": "OFFLINE"}
        else:
            if self.state["power_state"] == "on":
                self.state["status"] = "ONLINE"
            else:
                self.state["status"] = "STANDBY"
        if prior_status != self.state["status"]:
            hub_config.last_update_time = time.time()

    def queue_command(self, cmd: str):
        """Function to spawn a thread that sends a command to the projector.

        Named "queue_command" to match what is used for exhibitComponents
        """

        print(f"Queuing command {cmd} for {self.id}")
        thread_ = threading.Thread(target=self.send_command,
                                   args=[cmd],
                                   name=f"CommandProjector_{self.id}_{str(time.time())}")
        thread_.daemon = True
        thread_.start()

    def send_command(self, cmd: str):
        """Connect to a PJLink projector and send a command"""

        # Translate commands for projector_control
        cmd_dict = {
            "shutdown": "power_off",
            "sleepDisplay": "power_off",
            "wakeDisplay": "power_on"
        }

        try:
            connection = projector_control.pjlink_connect(self.ip_address, password=self.password)
            if cmd in cmd_dict:
                projector_control.pjlink_send_command(connection, cmd_dict[cmd])
            else:
                projector_control.pjlink_send_command(connection, cmd)

        except Exception as e:
            print(e)

    def get_dict(self):
        """Return a dictionary representation of this projector.

        Include only attributes that are likely to be the same if this projector is restored at a later date.
        """

        the_dict = super().get_dict()
        the_dict["class"] = "Projector"
        the_dict["ip_address"] = self.ip_address
        the_dict["password"] = self.password
        the_dict["connection_type"] = self.connection_type

        return the_dict


def load_components():
    """Load the components from disk"""

    path = ex_files.get_path(["components"], user_file=True)
    components = os.listdir(path)

    for component in components:
        if component.startswith('.'):
            continue  # Ignore .DS_store and similar
        comp_path = ex_files.get_path(["components", component], user_file=True)
        try:
            comp_dict = ex_files.load_json(comp_path)
        except json.JSONDecodeError:
            print("Bad component file detected. Removing and continuing")
            c_tools.delete_file(comp_path)
            continue
        if comp_dict is None:
            continue

        if comp_dict["class"] == "ExhibitComponent":
            add_exhibit_component(comp_dict["id"],
                                  comp_dict.get("groups", ["Default"]),
                                  category=comp_dict["category"],
                                  description=comp_dict.get("description", None),
                                  from_disk=True,
                                  last_contact_datetime=comp_dict.get("last_contact_datetime", ""),
                                  maintenance_log=comp_dict.get("maintenance_log", None),
                                  uuid_str=comp_dict["uuid"])
        elif comp_dict["class"] == "Projector":
            add_projector(comp_dict["id"],
                          comp_dict.get("groups", ["Default"]),
                          ip_address=comp_dict["ip_address"],
                          from_disk=True,
                          description=comp_dict.get("description", None),
                          last_contact_datetime=comp_dict.get("last_contact_datetime", ""),
                          maintenance_log=comp_dict.get("maintenance_log", None),
                          password=comp_dict.get("password", None),
                          uuid_str=comp_dict["uuid"])
        elif comp_dict["class"] == "WakeOnLANDevice":
            add_wake_on_LAN_device(comp_dict["id"],
                                   comp_dict.get("groups", ["Default"]),
                                   comp_dict["mac_address"],
                                   ip_address=comp_dict.get("ip_address", None),
                                   from_disk=True,
                                   description=comp_dict.get("description", None),
                                   last_contact_datetime=comp_dict.get("last_contact_datetime", ""),
                                   maintenance_log=comp_dict.get("maintenance_log", None),
                                   uuid_str=comp_dict["uuid"])


def add_exhibit_component(this_id: str,
                          groups: list[str],
                          category: str = "dynamic",
                          description: str | None = None,
                          from_disk: bool = False,
                          last_contact_datetime: str = "",
                          maintenance_log: dict[str, Any] | None = None,
                          uuid_str: str = "") -> ExhibitComponent:
    """Create a new ExhibitComponent, add it to the apps_config.componentList, and return it.

    Set category="static" for static components.
    Set from_disk=True when loading a previously-created component to skip some steps.
    """

    # Check if component has a legacy maintenance status.
    old_maintenance_log = ex_maint.convert_legacy_maintenance_log(this_id)
    if old_maintenance_log is not None:
        maintenance_log = old_maintenance_log
        maint_path = ex_files.get_path(["maintenance-logs", this_id + '.txt'], user_file=True)
        maint_path_new = ex_files.get_path(["maintenance-logs", this_id + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

    component = ExhibitComponent(this_id, groups, category,
                                 description=description,
                                 last_contact_datetime=last_contact_datetime,
                                 maintenance_log=maintenance_log,
                                 uuid_str=uuid_str)
    if not from_disk or old_maintenance_log is not None:
        component.save()

    hub_config.componentList.append(component)
    hub_config.last_update_time = time.time()

    return component


def add_projector(this_id: str,
                  groups: list[str],
                  ip_address: str,
                  description: str | None = None,
                  from_disk: bool = False,
                  last_contact_datetime: str = "",
                  maintenance_log: dict[str, Any] | None = None,
                  password: str | None = None,
                  uuid_str: str = "") -> Projector:
    """Create a new Projector, add it to the apps_config.projectorList, and return it.

    Set from_disk=True when loading a previously-created projector to skip some steps.
    """

    projector = Projector(this_id,
                          groups,
                          ip_address, "pjlink",
                          password=password,
                          description=description,
                          last_contact_datetime=last_contact_datetime,
                          maintenance_log=maintenance_log,
                          uuid_str=uuid_str)
    if not from_disk:
        projector.save()

    hub_config.projectorList.append(projector)
    hub_config.last_update_time = time.time()

    return projector


def add_wake_on_LAN_device(this_id: str,
                           groups: list[str],
                           mac_address: str,
                           description: str | None = None,
                           from_disk: bool = False,
                           ip_address: str | None = None,
                           last_contact_datetime: str = "",
                           maintenance_log: dict[str, Any] | None = None,
                           uuid_str: str = "") -> WakeOnLANDevice:
    """Create a new WakeOnLANDevice, add it to the apps_config.wakeOnLANList, and return it.

    Set from_disk=True when loading a previously-created component to skip some steps.
    """

    component = WakeOnLANDevice(this_id, groups, mac_address,
                                description=description,
                                ip_address=ip_address,
                                last_contact_datetime=last_contact_datetime,
                                maintenance_log=maintenance_log,
                                uuid_str=uuid_str)
    if not from_disk:
        component.save()

    hub_config.wakeOnLANList.append(component)
    hub_config.last_update_time = time.time()

    return component


def check_available_exhibits():
    """Get a list of available exhibit configuration files"""

    hub_config.exhibit_list = []
    exhibits_path = ex_files.get_path(["exhibits"], user_file=True)

    for file in os.listdir(exhibits_path):
        if file.lower().endswith(".json"):
            hub_config.exhibit_list.append(ex_files.load_json(ex_files.get_path(["exhibits", file], user_file=True)))

    # Make sure we have something usable loaded
    if len(hub_config.exhibit_list) == 0:
        create_new_exhibit("Default", None)

    if hub_config.current_exhibit not in [x["uuid"] for x in hub_config.exhibit_list]:
        hub_config.current_exhibit = hub_config.exhibit_list[0]["uuid"]
        c_tools.update_system_configuration({"current_exhibit": hub_config.current_exhibit})


def command_all_exhibit_components(cmd: str):
    """Queue a command for every exhibit component"""

    print("Sending command to all components:", cmd)
    with hub_config.logLock:
        logging.info("command_all_exhibit_components: %s", cmd)

    for component in hub_config.componentList:
        component.queue_command(cmd)

    for projector in hub_config.projectorList:
        projector.queue_command(cmd)

    for device in hub_config.wakeOnLANList:
        device.queue_command(cmd)


def create_new_exhibit(name: str, clone: str | None) -> str:
    """Create a new exhibit file

    Set clone=None to create a new file, or set it equal to the name of an
    existing exhibit to clone that exhibit."""

    if name == 'Default':
        uuid_str = 'Default'
    else:
        uuid_str = str(uuid.uuid4())

    new_file = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, '.json')], user_file=True)

    if clone is not None:
        # Copy an existing file

        # Make sure we have the proper extension on the file we're copying from
        if not clone.lower().endswith(".json"):
            clone += ".json"
        existing_file = ex_files.get_path(["exhibits", clone], user_file=True)
        cloned = ex_files.load_json(existing_file)
        if cloned is not None:
            cloned["name"] = name
            cloned["uuid"] = uuid_str
            ex_files.write_json(cloned, new_file)
        else:
            # Make a new file
            ex_files.write_json({"name": name, "uuid": uuid_str, "components": [], "commands": []}, new_file)

    else:
        # Make a new file
        ex_files.write_json({"name": name, "uuid": uuid_str, "components": [], "commands": []}, new_file)

    hub_config.last_update_time = time.time()
    check_available_exhibits()

    return uuid_str


def delete_exhibit(name: str):
    """Delete the specified exhibit file"""

    # Make sure we have the proper extension
    if not name.lower().endswith(".json"):
        name += ".json"

    file_to_delete = ex_files.get_path(["exhibits", name], user_file=True)

    with hub_config.exhibitsLock:
        try:
            os.remove(file_to_delete)
        except FileNotFoundError:
            print(f"Error: Unable to delete exhibit {file_to_delete}. File not found!")

    hub_config.last_update_time = time.time()
    check_available_exhibits()


def get_exhibit_component(component_id: str = "", component_uuid: str = "") -> ExhibitComponent | None:
    """Return a component with the given UUID or id, or None if no such component exists"""

    if component_uuid == "" and component_id == "":
        raise ValueError("Must specify one of 'component_id' or 'component_uuid'")

    if component_uuid != "":
        # Prefer UUID from Ex 5
        component = next((x for x in hub_config.componentList if x.uuid == component_uuid), None)
    else:
        component = next((x for x in hub_config.componentList if x.id == component_id), None)

    if component is None:
        # Try projector
        component = get_projector(projector_uuid=component_uuid, projector_id=component_id)

    if component is None:
        # Try wake on LAN
        component = get_wake_on_lan_component(component_uuid=component_uuid, component_id=component_id)

    return component


def get_projector(projector_id: str = "", projector_uuid: str = "") -> Projector | None:
    """Return a projector with the given id or uuid, or None if no such projector exists"""

    if projector_uuid == "" and projector_id == "":
        raise ValueError("Must specify one of 'projector_id' or 'projector_uuid'")

    if projector_uuid != "":
        # Prefer UUID from Ex5
        return next((x for x in hub_config.projectorList if x.uuid == projector_uuid), None)
    if projector_id != "":
        return next((x for x in hub_config.projectorList if x.id == projector_id), None)
    return None


def get_wake_on_lan_component(component_id: str = "", component_uuid: str = "") -> WakeOnLANDevice | None:
    """Return a WakeOnLan device with the given id or uuid, or None if no such component exists"""

    if component_uuid == "" and component_id == "":
        raise ValueError("Must specify one of 'component_id' or 'component_uuid'")

    if component_uuid != "":
        # Prefer UUID from Ex5
        return next((x for x in hub_config.wakeOnLANList if x.uuid == component_uuid), None)
    if component_id != "":
        return next((x for x in hub_config.wakeOnLANList if x.id == component_id), None)

    return None


def poll_wake_on_lan_devices():
    """Ask every Wake on LAN device to report its status at an interval.
    """

    for device in hub_config.wakeOnLANList:
        new_thread = threading.Thread(target=device.update, name=f"Poll_WOL_{device.id}_{str(time.time())}")
        new_thread.daemon = True  # So it dies if we exit
        new_thread.start()

    hub_config.polling_thread_dict["poll_wake_on_LAN_devices"] = threading.Timer(30, poll_wake_on_lan_devices)
    hub_config.polling_thread_dict["poll_wake_on_LAN_devices"].daemon = True
    hub_config.polling_thread_dict["poll_wake_on_LAN_devices"].start()


def read_exhibit_configuration(uuid_str: str) -> tuple[bool, str]:
    """Load the given exhibit configuration and trigger an update."""

    exhibit_path = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, 'json')], user_file=True)
    if not os.path.exists(exhibit_path):
        logging.error('read_exhibit_configuration: exhibit does not exist: ' + uuid_str)
        return False, 'does_not_exist'

    try:
        hub_config.exhibit_configuration = ex_files.load_json(exhibit_path)
    except json.JSONDecodeError:
        logging.error('read_exhibit_configuration: bad JSON in ' + uuid_str)
        return False, 'invalid_json'

    # Update the components that the configuration has changed
    for component in hub_config.componentList:
        component.update_configuration()

    # Trigger any exhibit actions
    for command in hub_config.exhibit_configuration.get("commands", []):
        execute_action(command["action"], command["target"], command["value"])

    hub_config.current_exhibit = uuid_str
    hub_config.last_update_time = time.time()
    return True, ''


def update_exhibit_configuration(update: dict[str, Any],
                                 component_id: str | None = "",
                                 component_uuid: str | None = "",
                                 exhibit_name: str | None = ""):
    """Update an exhibit configuration with the given data for a given ID or UUID."""

    if exhibit_name == "" or exhibit_name is None:
        exhibit_name = hub_config.current_exhibit

    exhibit_path = ex_files.get_path(["exhibits", exhibit_name + ".json"], user_file=True)
    exhibit_config = ex_files.load_json(exhibit_path)
    if exhibit_config is None:
        if ex_config.debug is True:
            print('update_exhibit_configuration: error: invalid exhibit: ', exhibit_name)
        return

    match_found = False
    for index, component in enumerate(exhibit_config.get("components", [])):
        # Prefer UUID to ID from Exhibitera 5
        if component_uuid and component.get("uuid") == component_uuid:
            exhibit_config["components"][index] |= update
            exhibit_config["components"][index]["uuid"] = component_uuid
            match_found = True
        elif component_id and component.get("id") == component_id:
            exhibit_config["components"][index] |= update
            if component_uuid:
                exhibit_config["components"][index]["uuid"] = component_uuid
            match_found = True
    if not match_found:
        new_entry = {}
        if component_id != '' and component_id is not None:
            new_entry['id'] = component_id
        if component_uuid != '' and component_uuid is not None:
            new_entry['uuid'] = component_uuid
        new_entry |= update
        exhibit_config["components"].append(new_entry)
    hub_config.exhibit_configuration = exhibit_config

    ex_files.write_json(exhibit_config, exhibit_path)
    if component_uuid:
        this_component = get_exhibit_component(component_uuid=component_uuid)
    else:
        this_component = get_exhibit_component(component_id=component_id)
    if this_component is not None:
        this_component.update_configuration()


def execute_action(action: str,
                   target: list[dict[str, str]] | dict[str, str] | None,
                   value: list | str | None):
    """Execute the given action."""

    if action == 'set_definition' and target is not None and value is not None:
        if isinstance(value, list):
            value = value[0]
        target_uuid = None
        target_id = None
        if "uuid" in target:
            target_uuid = target["uuid"]
        elif "id" in target:
            # Depreciated in Ex5.2 - UUID should be the default
            target_id = target["id"]
        else:
            if ex_config.debug:
                print("set_definition scheduled without a target uuid")
            logging.error("set_definition scheduled without a target uuid")
            return
        print(f"Changing definition for {target} to {value}")

        logging.info("Changing definition for %s to %s", target, value)
        update_exhibit_configuration({"definition": value},
                                     component_id=target_id,
                                     component_uuid=target_uuid)
    elif action == 'set_dmx_scene' and target is not None and value is not None:
        if isinstance(value, list):
            value = value[0]
        target_uuid = None
        target_id = None
        if "uuid" in target:
            target_uuid = target["uuid"]
        elif "id" in target:
            # Depreciated in Ex5.2 - UUID should be the default
            target_id = target["id"]
        else:
            if ex_config.debug:
                print("set_definition scheduled without a target uuid")
                logging.error("set_definition scheduled without a target uuid")
            return

        logging.info('Setting DMX scene for %s to %s', target, value)
        component = get_exhibit_component(component_id=target_id, component_uuid=target_uuid)
        if component is not None:
            component.queue_command("set_dmx_scene__" + value)
    elif action == 'set_exhibit' and target is not None:
        print("Changing exhibit to:", target["value"])
        logging.info("Changing exhibit to %s", target["value"])
        read_exhibit_configuration(target["value"])
    elif target is not None:
        if isinstance(target, dict):
            target = [target]
        for target_i in target:
            if target_i["type"] == 'all':
                command_all_exhibit_components(action)
            elif target_i["type"] == "group":
                group = target_i["uuid"]
                for component in hub_config.componentList:
                    if group in component.groups:
                        component.queue_command(action)
                for component in hub_config.projectorList:
                    if group in component.groups:
                        component.queue_command(action)
                for component in hub_config.wakeOnLANList:
                    if group in component.groups:
                        component.queue_command(action)
            elif target_i["type"] == "component":
                target_uuid = None
                target_id = None
                if "uuid" in target_i:
                    target_uuid = target_i["uuid"]
                elif "id" in target_i:
                    # Depreciated in Ex5.2 - UUID should be the default
                    target_id = target_i["id"]
                else:
                    if ex_config.debug:
                        print("action scheduled without a target uuid")
                        logging.error("set_definition scheduled without a target uuid")
                    return
                component = get_exhibit_component(component_id=target_id, component_uuid=target_uuid)
                if component is not None:
                    component.queue_command(action)
    else:
        command_all_exhibit_components(action)

    hub_config.last_update_time = time.time()


def update_exhibit_component_status(data: dict[str, Any], ip: str):
    """Update an ExhibitComponent with the values in a dictionary."""

    if ip == "::1":
        ip = "localhost"

    if "uuid" in data:
        # This is the preferred way from Exhibitera 5 onwards
        component = get_exhibit_component(component_uuid=data["uuid"])
    else:
        # Legacy support
        component = get_exhibit_component(component_id=data["id"])

    if component is None:  # This is a new uuid, so make the component
        component = add_exhibit_component(data["id"], ["Default"], uuid_str=data.get("uuid", ""))

    component.ip_address = ip
    if "helperAddress" in data:
        component.set_helper_address(data["helperAddress"])

    component.update_last_contact_datetime(interaction=data.get("currentInteraction", False))

    if "permissions" in data:
        permissions = data["permissions"]

        for key in permissions:
            component.config["permissions"][key] = permissions[key]
    if "error" in data:
        component.config["error"] = data["error"]
    else:
        if "error" in component.config:
            component.config.pop("error")
    if "platform_details" in data:
        if isinstance(data["platform_details"], dict):
            component.platform_details.update(data["platform_details"])
    if "exhibiteraAppID" in data:
        component.config["app_id"] = data["exhibiteraAppID"]

# Set up log file
log_path = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)
