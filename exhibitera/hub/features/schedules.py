# Standard imports
import csv
import datetime
import json
import io
import time

import dateutil
import logging
import os
import threading

# Exhibitera imports
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.exhibitions as hub_exhibitions


def create_schedule(name: str, entries: dict[str, dict]) -> tuple[bool, dict]:
    """Create a new schedule."""

    # First, try to open the named schedule
    success, schedule = load_json_schedule(name)

    if success is False:
        # Write a blank schedule
        try:
            with open(ex_files.with_extension(name, 'json'), 'w', encoding='UTF-8') as f:
                f.write('')
        except PermissionError:
            return False, {}

    updated = update_json_schedule(name, entries)
    return True, updated


def retrieve_json_schedule():
    """Build a schedule for the next 21 days based on the available json schedule files and queue today's events"""

    with hub_config.scheduleLock:
        hub_config.scheduleUpdateTime = time.time()
        hub_config.json_schedule_list = []

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
        source_dir = os.listdir(ex_files.get_path(["schedules"], user_file=True))
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

        hub_config.json_schedule_list.append(day_dict)

    queue_json_schedule((hub_config.json_schedule_list[0])["schedule"])


def get_available_date_specific_schedules(all: bool = False) -> list[str]:
    """Search the schedule directory for a list of available date-specific schedules and return their names.

    By default, return only schedules for today's date or future. Set all=True to return past schedules.
    """

    schedule_path = ex_files.get_path(["schedules"], user_file=True)
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

    schedule_path = ex_files.get_path(["schedules", schedule_name], user_file=True)
    with hub_config.scheduleLock:
        events = ex_files.load_json(schedule_path)
        if events is None:
            # Check if the file is empty, which is a success condition
            with open(schedule_path, "r", encoding="UTF-8") as f:
                if len(f.read().strip()) == 0:
                    return True, {}
            return False, {}

    return True, events


def write_json_schedule(schedule_name: str, schedule: dict) -> bool:
    """Take a json schedule dictionary and write it to file"""

    schedule_path = ex_files.get_path(["schedules", schedule_name], user_file=True)
    with hub_config.scheduleLock:
        success, reason = ex_files.write_json(schedule, schedule_path)

    return success


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
    hub_config.last_update_time = time.time()
    return schedule


def delete_json_schedule_event(schedule_name: str, schedule_id: str) -> dict:
    """Delete the schedule item with the given id"""

    _, schedule = load_json_schedule(schedule_name)

    if schedule_id in schedule:
        del schedule[schedule_id]
        hub_config.last_update_time = time.time()

    write_json_schedule(schedule_name, schedule)
    return schedule


def queue_json_schedule(schedule: dict) -> None:
    """Take a schedule dict and create a timer to execute it"""

    new_timers = []
    for key in schedule:
        event = schedule[key]
        if event["action"] == "note":
            # Don't queue notes
            continue
        event_time = dateutil.parser.parse(event["time"])
        seconds_from_now = (event_time - datetime.datetime.now()).total_seconds()
        if seconds_from_now >= 0:

            timer = threading.Timer(seconds_from_now,
                                    execute_scheduled_action,
                                    args=(event["action"], event["target"], event["value"]))
            timer.daemon = True
            timer.start()
            new_timers.append(timer)

    get_next_scheduled_action()  # Update the config.json_next_event field

    # Add a timer to reload the schedule
    midnight = datetime.datetime.combine(datetime.datetime.now() + datetime.timedelta(days=1), datetime.time.min)
    seconds_until_midnight = (midnight - datetime.datetime.now()).total_seconds()
    timer = threading.Timer(seconds_until_midnight, retrieve_json_schedule)
    timer.daemon = True
    timer.start()
    new_timers.append(timer)

    # Stop the existing timers and switch to our new ones
    with hub_config.scheduleLock:
        for timer in hub_config.schedule_timers:
            timer.cancel()
        hub_config.schedule_timers = new_timers


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


def get_next_scheduled_action():
    """Search today's schedule for the next scheduled action, update the apps_config, and return it."""

    schedule = (hub_config.json_schedule_list[0])["schedule"]

    hub_config.json_next_event = []
    for key in schedule:
        event = schedule[key]
        if event["action"] == "note":
            # Don't queue notes
            continue
        event_time = dateutil.parser.parse(event["time"])
        seconds_from_now = (event_time - datetime.datetime.now()).total_seconds()
        if seconds_from_now >= 0:

            # Check if this is the next event
            if len(hub_config.json_next_event) == 0:
                hub_config.json_next_event.append(event)
            elif event["time_in_seconds"] < (hub_config.json_next_event[0])["time_in_seconds"]:
                hub_config.json_next_event = [event]
            elif event["time_in_seconds"] == (hub_config.json_next_event[0])["time_in_seconds"]:
                hub_config.json_next_event.append(event)

    return hub_config.json_next_event


def execute_scheduled_action(action: str,
                             target: list[dict[str, str]] | dict[str, str] | None,
                             value: list | str | None):
    """Dispatch the appropriate action when called by a schedule timer"""

    hub_exhibitions.execute_action(action, target, value)
    get_next_scheduled_action()
    hub_config.scheduleUpdateTime = time.time()


def seconds_from_midnight(input_time: str) -> float:
    """Parse a natural language expression of time and return the number of seconds from midnight."""

    time_dt = dateutil.parser.parse(input_time)
    return (time_dt - time_dt.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds()


# Set up log file
log_path = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)
