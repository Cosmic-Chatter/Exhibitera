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
