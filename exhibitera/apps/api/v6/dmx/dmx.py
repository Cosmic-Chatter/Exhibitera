# Standard modules
import os
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.dmx as apps_dmx

router = APIRouter(prefix='/DMX')


@router.get("/availableControllers")
async def get_dmx_controllers():
    """Return a list of connected DMX controllers."""

    success, reason, controllers = apps_dmx.get_available_controllers()

    return {"success": success, "reason": reason, "controllers": controllers}


@router.get("/debug")
async def debug_dmx_universe(universe_index: int):
    """Trigger the debug mode for the universe at the given index"""

    apps_config.dmx_universe.controller.web_control()


@router.get("/configuration")
async def get_dmx_configuration():
    """Return the JSON DMX configuration file."""

    success, reason = apps_dmx.activate_dmx()
    config_dict = {
        "universe": None,
        "groups": []
    }
    if success is True:
        config_path = ex_files.get_path(
            ["configuration", "dmx.json"], user_file=True)
        config_dict = ex_files.load_json(config_path)

    return {"success": success, "reason": reason, "configuration": config_dict}


@router.get("/status")
async def get_dmx_status():
    """Return a dictionary with the current channel value for every channel in every fixture."""

    success, reason = apps_dmx.activate_dmx()

    result = {}

    for fixture in apps_config.dmx_fixtures:
        result[fixture.uuid] = fixture.get_all_channel_values()

    return {"success": success, "reason": reason, "status": result}


@router.post("/fixture/create")
async def create_dmx_fixture(name: str = Body(description="The name of the fixture."),
                             channels: list[str] = Body(description="A list of channel names."),
                             start_channel: int = Body(description="The first channel to allocate.")):
    """Create a new DMX fixture"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    new_fixture = apps_config.dmx_universe.create_fixture(name, start_channel, channels)
    apps_dmx.write_dmx_configuration()

    return {"success": True, "fixture": new_fixture.get_dict()}


@router.post("/fixture/{uuid_str}/edit")
async def edit_dmx_fixture(uuid_str: str,
                           name: str = Body(description="The name of the fixture.", default=None),
                           channels: list[str] = Body(description="A list of channel names.", default=None),
                           start_channel: int = Body(description="The first channel to allocate.", default=None)):
    """Edit an existing DMX fixture"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_config.dmx_universe.get_fixture(uuid_str)
    fixture.update(name=name, start_channel=start_channel, channel_list=channels)
    apps_dmx.write_dmx_configuration()

    return {"success": True, "fixture": fixture.get_dict()}


@router.delete("/fixture/{uuid_str}")
async def remove_dmx_fixture(uuid_str: str):
    """Remove the given DMX fixture from its universe and any groups"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(uuid_str)
    if fixture is None:
        print(f"Cannot remove fixture {uuid_str}. It does not exist.")
        return {"success": False, "reason": "Fixture does not exist."}
    fixture.delete()
    apps_dmx.write_dmx_configuration()

    return {"success": True}


@router.post("/fixture/{uuid_str}/setBrightness")
async def set_dmx_fixture_to_brightness(uuid_str: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given fixture to the specified brightness."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(uuid_str)
    fixture.set_brightness(value, duration)
    return {"success": True, "configuration": fixture.get_dict()}


@router.post("/fixture/{uuid_str}/setChannel")
async def set_dmx_fixture_channel(uuid_str: str,
                                  channel_name: str = Body(
                                      "The name of the chanel to set."),
                                  value: int = Body(
                                      description="The value to be set.")):
    """Set the given channel of the given fixture to the given value."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(uuid_str)
    fixture.set_channel(channel_name, value)
    return {"success": True, "configuration": fixture.get_dict()}


@router.post("/fixture/{uuid_str}/setColor")
async def set_dmx_fixture_to_color(uuid_str: str,
                                   color: list = Body(
                                       description="The color to be set."),
                                   duration: float = Body(description="How long the color transition should take.",
                                                          default=0)):
    """Set the given fixture to the specified color."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(uuid_str)
    if fixture is None:
        return {"success": False, "reason": "Figure does not exist."}
    fixture.set_color(color, duration)
    return {"success": True, "configuration": fixture.get_dict()}


@router.post("/group/create")
async def create_dmx_group(name: str = Body(description="The name of the group to create."),
                           fixture_list: list[str] = Body(description="The UUIDs of the fixtures to include.")):
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    new_group = apps_dmx.create_group(name)

    fixtures = []
    for fixture_uuid in fixture_list:
        fixtures.append(apps_dmx.get_fixture(fixture_uuid))
    new_group.add_fixtures(fixtures)
    apps_dmx.write_dmx_configuration()

    return {"success": True, "uuid": new_group.uuid}


@router.post("/group/{group_uuid}/edit")
async def edit_dmx_group(group_uuid: str,
                         name: str = Body(description="The new name for the group", default=""),
                         fixture_list: list[str] = Body(
                             description="A list of UUIDs for fixtures that should be included.", default=[])):
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)

    if group is None:
        return {"success": False, "reason": f"Group {group_uuid} does not exist."}

    if name != "":
        group.name = name

    if len(fixture_list) > 0:
        # First, remove any fixtures that are in the group, but not in fixture_list
        for fixture_uuid in group.fixtures.copy():
            if fixture_uuid not in fixture_list:
                group.remove_fixture(fixture_uuid)

        # Then, loop through fixture_list and add any that are not included in the group
        fixtures_to_add = []
        for fixture_uuid in fixture_list:
            if fixture_uuid not in group.fixtures:
                fixture = apps_dmx.get_fixture(fixture_uuid)
                if fixture is not None:
                    fixtures_to_add.append(fixture)

        if len(fixtures_to_add) > 0:
            group.add_fixtures(fixtures_to_add)
    apps_dmx.write_dmx_configuration()

    return {"success": True}


@router.get("/group/{group_uuid}/delete")
async def delete_dmx_group(group_uuid: str):
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    apps_dmx.get_group(group_uuid).delete()
    apps_dmx.write_dmx_configuration()
    return {"success": True}


@router.post("/scene/create")
async def create_dmx_scene(name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Create the given scene."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    uuid_str = apps_dmx.create_scene(name, values, duration=duration)
    apps_dmx.write_dmx_configuration()
    return {"success": True, "uuid": uuid_str}


@router.post("/scene/{uuid_str}/edit")
async def edit_dmx_scene(uuid_str: str,
                         name: str = Body(description="The name of the scene."),
                         values: dict = Body(description="A dictionary of values for the scene."),
                         duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Edit the given scene"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    scene = apps_dmx.get_scene(uuid_str=uuid_str)

    scene.name = name
    scene.duration = duration
    scene.set_values(values)

    apps_dmx.write_dmx_configuration()
    return {"success": True}


@router.delete("/scene/{uuid_str}")
async def create_dmx_scene(uuid_str: str):
    """Delete the given scene."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    apps_dmx.delete_scene(uuid_str)
    apps_dmx.write_dmx_configuration()
    return {"success": True}


@router.post("/group/{group_uuid}/setBrightness")
async def set_dmx_fixture_to_brightness(group_uuid: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given group to the specified brightness."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.set_brightness(value, duration)
    return {"success": True, "configuration": group.get_dict()}


@router.post("/group/{group_uuid}/setChannel")
async def set_dmx_group_channel(group_uuid: str,
                                channel: str = Body(description="The channel to set."),
                                value: int = Body(description="The value to set.")):
    """Set the given channel to the specified value for every fixture in the group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.set_channel(channel, value)
    return {"success": True, "configuration": group.get_dict()}


@router.post("/group/{group_uuid}/setColor")
async def set_dmx_group_to_color(group_uuid: str,
                                 color: list = Body(
                                     description="The color to be set."),
                                 duration: float = Body(description="How long the color transition should take.",
                                                        default=0)):
    """Set the given group to the specified color."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.set_color(color, duration)
    return {"success": True, "configuration": group.get_dict()}


@router.get("/scenes")
async def get_dmx_scenes():
    """Return a list of the available scenes."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    scenes = []
    for scene in apps_config.dmx_scenes:
        scenes.append({"uuid": scene.uuid, "name": scene.name})

    return {"success": True, "scenes": scenes}


@router.get("/scene/{uuid_str}/set")
async def set_dmx_scene(uuid_str: str):
    """Show a DMX scene."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    try:
        apps_dmx.show_scene(uuid_str)
    except ValueError:
        return {"success": False, reason: "scene_does_not_exist"}

    return {"success": True}


@router.post("/universe/create")
async def create_dmx_universe(controller: str = Body(description="The type of this controller (OpenBMX or uDMX)."),
                              device_details: dict[str, Any] = Body(
                                  description="A dictionary of hardware details for the controller.")):
    """Create a new DMXUniverse."""

    apps_dmx.activate_dmx()
    new_universe = apps_dmx.create_universe(controller=controller,
                                            device_details=device_details)
    apps_dmx.write_dmx_configuration()
    apps_config.dmx_active = True

    return {"success": True, "universe": new_universe.get_dict()}


@router.delete("/universe")
async def delete_dmx_universe():
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    universe = apps_config.dmx_universe
    if universe is None:
        return {"success": False, "reason": "Universe does not exist"}
    universe.delete()
    return {"success": True}
