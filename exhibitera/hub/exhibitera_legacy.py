"""Module containing functions for converting legacy app elements.

Functions in this module should be marked with when they are introduced
to aid in deprecating them.
"""

# Standard imports
import json
import os
import shutil

# Exhibitera imports
import config
import exhibitera_exhibit as ex_exhibit
import exhibitera_maintenance as ex_maint
import exhibitera_schedule as ex_sched
import exhibitera_tools as ex_tools


# Added in Ex5 to convert legacy C4 and earlier projector.json
def convert_legacy_projector_configuration():
    """Convert projectors.json to a series of components in the components directory."""

    config_path = ex_tools.get_path(["configuration", "projectors.json"], user_file=True)
    config_path_new = ex_tools.get_path(["configuration", "projectors.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    proj_config = ex_tools.load_json(config_path)

    for proj in proj_config:
        maintenance_log = ex_maint.convert_legacy_maintenance_log(proj["id"], )
        maint_path = ex_tools.get_path(["maintenance-logs", proj["id"] + '.txt'], user_file=True)
        maint_path_new = ex_tools.get_path(["maintenance-logs", proj["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_proj = ex_exhibit.Projector(proj["id"],
                                        proj.get("group", "Projectors"),
                                        proj.get('ip_address', ''), "pjlink",
                                        password=proj.get("password", None),
                                        maintenance_log=maintenance_log)
        new_proj.save()
    os.rename(config_path, config_path_new)


# Added in Ex5 to convert legacy C4 and earlier static.json
def convert_legacy_static_configuration():
    """Convert static.json to a series of components in the components directory."""

    config_path = ex_tools.get_path(["configuration", "static.json"], user_file=True)
    config_path_new = ex_tools.get_path(["configuration", "static.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    static_config = ex_tools.load_json(config_path)

    for static in static_config:
        maintenance_log = ex_maint.convert_legacy_maintenance_log(static["id"], )
        maint_path = ex_tools.get_path(["maintenance-logs", static["id"] + '.txt'], user_file=True)
        maint_path_new = ex_tools.get_path(["maintenance-logs", static["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_static = ex_exhibit.ExhibitComponent(static["id"],
                                                 static.get("group", "Default"),
                                                 category="static",
                                                 maintenance_log=maintenance_log)
        new_static.save()
    os.rename(config_path, config_path_new)


# Added in Ex5 to convert legacy C4 and earlier wake_on_LAN.json
def convert_legacy_WOL_configuration():
    """Convert wake_on_LAN.json to a series of components in the components directory."""

    config_path = ex_tools.get_path(["configuration", "wake_on_LAN.json"], user_file=True)
    config_path_new = ex_tools.get_path(["configuration", "wake_on_LAN.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    WOL_config = ex_tools.load_json(config_path)

    for WOL in WOL_config:
        maintenance_log = ex_maint.convert_legacy_maintenance_log(WOL["id"], )
        maint_path = ex_tools.get_path(["maintenance-logs", WOL["id"] + '.txt'], user_file=True)
        maint_path_new = ex_tools.get_path(["maintenance-logs", WOL["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_WOL = ex_exhibit.WakeOnLANDevice(WOL["id"],
                                             WOL.get("group", "Default"),
                                             WOL["mac_address"],
                                             ip_address=WOL.get("ip_address", ""),
                                             maintenance_log=maintenance_log)
        new_WOL.save()
    os.rename(config_path, config_path_new)


# Added in Ex5.2 to convert schedule targets from formatted strings to JSON
def convert_schedule_targets_to_json():
    """Take schedule target formatted strings and convert them to JSON."""

    schedule_dir = ex_tools.get_path(["schedules"], user_file=True)
    for file in os.listdir(schedule_dir):
        if file.startswith('.'):
            continue
        if not file.endswith('.json'):
            continue

        # First, determine if a file needs to be converted
        convert_file = False
        _, schedule = ex_sched.load_json_schedule(file)
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
            shutil.copy(ex_tools.get_path(["schedules", file], user_file=True),
                        ex_tools.get_path(["schedules", file + ".backup"], user_file=True))

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
            ex_sched.write_json_schedule(file, schedule)


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
