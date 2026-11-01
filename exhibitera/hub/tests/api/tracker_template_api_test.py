"""Verify that Flexible Tracker templates can only be written inside the templates folder.

A template's UUID becomes its file name, so a UUID such as ../../x must be refused rather than
writing a file elsewhere.
"""

# Standard modules
import json

# Third-party modules
import pytest

CREATE = "/internal/tracker/template/create"


@pytest.fixture
def analyst(add_user):
    return add_user("analyst", analytics="edit")


def test_templates_are_saved_by_uuid(client, hub_env, analyst):
    template = {"uuid": "t1", "name": "Gallery flow", "widget_order": [], "widgets": {}}

    response = client(analyst).post(CREATE, json={"template": template, "tracker_uuid": "t1"})

    assert response.json()["success"] is True
    saved = hub_env / "flexible-tracker" / "templates" / "t1.json"
    assert json.loads(saved.read_text(encoding="UTF-8"))["name"] == "Gallery flow"


@pytest.mark.parametrize("tracker_uuid", ["../../escape", "../escape", "a/b", "", ".."])
def test_unsafe_template_uuids_are_refused(client, hub_env, analyst, tracker_uuid):
    before = {p for p in hub_env.rglob("*")}

    response = client(analyst).post(CREATE, json={"template": {"name": "x"}, "tracker_uuid": tracker_uuid})

    assert response.json() == {"success": False, "reason": "unsafe_filename"}
    assert {p for p in hub_env.rglob("*")} == before
