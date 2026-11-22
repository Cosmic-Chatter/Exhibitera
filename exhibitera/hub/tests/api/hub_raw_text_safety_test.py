"""Verify that reading raw text from Hub can't reach files outside its data folder.

The Core API's raw text endpoint needs no login, and used to read any name it was given. On Windows, where a
backslash separates folders, a name like ..\\configuration\\encryption_key read the key Hub signs logins with.
Names are now checked before any file is opened, as they are when writing.
"""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files

ESCAPING_NAMES = ["..\\configuration\\encryption_key", "..\\..\\secret", "folder\\file", "..", "."]
ENDPOINTS = ["/core/data/{name}/rawText", "/external/v6.1/data/{name}/rawText", "/v6/data/{name}/rawText"]


@pytest.fixture
def opened(monkeypatch):
    """Record every file Hub opens to read text."""

    paths = []
    real_get_text = ex_files.get_text
    monkeypatch.setattr(ex_files, "get_text", lambda path: paths.append(path) or real_get_text(path))
    return paths


@pytest.mark.parametrize("endpoint", ENDPOINTS)
@pytest.mark.parametrize("name", ESCAPING_NAMES)
def test_names_that_leave_the_data_folder_are_refused(client, hub_env, opened, endpoint, name):
    reply = client().get(endpoint.format(name=name.replace("\\", "%5C")))

    # The name is refused, or for . and .., the address resolves to one with no such endpoint. Either way, no file
    # is opened.
    reached = reply.status_code not in (404, 405)
    assert not reached or reply.json()["reason"] == "unsafe_filename"
    assert not reached or reply.json()["success"] is False
    assert opened == []


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_data_can_still_be_read(client, hub_env, endpoint):
    (hub_env / "data" / "sensor log.txt").write_text("12.5\n", encoding="UTF-8")

    assert client().get(endpoint.format(name="sensor log")).json() == {"success": True, "reason": "", "text": "12.5\n"}
