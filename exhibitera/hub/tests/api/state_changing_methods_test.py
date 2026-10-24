"""Verify that v6.1 endpoints which change data can't be triggered by a GET request.

A browser sends cookies with top-level GET navigations, even from other sites, so a link or
redirect could otherwise delete or restore data for a logged-in user.
"""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.groups as hub_groups
import exhibitera.hub.features.issues as hub_issues
import exhibitera.hub.features.programs as hub_programs


@pytest.fixture
def editor(client, add_user, hub_env, monkeypatch):
    monkeypatch.setattr(hub_config, "issue_list", [])
    return client(add_user("editor", maintenance="edit", settings="edit", programs="edit"))


def issue_ids():
    return [x.details["id"] for x in hub_config.issue_list]


def archived_issue_ids(api, prefix="/v6.1"):
    return [x["id"] for x in api.get(f"{prefix}/issue/archive/list/__all").json()["issues"]]


def new_issue() -> str:
    issue = hub_issues.create_issue({"issueName": "Broken screen"})
    hub_issues.save_issue_list()
    return issue.details["id"]


# Issues

def test_delete_issue(editor):
    issue_id = new_issue()

    assert editor.delete(f"/v6.1/issue/{issue_id}").json() == {"success": True, "reason": ""}
    assert issue_id not in issue_ids()


def test_archive_and_restore_issue(editor):
    issue_id = new_issue()

    assert editor.post(f"/v6.1/issue/{issue_id}/archive").json()["success"] is True
    assert issue_id not in issue_ids()
    assert issue_id in archived_issue_ids(editor)

    assert editor.post(f"/v6.1/issue/{issue_id}/restore").json()["success"] is True
    assert issue_id in issue_ids()
    assert issue_id not in archived_issue_ids(editor)


@pytest.mark.parametrize("action", ["delete", "archive"])
def test_get_does_not_change_issues(editor, action):
    issue_id = new_issue()

    response = editor.get(f"/v6.1/issue/{issue_id}/{action}")

    assert response.status_code in (404, 405)
    assert issue_id in issue_ids()


def test_get_does_not_restore_issues(editor):
    issue_id = new_issue()
    editor.post(f"/v6.1/issue/{issue_id}/archive")

    response = editor.get(f"/v6.1/issue/{issue_id}/restore")

    assert response.status_code in (404, 405)
    assert issue_id not in issue_ids()


# Groups and programs

def test_restore_group(editor):
    group = hub_groups.create_group("Lobby", "")
    hub_groups.archive_group(group["uuid"])

    assert editor.get(f"/v6.1/group/{group['uuid']}/restore").status_code in (404, 405)
    assert hub_groups.get_group(group["uuid"]) is None

    assert editor.post(f"/v6.1/group/{group['uuid']}/restore").json() == {"success": True}
    assert hub_groups.get_group(group["uuid"]) is not None


def test_restore_program(editor):
    program = hub_programs.create_program({"name": "Planetarium show"})
    hub_programs.save_program_list()
    hub_programs.archive_program(program.uuid, "editor")

    assert editor.get(f"/v6.1/program/{program.uuid}/restore").status_code in (404, 405)
    assert hub_programs.get_program(program.uuid) is None

    assert editor.post(f"/v6.1/program/{program.uuid}/restore").json()["success"] is True
    assert hub_programs.get_program(program.uuid) is not None
