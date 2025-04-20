# Standard modules
import json
import os
import shutil
import time

# Third-party modules
import dateutil
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.schedules as hub_schedule
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/schedule")


@router.get("/{schedule_name}")
async def get_specific_schedule(request: Request, schedule_name: str):
    """Retrieve the given schedule and return it as a dictionary."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if not schedule_name.endswith('.json'):
        schedule_name += '.json'
    success, schedule = hub_schedule.load_json_schedule(schedule_name)

    return {"success": success, "schedule": schedule}


@router.delete("/{schedule_name}")
async def delete_schedule(request: Request, schedule_name: str):
    """Delete the given schedule."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    # Check filename is safe
    if ex_files.filename_safe(schedule_name) is False:
        return {"success": False, "reason": "unsafe_filename"}

    with hub_config.scheduleLock:
        json_schedule_path = ex_files.get_path(["schedules", ex_files.with_extension(schedule_name, 'json')], user_file=True)
        os.remove(json_schedule_path)

    # Reload the schedule from disk
    hub_schedule.retrieve_json_schedule()
    hub_config.last_update_time = time.time()

    # Send the updated schedule back
    with hub_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": hub_config.scheduleUpdateTime,
                         "schedule": hub_config.json_schedule_list,
                         "nextEvent": hub_config.json_next_event}
    return response_dict


@router.post("/convert")
async def convert_schedule(
        request: Request,
        date: str = Body(description="The date of the schedule to create, in the form of YYYY-MM-DD."),
        convert_from: str = Body(description="The name of the schedule to clone to the new date.")):
    """Convert between date- and day-specific schedules."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    with hub_config.scheduleLock:
        shutil.copy(ex_files.get_path(["schedules", convert_from.lower() + ".json"], user_file=True),
                    ex_files.get_path(["schedules", date + ".json"], user_file=True))

    hub_config.last_update_time = time.time()
    # Reload the schedule from disk
    hub_schedule.retrieve_json_schedule()

    # Send the updated schedule back
    with hub_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": hub_config.scheduleUpdateTime,
                         "schedule": hub_config.json_schedule_list,
                         "nextEvent": hub_config.json_next_event}
    return response_dict


@router.post("/create")
async def create_schedule(request: Request,
                          entries: dict[str, dict] = Body(
                              description="A dict of dicts that each define one entry in the schedule."),
                          name: str = Body(description="The name for the schedule to be created.")):
    """Create a new schedule from an uploaded CSV file"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success, schedule = hub_schedule.create_schedule(ex_files.with_extension(name, 'json'), entries)
    hub_schedule.retrieve_json_schedule()
    return {"success": success, "schedule": schedule}


@router.post("/getSecondsFromMidnight")
async def get_seconds_from_midnight(time_str: str = Body(description="The time to parse.", embed=True)):
    """Return the number of seconds from midnight for the given natural language time.

    This ensures that the value in the browser is consistent with how Python will process.
    """

    return {"success": True, "seconds": hub_schedule.seconds_from_midnight(time_str)}


@router.get("/{schedule_name}/JSONString")
async def get_schedule_as_json_string(request: Request,
                                      schedule_name: str):
    """Return the requested schedule as a JSON, excluding unnecessary fields."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success, schedule = hub_schedule.load_json_schedule(schedule_name + '.json')
    result = {}

    for key in list(schedule.keys()):
        result[key] = {
            "time": schedule[key].get("time", ""),
            "action": schedule[key].get("action", ""),
            "target": schedule[key].get("target", ""),
            "value": schedule[key].get("value", ""),
        }
    return {"success": success, "json": json.dumps(result, indent=2, sort_keys=True)}


@router.delete("/{schedule_name}/action/{action_id}")
async def delete_schedule_action(request: Request, schedule_name: str, action_id: str):
    """Delete the given action from the specified schedule."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_schedule.delete_json_schedule_event(ex_files.with_extension(schedule_name, 'json'), action_id)
    hub_schedule.retrieve_json_schedule()

    # Send the updated schedule back
    with hub_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": hub_config.scheduleUpdateTime,
                         "schedule": hub_config.json_schedule_list,
                         "nextEvent": hub_config.json_next_event}
    return response_dict


@router.get("/availableDateSpecificSchedules")
async def get_date_specific_schedules(request: Request):
    """Retrieve a list of available date-specific schedules"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    return {"success": True, "schedules": hub_schedule.get_available_date_specific_schedules()}


@router.post("/{schedule_name}/action/{action_id}/update")
async def update_schedule(
        request: Request,
        schedule_name: str,
        action_id: str,
        time_to_set: str = Body(description="The time of the action to set, expressed in any normal way."),
        action_to_set: str = Body(description="The action to set."),
        target_to_set: list[dict] | dict | None = Body(default=None,
                                                       description="The details of the component(s) that should be acted upon."),
        value_to_set: str = Body(default="", description="A value corresponding to the action.")):
    """Write a schedule update to disk.

    This command handles both adding a new scheduled action and editing an existing action
    """

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    # Make sure we were given a valid time to parse
    try:
        dateutil.parser.parse(time_to_set)
    except dateutil.parser._parser.ParserError:
        response_dict = {"success": False,
                         "reason": "Time not valid"}
        return response_dict

    hub_schedule.update_json_schedule(ex_files.with_extension(schedule_name, 'json'), {
        action_id: {"time": time_to_set, "action": action_to_set,
                      "target": target_to_set, "value": value_to_set}})

    error = False
    error_message = ""

    response_dict = {}
    if not error:
        # Reload the schedule from disk
        hub_schedule.retrieve_json_schedule()

        # Send the updated schedule back
        with hub_config.scheduleLock:
            response_dict["updateTime"] = hub_config.scheduleUpdateTime
            response_dict["schedule"] = hub_config.json_schedule_list
            response_dict["nextEvent"] = hub_config.json_next_event
            response_dict["success"] = True
    else:
        response_dict["success"] = False
        response_dict["reason"] = error_message
    return response_dict
