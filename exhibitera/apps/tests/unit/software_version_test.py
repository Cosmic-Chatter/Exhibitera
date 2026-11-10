"""Verify that Apps tells Hub its version, however it was started.

Apps used to load its version only when it started with a configuration file. A new installation, which starts with
first-time setup, reported no version, and Hub's component dialog showed "undefined.undefined.undefined".
"""

# Standard modules
import json

# Third-party modules
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
import exhibitera.apps.config as apps_config
import exhibitera.common.files as ex_files


@pytest.fixture
def version_not_loaded(monkeypatch):
    """Start as Apps does after first-time setup, without having loaded its version."""

    monkeypatch.setattr(apps_config, "software_version", {})


def installed_version() -> dict:
    with open(ex_files.get_path(["_static", "semantic_version.json"]), "r", encoding="UTF-8") as f:
        return json.load(f)["version"]


def test_platform_details_include_the_version(version_not_loaded):
    details = TestClient(apps.app).get("/internal/system/platformDetails").json()

    assert details["exhibitera_version"] == installed_version()
    assert set(details["exhibitera_version"]) == {"major", "minor", "patch"}
