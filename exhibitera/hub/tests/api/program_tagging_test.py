"""Verify that kiosk records sent with a location are tagged with the program running there.

A Voting Kiosk can be set to a location, which is one of Hub's groups. Programs also have a location, and run when a
schedule starts them, for their duration. When a record arrives with a location, Hub tags it with the program running
there at the record's time. If several are running, it's the one that started most recently. Downloads show the
program's name, in a Program column.

Visitors often vote as they leave, so a kiosk can also count votes for a few minutes after a program ends. A program
that starts in that time takes over, since it started more recently.
"""

# Standard modules
import datetime
import json

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.programs as hub_programs

KIOSK_APPEND = "/external/v6.1/datasets/kiosk/append"

# Friday, 13 November 2026
FRIDAY = "2026-11-13"


@pytest.fixture
def analyst(add_user):
    return add_user("analyst", analytics="view")


def add_program(uuid: str, name: str, location: str = "lobby", duration: int = 60):
    hub_config.program_list.append(hub_programs.Program({"uuid": uuid, "name": name, "location": location,
                                                         "duration": duration}))


def write_schedule(hub_env, name: str, programs: list[tuple[str, str]]):
    """Save a schedule that starts each (program UUID, time) given."""

    schedule = {f"e{i}": {"time": time, "action": "run_program", "target": [{"type": "program", "uuid": uuid}]}
                for i, (uuid, time) in enumerate(programs)}
    (hub_env / "schedules" / f"{name}.json").write_text(json.dumps(schedule), encoding="UTF-8")


def send_votes(client, time: str | None, location: str | None = "lobby", data_id: str = "d1",
               minutes_after: float | None = None) -> dict:
    """Send a Voting Kiosk record made at the given time on Friday, and return the record Hub saved."""

    data = {"Yes": 3, "No": 1}
    if time is not None:
        data["Date"] = f"{FRIDAY}T{time}"
    body = {"data_id": data_id, "name": "Exit vote", "app": "voting_kiosk", "data": data}
    if location is not None:
        body["location"] = location
    if minutes_after is not None:
        body["minutes_after_program"] = minutes_after
    assert client().post(KIOSK_APPEND, json=body).json()["success"] is True

    path = ex_files.get_path(["data", "kiosk", f"{data_id}.txt"], user_file=True)
    with open(path, "r", encoding="UTF-8") as f:
        return json.loads(f.read().splitlines()[-1])


def tag(client, time, **kwargs) -> str | None:
    return send_votes(client, time, **kwargs).get("_program")


# Which program is running

def test_a_record_during_a_program_is_tagged(client, hub_env):
    add_program("p1", "Planetarium show")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM")])

    assert tag(client, "10:30:00.000") == "p1"
    # The program runs from its start, for its duration
    assert tag(client, "10:00:00.000") == "p1"
    assert tag(client, "09:59:59.000") is None
    assert tag(client, "11:00:00.000") is None


def test_a_date_specific_schedule_replaces_the_weekday_one(client, hub_env):
    add_program("p1", "Planetarium show")
    add_program("p2", "Special screening")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM")])
    write_schedule(hub_env, FRIDAY, [("p2", "10:00 AM")])

    assert tag(client, "10:30:00.000") == "p2"


def test_programs_elsewhere_dont_count(client, hub_env):
    add_program("p1", "Planetarium show", location="dome")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM")])

    assert tag(client, "10:30:00.000") is None


def test_a_program_running_past_midnight(client, hub_env):
    add_program("p1", "Late show", duration=60)
    write_schedule(hub_env, "thursday", [("p1", "11:30 PM")])

    assert tag(client, "00:15:00.000") == "p1"
    assert tag(client, "00:45:00.000") is None


def test_the_program_that_started_most_recently(client, hub_env):
    add_program("p1", "Long tour", duration=120)
    add_program("p2", "Short talk", duration=60)
    write_schedule(hub_env, "friday", [("p1", "10:00 AM"), ("p2", "10:30 AM")])

    assert tag(client, "10:15:00.000") == "p1"
    assert tag(client, "10:45:00.000") == "p2"


def test_programs_that_no_longer_exist_dont_count(client, hub_env):
    write_schedule(hub_env, "friday", [("gone", "10:00 AM")])

    assert tag(client, "10:30:00.000") is None


@pytest.mark.parametrize("location", [None, ""])
def test_records_without_a_location_arent_tagged(client, hub_env, location):
    add_program("p1", "Planetarium show")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM")])

    assert "_program" not in send_votes(client, "10:30:00.000", location=location)


def test_records_without_a_time_use_when_hub_receives_them(client, hub_env):
    # A program that runs all day today
    add_program("p1", "All day", duration=24 * 60)
    write_schedule(hub_env, datetime.date.today().isoformat(), [("p1", "12:00 AM")])

    assert tag(client, None) == "p1"


# Votes after a program ends

def test_votes_soon_after_a_program_count(client, hub_env):
    add_program("p1", "Planetarium show")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM")])

    assert tag(client, "11:04:59.000", minutes_after=5) == "p1"
    assert tag(client, "11:05:00.000", minutes_after=5) is None
    # Without it, votes count only while the program runs
    assert tag(client, "11:01:00.000") is None
    assert tag(client, "11:01:00.000", minutes_after=0) is None


def test_the_next_program_takes_over(client, hub_env):
    add_program("p1", "Morning show")
    add_program("p2", "Midday show")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM"), ("p2", "11:02 AM")])

    assert tag(client, "11:01:00.000", minutes_after=5) == "p1"
    assert tag(client, "11:03:00.000", minutes_after=5) == "p2"


def test_votes_after_a_late_program_past_midnight(client, hub_env):
    add_program("p1", "Late show", duration=25)
    write_schedule(hub_env, "thursday", [("p1", "11:30 PM")])

    assert tag(client, "00:03:00.000", minutes_after=10) == "p1"


@pytest.mark.parametrize("minutes_after", [-1, 31, "soon"])
def test_the_time_after_must_be_up_to_30_minutes(client, hub_env, minutes_after):
    body = {"data_id": "d1", "name": "Exit vote", "app": "voting_kiosk", "data": {"Yes": 1},
            "location": "lobby", "minutes_after_program": minutes_after}

    assert client().post(KIOSK_APPEND, json=body).status_code == 422


# Downloads

def download(client, analyst, data_id="d1", **params) -> list[list[str]]:
    response = client(analyst).get(f"/internal/datasets/kiosk/{data_id}/csv", params=params).json()
    return [line.split(",") for line in response["csv"].splitlines()]


def column(rows, name) -> list[str]:
    index = rows[0].index(name)
    return [row[index] for row in rows[1:]]


def test_downloads_show_the_programs_name(client, hub_env, analyst):
    add_program("p1", "Planetarium show")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM")])
    send_votes(client, "10:30:00.000")
    send_votes(client, "12:00:00.000")
    # Renaming the program renames it in downloads
    hub_programs.get_program("p1").update({"name": "Star show"})

    rows = download(client, analyst)

    assert "_program" not in rows[0]
    assert column(rows, "Program") == ["Star show", ""]


def test_archived_and_deleted_programs(client, hub_env, analyst):
    add_program("p1", "Planetarium show")
    add_program("p2", "Old talk")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM"), ("p2", "2:00 PM")])
    send_votes(client, "10:30:00.000")
    send_votes(client, "14:30:00.000")
    hub_programs.archive_program("p1", "admin")
    hub_programs.remove_program("p2")

    # An archived program keeps its name. One deleted outright can only be shown by its UUID.
    assert column(download(client, analyst), "Program") == ["Planetarium show", "p2"]


def test_the_program_column_can_be_chosen(client, hub_env, analyst):
    add_program("p1", "Planetarium show")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM")])
    send_votes(client, "10:30:00.000")

    summary = client(analyst).get("/internal/datasets/kiosk/d1/summary").json()
    rows = download(client, analyst, columns=["Program", "Yes"])

    assert "Program" in summary["columns"] and "_program" not in summary["columns"]
    assert rows == [["Program", "Yes"], ["Planetarium show", "3"]]


def test_survey_kiosk_responses_are_tagged_too(client, hub_env):
    add_program("p1", "Planetarium show")
    write_schedule(hub_env, "friday", [("p1", "10:00 AM")])
    body = {"data_id": "s1", "name": "Exit survey", "app": "survey_kiosk",
            "data": {"Date": f"{FRIDAY}T11:03:00.000", "Enjoyed": "Yes"}, "location": "lobby", "minutes_after_program": 5}

    assert client().post(KIOSK_APPEND, json=body).json()["success"] is True
    with open(ex_files.get_path(["data", "kiosk", "s1.txt"], user_file=True), "r", encoding="UTF-8") as f:
        assert json.loads(f.read().splitlines()[-1])["_program"] == "p1"
