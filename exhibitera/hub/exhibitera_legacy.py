"""Module containing functions for converting legacy app elements.

Functions in this module should be marked with when they are introduced
to aid in deprecating them.
"""

# Standard imports
import os

# Exhibitera imports
import config
import exhibitera_exhibit as c_exhibit
import exhibitera_maintenance as c_maint
import exhibitera_tools as c_tools


# Added in C5 to convert legacy C4 and earlier projector.json
def convert_legacy_projector_configuration():
    """Convert projectors.json to a series of components in the components directory."""

    config_path = c_tools.get_path(["configuration", "projectors.json"], user_file=True)
    config_path_new = c_tools.get_path(["configuration", "projectors.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    proj_config = c_tools.load_json(config_path)

    for proj in proj_config:
        maintenance_log = c_maint.convert_legacy_maintenance_log(proj["id"], )
        maint_path = c_tools.get_path(["maintenance-logs", proj["id"] + '.txt'], user_file=True)
        maint_path_new = c_tools.get_path(["maintenance-logs", proj["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_proj = c_exhibit.Projector(proj["id"],
                                       proj.get("group", "Projectors"),
                                       proj.get('ip_address', ''), "pjlink",
                                       password=proj.get("password", None),
                                       maintenance_log=maintenance_log)
        new_proj.save()
    os.rename(config_path, config_path_new)


# Added in C5 to convert legacy C4 and earlier projector.json
def convert_legacy_static_configuration():
    """Convert static.json to a series of components in the components directory."""

    config_path = c_tools.get_path(["configuration", "static.json"], user_file=True)
    config_path_new = c_tools.get_path(["configuration", "static.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    static_config = c_tools.load_json(config_path)

    for static in static_config:
        maintenance_log = c_maint.convert_legacy_maintenance_log(static["id"], )
        maint_path = c_tools.get_path(["maintenance-logs", static["id"] + '.txt'], user_file=True)
        maint_path_new = c_tools.get_path(["maintenance-logs", static["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_static = c_exhibit.ExhibitComponent(static["id"],
                                                static.get("group", "Default"),
                                                category="static",
                                                maintenance_log=maintenance_log)
        new_static.save()
    os.rename(config_path, config_path_new)


def convert_legacy_WOL_configuration():
    """Convert wake_on_LAN.json to a series of components in the components directory."""

    config_path = c_tools.get_path(["configuration", "wake_on_LAN.json"], user_file=True)
    config_path_new = c_tools.get_path(["configuration", "wake_on_LAN.json.old"], user_file=True)
    if not os.path.exists(config_path):
        return
    WOL_config = c_tools.load_json(config_path)

    for WOL in WOL_config:
        maintenance_log = c_maint.convert_legacy_maintenance_log(WOL["id"], )
        maint_path = c_tools.get_path(["maintenance-logs", WOL["id"] + '.txt'], user_file=True)
        maint_path_new = c_tools.get_path(["maintenance-logs", WOL["id"] + '.txt.old'], user_file=True)
        try:
            os.rename(maint_path, maint_path_new)
        except FileNotFoundError:
            pass

        new_WOL = c_exhibit.WakeOnLANDevice(WOL["id"],
                                            WOL.get("group", "Default"),
                                            WOL["mac_address"],
                                            ip_address=WOL.get("ip_address", ""),
                                            maintenance_log=maintenance_log)
        new_WOL.save()
    os.rename(config_path, config_path_new)
