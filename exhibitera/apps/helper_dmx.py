# Standard imports
import os.path
from typing import Any, Union
import uuid

# Non-standard imports
from PyDMXControl.controllers import OpenDMXController, TransmittingController, uDMXController
from PyDMXControl.profiles.defaults import Fixture
from pyftdi.ftdi import Ftdi

# Exhibitera modules
import config
import helper_files


class DMXUniverse:
    """A DMX controller and up to 32 fixtures."""

    def __init__(self, name: str,
                 controller: str = "OpenDMX",
                 device_details: dict[str, Any] = {},
                 dynamic_frame=True,
                 uuid_str: str = ""):

        self.name: str = name
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

        # Delete each fixture
        for key in self.fixtures.copy():
            self.fixtures[key].delete()

        # Remove from config
        config.dmx_universes = [x for x in config.dmx_universes if x.uuid != self.uuid]

        write_dmx_configuration()

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
        config.dmx_fixtures.append(fixture)

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
            "name": self.name,
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
        return f"[DMXFixture: '{self.name}' in universe '{get_universe(self.universe).name}' with channels {self.channel_usage}]"

    def __str__(self, *args, **kwargs):
        return f"[DMXFixture: '{self.name}' in universe '{get_universe(self.universe).name}' with channels {self.channel_usage}]"

    def update(self,
               name: str | None = None,
               start_channel: int | None = None,
               channel_list: list[str] | None = None):
        """Update the fixture with the given details"""

        if name is not None:
            self._set_name(name)

        if start_channel is not None:
            self.__start_channel = start_channel

        if channel_list is not None:
            self._Fixture__channels = []
            self._Fixture__channel_aliases = {}
            for channel in channel_list:
                self._register_channel(channel)

    def delete(self):
        """Remove the fixture from all its groups, then its universe."""

        # Remove from config
        config.dmx_fixtures = [x for x in config.dmx_fixtures if x.uuid != self.uuid]

        # Remove from groups
        for group_name in self.groups.copy():
            group = get_group(group_name)
            group.remove_fixture(self.uuid)

        get_universe(self.universe).remove_fixture(self.uuid)

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
        self.scenes: list[DMXScene] = []

        if uuid_str == "":
            self.uuid = str(uuid.uuid4())  # A unique ID
        else:
            self.uuid = uuid_str

    def delete(self):
        """Remove the group."""

        # Remove from config
        config.dmx_groups = [x for x in config.dmx_groups if x.uuid != self.uuid]

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

    def create_scene(self, name: str, values: dict[str, Any], duration: float = 0, uuid_str: str = ""):
        """Create a new scene and add it to the list."""

        self.scenes.append(DMXScene(name, values, duration=duration, uuid_str=uuid_str))

        return self.scenes[-1].uuid

    def delete_scene(self, uuid_str):
        """Remove the given scene."""

        self.scenes = [scene for scene in self.scenes if scene.uuid != uuid_str]

    def get_scene(self, uuid_str: str) -> Union['DMXScene', None]:

        for scene in self.scenes:
            if scene.uuid == uuid_str:
                return scene

    def show_scene(self, uuid_str: str):
        """Find the given scene and set it."""

        scene = self.get_scene(uuid_str)
        if scene is None:
            raise ValueError("A scene with the given identifier does not exist.")

        for key in scene.values:
            # key is the name of a Fixture
            if key in self.fixtures:
                entry = scene.values[key]

                if "duration" in entry:
                    duration = entry["duration"]
                else:
                    duration = 0

                for channel in entry:
                    if channel == 'duration':
                        continue
                    self.fixtures[key].anim(duration, [channel, entry[channel]])

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary that can be used to rebuild this group."""

        scene_list = []
        for scene in self.scenes:
            scene_list.append(scene.get_dict())

        fixture_list = []
        for fixture_uuid in self.fixtures:
            fixture_list.append(fixture_uuid)

        the_dict = {
            "name": self.name,
            "uuid": self.uuid,
            "fixtures": fixture_list,
            "scenes": scene_list
        }
        return the_dict


class DMXScene:
    """A collection of values for DMX fixtures.

        Each entry in the outer dict is the name of a fixture.
        Each entry in the inner dict is a parameter to set for that fixture.
        Options: brightness, color
    """

    def __init__(self, name: str, values: dict[str, dict[str, Any]], duration: float = 0, uuid_str: str = ""):
        self.name: str = name
        self.values: dict[str, dict[str, Any]] = values
        self.duration: float = duration

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
    """Create a new DMXFixtureGroup and add it to config.dmx_groups."""

    new_group = DMXFixtureGroup(name, uuid_str=uuid_str)
    config.dmx_groups.append(new_group)

    return new_group


def create_universe(name: str,
                    controller: str = "OpenDMX",
                    device_details: dict[str, Any] = {},
                    dynamic_frame: bool = True,
                    uuid_str: str = "") -> Union[DMXUniverse, None]:
    """Create a new DMXUniverse and add it to config.dmx_universes."""

    try:
        new_universe = DMXUniverse(name,
                                   controller=controller,
                                   device_details=device_details,
                                   dynamic_frame=dynamic_frame,
                                   uuid_str=uuid_str)

        config.dmx_universes.append(new_universe)
    except IOError as e:
        if e.args[0] == "No such device":
            return None
        else:
            raise e

    return new_universe


def get_fixture(uuid_str: str) -> Union[DMXFixture, None]:
    """Return the matched DMXFixture, if it exists."""

    for fixture in config.dmx_fixtures:
        if fixture.uuid == uuid_str:
            return fixture
    return None


def get_group(uuid_str: str) -> Union[DMXFixtureGroup, None]:
    """Return the matching DMXFixtureGroup."""

    for group in config.dmx_groups:
        if group.uuid == uuid_str:
            return group


def get_scene(uuid_str: str) -> tuple[DMXScene | None, DMXFixtureGroup | None]:
    """Return the matching DMXScene, searching across groups."""

    for group in config.dmx_groups:
        for scene in group.scenes:
            if scene.uuid == uuid_str:
                return scene, group
    return None, None


def get_universe(uuid_str: str) -> Union[DMXUniverse, None]:
    """Return the matching DMXUniverse."""

    for universe in config.dmx_universes:
        if universe.uuid == uuid_str:
            return universe


def write_dmx_configuration() -> None:
    """Use config.dmx_universes and config.dmx_groups to write dmx.json."""

    universe_list = []
    group_list = []

    for universe in config.dmx_universes:
        universe_list.append(universe.get_dict())

    for group in config.dmx_groups:
        group_list.append(group.get_dict())

    config_dict = {
        "universes": universe_list,
        "groups": group_list
    }

    config_path = helper_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    helper_files.write_json(config_dict, config_path)


def read_dmx_configuration() -> tuple[bool, str]:
    """Read dmx.json and turn it into a set of universes, fixtures, and groups."""

    config_path = helper_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        return False, "no_config_file"

    config_dict = helper_files.load_json(config_path)

    # First, create any universes
    config.dmx_universes = []
    universe_config = config_dict["universes"]

    for entry in universe_config:
        details = {
            "address": entry["address"],
            "bus": entry['bus'],
            "serial_number": entry["serial_number"]
        }
        uni = create_universe(entry["name"],
                              controller=entry["controller"],
                              device_details=details,
                              uuid_str=entry["uuid"])
        if uni is None:
            return False, "device_not_found"

        for fix in entry["fixtures"]:
            uni.create_fixture(
                fix["name"], fix["start_channel"], fix["channels"], uuid_str=fix["uuid"])

    # Then, create any groups
    config.dmx_groups = []
    group_config = config_dict["groups"]
    for entry in group_config:
        group = create_group(entry["name"], uuid_str=entry["uuid"])
        for fixture_uuid in entry["fixtures"]:
            fixture = get_fixture(fixture_uuid)
            group.add_fixtures([fixture])
        for scene in entry["scenes"]:
            group.create_scene(scene["name"], scene["values"], duration=scene["duration"], uuid_str=scene["uuid"])

    return True, ""


def activate_dmx() -> tuple[bool, str]:
    """Perform setup actions to get ready to use DMX in Exhibitera.

    Returns True is DMX has been successfully activated (already or just now) and False otherwise.
    """

    reason = ""
    if not config.dmx_active:
        config.dmx_active, reason = read_dmx_configuration()
    # print("activate_dmx: ", config.dmx_active, reason)
    return config.dmx_active, reason


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
