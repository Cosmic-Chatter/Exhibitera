# Standard modules
import aiofiles
import os
from typing import Any
import uuid

# Third-party modules
from fastapi import APIRouter, Body, Depends, File, UploadFile

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.issues as hub_issues
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/issue")

@router.post("/create", dependencies=[Depends(hub_users.require_permission("maintenance", "edit"))])
async def create_issue(details: dict[str, Any] = Body(embed=True),
                       authorizing_user: str = Depends(hub_users.require_user)):
    """Create a new issue."""

    hub_issues.create_issue(details, username=authorizing_user)
    with hub_config.issueLock:
        hub_issues.save_issue_list()
    return {"success": True}


@router.get("/{issue_id}/delete", dependencies=[Depends(hub_users.require_permission("maintenance", "edit"))])
async def delete_issue(issue_id: str):
    """Delete an issue."""

    hub_issues.remove_issue(issue_id)
    return {"success": True, "reason": ""}


@router.get("/{issue_id}/archive", dependencies=[Depends(hub_users.require_permission("maintenance", "edit"))])
async def archive_issue(issue_id: str, authorizing_user: str = Depends(hub_users.require_user)):
    """Move the given issue to the archive."""

    # Check that the issue exists
    issue = hub_issues.get_issue(issue_id)
    if issue is None:
        return {"success": False, "reason": 'does_not_exist'}

    hub_issues.archive_issue(issue_id, authorizing_user)
    return {"success": True}


@router.get("/{issue_id}/restore", dependencies=[Depends(hub_users.require_permission("maintenance", "edit"))])
async def restore_issue(issue_id: str):
    """Move the given issue from the archive to the issue list."""

    success = hub_issues.restore_issue(issue_id)
    return {"success": success}


@router.post("/deleteMedia", dependencies=[Depends(hub_users.require_permission("maintenance", "edit"))])
async def delete_issue_media(filenames: list[str] = Body(description="The filenames to be deleted."),
                             owner: str | None = Body(default=None,
                                                            description="The ID of the Issue this media file belonged to.")):
    """Delete the media files linked to an issue and remove the reference."""

    for filename in filenames:
        if ex_files.filename_safe(filename) is False:
            return {"success": False, "reason": "unsafe_filename"}

    hub_issues.delete_issue_media_file(filenames, owner=owner)
    return {"success": True}


@router.post("/edit", dependencies=[Depends(hub_users.require_permission("maintenance", "edit"))])
async def edit_issue(details: dict[str, Any] = Body(description="The details to be changed.", embed=True),
                     authorizing_user: str = Depends(hub_users.require_user)):
    """Make changes to an existing issue."""

    if "id" not in details:
        return {"success": False, "reason": "'details' must include property 'id'"}

    issue = hub_issues.get_issue(details["id"])
    if issue is None:
        return {"success": False, "reason": 'does_not_exist'}

    hub_issues.edit_issue(details, authorizing_user)
    with hub_config.issueLock:
        hub_issues.save_issue_list()
    return {"success": True}


@router.get("/list/{match_uuid}", dependencies=[Depends(hub_users.require_permission("maintenance", "view"))])
async def get_issue_list(match_uuid: str):
    """Return a list of open issues."""

    if match_uuid != "__all":
        matched_issues = []
        for issue in hub_config.issue_list:
            if match_uuid in issue.details["relatedComponentUUIDs"]:
                matched_issues.append(issue.details)
    else:
        matched_issues = [x.details for x in hub_config.issue_list]

    response = {
        "success": True,
        "issue_list": matched_issues
    }
    return response


@router.get("/archive/list/{match_uuid}", dependencies=[Depends(hub_users.require_permission("maintenance", "view"))])
async def get_archived_issues(match_uuid: str):
    """Return a list of open issues."""

    archive_file = ex_files.get_path(["issues", "archived.json"], user_file=True)

    with hub_config.issueLock:
        archive_list = ex_files.load_json(archive_file)
        if archive_list is None:
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


@router.get("/{issue_id}/media", dependencies=[Depends(hub_users.require_permission("maintenance", "view"))])
async def get_issue_media(issue_id: str):
    """Return a list of media files connected to the given ID."""

    issue = hub_issues.get_issue(issue_id)

    if issue is None:
        return {"success": False, "reason": f"Issue does not exist: {issue_id}"}

    return {"success": True, "media": issue.details["media"]}


@router.post("/uploadMedia", dependencies=[Depends(hub_users.require_permission("maintenance", "edit"))])
async def upload_issue_media(files: list[UploadFile] = File()):
    """Upload issue media files."""

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