# Standard imports
import datetime
import logging
import os
import time
from typing import Any, Union
import uuid

# Exhibitera imports
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.tools as hub_tools


class Issue:
    """Contains information relevant for tracking an issue."""

    def __init__(self, details: dict):
        """Populate the Issue with the information stored in a dictionary"""

        now_date = datetime.datetime.now().isoformat()
        self.details = {"id": details.get("id", str(uuid.uuid4())),
                        "creationDate": details.get("creationDate", now_date),
                        "createdUsername": details.get("createdUsername", ""),
                        "lastUpdateDate": details.get("lastUpdateDate", now_date),
                        "lastUpdateUsername": details.get("lastUpdateUsername", ""),
                        "priority": details.get("priority", "medium"),
                        "issueName": details.get("issueName", "New Issue"),
                        "issueDescription": details.get("issueDescription", ""),
                        "relatedComponentUUIDs": details.get("relatedComponentUUIDs", []),
                        "assignedTo": details.get("assignedTo", []),
                        "media": details.get("media", [])}
        if isinstance(self.details["media"], str):
            # Fix in Constellation 4 when transitioning from one media file to multiple
            self.details["media"] = [self.details["media"]]

    def __repr__(self):
        return repr(f"[Issue Name: {self.details['issueName']}]")

    def refresh_last_update_date(self):
        self.details["lastUpdateDate"] = datetime.datetime.now().isoformat()
        hub_config.issue_list_last_update_date = self.details["lastUpdateDate"]


def delete_issue_media_file(files: list[str], owner: Union[str, None] = None) -> None:
    """Delete a media file from an issue"""

    for file in files:
        file_path = ex_files.get_path(["issues", "media", file], user_file=True)
        print("Deleting issue media file:", file)
        logging.info("Deleting issue media file %s", file)
        with hub_config.issueMediaLock:
            try:
                os.remove(file_path)
            except FileNotFoundError:
                logging.error("Cannot delete requested issue media file %s: file not found", file)
                print(f"Cannot delete requested issue media file {file}: file not found")

        if owner is not None:
            with hub_config.issueLock:
                issue = get_issue(owner)
                issue.details["media"] = [x for x in issue.details["media"] if x != file]
                issue.refresh_last_update_date()
                save_issue_list()
            hub_config.last_update_time = time.time()


def create_issue(details: dict[str, Any], username: str = "") -> Issue:
    """Create a new issue and add it to hub_config.issue_list"""

    if username != "":
        details = {**details, "createdUsername": username}
    with hub_config.issueLock:
        new_issue = Issue(details)
        hub_config.issue_list.append(new_issue)
    hub_config.last_update_time = time.time()
    return new_issue


def edit_issue(details: dict, username: str) -> None:
    """Edit issue with the id given in details dict"""

    details["lastUpdateUsername"] = username
    issue = get_issue(details["id"])

    if issue is None:
        logging.error("edit_issue: issue ID not found: " + details["id"])
        return

    with hub_config.issueLock:
        issue.details = issue.details | details
        issue.refresh_last_update_date()
    hub_config.last_update_time = time.time()


def get_issue(this_id: str) -> Issue:
    """Return an Issue with the given id, or None if no such Issue exists"""

    return next((x for x in hub_config.issue_list if x.details["id"] == this_id), None)


def remove_issue(this_id: str) -> None:
    """Remove an Issue with the given id from hub_config.issue_list"""

    issue = get_issue(this_id)
    if issue is not None:
        # First, if there are media files, delete them
        if "media" in issue.details and issue.details["media"] is not None:
            if len(issue.details["media"]) > 0:
                delete_issue_media_file(issue.details["media"])

        with hub_config.issueLock:
            hub_config.issue_list = [x for x in hub_config.issue_list if x.details["id"] != this_id]
            issue.refresh_last_update_date()
            save_issue_list()
    hub_config.last_update_time = time.time()


def archive_issue(this_id: str, username: str) -> None:
    """Move the given issue from issues.json to archived.json."""

    issue = get_issue(this_id)
    if issue is None:
        logging.error("archive_issue: issue ID not found: " + this_id)
        return

    # First, load the current archive
    archive_file = ex_files.get_path(["issues", "archived.json"], user_file=True)
    with hub_config.issueLock:
        archive: list[dict[str, Any]] | None = ex_files.load_json(archive_file)
        if archive is None:
            # File does not exist or is blank
            archive = []

        details = issue.details.copy()
        now_date = datetime.datetime.now().isoformat()
        details["archiveDate"] = now_date
        details["lastUpdateDate"] = now_date
        details["media"] = []
        details["archivedUsername"] = username

        # Next, append the newly-archived issue
        archive.append(details)

        # Then, write the file back to disk
        ex_files.write_json(archive, archive_file)

    # Finally, delete the issue
    remove_issue(this_id)


def restore_issue(this_id: str) -> bool:
    """Move the given issue from the archive back to hub_config.issue_list"""

    archive_file = ex_files.get_path(["issues", "archived.json"], user_file=True)

    # First, create the new issue
    with hub_config.issueLock:
        archive_list = ex_files.load_json(archive_file)
        if archive_list is None:
            archive_list = []

        issue = next((x for x in archive_list if x["id"] == this_id), None)

    if issue is None:
        return False

    create_issue(issue)
    with hub_config.issueLock:
        save_issue_list()

    with hub_config.issueLock:
        # Then, remove the issue from the archive
        new_archive = [x for x in archive_list if x["id"] != this_id]

        # Finally, write the file back to disk
        ex_files.write_json(new_archive, archive_file)

    return True

def read_issue_list() -> None:
    """Read issues.json and set up hub_config.issue_list"""

    latest_update = datetime.datetime(year=2000, day=1, month=1)

    issue_file = ex_files.get_path(["issues", "issues.json"], user_file=True)
    issues = ex_files.load_json(issue_file)  # Logs an error if the file is malformed
    if issues is None:
        if os.path.exists(issue_file):
            print("issues.json is incorrectly formatted or blank.")
        else:
            print("No stored issues to load")
        issues = []

    for issue in issues:
        update_datetime = datetime.datetime.fromisoformat(issue['lastUpdateDate'])
        if update_datetime > latest_update:
            latest_update = update_datetime
        create_issue(issue)
    hub_config.issue_list_last_update_date = latest_update


def save_issue_list() -> None:
    """Write the current issue list to file"""

    issue_file = ex_files.get_path(["issues", "issues.json"], user_file=True)

    ex_files.write_json([x.details for x in hub_config.issue_list], issue_file)
