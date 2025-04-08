"""Module containing functions for converting legacy app elements.

Functions in this module should be marked with when they are introduced
to aid in deprecating them.
"""

# Standard imports
from collections import OrderedDict
import configparser
import os
import shutil
import uuid

# Exhibitera imports
import exhibitera.common.files as ex_files
import exhibitera.hub.features.exhibits as hub_exhibit
import exhibitera.hub.features.maintenance as hub_maintain
import exhibitera.hub.features.schedules as hub_schedule
import exhibitera.hub.tools as hub_tools


# Added in Ex5 to convert legacy C4 and earlier projector.json
def convert_legacy_projector_configuration():
    """Convert projectors.json to a series of components in the components directory."""

    config_path = ex_files.get_path(["configuration", "projectors.json"], user_file=True)
    config_path_new = ex_files.get_path(["configuration", "projectors.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    proj_config = ex_files.load_json(config_path)

    for proj in proj_config:
        maintenance_log = hub_maintain.convert_legacy_maintenance_log(proj["id"], )
        maint_path = ex_files.get_path(["maintenance-logs", proj["id"] + '.txt'], user_file=True)
        maint_path_new = ex_files.get_path(["maintenance-logs", proj["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_proj = hub_exhibit.Projector(proj["id"],
                                         proj.get("group", "Projectors"),
                                         proj.get('ip_address', ''), "pjlink",
                                         password=proj.get("password", None),
                                         maintenance_log=maintenance_log)
        new_proj.save()
    os.rename(config_path, config_path_new)


# Added in Ex5 to convert legacy C4 and earlier static.json
def convert_legacy_static_configuration():
    """Convert static.json to a series of components in the components directory."""

    config_path = ex_files.get_path(["configuration", "static.json"], user_file=True)
    config_path_new = ex_files.get_path(["configuration", "static.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    static_config = ex_files.load_json(config_path)

    for static in static_config:
        maintenance_log = hub_maintain.convert_legacy_maintenance_log(static["id"], )
        maint_path = ex_files.get_path(["maintenance-logs", static["id"] + '.txt'], user_file=True)
        maint_path_new = ex_files.get_path(["maintenance-logs", static["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_static = hub_exhibit.ExhibitComponent(static["id"],
                                                  static.get("group", "Default"),
                                                  category="static",
                                                  maintenance_log=maintenance_log)
        new_static.save()
    os.rename(config_path, config_path_new)


# Added in Ex5 to convert legacy C4 and earlier wake_on_LAN.json
def convert_legacy_WOL_configuration():
    """Convert wake_on_LAN.json to a series of components in the components directory."""

    config_path = ex_files.get_path(["configuration", "wake_on_LAN.json"], user_file=True)
    config_path_new = ex_files.get_path(["configuration", "wake_on_LAN.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    WOL_config = ex_files.load_json(config_path)

    for WOL in WOL_config:
        maintenance_log = hub_maintain.convert_legacy_maintenance_log(WOL["id"], )
        maint_path = ex_files.get_path(["maintenance-logs", WOL["id"] + '.txt'], user_file=True)
        maint_path_new = ex_files.get_path(["maintenance-logs", WOL["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_WOL = hub_exhibit.WakeOnLANDevice(WOL["id"],
                                              WOL.get("group", "Default"),
                                              WOL["mac_address"],
                                              ip_address=WOL.get("ip_address", ""),
                                              maintenance_log=maintenance_log)
        new_WOL.save()
    os.rename(config_path, config_path_new)


# Added in Ex5.2 to convert schedule targets from formatted strings to JSON
def convert_schedule_targets_to_json():
    """Take schedule target formatted strings and convert them to JSON."""

    schedule_dir = ex_files.get_path(["schedules"], user_file=True)
    for file in os.listdir(schedule_dir):
        if file.startswith('.'):
            continue
        if not file.endswith('.json'):
            continue

        # First, determine if a file needs to be converted
        convert_file = False
        _, schedule = hub_schedule.load_json_schedule(file)
        for event_uuid in schedule:
            event = schedule[event_uuid]
            if "target" in event:
                if event["target"] is None:
                    continue
                elif isinstance(event["target"], list):
                    for item in event["target"]:
                        if not isinstance(item, dict):
                            convert_file = True
                elif not isinstance(event["target"], dict):
                    convert_file = True
        if convert_file is True:
            shutil.copy(ex_files.get_path(["schedules", file], user_file=True),
                        ex_files.get_path(["schedules", file + ".backup"], user_file=True))

            for event_uuid in schedule:
                event = schedule[event_uuid]
                if "target" in event:
                    if isinstance(event["target"], list):
                        temp_list = []
                        for item in event["target"]:
                            temp_list.append(_convert_schedule_targets_to_json(item))
                        event["target"] = temp_list
                    else:
                        event["target"] = _convert_schedule_targets_to_json(event["target"])
            hub_schedule.write_json_schedule(file, schedule)


def _convert_schedule_targets_to_json(target: str | None):
    """Helper function to do the conversion"""

    if target is None:
        return {"type": None}
    if target.startswith("__id_"):
        return {"type": "component", "id": target[5:]}
    if target.startswith("__group_"):
        return {"type": "group", "uuid": target[8:]}
    if target.startswith("__all"):
        return {"type": "all"}
    return {"type": "value", "value": target}


# Added in Ex5.3 to convert from list-based exhibit files to dict-based.
def convert_exhibit_files():
    """Convert from list-based exhibits to dict-based."""

    for file in os.listdir(ex_files.get_path(["exhibits"], user_file=True)):
        if file.startswith('.'):
            continue
        if not file.endswith('.json'):
            continue

        current_path = ex_files.get_path(["exhibits", file], user_file=True)
        exhibit = ex_files.load_json(current_path)
        if exhibit is None or isinstance(exhibit, dict):
            continue

        uuid_str = str(uuid.uuid4())
        name = os.path.splitext(file)[0]
        new_exhibit = {
            "components": exhibit,
            "name": name,
            "uuid": uuid_str,
        }

        # Fix any references in the schedule
        _convert_schedule_set_exhibit(name, uuid_str)

        # Make a backup
        backup_path = ex_files.get_path(["exhibits", file + '.backup'], user_file=True)
        shutil.move(current_path, backup_path)

        # Write the new file
        new_path = ex_files.get_path(["exhibits", uuid_str + '.json'], user_file=True)
        ex_files.write_json(new_exhibit, new_path)


# Helper function for convert_exhibit_files()
def _convert_schedule_set_exhibit(name, uuid_str):
    """Iterate the schedules and replace instances of name with uuid_str for set_exhibit events,"""

    schedule_dir = ex_files.get_path(["schedules"], user_file=True)
    for file in os.listdir(schedule_dir):
        if file.startswith('.'):
            continue
        if not file.endswith('.json'):
            continue

        _, schedule = hub_schedule.load_json_schedule(file)
        convert = False
        for event_uuid in schedule:
            event = schedule[event_uuid]
            if event["action"] == "set_exhibit" and event.get("target", {}).get("value", "") == name:
                event["target"] = {"value": uuid_str, "type": "value"}
                convert = True
        if convert is True:
            shutil.copy(ex_files.get_path(["schedules", file], user_file=True),
                        ex_files.get_path(["schedules", file + ".backup"], user_file=True))
            hub_schedule.write_json_schedule(file, schedule)

    hub_exhibit.check_available_exhibits()


# Added in Ex5.3 to convert tracker templates from INI to JSON
def convert_legacy_tracker_templates_to_json():
    """Convert tracker templates from INI to JSON"""

    config_parser = configparser.ConfigParser(dict_type=OrderedDict)
    config_parser.optionxform = str  # preserve case for keys

    template_dir = ex_files.get_path(["flexible-tracker", "templates"], user_file=True)

    for file in os.listdir(template_dir):
        if file.startswith('.'):
            continue
        if not file.lower().endswith('.ini'):
            continue

        this_name = os.path.splitext(file)[0]
        this_uuid = str(uuid.uuid4())
        ini_filepath = ex_files.get_path(["flexible-tracker", "templates", file], user_file=True)
        json_filepath = ex_files.get_path(
            ["flexible-tracker", "templates", ex_files.with_extension(this_uuid, 'json')],
            user_file=True)
        config_parser.read(ini_filepath)

        widgets = {}
        widget_order = []

        for section in config_parser.sections():
            # Each section becomes an object with a "name" field
            section_uuid = str(uuid.uuid4())
            section_obj = {"name": section, "uuid": section_uuid}
            for key, value in config_parser.items(section):
                value = value.strip()
                # Convert booleans
                if value.lower() in ('true', 'false'):
                    converted = value.lower() == 'true'
                else:
                    # Attempt to convert to a number if possible
                    try:
                        if '.' in value:
                            converted = float(value)
                        else:
                            converted = int(value)
                    except ValueError:
                        # Convert comma-separated values to a list if applicable
                        if ',' in value:
                            converted = [item.strip() for item in value.split(',')]
                        else:
                            converted = value
                section_obj[key] = converted
            widgets[section_uuid] = section_obj
            widget_order.append(section_uuid)

        output = {"name": this_name,
                  "uuid": this_uuid,
                  "widgets": widgets,
                  "widget_order":widget_order}
        ex_files.write_json(output, json_filepath)

        # Rename the INI file, so we don't convert it again
        os.rename(ini_filepath, ini_filepath+'.old')
