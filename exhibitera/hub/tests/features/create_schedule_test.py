"""Verify that creating a schedule writes it to the schedules folder and nowhere else."""

# Standard modules
import json
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.hub.features.schedules as hub_schedules

ENTRY = {"time": "10:00 AM", "action": "set_exhibit", "target": {"uuid": "test"}, "value": ""}


@pytest.fixture
def folders(tmp_path, monkeypatch):
    """Use separate temporary folders for user files and the working directory."""

    data = tmp_path / "data"
    working = tmp_path / "working"
    os.makedirs(data / "schedules")
    os.makedirs(working)
    monkeypatch.setattr(ex_config, "application_path", str(data))
    monkeypatch.chdir(working)
    return data, working


def read(path):
    with open(path, "r", encoding="UTF-8") as f:
        return json.load(f)


def test_new_schedule_is_written_to_schedules_folder(folders):
    data, working = folders

    success, schedule = hub_schedules.create_schedule("monday.json", {"event1": dict(ENTRY)})

    assert success is True
    assert schedule["event1"]["action"] == "set_exhibit"
    assert read(data / "schedules" / "monday.json") == schedule


def test_nothing_is_written_to_the_working_directory(folders):
    data, working = folders

    hub_schedules.create_schedule("monday.json", {"event1": dict(ENTRY)})

    assert os.listdir(working) == []


def test_existing_schedule_keeps_its_events(folders):
    data, working = folders
    hub_schedules.create_schedule("monday.json", {"event1": dict(ENTRY)})

    success, schedule = hub_schedules.create_schedule("monday.json", {"event2": dict(ENTRY, time="2:00 PM")})

    assert success is True
    assert set(schedule) == {"event1", "event2"}
    assert set(read(data / "schedules" / "monday.json")) == {"event1", "event2"}


# Saving several entries at once (as a CSV upload does)

def test_every_entry_is_saved(folders):
    data, working = folders
    entries = {f"event{i}": dict(ENTRY, time=f"{9 + i}:00 AM") for i in range(1, 4)}

    _, schedule = hub_schedules.create_schedule("monday.json", entries)

    assert set(schedule) == {"event1", "event2", "event3"}
    assert set(read(data / "schedules" / "monday.json")) == {"event1", "event2", "event3"}


@pytest.mark.parametrize("order", [["good", "invalid"], ["invalid", "good"]])
def test_invalid_entries_are_skipped(folders, order):
    data, working = folders
    candidates = {"good": dict(ENTRY), "invalid": {"value": "missing time and action"}}
    entries = {key: candidates[key] for key in order}

    _, schedule = hub_schedules.create_schedule("monday.json", entries)

    assert set(schedule) == {"good"}
    assert set(read(data / "schedules" / "monday.json")) == {"good"}


def test_missing_target_and_value_default_to_none(folders):
    _, schedule = hub_schedules.create_schedule("monday.json", {"event1": {"time": "10:00 AM", "action": "note"}})

    assert schedule["event1"]["target"] is None
    assert schedule["event1"]["value"] is None
    assert schedule["event1"]["time_in_seconds"] == 36000


def test_updating_with_no_entries_keeps_the_schedule(folders):
    data, working = folders
    hub_schedules.create_schedule("monday.json", {"event1": dict(ENTRY)})

    schedule = hub_schedules.update_json_schedule("monday.json", {})

    assert set(schedule) == {"event1"}
