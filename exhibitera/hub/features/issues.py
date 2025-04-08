# Standard imports
import datetime
import json
import logging
import os
import time
from typing import Any, Union
import uuid

# Exhibitera imports
import exhibitera.common.files as ex_files
import exhibitera.hub.config as config
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
        config.issueList_last_update_date = self.details["lastUpdateDate"]


def delete_issue_media_file(files: list[str], owner: Union[str, None] = None) -> None:
    """Delete a media file from an issue"""

    for file in files:
        file_path = ex_files.get_path(["issues", "media", file], user_file=True)
        print("Deleting issue media file:", file)
        with config.logLock:
            logging.info("Deleting issue media file %s", file)
        with config.issueMediaLock:
            try:
                os.remove(file_path)
            except FileNotFoundError:
                with config.logLock:
                    logging.error("Cannot delete requested issue media file %s: file not found", file)
                print(f"Cannot delete requested issue media file {file}: file not found")

        if owner is not None:
            with config.issueLock:
                issue = get_issue(owner)
                issue.details["media"] = [x for x in issue.details["media"] if x != file]
                issue.refresh_last_update_date()
                save_issue_list()
            config.last_update_time = time.time()


def create_issue(details: dict[str, Any], username: str = "") -> Issue:
    """Create a new issue and add it to the issueList"""

    if username != "":
        details["createdUsername"] = username
    with config.issueLock:
        new_issue = Issue(details)
        config.issueList.append(new_issue)
    config.last_update_time = time.time()
    return new_issue


def edit_issue(details: dict, username: str) -> None:
    """Edit issue with the id given in details dict"""

    details["lastUpdateUsername"] = username
    issue = get_issue(details["id"])
    with config.issueLock:
        issue.details = issue.details | details
        issue.refresh_last_update_date()
    config.last_update_time = time.time()


def get_issue(this_id: str) -> Issue:
    """Return an Issue with the given id, or None if no such Issue exists"""

    return next((x for x in config.issueList if x.details["id"] == this_id), None)


def remove_issue(this_id: str) -> None:
    """Remove an Issue with the given id from the issueList"""

    issue = get_issue(this_id)
    if issue is not None:
        # First, if there are media files, delete them
        if "media" in issue.details and issue.details["media"] is not None:
            if len(issue.details["media"]) > 0:
                delete_issue_media_file(issue.details["media"])

        with config.issueLock:
            config.issueList = [x for x in config.issueList if x.details["id"] != this_id]
            issue.refresh_last_update_date()
            save_issue_list()
    config.last_update_time = time.time()


def archive_issue(this_id: str, username: str) -> None:
    """Move the given issue from issues.json to archived.json."""

    details = get_issue(this_id).details.copy()
    now_date = datetime.datetime.now().isoformat()
    details["archiveDate"] = now_date
    details["lastUpdateDate"] = now_date
    details["media"] = []
    details["archivedUsername"] = username

    # First, load the current archive
    archive_file = ex_files.get_path(["issues", "archived.json"], user_file=True)
    with config.issueLock:
        try:
            with open(archive_file, 'r', encoding="UTF-8") as file_object:
                try:
                    archive: list[dict[str, Any]] = json.load(file_object)
                except json.decoder.JSONDecodeError:
                    # File is blank
                    archive = []
        except FileNotFoundError:
            # File does not exist
            archive = []

        # Next, append the newly-archived issue
        archive.append(details)

        # Then, write the file back to disk
        with open(archive_file, "w", encoding="UTF-8") as file_object:
            json.dump(archive, file_object, indent=2, sort_keys=True)

    # Finally, delete the issue
    remove_issue(this_id)


def restore_issue(this_id: str) -> None:
    """Move the given issue from the archive back to the issueList"""

    archive_file = ex_files.get_path(["issues", "archived.json"], user_file=True)

    # First, create the new issue
    with config.issueLock:
        try:
            with open(archive_file, 'r', encoding='UTF-8') as file_object:
                archive_list = json.load(file_object)
        except (FileNotFoundError, json.JSONDecodeError):
            archive_list = []

        issue = [x for x in archive_list if x["id"] == this_id][0]
    create_issue(issue)
    save_issue_list()

    with config.issueLock:
        # Then, remove the issue from the archive
        new_archive = [x for x in archive_list if x["id"] != this_id]

        # Finally, write the file back to disk
        with open(archive_file, "w", encoding="UTF-8") as file_object:
            json.dump(new_archive, file_object, indent=2, sort_keys=True)


def read_issue_list() -> None:
    """Read issues.json and set up the issueList"""

    latest_update = datetime.datetime(year=2000, day=1, month=1)

    try:
        issue_file = ex_files.get_path(["issues", "issues.json"], user_file=True)
        with open(issue_file, "r", encoding="UTF-8") as file_object:
            issues = json.load(file_object)

        for issue in issues:
            update_datetime = datetime.datetime.fromisoformat(issue['lastUpdateDate'])
            if update_datetime > latest_update:
                latest_update = update_datetime
            create_issue(issue)
    except FileNotFoundError:
        print("No stored issues to read")
    config.issueList_last_update_date = latest_update


def save_issue_list() -> None:
    """Write the current issueList to file"""

    issue_file = ex_files.get_path(["issues", "issues.json"], user_file=True)

    with open(issue_file, "w", encoding="UTF-8") as file_object:
        json.dump([x.details for x in config.issueList], file_object, indent=2, sort_keys=True)


# Set up log file
log_path = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)
