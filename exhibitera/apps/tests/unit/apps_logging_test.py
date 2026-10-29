"""Verify that Apps records problems and actions in its log file, not only in a console.

Packaged builds have no console, and exhibits run unattended, so the log is often the only record of
why a thumbnail failed or a restart didn't happen. Only the command-line setup and the startup
messages are printed, since they're meant for someone at a terminal.
"""

# Standard modules
import json
import logging
import re

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.files as apps_files
import exhibitera.apps.features.system as apps_system
import exhibitera.common.config as ex_config
from exhibitera.common.tests import api_scanning

APPS_DIR = api_scanning.EXHIBITERA_DIR / "apps"

# Printing is fine here: the interactive command-line setup, and the startup messages
PRINT_ALLOWED_FILES = {"features/utilities.py"}
PRINT_ALLOWED_LINES = ["Bootstrapping server", "Starting Exhibitera Apps on port"]


def test_apps_logs_instead_of_printing():
    offenders = []
    for path in sorted(APPS_DIR.rglob("*.py")):
        relative = path.relative_to(APPS_DIR).as_posix()
        if relative.startswith("tests/") or relative in PRINT_ALLOWED_FILES:
            continue
        for number, line in enumerate(path.read_text(encoding="UTF-8").split("\n"), start=1):
            if re.search(r"\bprint\(", line) and not any(allowed in line for allowed in PRINT_ALLOWED_LINES):
                offenders.append(f"{relative}:{number}: {line.strip()}")

    assert offenders == []


def test_apps_has_one_debug_setting():
    # Apps follows the debug setting in config.json, which is stored in the shared config
    assert not hasattr(apps_config, "debug")


@pytest.fixture
def permissions(monkeypatch):
    commands = []
    monkeypatch.setattr(apps_system.os, "system", commands.append)
    monkeypatch.setattr(apps_config, "defaults", {"permissions": {}})

    def set_permissions(**values):
        apps_config.defaults["permissions"] = values
        return commands

    return set_permissions


def test_restart_is_logged(permissions, caplog):
    commands = permissions(restart=True)

    with caplog.at_level(logging.INFO):
        apps_system.reboot()

    assert len(commands) == 1
    assert "Restarting" in caplog.text


def test_refused_restart_is_logged(permissions, caplog):
    commands = permissions(restart=False)

    with caplog.at_level(logging.INFO):
        apps_system.reboot()

    assert commands == []
    assert "Restart requested but not permitted" in caplog.text


def test_shutdown_is_logged(permissions, caplog):
    permissions(shutdown=True)

    with caplog.at_level(logging.INFO):
        apps_system.shutdown()

    assert "Shutting down" in caplog.text


@pytest.fixture
def user_files(tmp_path, monkeypatch):
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    (tmp_path / "definitions").mkdir()
    (tmp_path / "content").mkdir()
    return tmp_path


def test_definition_without_an_app_is_logged_by_name(user_files, caplog):
    (user_files / "definitions" / "broken.json").write_text(json.dumps({"uuid": "broken"}), encoding="UTF-8")

    with caplog.at_level(logging.ERROR):
        result = apps_files.get_available_definitions("media_player")

    assert result == {}
    assert "broken.json" in caplog.text


def test_deleting_a_file_is_logged(user_files, caplog):
    (user_files / "content" / "old.jpg").write_bytes(b"")

    with caplog.at_level(logging.INFO):
        apps_files.delete_file("old.jpg")

    assert not (user_files / "content" / "old.jpg").exists()
    assert "old.jpg" in caplog.text
