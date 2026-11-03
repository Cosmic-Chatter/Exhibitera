"""Store data collected by Flexible Tracker and the Apps kiosks by ID, rather than by name.

Each kind of dataset has a folder in the data directory:

    data/tracker/<template UUID>.txt       Flexible Tracker, named by its template (active or archived)
    data/kiosk/<data ID>.txt               Voting and Survey Kiosk, named in data/kiosk/index.json
    data/word_cloud/<ID>.txt               Word Cloud, keyed by collection name in data/word_cloud/index.json

Names are only used for display and for the downloaded file's name, so any name works and renaming
doesn't split the data. Files directly in the data directory, written through the Core API or by
Apps 6.0, are stored by name as before. Kiosks claim the file with their old name the first time they
record under this scheme.
"""

# Standard modules
import datetime
import json
import logging
import os
import threading
import uuid
from typing import Any

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config

KINDS = ["tracker", "kiosk", "word_cloud"]
KIOSK_APPS = ["survey_kiosk", "voting_kiosk"]

# Characters that can't appear in a file name on at least one operating system
FORBIDDEN_FILENAME_CHARACTERS = ['/', '\\', '<', '>', ':', '"', '|', '?', '*']

# Stored with each Flexible Tracker record that has an ID, and left out of downloads
RECORD_ID_KEY = "_record_id"

index_lock = threading.Lock()
tracker_record_lock = threading.Lock()


# Paths

def dataset_path(kind: str, dataset_id: str) -> str | None:
    """Return the path of the given dataset's records, or None if the kind or ID isn't valid."""

    if kind not in KINDS or not ex_files.filename_safe(dataset_id):
        return None
    folder = ex_files.get_path(["data", kind], user_file=True)
    os.makedirs(folder, exist_ok=True)
    return ex_files.get_path(["data", kind, ex_files.with_extension(dataset_id, "txt")], user_file=True)


def _index_path(kind: str) -> str:
    folder = ex_files.get_path(["data", kind], user_file=True)
    os.makedirs(folder, exist_ok=True)
    return ex_files.get_path(["data", kind, "index.json"], user_file=True)


def load_index(kind: str) -> dict[str, dict[str, Any]]:
    """Return the names and details for the given kind of dataset, by ID."""

    index = ex_files.load_json(_index_path(kind))
    return index if isinstance(index, dict) else {}


def _save_index(kind: str, index: dict[str, dict[str, Any]]):
    ex_files.write_json(index, _index_path(kind))


def _claim_old_file(old_name: str, path: str) -> bool:
    """Move the file stored by name directly in the data directory to the given dataset path.

    Any records already in the dataset are kept after the old ones. Return True if a file was moved.
    """

    if not ex_files.filename_safe(old_name):
        return False
    old_path = ex_files.get_path(["data", ex_files.with_extension(old_name, "txt")], user_file=True)
    if not os.path.exists(old_path):
        return False

    with ex_config.text_file_lock:
        with open(old_path, "r", encoding="UTF-8") as f:
            old_text = f.read()
        existing = ""
        if os.path.exists(path):
            with open(path, "r", encoding="UTF-8") as f:
                existing = f.read()
        if old_text != "" and not old_text.endswith("\n"):
            old_text += "\n"
        ex_files.replace_file_contents(path, old_text + existing)
        os.remove(old_path)
    logging.info("Moved data file %s.txt to %s", old_name, path)
    return True


def download_name(name: str) -> str:
    """Return the given dataset name as a file name, replacing characters that aren't allowed with _."""

    for char in FORBIDDEN_FILENAME_CHARACTERS:
        name = name.replace(char, "_")
    name = name.strip()
    if name == "":
        return "data"
    if not ex_files.filename_safe(name):
        # Reserved Windows names, such as CON
        return name + "_"
    return name


# Flexible Tracker

def load_tracker_template_archive() -> list[dict[str, Any]]:
    """Return the templates that have been deleted, most recently deleted last."""

    archive = ex_files.load_json(ex_files.get_path(["flexible-tracker", "archived.json"], user_file=True))
    return archive if isinstance(archive, list) else []


def find_tracker_template(template_uuid: str) -> tuple[dict[str, Any] | None, bool]:
    """Return the given template and whether it has been archived, or (None, False) if it doesn't exist."""

    if not ex_files.filename_safe(template_uuid):
        return None, False
    path = ex_files.get_path(["flexible-tracker", "templates", ex_files.with_extension(template_uuid, "json")],
                             user_file=True)
    template = ex_files.load_json(path)
    if isinstance(template, dict):
        return template, False
    for archived in reversed(load_tracker_template_archive()):
        if archived.get("uuid") == template_uuid:
            return archived, True
    return None, False


def archive_tracker_template(template_uuid: str, username: str) -> bool:
    """Move the given template to the archive, so its data can still be found by name."""

    template, archived = find_tracker_template(template_uuid)
    if template is None or archived:
        return False

    archive_path = ex_files.get_path(["flexible-tracker", "archived.json"], user_file=True)
    template_path = ex_files.get_path(
        ["flexible-tracker", "templates", ex_files.with_extension(template_uuid, "json")], user_file=True)
    with hub_config.trackerTemplateWriteLock:
        archive = load_tracker_template_archive()
        details = dict(template)
        details["archiveDate"] = datetime.datetime.now().isoformat()
        details["archivedUsername"] = username
        archive.append(details)
        ex_files.write_json(archive, archive_path)
        ex_files.delete_file(template_path)
    return True


def append_tracker_record(template_uuid: str, record: dict[str, Any],
                          record_id: str | None = None) -> tuple[bool, str]:
    """Save a record for the given template. Archived templates are accepted, for trackers left open.

    Trackers keep records on the device until Hub confirms them, so a record whose reply was lost is
    sent again with the same ID. A record with an ID that's already saved is skipped.
    """

    template, _ = find_tracker_template(template_uuid)
    if template is None:
        return False, "unknown_template"
    path = dataset_path("tracker", template_uuid)
    if record_id is None:
        return ex_files.write_json(record, path, append=True, indent=None)

    with tracker_record_lock:
        if _has_tracker_record(path, record_id):
            return True, ""
        return ex_files.write_json({**record, RECORD_ID_KEY: record_id}, path, append=True, indent=None)


def _has_tracker_record(path: str, record_id: str) -> bool:
    """Return whether the given dataset already has a record with the given ID."""

    if not os.path.exists(path):
        return False
    with open(path, "r", encoding="UTF-8") as f:
        for line in f:
            if record_id not in line:
                continue
            try:
                if json.loads(line).get(RECORD_ID_KEY) == record_id:
                    return True
            except (json.JSONDecodeError, AttributeError):
                pass
    return False


# Voting and Survey Kiosk

def append_kiosk_record(data_id: str | None, name: str, app: str, record: dict[str, Any]) -> tuple[bool, str]:
    """Save a record from a Voting or Survey Kiosk.

    Definitions made before data IDs existed send only their name, and all of them with the same name
    share one dataset, as they shared one file before. The first dataset to record under a name claims
    the old file with that name.
    """

    if app not in KIOSK_APPS:
        return False, "unknown_app"
    if not isinstance(name, str):
        return False, "invalid_name"
    if data_id is not None and not ex_files.filename_safe(data_id):
        return False, "invalid_data_id"

    with index_lock:
        index = load_index("kiosk")
        # The dataset that records under this name, and so has its old file
        claimed_by = next((i for i, entry in index.items() if name in entry.get("old_names", [])), None)

        if data_id is None:
            data_id = claimed_by or str(uuid.uuid4())

        entry = index.setdefault(data_id, {})
        entry["name"] = name
        entry["app"] = app
        path = dataset_path("kiosk", data_id)
        if claimed_by is None:
            entry.setdefault("old_names", []).append(name)
            _claim_old_file(name, path)
        _save_index("kiosk", index)

    return ex_files.write_json(record, path, append=True, indent=None)


# Word Cloud

def _word_cloud_path(collection: str) -> str:
    """Return the path for the given collection, creating it the first time, and claiming its old file."""

    with index_lock:
        index = load_index("word_cloud")
        dataset_id = next((i for i, entry in index.items() if entry.get("name") == collection), None)
        if dataset_id is None:
            dataset_id = str(uuid.uuid4())
            index[dataset_id] = {"name": collection}
            _save_index("word_cloud", index)
            _claim_old_file("Word_Cloud_" + collection, dataset_path("word_cloud", dataset_id))
    return dataset_path("word_cloud", dataset_id)


def append_word_cloud_text(collection: str, text: str) -> tuple[bool, str]:
    """Add text to the given Word Cloud collection."""

    if not isinstance(collection, str):
        return False, "invalid_collection"
    return ex_files.write_text(text, _word_cloud_path(collection), mode="a")


def get_word_cloud_text(collection: str) -> str:
    """Return all the text in the given Word Cloud collection."""

    path = _word_cloud_path(collection)
    if not os.path.exists(path):
        return ""
    text, _, _ = ex_files.get_text(path)
    return text


# Listing, downloading, and deleting

def list_datasets() -> list[dict[str, Any]]:
    """Return every dataset that has data, with its display name."""

    datasets = []
    for kind in KINDS:
        folder = ex_files.get_path(["data", kind], user_file=True)
        if not os.path.isdir(folder):
            continue
        index = load_index(kind) if kind != "tracker" else {}
        for file in sorted(os.listdir(folder)):
            if not file.endswith(".txt"):
                continue
            dataset_id = file[:-len(".txt")]
            datasets.append(describe_dataset(kind, dataset_id, index))
    return datasets


def describe_dataset(kind: str, dataset_id: str, index: dict | None = None) -> dict[str, Any]:
    """Return the display details for the given dataset."""

    if kind == "tracker":
        template, archived = find_tracker_template(dataset_id)
        name = template["name"] if template is not None else dataset_id
        return {"kind": kind, "id": dataset_id, "name": name, "app": "flexible_tracker", "archived": archived}

    entry = (index if index is not None else load_index(kind)).get(dataset_id, {})
    app = entry.get("app", "word_cloud" if kind == "word_cloud" else "")
    return {"kind": kind, "id": dataset_id, "name": entry.get("name", dataset_id), "app": app, "archived": False}


def list_other_files() -> list[str]:
    """Return the names of data files stored by name, such as those written through the Core API."""

    folder = ex_files.get_path(["data"], user_file=True)
    return sorted(file[:-len(".txt")] for file in os.listdir(folder)
                  if file.lower().endswith(".txt") and os.path.isfile(os.path.join(folder, file)))


def dataset_records(kind: str, dataset_id: str) -> list[dict[str, Any]] | None:
    """Return the given dataset's records, or None if it doesn't exist."""

    path = dataset_path(kind, dataset_id)
    if path is None or not os.path.exists(path):
        return None

    if kind == "word_cloud":
        # Word Cloud stores one entry per line, as plain text
        text, _, _ = ex_files.get_text(path)
        return [{"Text": line} for line in text.splitlines() if line.strip() != ""]
    return ex_files.load_records(path, exclude_keys=[RECORD_ID_KEY])


def dataset_csv(kind: str, dataset_id: str,
                start: datetime.datetime | None = None,
                end: datetime.datetime | None = None,
                columns: list[str] | None = None) -> tuple[str, str] | None:
    """Return the given dataset as CSV text and the file name to download it as, or None if it doesn't exist.

    The records can be limited to a time range and to the given columns.
    """

    records = dataset_records(kind, dataset_id)
    if records is None:
        return None

    records = ex_files.select_columns(ex_files.records_in_range(records, start, end), columns)
    details = describe_dataset(kind, dataset_id)
    prefix = "Word_Cloud_" if kind == "word_cloud" else ""
    return ex_files.json_list_to_csv(records), download_name(prefix + details["name"]) + ".csv"


def delete_dataset(kind: str, dataset_id: str) -> bool:
    """Delete the given dataset's records. Its name stays in the index, so it can collect data again."""

    path = dataset_path(kind, dataset_id)
    if path is None or not os.path.exists(path):
        return False
    with ex_config.text_file_lock:
        os.remove(path)
    return True
