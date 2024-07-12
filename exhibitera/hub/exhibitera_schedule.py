# Standard imports
import csv
import datetime
import json
import io
import time
from typing import Union

import dateutil
import logging
import os
import threading

# Exhibitera imports
import config
import exhibitera_exhibit as c_exhibit
import exhibitera_tools as c_tools


def create_schedule(name: str, entries: dict[str, dict]) -> tuple[bool, dict]:
    """Create a new schedule."""

    # First, try to open the named schedule
    success, schedule = load_json_schedule(name)

    if success is False:
        # Write a blank schedule
        try:
            with open(c_tools.with_extension(name, 'json'), 'w', encoding='UTF-8') as f:
                f.write('')
        except PermissionError:
            return False, {}

    updated = update_json_schedule(name, entries)
    return True, updated


def retrieve_json_schedule():
    """Build a schedule for the next 21 days based on the available json schedule files and queue today's events"""

    with config.scheduleLock:
        config.scheduleUpdateTime = (datetime.datetime.now() - datetime.datetime.utcfromtimestamp(0)).total_seconds()
        config.json_schedule_list = []

        today = datetime.datetime.today().date()
        upcoming_days = [today + datetime.timedelta(days=x) for x in range(21)]

    for day in upcoming_days:
        day_dict = {"date": day.isoformat(),
                    "dayName": day.strftime("%A"),
                    "source": "none",
                    "schedule": {}}

        date_specific_filename = day.isoformat() + ".json"  # e.g., 2021-04-14.ini
        day_specific_filename = day.strftime("%A").lower() + ".json"  # e.g., monday.ini

        sources_to_try = [date_specific_filename, day_specific_filename]
        source_dir = os.listdir(c_tools.get_path(["schedules"], user_file=True))
        schedule_to_read = None

        for source in sources_to_try:
            if source in source_dir:
                schedule_to_read = source
                if source == date_specific_filename:
                    day_dict["source"] = 'date-specific'
                elif source == day_specific_filename:
                    day_dict["source"] = 'day-specific'
                break

        if schedule_to_read is not None:
            _, day_dict["schedule"] = load_json_schedule(schedule_to_read)

        config.json_schedule_list.append(day_dict)

    queue_json_schedule((config.json_schedule_list[0])["schedule"])


def get_available_date_specific_schedules(all: bool = False) -> list[str]:
    """Search the schedule directory for a list of available date-specific schedules and return their names.

    By default, return only schedules for today's date or future. Set all=True to return past schedules.
    """

    schedule_path = c_tools.get_path(["schedules"], user_file=True)
    available_schedules = os.listdir(schedule_path)
    schedules_to_return = []

    for file in available_schedules:
        if file not in ['monday.json', 'tuesday.json', 'wednesday.json',
                        'thursday.json', 'friday.json', 'saturday.json', 'sunday.json', '.DS_']:
            schedules_to_return.append(file[:-5])

    if all is False:
        # Filter out schedules with past dates.
        all_schedules = schedules_to_return.copy()
        schedules_to_return = []
        today = datetime.datetime.now().date()
        for schedule in all_schedules:
            try:
                if dateutil.parser.parse(schedule).date() >= today:
                    schedules_to_return.append(schedule)
            except dateutil.parser._parser.ParserError:
                pass
    return schedules_to_return


def load_json_schedule(schedule_name: str) -> tuple[bool, dict]:
    """Load and parse the appropriate schedule file and return it"""

    schedule_path = c_tools.get_path(["schedules", schedule_name], user_file=True)
    with config.scheduleLock:
        try:
            with open(schedule_path, "r", encoding="UTF-8") as f:
                events = json.load(f)
        except FileNotFoundError:
            return False, {}
        except json.decoder.JSONDecodeError:
            # Check if the file is empty, which is a success condition
            with open(schedule_path, "r", encoding="UTF-8") as f:
                if len(f.read().strip()) == 0:
                    return True, {}
            return False, {}

    return True, events


def write_json_schedule(schedule_name: str, schedule: dict) -> bool:
    """Take a json schedule dictionary and write it to file"""

    schedule_path = c_tools.get_path(["schedules", schedule_name], user_file=True)
    with config.scheduleLock:
        try:
            with open(schedule_path, "w", encoding="UTF-8") as f:
                json.dump(schedule, f, indent=2, sort_keys=True)
            return True
        except PermissionError:
            print(f"update_json_schedule: cannot open file {schedule_path} for writing. Do you have write permission?")

    return False


def update_json_schedule(schedule_name: str, updates: dict) -> dict:
    """Write schedule updates to disk and return the updated schedule"""

    _, schedule = load_json_schedule(schedule_name)

    # The keys should be the schedule_ids for the items to be updated
    for key in updates:
        update = updates[key]
        if "time" not in update or "action" not in update:
            continue
        if "target" not in update:
            update["target"] = None
        if "value" not in update:
            update["value"] = None

        # Calculate the time from midnight for use when sorting, etc.
        update["time_in_seconds"] = seconds_from_midnight(update["time"])

        schedule[key] = update

    write_json_schedule(schedule_name, schedule)
    config.last_update_time = time.time()
    return schedule


def delete_json_schedule_event(schedule_name: str, schedule_id: str) -> dict:
    """Delete the schedule item with the given id"""

    _, schedule = load_json_schedule(schedule_name)

    if schedule_id in schedule:
        del schedule[schedule_id]
        config.last_update_time = time.time()

    write_json_schedule(schedule_name, schedule)
    return schedule


def queue_json_schedule(schedule: dict) -> None:
    """Take a schedule dict and create a timer to execute it"""

    new_timers = []
    config.json_next_event = []
    for key in schedule:
        event = schedule[key]
        if event["action"] == "note":
            # Don't queue notes
            continue
        event_time = dateutil.parser.parse(event["time"])
        seconds_from_now = (event_time - datetime.datetime.now()).total_seconds()
        if seconds_from_now >= 0:

            # Check if this is the next event
            if len(config.json_next_event) == 0:
                config.json_next_event.append(event)
            elif event["time_in_seconds"] < (config.json_next_event[0])["time_in_seconds"]:
                config.json_next_event = [event]
            elif event["time_in_seconds"] == (config.json_next_event[0])["time_in_seconds"]:
                config.json_next_event.append(event)

            timer = threading.Timer(seconds_from_now,
                                    execute_scheduled_action,
                                    args=(event["action"], event["target"], event["value"]))
            timer.daemon = True
            timer.start()
            new_timers.append(timer)

    # Add timer to reboot the server
    if config.serverRebootTime is not None:
        seconds_until_reboot = (config.serverRebootTime - datetime.datetime.now()).total_seconds()
        if seconds_until_reboot >= 0:
            timer = threading.Timer(seconds_until_reboot, c_tools.reboot_server)
            timer.daemon = True
            timer.start()
            new_timers.append(timer)

    # Add a timer to reload the schedule
    midnight = datetime.datetime.combine(datetime.datetime.now() + datetime.timedelta(days=1), datetime.time.min)
    seconds_until_midnight = (midnight - datetime.datetime.now()).total_seconds()
    timer = threading.Timer(seconds_until_midnight, retrieve_json_schedule)
    timer.daemon = True
    timer.start()
    new_timers.append(timer)

    # Stop the existing timers and switch to our new ones
    with config.scheduleLock:
        for timer in config.schedule_timers:
            timer.cancel()
        config.schedule_timers = new_timers


def convert_schedule_to_csv(schedule_name: str) -> tuple[bool, str]:
    """Convert the given schedule to a comma-separated values string."""

    success, schedule = load_json_schedule(schedule_name)
    if success is False:
        return False, ''

    # Convert the dict of dicts to a list of dicts
    dict_list = []
    for key in list(schedule.keys()):
        # Create dict with only the keys we want
        sub_dict = {
            "time": schedule[key].get("time", "7 AM"),
            "action": schedule[key].get("action", ""),
            "target": schedule[key].get("target", ""),
            "value": schedule[key].get("value", ""),
        }
        # Convert list entries into comma-separated strings
        for entry in ["target", "value"]:
            if isinstance(sub_dict[entry], list):
                string = ""
                length = len(sub_dict[entry])
                if length == 0:
                    pass
                elif length == 1:
                    string = sub_dict[entry][0]
                else:
                    for item in sub_dict[entry]:
                        string += item + ","
                    # Remove the trailing comma
                    string = string[:-1]
                sub_dict[entry] = string
        dict_list.append(sub_dict)

    try:
        output = io.StringIO()
        writer = csv.DictWriter(output, ["time", "action", "target", "value"])
        writer.writeheader()
        writer.writerows(dict_list)
    except csv.Error:
        return False, ""

    return True, output.getvalue()


def execute_scheduled_action(action: str, target: Union[list, str, None], value: Union[list, str, None]):
    """Dispatch the appropriate action when called by a schedule timer"""

    config.last_update_time = time.time()
    if action == 'set_definition' and target is not None and value is not None:
        if isinstance(value, list):
            value = value[0]
        if target.startswith("__id_"):
            target = target[5:]
        print(f"Changing definition for {target} to {value}")
        logging.info("Changing definition for %s to %s", target, value)
        c_exhibit.update_exhibit_configuration({"definition": value}, component_id=target)
    elif action == 'set_dmx_scene' and target is not None and value is not None:
        if isinstance(value, list):
            value = value[0]
        if target.startswith("__id_"):
            target = target[5:]
        logging.info('Setting DMX scene for %s to %s', target, value)
        component = c_exhibit.get_exhibit_component(component_id=target)
        component.queue_command("set_dmx_scene__" + value)
    elif action == 'set_exhibit' and target is not None:
        print("Changing exhibit to:", target)
        logging.info("Changing exhibit to %s", target)
        c_exhibit.read_exhibit_configuration(target)

        # Update the components that the configuration has changed
        for component in config.componentList:
            component.update_configuration()
    elif target is not None:
        if isinstance(target, str):
            target = [target]
        for target_i in target:
            if target_i == "__all":
                c_exhibit.command_all_exhibit_components(action)
            elif target_i.startswith("__group"):
                group = target_i[8:]
                for component in config.componentList:
                    if component.group == group:
                        component.queue_command(action)
                for component in config.projectorList:
                    if component.group == group:
                        component.queue_command(action)
                for component in config.wakeOnLANList:
                    if component.group == group:
                        component.queue_command(action)
            elif target_i.startswith("__id"):
                c_exhibit.get_exhibit_component(component_id=target_i[5:]).queue_command(action)
    else:
        c_exhibit.command_all_exhibit_components(action)


def seconds_from_midnight(input_time: str) -> float:
    """Parse a natural language expression of time and return the number of seconds from midight."""

    time_dt = dateutil.parser.parse(input_time)
    return (time_dt - time_dt.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds()


# Set up log file
log_path = c_tools.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)
