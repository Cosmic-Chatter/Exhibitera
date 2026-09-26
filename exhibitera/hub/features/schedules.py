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
import exhibitera.hub.features.programs as hub_programs


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

    today = datetime.datetime.today().date()
    upcoming_days = [today + datetime.timedelta(days=x) for x in range(21)]
    new_schedule_list = []


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

        new_schedule_list.append(day_dict)

    with hub_config.scheduleLock:
        hub_config.scheduleUpdateTime = time.time()
        hub_config.json_schedule_list = new_schedule_list

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

    with hub_config.scheduleLock:
        return _load_json_schedule_unlocked(schedule_name)


def _load_json_schedule_unlocked(schedule_name: str) -> tuple[bool, dict]:
    """Load the schedule without holding hub_config.scheduleLock.

    Useful when loading schedules in more complicated situations where
    hub_config.scheduleLock is already held.
    """

    schedule_path = ex_files.get_path(["schedules", schedule_name], user_file=True)
    if not os.path.exists(schedule_path):
        return False, {}

    events = ex_files.load_json(schedule_path)
    if events is None:
        events = {}

    # Ensure time_in_seconds is present for all events
    for key in events:
        if "time_in_seconds" not in events[key]:
            try:
                events[key]["time_in_seconds"] = seconds_from_midnight(events[key]["time"])
            except (KeyError, ValueError):
                # Malformed entry — log and skip
                logging.error(f"Schedule entry {key} in {schedule_name} missing 'time' field")
                events[key]["time_in_seconds"] = 0  # Safe default

    return True, events


def write_json_schedule(schedule_name: str, schedule: dict) -> bool:
    """Take a json schedule dictionary and write it to file"""

    with hub_config.scheduleLock:
        return _write_json_schedule_unlocked(schedule_name, schedule)


def _write_json_schedule_unlocked(schedule_name: str, schedule: dict) -> bool:
    """Write the schedule without holding hub_config.scheduleLock.

    Useful when writing schedules in more complicated situations where
    hub_config.scheduleLock is already held.
    """

    schedule_path = ex_files.get_path(["schedules", schedule_name], user_file=True)
    success, reason = ex_files.write_json(schedule, schedule_path)

    return success


def update_json_schedule(schedule_name: str, updates: dict) -> dict:
    """Write schedule updates to disk and return the updated schedule"""

    with hub_config.scheduleLock:

        _, schedule = _load_json_schedule_unlocked(schedule_name)

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

        _write_json_schedule_unlocked(schedule_name, schedule)
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

    local_tz = dateutil.tz.tzlocal()
    now = datetime.datetime.now(tz=local_tz)

    # Expand any Programs into their individual actions, scheduled relative to the
    # Program's start time, before setting up execution timers.
    expanded_schedule = expand_program_events(schedule)

    new_timers = []
    for key in expanded_schedule:
        event = expanded_schedule[key]
        if event["action"] == "note":
            # Don't queue notes
            continue

        event_time = dateutil.parser.parse(event["time"]).replace(tzinfo=local_tz)
        seconds_from_now = (event_time - now).total_seconds()

        if seconds_from_now >= 0:
            timer = threading.Timer(seconds_from_now,
                                    execute_scheduled_action,
                                    args=(event["action"], event["target"], event["value"]))
            timer.daemon = True
            timer.start()
            new_timers.append(timer)

    get_next_scheduled_action()  # Update the config.json_next_event field

    # Add a timer to reload the schedule
    tomorrow_midnight = datetime.datetime.combine(
        now.date() + datetime.timedelta(days=1), datetime.time.min
    ).replace(tzinfo=local_tz)
    seconds_until_midnight = (tomorrow_midnight - now).total_seconds()

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


def get_all_schedule_names_to_check() -> list[str]:
    """Return the filenames (without extension) of every schedule that is current or could occur in the future.
    """

    day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    date_specific = sorted(get_available_date_specific_schedules())
    return day_names + date_specific


def find_program_schedule_usage(this_uuid: str) -> list[str]:
    """Search every current/future schedule file on disk for references to the given program.

    Returns a list of schedule names (without extension) that contain a 'run_program' event
    pointing at this program.
    """

    matches = []
    for name in get_all_schedule_names_to_check():
        filename = ex_files.with_extension(name, 'json')
        success, schedule = load_json_schedule(filename)
        if not success:
            continue

        for event in schedule.values():
            if event.get("action") != "run_program":
                continue
            target = event.get("target")
            if isinstance(target, list):
                target = target[0] if len(target) > 0 else None
            if isinstance(target, dict) and target.get("uuid") == this_uuid:
                matches.append(name)
                break

    return matches


def remove_program_from_schedules(this_uuid: str) -> list[str]:
    """Remove any 'run_program' events referencing the given program from all current/future schedules.
    """

    modified = []
    with hub_config.scheduleLock:
        for name in get_all_schedule_names_to_check():
            filename = ex_files.with_extension(name, 'json')
            success, schedule = _load_json_schedule_unlocked(filename)
            if not success or len(schedule) == 0:
                continue

            keys_to_remove = []
            for key, event in schedule.items():
                if event.get("action") != "run_program":
                    continue
                target = event.get("target")
                if isinstance(target, list):
                    target = target[0] if len(target) > 0 else None
                if isinstance(target, dict) and target.get("uuid") == this_uuid:
                    keys_to_remove.append(key)

            if len(keys_to_remove) > 0:
                for key in keys_to_remove:
                    del schedule[key]
                _write_json_schedule_unlocked(filename, schedule)
                modified.append(name)

    if len(modified) > 0:
        retrieve_json_schedule()

    return modified


def expand_program_events(schedule: dict) -> dict:
    """Expand any 'run_program' events in a schedule into their constituent actions.

    A Program is stored in the schedule as a single 'run_program' event pointing at the
    program's UUID. To actually queue or evaluate the individual actions that make up the
    program, each of the program's actions must be turned into its own event, with a time
    calculated by adding the action's time_offset (in seconds) to the time of the
    'run_program' event.

    This does NOT modify the schedule that is saved to disk or sent to the browser -- that
    schedule should keep showing the program as a single entry. This expanded version is
    only used internally, for setting up execution timers and for calculating the next
    upcoming event.
    """

    expanded_schedule = {}

    for key, event in schedule.items():
        if event.get("action") != "run_program":
            expanded_schedule[key] = event
            continue

        # Figure out which program this event refers to
        target = event.get("target")
        if isinstance(target, list):
            target = target[0] if len(target) > 0 else None

        program_uuid = None
        if isinstance(target, dict):
            program_uuid = target.get("uuid")

        if program_uuid is None:
            logging.warning(f"Schedule event {key} has action 'run_program' but no valid program target")
            continue

        program = hub_programs.get_program(program_uuid)
        if program is None:
            logging.warning(f"Schedule event {key} references program {program_uuid}, which does not exist")
            continue

        # Figure out the base time the program is set to start at
        try:
            base_time = dateutil.parser.parse(event["time"])
        except (KeyError, ValueError, OverflowError, dateutil.parser.ParserError):
            logging.warning(f"Schedule event {key} has an unparsable time; skipping program expansion")
            continue

        if "time_in_seconds" in event:
            base_time_in_seconds = event["time_in_seconds"]
        else:
            base_time_in_seconds = seconds_from_midnight(event["time"])

        for action_uuid, action in program.actions.items():
            if action.get("action") == "note":
                # Notes are informational only and are never queued or executed
                continue

            # Prefer the precomputed offset in seconds, but fall back to time_offset (in minutes)
            offset_in_seconds = action.get("time_offset_in_seconds")
            if offset_in_seconds is None:
                offset_in_seconds = action.get("time_offset", 0) * 60

            action_time = base_time + datetime.timedelta(seconds=offset_in_seconds)

            sub_key = f"{key}__{program.uuid}__{action_uuid}"
            expanded_schedule[sub_key] = {
                "time": action_time.isoformat(),
                "time_in_seconds": base_time_in_seconds + offset_in_seconds,
                "action": action.get("action"),
                "target": action.get("target"),
                "value": action.get("value"),
                "source_schedule_id": key,
                "source_program_uuid": program.uuid,
                "source_program_action_uuid": action_uuid
            }

    return expanded_schedule


def get_next_scheduled_action():
    """Search today's schedule for the next scheduled action, update the apps_config, and return it."""

    schedule = (hub_config.json_schedule_list[0])["schedule"]
    local_tz = dateutil.tz.tzlocal()
    now = datetime.datetime.now(tz=local_tz)

    # Expand any Programs into their individual actions, scheduled relative to the
    # program's start time, so the "next event" reflects the actual next action to run.
    expanded_schedule = expand_program_events(schedule)

    previous_next_event = hub_config.json_next_event
    hub_config.json_next_event = []
    for key in expanded_schedule:
        event = expanded_schedule[key]
        if event["action"] == "note":
            # Don't queue notes
            continue

        event_time = dateutil.parser.parse(event["time"]).replace(tzinfo=local_tz)
        seconds_from_now = (event_time - now).total_seconds()

        if seconds_from_now >= 0:
            # Check if this is the next event
            if len(hub_config.json_next_event) == 0:
                hub_config.json_next_event.append(event)
            elif event["time_in_seconds"] < (hub_config.json_next_event[0])["time_in_seconds"]:
                hub_config.json_next_event = [event]
            elif event["time_in_seconds"] == (hub_config.json_next_event[0])["time_in_seconds"]:
                hub_config.json_next_event.append(event)

    if _next_event_changed(previous_next_event, hub_config.json_next_event):
        hub_config.scheduleUpdateTime = time.time()

    return hub_config.json_next_event


def _next_event_changed(old_events: list[dict], new_events: list[dict]) -> bool:
    """Compare two lists of 'next event' dicts and return True if they differ.

    Events are compared by their action/target/value/time_in_seconds, rather than by
    object identity, since get_next_scheduled_action() builds fresh dicts every call
    (and program-expanded events get freshly-generated synthetic keys each time too).
    """

    if len(old_events) != len(new_events):
        return True

    def _fingerprint(event: dict) -> tuple:
        return (
            event.get("action"),
            json.dumps(event.get("target"), sort_keys=True),
            json.dumps(event.get("value"), sort_keys=True),
            event.get("time_in_seconds")
        )

    old_fingerprints = sorted(_fingerprint(e) for e in old_events)
    new_fingerprints = sorted(_fingerprint(e) for e in new_events)

    return old_fingerprints != new_fingerprints


def execute_scheduled_action(action: str,
                             target: list[dict[str, str]] | dict[str, str] | None,
                             value: list | str | None):
    """Dispatch the appropriate action when called by a schedule timer"""

    try:
        hub_exhibitions.execute_action(action, target, value)
    except Exception as e:
        logging.error(e)
        print(e)

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
                    level=logging.ERROR)
