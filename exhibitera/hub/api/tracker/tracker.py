# Standard modules
import logging
import os
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.tools as hub_tools
import exhibitera.hub.features.users as hub_users

# Set up log file
log_path: str = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

router = APIRouter(prefix='/tracker')


@router.post("/template/create")
async def create_tracker_template(request: Request,
                                  template: dict[str, Any] = Body(description='A dictionary containing the template'),
                                  tracker_uuid: str = Body(description='The UUID for the template we are creating.')):
    """Write the given tracker template to file"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    template_path = ex_files.get_path(
        ["flexible-tracker", "templates", ex_files.with_extension(tracker_uuid, 'json')],
        user_file=True)
    success, reason = ex_files.write_json(template, template_path)
    return {"success": success, "reason": reason}


@router.delete("/template/{tracker_uuid}")
async def delete_tracker_template(request: Request, tracker_uuid: str):
    """Delete the specified tracker template."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    file_path = ex_files.get_path(["flexible-tracker", "templates", ex_files.with_extension(tracker_uuid, 'json')], user_file=True)
    with hub_config.trackerTemplateWriteLock:
        response = ex_files.delete_file(file_path)
    return response


@router.get("/template/{template_uuid}")
async def get_tracker_template(template_uuid: str):
    """Load the requested tracker template and return it as a dictionary."""

    template_path = ex_files.get_path(["flexible-tracker", "templates", ex_files.with_extension(template_uuid, "json")])
    template = ex_files.load_json(template_path)
    if template is None:
        success = False
    else:
        success = True

    return {"success": success, "template": template}


@router.get("/templates/list")
async def get_available_tracker_templates():
    """Send a list of all the available templates for the given tracker group (usually flexible-tracker)."""

    template_list = []
    template_path = ex_files.get_path(["flexible-tracker", "templates"], user_file=True)
    for file in os.listdir(template_path):
        if file.lower().endswith(".json"):
            file_path = ex_files.get_path(["flexible-tracker", "templates", file], user_file=True)
            template = ex_files.load_json(file_path)
            template_list.append({"name": template["name"], "uuid": template["uuid"]})

    return template_list

