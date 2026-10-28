"""Verify Smart Restart's connection checks and what they log.

Smart Restart restarts the computer when Hub has been unreachable for too long, which is usually
because the Wi-Fi dropped. If Hub has never been reached since Apps started, it doesn't restart,
since a restart wouldn't help a computer that was never connected.
"""

# Standard modules
import copy
import datetime
import logging
import re

# Third-party modules
import pytest
import requests

# Exhibitera modules
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.system as apps_system


@pytest.fixture
def smart_restart(monkeypatch):
    """Run one connection check at a time against an unreachable Hub, without restarting anything."""

    monkeypatch.setattr(apps_config, "smart_restart", copy.deepcopy(apps_config.smart_restart))
    monkeypatch.setattr(apps_config, "defaults", {"system": {"standalone": False},
                                                  "control_server": {"ip_address": "localhost", "port": 8082}})

    class NoTimer:
        daemon = False

        def __init__(self, *args):
            pass

        def start(self):
            pass

    monkeypatch.setattr(apps_system.threading, "Timer", NoTimer)

    def unreachable(*args, **kwargs):
        raise requests.exceptions.ConnectionError("Hub is unreachable")

    monkeypatch.setattr(apps_system.requests, "get", unreachable)

    restarts = []
    monkeypatch.setattr(apps_system, "smart_restart_act", lambda: restarts.append(True))
    return restarts


def test_never_contacting_hub_logs_clearly_and_does_not_restart(smart_restart, caplog, capsys):
    with caplog.at_level(logging.WARNING):
        apps_system.smart_restart_check()

    messages = [record.getMessage() for record in caplog.records] + [capsys.readouterr().out]
    assert not any(re.search(r"-\d", message) for message in messages)
    assert "not reached Hub since Apps started" in caplog.text
    assert smart_restart == []


def test_losing_contact_logs_the_seconds_since_last_contact(smart_restart, caplog):
    apps_config.smart_restart["last_contact_datetime"] = datetime.datetime.now() - datetime.timedelta(seconds=120)

    with caplog.at_level(logging.WARNING):
        apps_system.smart_restart_check()

    seconds = float(caplog.records[0].args[0])
    assert 119 <= seconds < 130
    assert smart_restart == []


def test_losing_contact_past_the_threshold_restarts(smart_restart):
    apps_config.smart_restart["last_contact_datetime"] = datetime.datetime.now() - datetime.timedelta(
        seconds=apps_config.smart_restart["threshold"] + 60)

    apps_system.smart_restart_check()

    assert smart_restart == [True]


def test_reaching_hub_records_the_contact(smart_restart, monkeypatch):
    monkeypatch.setattr(apps_system.requests, "get", lambda *args, **kwargs: None)

    apps_system.smart_restart_check()

    contact = apps_config.smart_restart["last_contact_datetime"]
    assert (datetime.datetime.now() - contact).total_seconds() < 5
