"""Verify that Hub's repeating background tasks survive bad data and errors."""

# Standard modules
import datetime
import threading

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.schedules as hub_schedules


@pytest.fixture
def schedule_state(monkeypatch):
    """Reset the global schedule state and cancel any timers a test creates."""

    monkeypatch.setattr(hub_config, "schedule_timers", [])
    monkeypatch.setattr(hub_config, "json_next_event", [])
    monkeypatch.setattr(hub_config, "program_list", [])
    yield
    for timer in hub_config.schedule_timers:
        timer.cancel()


def good_event() -> dict:
    """Return an event two minutes from now, as load_json_schedule() would provide it."""

    time_str = (datetime.datetime.now() + datetime.timedelta(minutes=2)).isoformat()
    return {"action": "set_exhibit", "target": {"uuid": "test"}, "value": "",
            "time": time_str, "time_in_seconds": hub_schedules.seconds_from_midnight(time_str)}


BAD_EVENTS = [
    pytest.param({"action": "set_exhibit", "target": None, "value": ""}, id="missing time"),
    pytest.param({"action": "set_exhibit", "target": None, "value": "", "time": "not a time"}, id="unparsable time"),
    pytest.param({"target": None, "value": "", "time": "10:00"}, id="missing action"),
    pytest.param({"action": "set_exhibit", "time": "23:59:59"}, id="missing target and value"),
]


def queued_functions() -> list:
    return [timer.function for timer in hub_config.schedule_timers]


@pytest.mark.parametrize("bad_event", BAD_EVENTS)
def test_bad_event_does_not_stop_schedule(monkeypatch, schedule_state, bad_event):
    schedule = {"bad": bad_event, "good": good_event()}
    monkeypatch.setattr(hub_config, "json_schedule_list", [{"schedule": schedule}])

    hub_schedules.queue_json_schedule(schedule)

    functions = queued_functions()
    assert functions.count(hub_schedules.retrieve_json_schedule) == 1  # Tomorrow's reload
    assert functions.count(hub_schedules.execute_scheduled_action) == 1  # The good event


@pytest.mark.parametrize("bad_event", BAD_EVENTS)
def test_bad_event_does_not_hide_next_action(monkeypatch, schedule_state, bad_event):
    good = good_event()
    monkeypatch.setattr(hub_config, "json_schedule_list", [{"schedule": {"bad": bad_event, "good": good}}])

    assert hub_schedules.get_next_scheduled_action() == [good]


def test_valid_schedule_queues_every_event(monkeypatch, schedule_state):
    schedule = {"first": good_event(), "second": good_event()}
    monkeypatch.setattr(hub_config, "json_schedule_list", [{"schedule": schedule}])

    hub_schedules.queue_json_schedule(schedule)

    functions = queued_functions()
    assert functions.count(hub_schedules.retrieve_json_schedule) == 1
    assert functions.count(hub_schedules.execute_scheduled_action) == 2


def test_latency_polling_survives_a_failed_check(monkeypatch):
    component = hub_components.ExhibitComponent("Test", ["G1"], category="static")
    component.ip_address = "10.0.0.1"

    checks = []
    finished = threading.Event()

    def flaky_check(ip_address):
        checks.append(ip_address)
        if len(checks) == 1:
            raise RuntimeError("network unavailable")
        return True, 5.0

    def fake_sleep(seconds):
        if len(checks) >= 2:
            finished.set()
            threading.Event().wait()  # Park the daemon polling thread so it makes no further checks

    monkeypatch.setattr(hub_components, "ip_address_alive", flaky_check)
    monkeypatch.setattr(hub_components.time, "sleep", fake_sleep)

    component.poll_latency()
    assert finished.wait(timeout=5)
    component.latency_timer.cancel()

    assert len(checks) == 2
    assert component.latency == 5.0
