# Standard imports
import logging
import os.path
from typing import Any, Union
import uuid

# Non-standard imports
from PyDMXControl.controllers import OpenDMXController, TransmittingController, uDMXController
from PyDMXControl.profiles.defaults import Fixture
from pyftdi.ftdi import Ftdi

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.files as apps_files


class DMXUniverse:
    """A DMX controller and up to 32 fixtures."""

    def __init__(self, controller: str = "OpenDMX",
                 device_details: dict[str, Any] = {},
                 dynamic_frame=True,
                 uuid_str: str = ""):

        self.fixtures: dict[str, DMXFixture] = {}
        self.controller: TransmittingController
        self.controller_type = controller

        if uuid_str != "":
            self.uuid = uuid_str
        else:
            self.uuid = str(uuid.uuid4())  # A unique ID

        self.address: Union[int, None] = device_details.get("address", None)
        self.bus: Union[int, None] = device_details.get("bus", None)
        self.serial_number: Union[str, None] = device_details.get("serial_number", None)

        if controller == "OpenDMX":
            self.controller = OpenDMXController(dynamic_frame=dynamic_frame,
                                                ftdi_serial=self.serial_number)
        elif controller == "uDMX":
            self.controller = uDMXController(dynamic_frame=dynamic_frame,
                                             udmx_address=self.address,
                                             udmx_bus=self.bus)
        else:
            raise ValueError(
                "'controller' must be one of 'OpenDMX' or 'uDMX'.")

    def __repr__(self, *args, **kwargs):
        return f"[DMXUniverse: '{self.name}' with controller '{self.controller_type}']"

    def __str__(self, *args, **kwargs):
        return f"[DMXUniverse: '{self.name}' with controller '{self.controller_type}']"

    def delete(self):
        """Remove the universe."""

        # Remove from apps_config
        apps_config.dmx_universe = None
        apps_config.dmx_groups = []
        apps_config.dmx_fixtures = []
        apps_config.dmx_active = False

        config_path = ex_files.get_path(["configuration", "dmx.json"], user_file=True)
        os.remove(config_path)

        # Stop the controller
        self.controller.close()

    def create_fixture(self, name: str, start_channel: int, channel_list: list[str],
                       uuid_str: str = "") -> 'DMXFixture':
        """Create a fixture and add it to the universe."""

        if len(self.fixtures) == 32:
            # We have reached the maximum limit for this universe
            raise AttributeError(
                "A DMX universe cannot contain more than 32 fixtures.")

        fixture = DMXFixture(name, start_channel, channel_list, uuid_str=uuid_str)
        fixture.universe = self.uuid
        self.fixtures[fixture.uuid] = fixture

        self.controller.add_fixture(fixture)
        apps_config.dmx_fixtures.append(fixture)

        return fixture

    def remove_fixture(self, uuid_str: str):
        """Remove the given fixture from the universe."""
        fixture = self.get_fixture(uuid_str)

        fixture.universe = ""
        del self.fixtures[uuid_str]
        self.controller.del_fixture(fixture.id)

    def get_fixture(self, uuid_str: str) -> Union['DMXFixture', None]:

        if uuid_str in self.fixtures:
            return self.fixtures[uuid_str]

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary with the information necessary to rebuild this universe."""

        fixture_list = []
        for name in self.fixtures:
            fixture = self.fixtures[name]
            fixture_list.append(fixture.get_dict())

        the_dict = {
            "uuid": self.uuid,
            "address": self.address,
            "bus": self.bus,
            "serial_number": self.serial_number,
            "controller": self.controller_type,
            "fixtures": fixture_list
        }
        return the_dict


class DMXFixture(Fixture):
    """Exhibitera object for a DMX fixture"""

    def __init__(self,
                 name: str,
                 start_channel: int,
                 channel_list: list[str],
                 channel_visibility: Union[dict[str, bool], None] = None,
                 uuid_str: str = ""):
        super().__init__(name=name,
                         start_channel=start_channel)

        if channel_visibility is not None:
            self.channel_visibility = channel_visibility
        else:
            self.channel_visibility = {}
        for channel in channel_list:
            self._register_channel(channel)

        if uuid_str == "":
            self.uuid = str(uuid.uuid4())  # A unique ID
        else:
            self.uuid = uuid_str

        self.universe: str = ""  # UUID of the universe this belongs to.
        self.groups: set[str] = set()

    def __repr__(self, *args, **kwargs):
        return f"[DMXFixture: '{self.name}' with channels {self.channel_usage}]"

    def __str__(self, *args, **kwargs):
        return f"[DMXFixture: '{self.name}' with channels {self.channel_usage}]"

    def update(self,
               name: str | None = None,
               start_channel: int | None = None,
               channel_list: list[str] | None = None):
        """Update the fixture with the given details"""

        if name is not None:
            self._set_name(name)

        if start_channel is not None:
            self._Fixture__start_channel = start_channel

        if channel_list is not None:
            self._Fixture__channels = []
            self._Fixture__channel_aliases = {}
            for channel in channel_list:
                self._register_channel(channel)

    def delete(self):
        """Remove the fixture from all its groups, then its universe."""

        # Remove from apps_config
        apps_config.dmx_fixtures = [x for x in apps_config.dmx_fixtures if x.uuid != self.uuid]

        # Remove from groups
        for group_name in self.groups.copy():
            group = get_group(group_name)
            group.remove_fixture(self.uuid)

        apps_config.dmx_universe.remove_fixture(self.uuid)

    def get_all_channel_values(self) -> dict[str, int]:
        """Return a dict with the current value of every channel."""

        result = {}
        for channel_index in self.channels:
            channel = self.channels[channel_index]
            result[channel["name"]] = channel["value"][0]

        return result

    def set_brightness(self, value, duration=0, *args, **kwargs):
        self.dim(value, duration, *args, **kwargs)

    def set_color(self, color, duration=0, *args, **kwargs):
        self.color(color, duration)

    def get_dict(self) -> dict[str, Any]:
        """Return a dict representing the necessary information to recreate this fixture"""

        channel_list = []
        for key in self.channels:
            channel = self.channels[key]
            channel_list.append(channel["name"])
        the_dict = {
            "name": self.name,
            "start_channel": self.start_channel,
            "channels": channel_list,
            "uuid": self.uuid
        }
        return the_dict


class DMXFixtureGroup:
    """Hold a collection of DMXFixtures."""

    def __init__(self, name, uuid_str: str = ""):
        self.name: str = name
        self.fixtures: dict[str, DMXFixture] = {}

        if uuid_str == "":
            self.uuid = str(uuid.uuid4())  # A unique ID
        else:
            self.uuid = uuid_str

    def delete(self):
        """Remove the group."""

        # Remove from apps_config
        apps_config.dmx_groups = [x for x in apps_config.dmx_groups if x.uuid != self.uuid]

        # Remove self reference from each child fixture
        for key in self.fixtures:
            fixture = self.fixtures[key]
            fixture.groups.remove(self.uuid)

    def add_fixtures(self, fixture_list: list[DMXFixture]):
        """Add one or more DMXFixtures to the group."""

        for fixture in fixture_list:
            self.fixtures[fixture.uuid] = fixture
            fixture.groups.add(self.uuid)

    def remove_fixture(self, uuid_str: str):
        """Remove the specified fixture."""

        fixture = self.get_fixture(uuid_str)
        fixture.groups.remove(self.uuid)
        del self.fixtures[uuid_str]

    def get_fixture(self, uuid_str: str) -> Union[DMXFixture, None]:

        if uuid_str in self.fixtures:
            return self.fixtures[uuid_str]

    def set_brightness(self, value, duration=0, *args, **kwargs):
        """Set the brightness of all fixtures."""

        for key in self.fixtures:
            fixture = self.fixtures[key]
            fixture.set_brightness(value, duration, *args, **kwargs)

    def set_channel(self, channel: Union[str, int], value: int, *args, **kwargs):
        """Set the given channel to the given value for all fixtures."""

        for key in self.fixtures:
            fixture = self.fixtures[key]
            fixture.set_channel(channel, value)

    def set_color(self, color, duration=0, *args, **kwargs):
        """Set the color of all fixtures."""

        for key in self.fixtures:
            fixture = self.fixtures[key]
            fixture.set_color(color, duration, *args, **kwargs)

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary that can be used to rebuild this group."""

        fixture_list = []
        for fixture_uuid in self.fixtures:
            fixture_list.append(fixture_uuid)

        the_dict = {
            "name": self.name,
            "uuid": self.uuid,
            "fixtures": fixture_list,
        }
        return the_dict


class DMXScene:
    """A collection of values for DMX fixtures.

        Each entry in the outer dict is the name of a fixture.
        Each entry in the inner dict is a parameter to set for that fixture.
        Options: brightness, color
    """

    def __init__(self, name: str, values: dict[str, dict[str, Any]], duration: int = 0, uuid_str: str = ""):
        self.name: str = name
        self.values: dict[str, dict[str, Any]] = values
        self.duration: int = int(duration)

        if uuid_str == "":
            self.uuid = str(uuid.uuid4())  # A unique ID
        else:
            self.uuid = uuid_str

    def set_values(self, values: dict[str, dict[str, Any]]):
        """Change the value of self.values."""

        self.values = values

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary that can be used to rebuild this scene."""

        the_dict = {
            "name": self.name,
            "values": self.values,
            "duration": self.duration,
            "uuid": self.uuid
        }
        return the_dict


def create_group(name: str, uuid_str: str = '') -> DMXFixtureGroup:
    """Create a new DMXFixtureGroup and add it to apps_config.dmx_groups."""

    new_group = DMXFixtureGroup(name, uuid_str=uuid_str)
    apps_config.dmx_groups.append(new_group)

    return new_group


def create_universe(controller: str = "OpenDMX",
                    device_details: dict[str, Any] = {},
                    dynamic_frame: bool = True,
                    uuid_str: str = "") -> Union[DMXUniverse, None]:
    """Create a new DMXUniverse."""

    if apps_config.dmx_universe is not None:
        print("create_universe: error: DMX universe already exits.")
        if apps_config.debug:
            logging.error("create_universe: error: DMX universe already exits.")
        return None

    try:
        new_universe = DMXUniverse(controller=controller,
                                   device_details=device_details,
                                   dynamic_frame=dynamic_frame,
                                   uuid_str=uuid_str)

        apps_config.dmx_universe = new_universe
    except IOError as e:
        if e.args[0] == "No such device":
            return None
        else:
            raise e

    return new_universe


def get_fixture(uuid_str: str) -> Union[DMXFixture, None]:
    """Return the matched DMXFixture, if it exists."""

    for fixture in apps_config.dmx_fixtures:
        if fixture.uuid == uuid_str:
            return fixture
    return None


def get_group(uuid_str: str) -> Union[DMXFixtureGroup, None]:
    """Return the matching DMXFixtureGroup."""

    for group in apps_config.dmx_groups:
        if group.uuid == uuid_str:
            return group


def create_scene(name: str, values: dict[str, Any], duration: int = 0, uuid_str: str = ""):
    """Create a new scene and add it to the list."""

    apps_config.dmx_scenes.append(DMXScene(name, values, duration=duration, uuid_str=uuid_str))

    return apps_config.dmx_scenes[-1].uuid


def delete_scene(uuid_str):
    """Remove the given scene."""

    apps_config.dmx_scenes = [scene for scene in apps_config.dmx_scenes if scene.uuid != uuid_str]


def show_scene(uuid_str: str):
    """Find the given scene and set it."""

    scene = get_scene(uuid_str)
    if scene is None:
        raise ValueError("A scene with the given identifier does not exist.")

    for fixture_uuid in scene.values:
        fixture = get_fixture(fixture_uuid)
        if fixture is not None:
            entry = scene.values[fixture_uuid]

            for channel in entry:
                fixture.anim(scene.duration, (channel, entry[channel]))


def get_scene(uuid_str: str) -> DMXScene | None:
    """Return the matching DMXScene."""

    for scene in apps_config.dmx_scenes:
        if scene.uuid == uuid_str:
            return scene
    return None


def write_dmx_configuration() -> None:
    """Use apps_config.dmx_universe and apps_config.dmx_groups to write dmx.json."""

    group_list = []
    scene_list = []

    for group in apps_config.dmx_groups:
        group_list.append(group.get_dict())

    for scene in apps_config.dmx_scenes:
        scene_list.append(scene.get_dict())

    config_dict = {
        "universe": apps_config.dmx_universe.get_dict(),
        "groups": group_list,
        "scenes": scene_list
    }

    config_path = ex_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    ex_files.write_json(config_dict, config_path)


def read_dmx_configuration() -> tuple[bool, str]:
    """Read dmx.json and turn it into a set of fixtures, groups, and scenes."""

    config_path = ex_files.get_path(["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        return False, "no_config_file"

    config_dict = ex_files.load_json(config_path)

    # First, create the universe
    apps_config.dmx_universe = None
    uni_dict = config_dict["universe"]

    details = {
        "address": uni_dict["address"],
        "bus": uni_dict['bus'],
        "serial_number": uni_dict["serial_number"]
    }
    uni = create_universe(controller=uni_dict["controller"],
                          device_details=details,
                          uuid_str=uni_dict["uuid"])
    if uni is None:
        return False, "device_not_found"

    for fix in uni_dict["fixtures"]:
        uni.create_fixture(
            fix["name"], fix["start_channel"], fix["channels"], uuid_str=fix["uuid"])

    # Then, create any groups
    apps_config.dmx_groups = []
    group_config = config_dict["groups"]
    for entry in group_config:
        group = create_group(entry["name"], uuid_str=entry["uuid"])
        for fixture_uuid in entry["fixtures"]:
            fixture = get_fixture(fixture_uuid)
            group.add_fixtures([fixture])

    # Then, create any scenes
    apps_config.dmx_scenes = []
    scene_config = config_dict["scenes"]
    for scene in scene_config:
        create_scene(scene["name"], scene["values"], duration=scene["duration"], uuid_str=scene["uuid"])

    return True, ""


def activate_dmx() -> tuple[bool, str]:
    """Perform setup actions to get ready to use DMX in Exhibitera.

    Returns True is DMX has been successfully activated (already or just now) and False otherwise.
    """

    reason = ""
    if not apps_config.dmx_active:
        apps_config.dmx_active, reason = read_dmx_configuration()
    return apps_config.dmx_active, reason


def get_available_controllers() -> tuple[bool, str, list[dict[str, Any]]]:
    """Return a list of Ftdi devices."""

    try:
        all_devices = Ftdi.list_devices()
    except ValueError as e:
        if e.args[0] == "No backend available":
            return False, "No backend available", []
        else:
            raise ValueError(e)

    device_list = []
    for entry in all_devices:
        device = entry[0]
        device_dict = {
            "serial_number": device.sn,
            "bus": device.bus,
            "address": device.address
        }
        if device.vid == 1027 and device.pid == 24577:
            device_dict["model"] = "OpenDMX"
        elif device.vid == 5824 and device.pid == 1500:
            device_dict["model"] = "uDMX"
        device_list.append(device_dict)

    return True, "", device_list
