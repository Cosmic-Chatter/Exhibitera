"""Verify that reading raw text from Apps can't reach files outside its data folder.

These endpoints need no login, and used to read any name they were given. On Windows, where a backslash separates
folders, a name like ..\\configuration\\config could read Apps' own files. Names are now checked before any file
is opened, as they are when writing.
"""

# Third-party modules
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files

ESCAPING_NAMES = ["..\\configuration\\config", "..\\..\\secret", "folder\\file", "..", "."]
ENDPOINTS = ["/core/data/{name}/rawText", "/internal/data/{name}/rawText"]


@pytest.fixture
def user_files(tmp_path, monkeypatch):
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    (tmp_path / "data").mkdir()
    return tmp_path


@pytest.fixture
def opened(monkeypatch):
    """Record every file Apps opens to read text."""

    paths = []
    real_get_text = ex_files.get_text
    monkeypatch.setattr(ex_files, "get_text", lambda path: paths.append(path) or real_get_text(path))
    return paths


@pytest.mark.parametrize("endpoint", ENDPOINTS)
@pytest.mark.parametrize("name", ESCAPING_NAMES)
def test_names_that_leave_the_data_folder_are_refused(user_files, opened, endpoint, name):
    reply = TestClient(apps.app).get(endpoint.format(name=name.replace("\\", "%5C")))

    # The name is refused, or for . and .., the address resolves to one with no such endpoint. Either way, no file
    # is opened.
    reached = reply.status_code not in (404, 405)
    assert not reached or reply.json()["reason"] == "unsafe_filename"
    assert not reached or reply.json()["success"] is False
    assert opened == []


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_data_can_still_be_read(user_files, endpoint):
    (user_files / "data" / "sensor log.txt").write_text("12.5\n", encoding="UTF-8")

    assert TestClient(apps.app).get(endpoint.format(name="sensor log")).json() == {
        "success": True, "reason": "", "text": "12.5\n"}
