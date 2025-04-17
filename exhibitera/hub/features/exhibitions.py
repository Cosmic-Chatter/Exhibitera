# Standard modules
import json
import logging
import os
import time
from typing import Any
import uuid

# Exhibitera modules
import  exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.tools as hub_tools
import exhibitera.hub.features.exhibits as hub_exhibit


def create_exhibition(name: str, clone: str | None) -> str:
    """Create a new exhibition file

    Set clone=None to create a new file, or set it equal to the name of an
    existing exhibition to clone that exhibition."""

    if name == 'Default':
        uuid_str = 'Default'
    else:
        uuid_str = str(uuid.uuid4())

    new_file = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, '.json')], user_file=True)

    if clone is not None:
        # Copy an existing file

        existing_file = ex_files.get_path(["exhibits",ex_files.with_extension(clone, 'json')], user_file=True)
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
    check_available_exhibitions()

    return uuid_str


def delete_exhibition(name: str):
    """Delete the specified exhibition file"""

    file_to_delete = ex_files.get_path(["exhibits", ex_files.with_extension(name, 'json')], user_file=True)

    with hub_config.exhibitsLock:
        try:
            os.remove(file_to_delete)
        except FileNotFoundError:
            print(f"Error: Unable to delete exhibit {file_to_delete}. File not found!")

    hub_config.last_update_time = time.time()
    check_available_exhibitions()


def check_available_exhibitions():
    """Get a list of available exhibition configuration files"""

    hub_config.exhibit_list = []
    exhibits_path = ex_files.get_path(["exhibits"], user_file=True)

    for file in os.listdir(exhibits_path):
        if file.lower().endswith(".json"):
            hub_config.exhibit_list.append(ex_files.load_json(ex_files.get_path(["exhibits", file], user_file=True)))

    # Make sure we have something usable loaded
    if len(hub_config.exhibit_list) == 0:
        create_exhibition("Default", None)

    if hub_config.current_exhibit not in [x["uuid"] for x in hub_config.exhibit_list]:
        hub_config.current_exhibit = hub_config.exhibit_list[0]["uuid"]
        hub_tools.update_system_configuration({"current_exhibit": hub_config.current_exhibit})


def load_exhibition(uuid_str: str) -> tuple[bool, str]:
    """Load the given exhibit configuration and trigger an update."""

    exhibit_path = ex_files.get_path(["exhibits", ex_files.with_extension(uuid_str, 'json')], user_file=True)
    if not os.path.exists(exhibit_path):
        logging.error('load_exhibition: exhibition does not exist: ' + uuid_str)
        return False, 'does_not_exist'

    try:
        hub_config.exhibit_configuration = ex_files.load_json(exhibit_path)
    except json.JSONDecodeError:
        logging.error('load_exhibition: bad JSON in ' + uuid_str)
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


def update_exhibition(component_uuid: str,
                      update: dict[str, Any],
                      exhibit_name: str | None = ""):
    """Update an exhibition with the given data."""

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
        if component.get("uuid") == component_uuid:
            exhibit_config["components"][index] |= update
            exhibit_config["components"][index]["uuid"] = component_uuid
            match_found = True
    if not match_found:
        new_entry = {}
        if component_uuid != '' and component_uuid is not None:
            new_entry['uuid'] = component_uuid
        new_entry |= update
        exhibit_config["components"].append(new_entry)
    hub_config.exhibit_configuration = exhibit_config

    ex_files.write_json(exhibit_config, exhibit_path)
    if component_uuid:
        this_component = hub_exhibit.get_exhibit_component(component_uuid=component_uuid)
    else:
        this_component = hub_exhibit.get_exhibit_component(component_id=component_id)
    if this_component is not None:
        this_component.update_configuration()


def execute_action(action: str,
                   target: list[dict[str, str]] | dict[str, str] | None,
                   value: list | str | None):
    """Execute the given action."""

    if action == 'set_definition' and target is not None and value is not None:
        if isinstance(value, list):
            value = value[0]
        print(f"Changing definition for {target} to {value}")

        logging.info("Changing definition for %s to %s", target, value)
        update_exhibition(target["uuid"], {"definition": value})
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
        component = hub_exhibit.get_exhibit_component(component_id=target_id, component_uuid=target_uuid)
        if component is not None:
            component.queue_command("set_dmx_scene__" + value)
    elif action == 'set_exhibit' and target is not None:
        print("Changing exhibit to:", target["value"])
        logging.info("Changing exhibition to %s", target["value"])
        load_exhibition(target["value"])
    elif target is not None:
        if isinstance(target, dict):
            target = [target]
        for target_i in target:
            if target_i["type"] == 'all':
                command_all_components(action)
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
                component = hub_exhibit.get_exhibit_component(component_id=target_id, component_uuid=target_uuid)
                if component is not None:
                    component.queue_command(action)
    else:
        command_all_components(action)

    hub_config.last_update_time = time.time()


def command_all_components(cmd: str):
    """Queue a command for every exhibit component"""

    print("Sending command to all components:", cmd)
    with hub_config.logLock:
        logging.info("command_all_components: %s", cmd)

    for component in hub_config.componentList:
        component.queue_command(cmd)

    for projector in hub_config.projectorList:
        projector.queue_command(cmd)

    for device in hub_config.wakeOnLANList:
        device.queue_command(cmd)

