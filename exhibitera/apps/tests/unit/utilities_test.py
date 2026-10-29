"""Verify that Apps handles missing or malformed configuration files."""

# Standard modules
import copy
import json
import logging
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.utilities as apps_utilities
import exhibitera.common.config as ex_config


@pytest.fixture
def config_dir(tmp_path, monkeypatch):
    """Point user files at a temporary directory and restore the global state afterward."""

    os.makedirs(tmp_path / "configuration")
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    monkeypatch.setattr(apps_config, "defaults", None)
    monkeypatch.setattr(apps_config, "smart_restart", copy.deepcopy(apps_config.smart_restart))

    root = logging.getLogger()
    original_level = root.level
    yield tmp_path / "configuration"
    root.setLevel(original_level)


def write_config(config_dir, contents: str):
    with open(config_dir / "config.json", "w", encoding="UTF-8") as f:
        f.write(contents)


def test_missing_config_returns_false(config_dir):
    assert apps_utilities.load_configuration() is False


@pytest.mark.parametrize("contents", ["", '{"system": {"debug": tr', "[1, 2, 3]"])
def test_malformed_config_returns_false(config_dir, contents):
    write_config(config_dir, contents)

    assert apps_utilities.load_configuration() is False


def test_config_without_system_section_loads(config_dir):
    write_config(config_dir, json.dumps({"app": {"uuid": "test"}}))

    assert apps_utilities.load_configuration() is True
    assert apps_config.defaults == {"app": {"uuid": "test"}, "system": {"remote_display": True}}


@pytest.mark.parametrize("system, expected", [({}, True), ({"remote_display": False}, False),
                                              ({"remote_display": True}, True)])
def test_remote_display_setting_is_always_present(config_dir, system, expected):
    # Apps' pages treat a missing setting as False, while the server treats it as True. Opening the app
    # window when the server has only a remote display window closes Apps.
    write_config(config_dir, json.dumps({"app": {"uuid": "test"}, "system": system}))

    apps_utilities.load_configuration()

    assert apps_config.defaults["system"]["remote_display"] is expected


def test_valid_config_applies_settings(config_dir):
    write_config(config_dir, json.dumps({
        "app": {"uuid": "test"},
        "system": {"debug": True, "active_hours": {"start": "8:00", "end": "18:00"}}
    }))

    assert apps_utilities.load_configuration() is True
    assert apps_config.smart_restart["active_hours_start"] == "8:00"
    assert apps_config.smart_restart["active_hours_end"] == "18:00"
    assert logging.getLogger().level == logging.DEBUG


# Falling back to the last working configuration
#
# A typo in a hand-edited config.json would otherwise send Apps to first-time setup, which shows the
# setup wizard on the visitor screen and gives the computer a new identity in Hub.

GOOD_CONFIG = {"app": {"uuid": "kiosk-uuid", "id": "Kiosk", "definition": "def-A"},
               "system": {"remote_display": True, "standalone": True}}


def read_json(path):
    with open(path, encoding="UTF-8") as f:
        return json.load(f)


def test_loading_a_good_config_keeps_a_copy(config_dir):
    write_config(config_dir, json.dumps(GOOD_CONFIG))

    apps_utilities.load_configuration()

    assert read_json(config_dir / "config.json.backup") == GOOD_CONFIG


def test_saving_the_config_updates_the_copy(config_dir):
    write_config(config_dir, json.dumps(GOOD_CONFIG))
    apps_utilities.load_configuration()

    apps_utilities.update_configuration({"app": {"definition": "def-B"}})

    assert read_json(config_dir / "config.json.backup")["app"]["definition"] == "def-B"


@pytest.mark.parametrize("contents", ["", '{"app": {"id": "Kiosk",}}', "[1, 2, 3]"])
def test_broken_config_falls_back_to_the_last_working_one(config_dir, contents, caplog):
    write_config(config_dir, json.dumps(GOOD_CONFIG))
    apps_utilities.load_configuration()
    write_config(config_dir, contents)

    with caplog.at_level(logging.ERROR):
        assert apps_utilities.load_configuration() is True

    assert apps_config.defaults["app"]["uuid"] == "kiosk-uuid"
    assert apps_config.defaults["app"]["definition"] == "def-A"
    assert "config.json.invalid" in caplog.text


def test_broken_config_is_kept_for_staff_to_fix(config_dir):
    write_config(config_dir, json.dumps(GOOD_CONFIG))
    apps_utilities.load_configuration()
    write_config(config_dir, '{"app": {"id": "Kiosk",}}')

    apps_utilities.load_configuration()

    assert (config_dir / "config.json.invalid").read_text(encoding="UTF-8") == '{"app": {"id": "Kiosk",}}'
    assert read_json(config_dir / "config.json") == GOOD_CONFIG


def test_broken_config_without_a_copy_still_starts_setup(config_dir):
    write_config(config_dir, '{"app": {"id": "Kiosk",}}')

    assert apps_utilities.load_configuration() is False


def test_broken_copy_is_not_used(config_dir):
    write_config(config_dir, "")
    (config_dir / "config.json.backup").write_text("[]", encoding="UTF-8")

    assert apps_utilities.load_configuration() is False
