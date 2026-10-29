"""Verify which definitions Apps lists, and that setup previews stay out of the list.

Setup pages save the definition being edited as __preview_<app>.json so the preview pane can show it.
A new definition has no 'app' until its first save, so its preview used to be logged as a broken
definition every time the list was read. Previews are only ever loaded directly by their ID.
"""

# Standard modules
import json
import logging

# Third-party modules
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
import exhibitera.apps.features.files as apps_files
import exhibitera.common.config as ex_config


@pytest.fixture
def definitions(tmp_path, monkeypatch):
    """Point user files at a temporary directory and return a function that writes a definition."""

    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    (tmp_path / "definitions").mkdir()

    def write(uuid: str, **fields):
        definition = {"uuid": uuid, **fields}
        (tmp_path / "definitions" / f"{uuid}.json").write_text(json.dumps(definition), encoding="UTF-8")
        return definition

    return write


def test_saved_definitions_are_listed_by_app(definitions):
    lobby = definitions("lobby", app="infostation", name="Lobby")
    definitions("fossils", app="media_browser", name="Fossils")

    assert apps_files.get_available_definitions("infostation") == {"lobby": lobby}
    assert set(apps_files.get_available_definitions()) == {"lobby", "fossils"}


@pytest.mark.parametrize("app_id", ["all", "infostation"])
def test_previews_are_not_listed(definitions, app_id, caplog):
    definitions("lobby", app="infostation", name="Lobby")
    definitions("__preview_infostation", name="")  # A new definition, not yet saved
    definitions("__preview_media_browser", app="media_browser", name="Fossils")

    with caplog.at_level(logging.WARNING):
        listed = apps_files.get_available_definitions(app_id)

    assert set(listed) == {"lobby"}
    assert caplog.text == ""


def test_definition_missing_its_app_is_still_reported(definitions, caplog):
    definitions("broken", name="Broken")

    with caplog.at_level(logging.ERROR):
        assert apps_files.get_available_definitions("infostation") == {}

    assert "broken.json" in caplog.text


def test_previews_can_still_be_loaded(definitions):
    preview = definitions("__preview_infostation", name="")

    response = TestClient(apps.app).get("/internal/definitions/__preview_infostation/load")

    assert response.json() == {"success": True, "definition": preview}
