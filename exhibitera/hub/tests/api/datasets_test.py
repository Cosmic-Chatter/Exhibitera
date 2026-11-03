"""Verify how Hub stores collected data: by ID rather than by name.

Flexible Tracker records are stored under their template's UUID, Voting and Survey Kiosk records under
their definition's data ID, and Word Cloud text under an ID for its collection name. Names are only used
for display and for the downloaded file's name, so any name works and renaming doesn't split the data.
Deleting a template archives it, so its data can still be found and downloaded by name.

Files written through the Core API, or by Apps 6.0, are stored by name as before and never moved.
"""

# Standard modules
import json
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.datasets as hub_datasets
import exhibitera.hub.features.legacy as hub_legacy

KIOSK_APPEND = "/external/v6.1/datasets/kiosk/append"
WORD_CLOUD_APPEND = "/external/v6.1/datasets/wordCloud/append"
WORD_CLOUD_TEXT = "/external/v6.1/datasets/wordCloud/text"


@pytest.fixture
def analyst(add_user):
    return add_user("analyst", analytics="edit")


def write_template(hub_env, uuid: str, name: str) -> dict:
    template = {"uuid": uuid, "name": name, "widget_order": [], "widgets": {}}
    path = hub_env / "flexible-tracker" / "templates" / f"{uuid}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(template), encoding="UTF-8")
    return template


def read_lines(path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="UTF-8").splitlines() if line.strip()]


def dataset_list(client, token) -> dict:
    return client(token).get("/internal/datasets/list").json()


def listed(client, token, kind: str) -> dict:
    """Return {id: entry} for the listed datasets of the given kind."""

    return {d["id"]: d for d in dataset_list(client, token)["datasets"] if d["kind"] == kind}


# Flexible Tracker

def test_tracker_records_are_stored_by_template_uuid(client, hub_env):
    write_template(hub_env, "t1", "Q1: Lobby/East?")

    response = client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 3}})

    assert response.json()["success"] is True
    assert read_lines(hub_env / "data" / "tracker" / "t1.txt") == [{"Visitors": 3}]


def test_tracker_records_for_unknown_templates_are_refused(client, hub_env):
    response = client().post("/internal/datasets/tracker/missing/append", json={"data": {"Visitors": 3}})

    assert response.json() == {"success": False, "reason": "unknown_template"}
    assert not (hub_env / "data" / "tracker" / "missing.txt").exists()


def test_tracker_records_sent_twice_are_saved_once(client, hub_env):
    # A tracker that loses Hub's reply sends the record again, with the same ID
    write_template(hub_env, "t1", "Lobby")
    body = {"data": {"Visitors": 3}, "record_id": "r1"}

    first = client().post("/internal/datasets/tracker/t1/append", json=body).json()
    second = client().post("/internal/datasets/tracker/t1/append", json=body).json()
    client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 4}, "record_id": "r2"})
    client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 5}})

    assert first["success"] is True
    assert second["success"] is True
    assert [line["Visitors"] for line in read_lines(hub_env / "data" / "tracker" / "t1.txt")] == [3, 4, 5]


def test_record_ids_are_left_out_of_downloads(client, hub_env, analyst):
    write_template(hub_env, "t1", "Lobby")
    client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 3}, "record_id": "r1"})

    csv = client(analyst).get("/internal/datasets/tracker/t1/csv").json()["csv"]

    assert "r1" not in csv
    assert "record_id" not in csv
    assert "Visitors" in csv


def test_tracker_data_is_listed_and_downloaded_by_template_name(client, hub_env, analyst):
    write_template(hub_env, "t1", "Q1: Lobby/East?")
    client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 3}})

    entry = listed(client, analyst, "tracker")["t1"]
    download = client(analyst).get("/internal/datasets/tracker/t1/csv").json()

    assert entry == {"kind": "tracker", "id": "t1", "name": "Q1: Lobby/East?", "app": "flexible_tracker",
                     "archived": False}
    assert download["success"] is True
    assert download["filename"] == "Q1_ Lobby_East_.csv"
    assert "Visitors" in download["csv"]


def test_deleting_a_template_archives_it_and_keeps_its_data(client, hub_env, analyst):
    write_template(hub_env, "t1", "Gallery flow")
    client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 3}})

    response = client(analyst).delete("/internal/tracker/template/t1")
    analyst_uuid = hub_config.user_list[-1].uuid

    assert response.json()["success"] is True
    assert not (hub_env / "flexible-tracker" / "templates" / "t1.json").exists()
    assert client().get("/internal/tracker/templates/list").json() == []
    archive = json.loads((hub_env / "flexible-tracker" / "archived.json").read_text(encoding="UTF-8"))
    # As for programs, the archiving user is recorded by UUID
    assert [(t["uuid"], t["name"], t["archivedUsername"]) for t in archive] == [("t1", "Gallery flow", analyst_uuid)]
    assert "archiveDate" in archive[0]

    assert read_lines(hub_env / "data" / "tracker" / "t1.txt") == [{"Visitors": 3}]
    assert listed(client, analyst, "tracker")["t1"]["archived"] is True
    assert client(analyst).get("/internal/datasets/tracker/t1/csv").json()["filename"] == "Gallery flow.csv"


def test_open_trackers_can_still_record_after_their_template_is_archived(client, hub_env, analyst):
    # A tracker page opened before the template was deleted shouldn't lose its next record
    write_template(hub_env, "t1", "Gallery flow")
    client(analyst).delete("/internal/tracker/template/t1")

    response = client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 1}})

    assert response.json()["success"] is True


def test_deleting_a_dataset_removes_only_its_data(client, hub_env, analyst):
    write_template(hub_env, "t1", "Gallery flow")
    client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 3}})

    response = client(analyst).delete("/internal/datasets/tracker/t1")

    assert response.json()["success"] is True
    assert not (hub_env / "data" / "tracker" / "t1.txt").exists()
    assert (hub_env / "flexible-tracker" / "templates" / "t1.json").exists()
    assert "t1" not in listed(client, analyst, "tracker")


# Voting and Survey Kiosk

def kiosk_record(client, data_id, name, app="survey_kiosk", data=None):
    body = {"data_id": data_id, "name": name, "app": app, "data": data or {"Answer": "Yes"}}
    return client().post(KIOSK_APPEND, json=body).json()


def test_kiosk_records_are_stored_by_data_id(client, hub_env, analyst):
    assert kiosk_record(client, "d1", "Lobby survey: 2026/27")["success"] is True
    kiosk_record(client, "d1", "Lobby survey (renamed)", data={"Answer": "No"})

    assert read_lines(hub_env / "data" / "kiosk" / "d1.txt") == [{"Answer": "Yes"}, {"Answer": "No"}]
    entry = listed(client, analyst, "kiosk")["d1"]
    assert entry == {"kind": "kiosk", "id": "d1", "name": "Lobby survey (renamed)", "app": "survey_kiosk",
                     "archived": False}
    assert client(analyst).get("/internal/datasets/kiosk/d1/csv").json()["filename"] == "Lobby survey (renamed).csv"


def test_first_kiosk_record_claims_the_old_file_with_its_name(client, hub_env):
    old_file = hub_env / "data" / "Lobby survey.txt"
    old_file.write_text('{"Answer": "Old"}\n', encoding="UTF-8")

    kiosk_record(client, "d1", "Lobby survey")
    # A different definition with the same name doesn't claim it again
    kiosk_record(client, "d2", "Lobby survey", data={"Answer": "Other"})

    assert not old_file.exists()
    assert read_lines(hub_env / "data" / "kiosk" / "d1.txt") == [{"Answer": "Old"}, {"Answer": "Yes"}]
    assert read_lines(hub_env / "data" / "kiosk" / "d2.txt") == [{"Answer": "Other"}]


def test_definitions_without_a_data_id_share_one_dataset_per_name(client, hub_env, analyst):
    # Definitions made before data IDs existed send only their name
    (hub_env / "data" / "Atrium vote.txt").write_text('{"Choice": "A"}\n', encoding="UTF-8")

    kiosk_record(client, None, "Atrium vote", app="voting_kiosk", data={"Choice": "B"})
    kiosk_record(client, None, "Atrium vote", app="voting_kiosk", data={"Choice": "C"})

    kiosk = listed(client, analyst, "kiosk")
    assert len(kiosk) == 1
    [(dataset_id, entry)] = kiosk.items()
    assert entry["name"] == "Atrium vote"
    assert entry["app"] == "voting_kiosk"
    assert read_lines(hub_env / "data" / "kiosk" / f"{dataset_id}.txt") == [{"Choice": "A"}, {"Choice": "B"},
                                                                           {"Choice": "C"}]


@pytest.mark.parametrize("body", [{"data_id": "../escape", "name": "x", "app": "survey_kiosk", "data": {}},
                                  {"data_id": "d1", "name": "x", "app": "not_an_app", "data": {}}])
def test_invalid_kiosk_records_are_refused(client, hub_env, body):
    assert client().post(KIOSK_APPEND, json=body).json()["success"] is False
    assert not (hub_env / "escape.txt").exists()


# Word Cloud

def test_word_cloud_text_is_stored_by_collection_name(client, hub_env):
    collection = "Lobby: what did you like?"

    client().post(WORD_CLOUD_APPEND, json={"collection": collection, "text": "dinosaurs"})
    client().post(WORD_CLOUD_APPEND, json={"collection": collection, "text": "tornado"})
    text = client().get(WORD_CLOUD_TEXT, params={"collection": collection}).json()

    assert text == {"success": True, "text": "dinosaurs\ntornado\n"}
    assert client().get(WORD_CLOUD_TEXT, params={"collection": "Another"}).json() == {"success": True, "text": ""}


def test_word_cloud_claims_the_old_collection_file(client, hub_env, analyst):
    old_file = hub_env / "data" / "Word_Cloud_Lobby.txt"
    old_file.write_text("fossils\n", encoding="UTF-8")

    text = client().get(WORD_CLOUD_TEXT, params={"collection": "Lobby"}).json()["text"]

    assert text == "fossils\n"
    assert not old_file.exists()
    [entry] = listed(client, analyst, "word_cloud").values()
    assert (entry["name"], entry["app"]) == ("Lobby", "word_cloud")
    assert client(analyst).get(f"/internal/datasets/word_cloud/{entry['id']}/csv").json()["filename"] == \
        "Word_Cloud_Lobby.csv"


# Other files

def test_core_api_files_are_untouched_and_listed_as_files(client, hub_env, analyst):
    client().post("/core/data/sensor log/rawText", json={"text": "12.5"})
    core_file = hub_env / "data" / "sensor log.txt"
    written = core_file.read_text(encoding="UTF-8")
    write_template(hub_env, "t1", "Gallery flow")
    client().post("/internal/datasets/tracker/t1/append", json={"data": {"Visitors": 3}})

    response = dataset_list(client, analyst)

    assert core_file.read_text(encoding="UTF-8") == written
    assert response["files"] == ["sensor log"]
    assert {d["id"] for d in response["datasets"]} == {"t1"}


# Migration of tracker data stored by name

def test_migration_moves_tracker_data_to_its_template(hub_env):
    write_template(hub_env, "t1", "Gallery flow")
    write_template(hub_env, "t2", "Twin")
    write_template(hub_env, "t3", "Twin")
    data = hub_env / "data"
    (data / "Gallery flow.txt").write_text('{"Visitors": 1}\n', encoding="UTF-8")
    (data / "Twin.txt").write_text('{"Visitors": 2}\n', encoding="UTF-8")
    (data / "sensor log.txt").write_text("12.5\n", encoding="UTF-8")

    hub_legacy.move_tracker_data_to_template_ids()
    hub_legacy.move_tracker_data_to_template_ids()  # Running again changes nothing

    assert read_lines(data / "tracker" / "t1.txt") == [{"Visitors": 1}]
    assert not (data / "Gallery flow.txt").exists()
    # Two templates share this name, so it's left for staff to sort out
    assert (data / "Twin.txt").exists()
    assert not (data / "tracker" / "t2.txt").exists()
    assert (data / "sensor log.txt").read_text(encoding="UTF-8") == "12.5\n"


@pytest.mark.parametrize("name, expected", [("Q1: Lobby/East?", "Q1_ Lobby_East_"), ('a<b>c"d|e*f\\g', "a_b_c_d_e_f_g"),
                                            ("Plain name", "Plain name"), ("", "data"), ("CON", "CON_")])
def test_download_names_replace_forbidden_characters(name, expected):
    assert hub_datasets.download_name(name) == expected


# Subsets
#
# The console can download part of a dataset: the records in a time range, with chosen columns. Times are
# given to the minute, and the end includes its whole minute.

SUBSET_RECORDS = [{"Date": "2026-10-01T09:30:00.000", "Gallery": "North", "Visitors": 3, "Topics": ["Fossils"]},
                  {"Date": "2026-10-02T14:05:30.500", "Gallery": "South", "Visitors": 5, "Topics": ["Fossils", "Gems"]},
                  {"Date": "2026-10-03T16:45:59.900", "Gallery": "North", "Visitors": 2},
                  {"Gallery": "East", "Visitors": 1}]


def csv_lines(response) -> list[str]:
    return response.json()["csv"].strip().splitlines()


@pytest.fixture
def subset_dataset(client, hub_env):
    write_template(hub_env, "t1", "Lobby")
    for i, record in enumerate(SUBSET_RECORDS):
        client().post("/internal/datasets/tracker/t1/append", json={"data": record, "record_id": f"r{i}"})
    return "/internal/datasets/tracker/t1"


def test_summary_lists_columns_and_time_range(client, analyst, subset_dataset):
    summary = client(analyst).get(subset_dataset + "/summary").json()

    assert summary == {"success": True, "columns": ["Date", "Gallery", "Topics", "Visitors"],
                       "first": "2026-10-01T09:30:00", "last": "2026-10-03T16:45:59.900000", "count": 4}


def test_summary_counts_records_in_a_time_range(client, analyst, subset_dataset):
    def count(**params):
        return client(analyst).get(subset_dataset + "/summary", params=params).json()["count"]

    # The end includes its whole minute. Records without a time are left out once there's a range.
    assert count(start="2026-10-02T14:05", end="2026-10-03T16:45") == 2
    assert count(start="2026-10-02T14:06") == 1
    assert count(end="2026-10-01T09:30") == 1
    assert count() == 4


def test_csv_can_be_limited_to_a_time_range_and_columns(client, analyst, subset_dataset):
    response = client(analyst).get(subset_dataset + "/csv", params={
        "start": "2026-10-02T00:00", "end": "2026-10-03T23:59", "columns": ["Date", "Topics"]})

    lines = csv_lines(response)
    assert response.json()["success"] is True
    # Multiple-choice columns are still expanded into one column per choice
    assert lines[0] == "Date,Topics - Fossils,Topics - Gems"
    assert len(lines) == 3
    assert "Visitors" not in response.json()["csv"]
    assert response.json()["filename"] == "Lobby.csv"


def test_csv_without_a_subset_is_unchanged(client, analyst, subset_dataset):
    lines = csv_lines(client(analyst).get(subset_dataset + "/csv"))

    assert lines[0].startswith("Date,Gallery,")
    assert len(lines) == 5


def test_an_end_date_includes_the_whole_day(client, analyst, subset_dataset):
    summary = client(analyst).get(subset_dataset + "/summary", params={"start": "2026-10-02", "end": "2026-10-03"}).json()

    assert summary["count"] == 2


@pytest.mark.parametrize("time", ["2026-10-02T00:00Z", "2026-10-02T00:00+02:00"])
def test_times_with_a_time_zone_are_refused(client, analyst, subset_dataset, time):
    # Records are stored in local time, without a time zone, so they can't be compared
    summary = client(analyst).get(subset_dataset + "/summary", params={"start": time}).json()
    download = client(analyst).get(subset_dataset + "/csv", params={"end": time}).json()

    assert summary == {"success": False, "reason": "invalid_time"}
    assert download["reason"] == "invalid_time"


def test_invalid_times_are_refused(client, analyst, subset_dataset):
    summary = client(analyst).get(subset_dataset + "/summary", params={"start": "yesterday"}).json()
    download = client(analyst).get(subset_dataset + "/csv", params={"end": "2026-13-45T99:00"}).json()

    assert summary == {"success": False, "reason": "invalid_time"}
    assert download["success"] is False
    assert download["reason"] == "invalid_time"


def test_word_cloud_summary_has_no_times(client, hub_env, analyst):
    client().post(WORD_CLOUD_APPEND, json={"collection": "Lobby", "text": "fossils"})
    [entry] = listed(client, analyst, "word_cloud").values()

    summary = client(analyst).get(f"/internal/datasets/word_cloud/{entry['id']}/summary").json()

    assert summary == {"success": True, "columns": ["Text"], "first": None, "last": None, "count": 1}


def test_other_files_can_be_downloaded_in_part(client, hub_env, analyst):
    for record in SUBSET_RECORDS:
        client().post("/internal/data/sensor log/append", json={"data": record})

    summary = client(analyst).get("/internal/data/sensor log/summary", params={"start": "2026-10-03T00:00"}).json()
    lines = csv_lines(client(analyst).get("/internal/data/sensor log/csv", params={
        "start": "2026-10-03T00:00", "columns": ["Gallery"]}))

    assert (summary["count"], summary["columns"]) == (1, ["Date", "Gallery", "Topics", "Visitors"])
    assert lines == ["Gallery", "North"]


def test_unknown_datasets_have_no_summary(client, analyst):
    assert client(analyst).get("/internal/datasets/tracker/missing/summary").json() == \
        {"success": False, "reason": "unknown_dataset"}
