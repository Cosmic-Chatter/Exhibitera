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

@router.get("/getAvailableControllers")
async def get_dmx_controllers():
    """Return a list of connected DMX controllers."""

    success, reason, controllers = apps_dmx.get_available_controllers()

    return {"success": success, "reason": reason, "controllers": controllers}


@router.get("/{universe_index}/debug")
async def debug_dmx_universe(universe_index: int):
    """Trigger the debug mode for the universe at the given index"""

    print(apps_config.dmx_universes, universe_index, type(universe_index))
    apps_config.dmx_universes[universe_index].controller.web_control()


@router.get("/configuration")
async def get_dmx_configuration():
    """Return the JSON DMX configuration file."""

    success, reason = apps_dmx.activate_dmx()
    config_dict = {
        "universes": [],
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
                             start_channel: int = Body(description="The first channel to allocate."),
                             universe: str = Body(description='The UUID of the universe this fixture belongs to.')):
    """Create a new DMX fixture"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    new_fixture = apps_dmx.get_universe(uuid_str=universe).create_fixture(name, start_channel, channels)
    apps_dmx.write_dmx_configuration()

    return {"success": True, "fixture": new_fixture.get_dict()}


@router.post("/fixture/edit")
async def edit_dmx_fixture(fixture_uuid: str = Body(description="The UUID of the fixture to edit."),
                           name: str = Body(description="The name of the fixture.", default=None),
                           channels: list[str] = Body(description="A list of channel names.", default=None),
                           start_channel: int = Body(description="The first channel to allocate.", default=None),
                           universe: str = Body(description='The UUID of the universe this fixture belongs to.')):
    """Edit an existing DMX fixture"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_universe(uuid_str=universe).get_fixture(fixture_uuid)
    fixture.update(name=name, start_channel=start_channel, channel_list=channels)
    apps_dmx.write_dmx_configuration()

    return {"success": True, "fixture": fixture.get_dict()}


@router.post("/fixture/remove")
async def remove_dmx_fixture(fixture_uuid: str = Body(description="The UUID of the fixture to remove.", embed=True)):
    """Remove the given DMX fixture from its universe and any groups"""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(fixture_uuid)
    if fixture is None:
        print(f"/DMX/fixture/remove: Cannot remove fixture {fixture_uuid}. It does not exist.")
        return {"success": False, "reason": "Fixture does not exist."}
    fixture.delete()
    apps_dmx.write_dmx_configuration()

    return {"success": True}


@router.post("/fixture/{fixture_uuid}/setBrightness")
async def set_dmx_fixture_to_brightness(fixture_uuid: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given fixture to the specified brightness."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(fixture_uuid)
    fixture.set_brightness(value, duration)
    return {"success": True, "configuration": fixture.get_dict()}


@router.post("/fixture/{fixture_uuid}/setChannel")
async def set_dmx_fixture_channel(fixture_uuid: str,
                                  channel_name: str = Body(
                                      "The name of the chanel to set."),
                                  value: int = Body(
                                      description="The value to be set.")):
    """Set the given channel of the given fixture to the given value."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(fixture_uuid)
    fixture.set_channel(channel_name, value)
    return {"success": True, "configuration": fixture.get_dict()}


@router.post("/fixture/{fixture_uuid}/setColor")
async def set_dmx_fixture_to_color(fixture_uuid: str,
                                   color: list = Body(
                                       description="The color to be set."),
                                   duration: float = Body(description="How long the color transition should take.",
                                                          default=0)):
    """Set the given fixture to the specified color."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    fixture = apps_dmx.get_fixture(fixture_uuid)
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


@router.post("/group/{group_uuid}/createScene")
async def create_dmx_scene(group_uuid: str,
                           name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Create the given scene for the specified group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    uuid_str = group.create_scene(name, values, duration=duration)
    apps_dmx.write_dmx_configuration()
    return {"success": True, "uuid": uuid_str}


@router.post("/group/{group_uuid}/editScene")
async def create_dmx_scene(group_uuid: str,
                           uuid: str = Body(description="The UUID of the scene to edit."),
                           name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Edit the given scene for the specified group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)

    scene = group.get_scene(uuid_str=uuid)

    scene.name = name
    scene.duration = duration
    scene.set_values(values)

    apps_dmx.write_dmx_configuration()
    return {"success": True}


@router.post("/group/{group_uuid}/deleteScene")
async def create_dmx_scene(group_uuid: str,
                           uuid: str = Body(description="The UUID of the scene to edit.", embed=True)):
    """Delete the given scene for the specified group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.delete_scene(uuid)

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


@router.get("/group/{group_uuid}/getScenes")
async def get_dmx_group_scenes(group_uuid: str):
    """Return a list of the available scenes for the given group."""

    response = {"success": True, "scenes": []}

    config_path = ex_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        response["success"] = False
        response["reason"] = "no_config_file"
        return response

    config_dict = ex_files.load_json(config_path)
    groups = config_dict["groups"]
    matches = [group for group in groups if group.uuid == group_uuid]
    if len(matches) == 0:
        response["success"] = False
        response["reason"] = "group_not_found"
        return response
    group = matches[0]
    response["scenes"] = group["scenes"]
    return response


@router.get("/getScenes")
async def get_dmx_scenes():
    """Return a list of the available scenes across all groups."""

    response = {"success": True, "groups": []}

    config_path = ex_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        response["success"] = False
        response["reason"] = "no_config_file"
        return response

    config_dict = ex_files.load_json(config_path)
    groups = config_dict["groups"]

    for group_def in groups:
        group = {}
        group["uuid"] = group_def["uuid"]
        group["name"] = group_def["name"]
        scenes = []
        for scene_def in group_def["scenes"]:
            scene = {"uuid": scene_def["uuid"], "name": scene_def["name"]}
            scenes.append(scene)
        group["scenes"] = scenes
        response["groups"].append(group)

    return response


@router.get("/setScene/{scene_uuid}")
async def set_dmx_scene(scene_uuid: str):
    """Search for and run a DMX scene."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    _, group = apps_dmx.get_scene(scene_uuid)
    group.show_scene(scene_uuid)


@router.post("/group/{group_uuid}/showScene")
async def set_dmx_group_scene(group_uuid: str,
                              uuid: str = Body(
                                  description="The UUID of the scene to be run.",
                                  default="",
                                  embed=True)
                              ):
    """Run a scene for the given group."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    group = apps_dmx.get_group(group_uuid)
    group.show_scene(uuid)

    return {"success": True, "configuration": group.get_dict()}


@router.post("/universe/create")
async def create_dmx_universe(name: str = Body(description="The name of the universe."),
                              controller: str = Body(description="The type of this controller (OpenBMX or uDMX)."),
                              device_details: dict[str, Any] = Body(
                                  description="A dictionary of hardware details for the controller.")):
    """Create a new DMXUniverse."""

    apps_dmx.activate_dmx()
    new_universe = apps_dmx.create_universe(name,
                                            controller=controller,
                                            device_details=device_details)
    apps_dmx.write_dmx_configuration()
    apps_config.dmx_active = True

    return {"success": True, "universe": new_universe.get_dict()}


@router.post("/universe/rename")
async def create_dmx_universe(uuid: str = Body(description="The UUID of the universe."),
                              new_name: str = Body(description="The new name to set.")):
    """Change the name for a universe."""

    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    apps_dmx.get_universe(uuid_str=uuid).name = new_name
    apps_dmx.write_dmx_configuration()

    return {"success": True}


@router.delete("/universe/{universe_uuid}")
async def delete_dmx_universe(universe_uuid: str):
    success, reason = apps_dmx.activate_dmx()
    if not success:
        return {"success": False, "reason": reason}

    universe = apps_dmx.get_universe(uuid_str=universe_uuid)
    if universe is None:
        return {"success": False, "reason": "Universe does not exist"}
    universe.delete()
    return {"success": True}