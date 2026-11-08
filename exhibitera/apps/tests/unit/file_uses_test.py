"""Verify how Apps finds the definitions that use a content file, so the file picker can warn before it's deleted.

Every text value in a definition is searched, rather than the fields each app is known to use, so a field added
later, such as an attractor, isn't missed. A file counts as used when a value is its name, or refers to it as
/content/<name>, as fonts and Markdown text do. Timelapse Viewer lists its files with a wildcard pattern.
"""

# Standard modules
import json

# Third-party modules
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
import exhibitera.common.config as ex_config


@pytest.fixture
def user_files(tmp_path, monkeypatch):
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    for folder in ["definitions", "content"]:
        (tmp_path / folder).mkdir(parents=True)
    return tmp_path


def add_definition(user_files, uuid, name, app, **fields):
    definition = {"uuid": uuid, "name": name, "app": app, **fields}
    (user_files / "definitions" / f"{uuid}.json").write_text(json.dumps(definition), encoding="UTF-8")


def uses(*files):
    return TestClient(apps.app).post("/internal/files/usage", json={"files": list(files)}).json()


def test_files_named_in_a_definition_are_in_use(user_files):
    add_definition(user_files, "d1", "Lobby loop", "media_player",
                   content={"i1": {"type": "file", "filename": "fossil.jpg"}})

    assert uses("fossil.jpg", "shell.jpg") == {
        "success": True,
        "usage": {"fossil.jpg": [{"uuid": "d1", "name": "Lobby loop", "app": "media_player"}]}}


def test_every_definition_using_a_file_is_listed_by_name(user_files):
    add_definition(user_files, "d1", "Lobby loop", "media_player", watermark={"file": "logo.png"})
    # An attractor, which the list of a definition's content used to miss
    add_definition(user_files, "d2", "Fossil hall", "timeline_explorer", attractor="logo.png")
    add_definition(user_files, "d3", "Gallery", "infostation", behavior={"attractor": "intro.mp4"})

    assert uses("logo.png")["usage"] == {"logo.png": [
        {"uuid": "d2", "name": "Fossil hall", "app": "timeline_explorer"},
        {"uuid": "d1", "name": "Lobby loop", "app": "media_player"}]}


@pytest.mark.parametrize("value, used", [
    ("Lobby.ttf", True),
    ("/content/Lobby.ttf", True),
    # Markdown text, with a title or without
    ("# Fossils\n![left 50](/content/My photo.jpg) and more", True),
    ('![left 50](/content/My photo.jpg "A fossil")', True),
    # Similar names
    ("/content/My photo.jpg.bak", False),
    ("Not My photo.jpg", False),
    ("/_fonts/Noto/Lobby.ttf", False),
    ("photo.jpg", False)])
def test_references_to_a_file(user_files, value, used):
    add_definition(user_files, "d1", "Lobby", "infostation", style={"font": {"header": value}})

    usage = uses("Lobby.ttf", "My photo.jpg")["usage"]

    assert (usage != {}) is used


def test_timelapse_files_match_its_pattern(user_files):
    add_definition(user_files, "d1", "Construction", "timelapse_viewer", files="frame_*.jpg")

    assert set(uses("frame_001.jpg", "frame_002.jpg", "frame.jpg", "other_frame_001.jpg")["usage"]) == {
        "frame_001.jpg", "frame_002.jpg"}


def test_previews_dont_count(user_files):
    # The setup pages save previews of definitions being edited, which aren't real definitions
    add_definition(user_files, "__preview_media_player", "Preview", "media_player",
                   content={"i1": {"type": "file", "filename": "fossil.jpg"}})

    assert uses("fossil.jpg") == {"success": True, "usage": {}}


def test_damaged_definitions_are_skipped(user_files):
    (user_files / "definitions" / "broken.json").write_text('{"uuid": ', encoding="UTF-8")
    add_definition(user_files, "d1", "Lobby loop", "media_player",
                   content={"i1": {"type": "file", "filename": "fossil.jpg"}})

    assert list(uses("fossil.jpg")["usage"]) == ["fossil.jpg"]
