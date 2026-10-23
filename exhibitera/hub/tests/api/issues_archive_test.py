"""Verify that the archived issues endpoints read archived.json through ex_files.load_json()."""

# Standard modules
import json
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files
from conftest import API_PREFIXES

ARCHIVE = os.path.join("issues", "archived.json")


@pytest.fixture
def loads(hub_env, monkeypatch):
    """Record every load_json() call."""

    calls = []
    real_load_json = ex_files.load_json

    def recording_load_json(path):
        calls.append(os.path.relpath(path, hub_env))
        return real_load_json(path)

    monkeypatch.setattr(ex_files, "load_json", recording_load_json)
    return calls


def write_archive(hub_env, contents: str):
    with open(hub_env / ARCHIVE, "w", encoding="UTF-8") as f:
        f.write(contents)


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_archived_issues_are_listed(client, add_user, hub_env, loads, prefix):
    write_archive(hub_env, json.dumps([
        {"id": "a", "relatedComponentUUIDs": ["component-1"]},
        {"id": "b", "relatedComponentUUIDs": []},
    ]))
    viewer = client(add_user("viewer", maintenance="view"))

    everything = viewer.get(f"{prefix}/issue/archive/list/__all").json()
    matched = viewer.get(f"{prefix}/issue/archive/list/component-1").json()

    assert ARCHIVE in loads
    assert everything == {"success": True, "issues": [{"id": "a", "relatedComponentUUIDs": ["component-1"]},
                                                      {"id": "b", "relatedComponentUUIDs": []}]}
    assert [x["id"] for x in matched["issues"]] == ["a"]


@pytest.mark.parametrize("prefix", API_PREFIXES)
@pytest.mark.parametrize("contents", [None, "", '[{"id": '])
def test_missing_or_damaged_archive_is_empty(client, add_user, hub_env, loads, prefix, contents):
    if contents is not None:
        write_archive(hub_env, contents)
    viewer = client(add_user("viewer", maintenance="view"))

    response = viewer.get(f"{prefix}/issue/archive/list/__all").json()

    assert ARCHIVE in loads
    assert response == {"success": True, "issues": []}
