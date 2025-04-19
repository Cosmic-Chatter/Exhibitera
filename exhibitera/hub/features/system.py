# Standard modules
import os
import socket

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.common.utilities as ex_utilities
import exhibitera.common.files as ex_files
import exhibitera.hub.features.exhibitions as hub_exhibitions


def get_webpage_update():
    """Collect the current exhibit status and send it back to the web client to update the page."""

    update_dict = {}

    component_dict_list = []
    for item in hub_config.componentList:
        temp = {"class": "exhibitComponent",
                "exhibiteraAppID": item.config["app_id"],
                "helperAddress": item.helperAddress,
                "id": item.id,
                "ip_address": item.ip_address,
                "groups": item.groups,
                "lastContactDateTime": item.last_contact_datetime,
                "latency": item.latency,
                "platform_details": item.platform_details,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "status": item.current_status(),
                "uuid": item.uuid}
        if "content" in item.config:
            temp["content"] = item.config["content"]
        if "definition" in item.config:
            temp["definition"] = item.config["definition"]
        if "error" in item.config:
            temp["error"] = item.config["error"]
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        if "autoplay_audio" in item.config:
            temp["autoplay_audio"] = item.config["autoplay_audio"]
        component_dict_list.append(temp)

    for item in hub_config.projectorList:
        temp = {"class": "projector",
                "groups": item.groups,
                "id": item.id,
                "ip_address": item.ip_address,
                "latency": item.latency,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "password": item.password,
                "protocol": item.connection_type,
                "state": item.state,
                "status": item.state["status"],
                "uuid": item.uuid}
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        component_dict_list.append(temp)

    for item in hub_config.wakeOnLANList:
        temp = {"class": "wolComponent",
                "id": item.id,
                "groups": item.groups,
                "ip_address": item.ip_address,
                "latency": item.latency,
                "mac_address": item.mac_address,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "status": item.state["status"],
                "uuid": item.uuid}
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        component_dict_list.append(temp)

    update_dict["components"] = component_dict_list
    update_dict["gallery"] = {"current_exhibit": hub_config.current_exhibit,
                              "availableExhibits": hub_config.exhibit_list,
                              "galleryName": hub_config.gallery_name,
                              "outdated_os": hub_config.outdated_os,
                              "softwareVersion": hub_config.software_version,
                              "softwareVersionAvailable": hub_config.software_update_available_version,
                              "updateAvailable": str(hub_config.software_update_available).lower()}

    update_dict["issues"] = {"issueList": [x.details for x in hub_config.issueList],
                             "lastUpdateDate": hub_config.issueList_last_update_date}

    update_dict["groups"] = {"group_list": hub_config.group_list,
                             "last_update_date": hub_config.group_list_last_update_date}

    with hub_config.scheduleLock:
        update_dict["schedule"] = {"updateTime": hub_config.scheduleUpdateTime,
                                   "schedule": hub_config.json_schedule_list,
                                   "nextEvent": hub_config.json_next_event}

    return update_dict


def command_line_setup_print_gui() -> None:
    """Helper to print the header content for the setup tool"""

    ex_utilities.clear_terminal()
    print("##########################################################")
    print("Welcome to Exhibitera Hub!")
    print("")
    print("This appears to be your first time running Hub.")
    print("In order to set up your configuration, let's answer a few")
    print("questions. If you don't know the answer, or wish to")
    print("accept the default, just press the enter key.")
    print("")


def command_line_setup() -> None:
    """Prompt the user for several pieces of information on first-time setup"""

    settings_dict = {}

    command_line_setup_print_gui()
    hub_config.gallery_name = input("Enter a name for the gallery (default: Exhibitera): ").strip()
    if hub_config.gallery_name == "":
        hub_config.gallery_name = "Exhibitera"
    settings_dict["gallery_name"] = hub_config.gallery_name

    command_line_setup_print_gui()
    default_ip = socket.gethostbyname(socket.gethostname())
    ip_address = input(f"Enter this computer's static IP address (default: {default_ip}): ").strip()
    if ip_address == "":
        ip_address = default_ip
    settings_dict["ip_address"] = ip_address

    command_line_setup_print_gui()
    default_port = 8082
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((ip_address, default_port)) != 0:
                # Port is free
                break
            else:
                default_port += 1
    port = input(f"Enter the desired port (default: {default_port}): ").strip()
    if port == "":
        port = default_port
    else:
        port = int(port)
    settings_dict["port"] = port

    settings_dict["current_exhibit"] = "Default"
    # Create this exhibit file if it doesn't exist
    if not os.path.exists(ex_files.get_path(["exhibits", "Default.json"], user_file=True)):
        hub_exhibitions.create_exhibition("Default", None)

    # Write new system apps_config to file
    config_path = ex_files.get_path(["configuration", "system.json"], user_file=True)
    ex_files.write_json(settings_dict, config_path)

    command_line_setup_print_gui()
    print("Setup is complete! Exhibitera Hub will now start.")
    print("")


def check_file_structure() -> None:
    """Check to make sure we have the appropriate file structure set up"""

    schedules_dir = ex_files.get_path(["schedules"], user_file=True)
    exhibits_dir = ex_files.get_path(["exhibits"], user_file=True)

    misc_dirs = {"analytics": ex_files.get_path(["analytics"], user_file=True),
                 "components": ex_files.get_path(["components"], user_file=True),
                 "configuration": ex_files.get_path(["configuration"], user_file=True),
                 "data": ex_files.get_path(["data"], user_file=True),
                 "flexible-tracker": ex_files.get_path(["flexible-tracker"], user_file=True),
                 "flexible-tracker/templates": ex_files.get_path(["flexible-tracker", "templates"], user_file=True),
                 "issues": ex_files.get_path(["issues"], user_file=True),
                 "issues/media": ex_files.get_path(["issues", "media"], user_file=True),
                 "static": ex_files.get_path(["static"], user_file=True)}

    try:
        os.listdir(schedules_dir)
    except FileNotFoundError:
        print("Missing schedules directory. Creating now...")
        os.mkdir(schedules_dir)
    except PermissionError:
        print("Error: unable to create 'schedules' directory. Do you have write permission?")

    default_schedule_list = ["monday.json", "tuesday.json",
                             "wednesday.json", "thursday.json",
                             "friday.json", "saturday.json",
                             "sunday.json"]
    for file in default_schedule_list:
        file_path = os.path.join(schedules_dir, file)
        if not os.path.exists(file_path):
            print("Missing schedule file " + file + ". Creating now..." )
            try:
                with open(file_path, 'w', encoding="UTF-8") as f:
                    f.write("{}")
            except PermissionError:
                print("Error: unable to create file in 'schedules' directory. Do you have write permission?")

    try:
        os.listdir(exhibits_dir)
    except FileNotFoundError:
        print("Missing exhibits directory. Creating now...")
        try:
            os.mkdir(exhibits_dir)
            ex_files.write_json({"name": "Default", "uuid": "Default", "components": [], "commands": []}, ex_files.get_path(["exhibits", "Default.json"], user_file=True))
        except PermissionError:
            print("Error: unable to create 'exhibits' directory. Do you have write permission?")

    for key in misc_dirs:
        try:
            os.listdir(misc_dirs[key])
        except FileNotFoundError:
            print(f"Missing {key} directory. Creating now...")
            try:
                os.mkdir(misc_dirs[key])
            except PermissionError:
                print(f"Error: unable to create '{key}' directory. Do you have write permission?")
