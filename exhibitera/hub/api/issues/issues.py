# Standard modules
import aiofiles
import json
import os
from typing import Any
import uuid

# Third-party modules
from fastapi import APIRouter, Body, File, Request, UploadFile

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.issues as hub_issues
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/issue")

@router.post("/create")
async def create_issue(request: Request, details: dict[str, Any] = Body(embed=True)):
    """Create a new issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_issues.create_issue(details, username=authorizing_user)
    hub_issues.save_issue_list()
    return {"success": True}


@router.get("/{issue_id}/delete")
async def delete_issue(request: Request, issue_id: str):
    """Delete an issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_issues.remove_issue(issue_id)
    return {"success": True, "reason": ""}


@router.get("/{issue_id}/archive")
async def archive_issue(request: Request, issue_id: str):
    """Move the given issue to the archive."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_issues.archive_issue(issue_id, authorizing_user)
    return {"success": True}


@router.get("/{issue_id}/restore")
async def restore_issue(request: Request, issue_id: str):
    """Move the given issue from the archive to the issue list."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_issues.restore_issue(issue_id)
    return {"success": True}


@router.post("/deleteMedia")
async def delete_issue_media(request: Request,
                             filenames: list[str] = Body(description="The filenames to be deleted."),
                             owner: str | None = Body(default=None,
                                                            description="The ID of the Issue this media file belonged to.")):
    """Delete the media files linked to an issue and remove the reference."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    hub_issues.delete_issue_media_file(filenames, owner=owner)
    return {"success": True}


@router.post("/edit")
async def edit_issue(request: Request,
                     details: dict[str, Any] = Body(description="The details to be changed.", embed=True)):
    """Make changes to an existing issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "id" in details:
        hub_issues.edit_issue(details, authorizing_user)
        hub_issues.save_issue_list()
        response_dict = {"success": True}
    else:
        response_dict = {
            "success": False,
            "reason": "'details' must include property 'id'"
        }
    return response_dict


@router.get("/list/{match_uuid}")
async def get_issue_list(request: Request, match_uuid: str):
    """Return a list of open issues."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if match_uuid != "__all":
        matched_issues = []
        for issue in hub_config.issueList:
            if match_uuid in issue.details["relatedComponentUUIDs"]:
                matched_issues.append(issue.details)
    else:
        matched_issues = [x.details for x in hub_config.issueList]

    response = {
        "success": True,
        "issueList": matched_issues
    }
    return response


@router.get("/archive/list/{match_uuid}")
async def get_archived_issues(request: Request, match_uuid: str):
    """Return a list of open issues."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    archive_file = ex_files.get_path(["issues", "archived.json"], user_file=True)

    with hub_config.issueLock:
        try:
            with open(archive_file, 'r', encoding='UTF-8') as file_object:
                archive_list = json.load(file_object)
        except (FileNotFoundError, json.JSONDecodeError):
            archive_list = []

    if match_uuid != "__all":
        matched_issues = []
        for issue in archive_list:
            if match_uuid in issue["relatedComponentUUIDs"]:
                matched_issues.append(issue)
    else:
        matched_issues = archive_list

    response = {
        "success": True,
        "issues": matched_issues
    }
    return response


@router.get("/{issue_id}/media")
async def get_issue_media(request: Request, issue_id: str):
    """Return a list of media files connected to the given ID."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    issue = hub_issues.get_issue(issue_id)

    if issue is None:
        return {"success": False, "reason": f"Issue does not exist: {issue_id}"}

    return {"success": True, "media": issue.details["media"]}


@router.post("/uploadMedia")
async def upload_issue_media(request: Request, files: list[UploadFile] = File()):
    """Upload issue media files."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    filenames = []
    for file in files:
        ext = os.path.splitext(file.filename)[1]
        filename = str(uuid.uuid4()) + ext
        filenames.append(filename)
        file_path = ex_files.get_path(["issues", "media", filename], user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with hub_config.issueMediaLock:
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content)  # async write
    return {"success": True, "filenames": filenames}