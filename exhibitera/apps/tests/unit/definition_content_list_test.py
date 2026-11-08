"""Verify the list of files a definition uses, which Hub's console uses to copy a definition to other computers.

Besides its supporting files, the list names the definition's own thumbnail, if it has one, so the copy
can include it. Media files' thumbnails are made on each computer as needed, so they aren't included.
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
    for folder in ["definitions", "content", "thumbnails/definitions"]:
        (tmp_path / folder).mkdir(parents=True)

    # A Media Player definition with one image, which has its own media thumbnail
    definition = {"uuid": "lobby", "name": "Lobby loop", "app": "media_player",
                  "content": {"i1": {"type": "file", "filename": "fossil.jpg"}}}
    (tmp_path / "definitions" / "lobby.json").write_text(json.dumps(definition), encoding="UTF-8")
    (tmp_path / "content" / "fossil.jpg").write_bytes(b"image")
    (tmp_path / "thumbnails" / "fossil.jpg").write_bytes(b"media thumbnail")
    return tmp_path


def content_list() -> dict:
    return TestClient(apps.app).get("/internal/definitions/lobby/getContentList").json()


@pytest.mark.parametrize("thumbnail", ["lobby.png", "lobby.mp4"])
def test_definition_thumbnail_is_listed(user_files, thumbnail):
    (user_files / "thumbnails" / "definitions" / thumbnail).write_bytes(b"thumbnail")

    result = content_list()

    assert result["thumbnail"] == thumbnail
    assert [file["name"] for file in result["content"]] == ["fossil.jpg"]


def test_definition_without_a_thumbnail(user_files):
    assert content_list()["thumbnail"] is None


# Which files are listed

def files_listed(user_files, definition: dict, files: list[str]) -> dict:
    """Save the definition as "lobby" with the given content files, and return the names listed and any failure."""

    definition = {"uuid": "lobby", "name": "Lobby", **definition}
    (user_files / "definitions" / "lobby.json").write_text(json.dumps(definition), encoding="UTF-8")
    for name in files:
        (user_files / "content" / name).parent.mkdir(parents=True, exist_ok=True)
        (user_files / "content" / name).write_bytes(b"file")
    response = TestClient(apps.app, raise_server_exceptions=False).get("/internal/definitions/lobby/getContentList")
    if response.status_code != 200:
        return {"status": response.status_code}
    result = response.json()
    return {"success": result["success"], "files": sorted(file["name"] for file in result.get("content", []))}


def test_timelapse_lists_the_files_matching_its_pattern(user_files):
    result = files_listed(user_files, {"app": "timelapse_viewer", "files": "frame_*.jpg"},
                          ["frame_001.jpg", "frame_002.jpg", "other.jpg"])

    # fossil.jpg is the other definition's
    assert result == {"success": True, "files": ["frame_001.jpg", "frame_002.jpg"]}


@pytest.mark.parametrize("definition", [{"app": "infostation", "behavior": {"attractor": "intro.mp4"}},
                                        {"app": "timeline_explorer", "attractor": "intro.mp4"},
                                        {"app": "media_browser", "attractor": {"file": "intro.mp4"}}])
def test_attractors_are_listed(user_files, definition):
    assert files_listed(user_files, definition, ["intro.mp4"]) == {"success": True, "files": ["intro.mp4"]}


def test_markdown_media_with_spaces_in_its_name(user_files):
    definition = {"app": "infostation", "languages": {"en": {"tabs": {"t1": {
        "text": '# Fossils\n![left 50](/content/Ammonite shell.jpg "An ammonite")\n![](/content/spiral.png)'}}}}}

    assert files_listed(user_files, definition, ["Ammonite shell.jpg", "spiral.png", "shell.jpg"]) == {
        "success": True, "files": ["Ammonite shell.jpg", "spiral.png"]}


def test_fonts_from_the_content_folder_are_listed(user_files):
    definition = {"app": "infostation", "style": {"font": {"header": "/content/Lobby.ttf",
                                                          "body": "/_fonts/Noto/NotoSans-Regular.ttf"}}}

    assert files_listed(user_files, definition, ["Lobby.ttf"]) == {"success": True, "files": ["Lobby.ttf"]}


@pytest.mark.parametrize("definition", [
    # An annotation without a font
    {"app": "media_player", "content": {"i1": {"type": "file", "filename": "fossil.jpg",
                                               "annotations": {"a1": {"type": "text"}}}}},
    # An item with only one of its two images chosen
    {"app": "image_compare", "content": {"i1": {"image1": "fossil.jpg"}}},
    # The order lists an item that isn't in the content
    {"app": "media_browser", "content_order": ["i1", "i2"], "content": {"i1": {"filename": "fossil.jpg"}}},
    {"app": "timelapse_viewer"}])
def test_incomplete_definitions_still_list_their_files(user_files, definition):
    result = files_listed(user_files, definition, [])

    expected = [] if definition["app"] == "timelapse_viewer" else ["fossil.jpg"]
    assert result == {"success": True, "files": expected}


@pytest.mark.parametrize("app", ["word_cloud_input", "word_cloud_viewer", "dmx_control", "other"])
def test_every_app_is_supported(user_files, app):
    assert files_listed(user_files, {"app": app, "background": "fossil.jpg"}, []) == {
        "success": True, "files": ["fossil.jpg"]}


def test_files_in_subfolders(user_files):
    assert files_listed(user_files, {"app": "media_player", "content": {"i1": {"type": "file", "filename": "gallery/fossil.jpg"}}},
                        ["gallery/fossil.jpg"]) == {"success": True, "files": ["gallery/fossil.jpg"]}
