"""Verify that editing a user, as the console does, keeps them logged in and able to log in again.

A beta tester found that changing their own permission level logged them out, and they couldn't log back in. Hub
handles the edit correctly. The console's edit dialog kept a password typed into it earlier, such as when creating a
user, and sent it with the edit, which changed the password and logged the user out everywhere.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts
import exhibitera.hub.features.users as hub_users

PERMISSIONS = {"analytics": "edit", "exhibits": "edit", "maintenance": "edit", "programs": "edit",
               "schedule": "edit", "settings": "edit", "users": "edit",
               "components": {"edit": ["__all"], "edit_content": [], "view": []}}


@pytest.fixture
def manager(hub_env):
    """A user who can manage users, and their password."""

    hub_users.create_user("manager", "Manager", "manager-password", permissions=PERMISSIONS)
    return hub_users.get_user(username="manager"), "manager-password"


def log_in(client, username: str, password: str):
    """Log in, returning a client holding the login cookie and the login reply."""

    session = client()
    reply = session.post("/internal/user/login", json={"credentials": [username, password]}).json()
    return session, reply


def console_edit(session, user, **changes) -> dict:
    """Edit the user with the body the console's edit dialog sends, which has no password unless one is typed."""

    body = {"username": user.username, "display_name": user.display_name, "permissions": dict(user.permissions)}
    for key, value in changes.items():
        if key in PERMISSIONS:
            body["permissions"][key] = value
        else:
            body[key] = value
    return session.post(f"/internal/user/{user.uuid}/edit", json=body).json()


def still_logged_in(session) -> bool:
    return session.post("/internal/user/login", json={}).json().get("success") is True


def test_changing_your_own_permission(client, manager):
    user, password = manager
    session, reply = log_in(client, user.username, password)
    assert reply["success"] is True

    assert console_edit(session, user, analytics="view")["success"] is True

    assert still_logged_in(session)
    assert log_in(client, user.username, password)[1]["success"] is True


def test_changing_another_users_permission(client, manager, add_user):
    user, password = manager
    hub_users.create_user("guide", "Guide", "guide-password", permissions={**PERMISSIONS, "users": "none"})
    guide = hub_users.get_user(username="guide")
    session, _ = log_in(client, user.username, password)
    guide_session, _ = log_in(client, "guide", "guide-password")

    assert console_edit(session, guide, analytics="none")["success"] is True

    assert still_logged_in(session)
    assert still_logged_in(guide_session)
    assert log_in(client, "guide", "guide-password")[1]["success"] is True


# The console's edit dialog

@page_scripts.needs_jsdom
def test_the_edit_dialog_starts_without_a_password():
    # The dialog kept the password fields from the last time it was used, such as creating a user, so editing
    # someone afterward changed their password too, which logs them out everywhere
    admin = {"uuid": "u1", "username": "admin", "display_name": "Admin", "preferences": {},
             "permissions": {"analytics": "edit", "components": {"edit": ["__all"], "edit_content": [], "view": []},
                             "exhibits": "edit", "maintenance": "edit", "programs": "edit", "schedule": "edit",
                             "settings": "edit", "users": "edit"}}
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(admin)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        const users = await import({page_scripts.module_url("hub/js/features/users.js")})
        const el = (id) => window.document.getElementById(id)

        // Create a user, typing their password
        users.showEditUserModal()
        el('editUserPassword1Input').value = 'new-users-password'
        el('editUserPassword2Input').value = 'new-users-password'

        // Then edit an existing user, changing only a permission
        users.showEditUserModal({json.dumps(admin)})
        const fields = [el('editUserPassword1Input').value, el('editUserPassword2Input').value]
        el('editUserPermissionAnalytics').value = 'view'
        users.submitChangeFromEditUserModal()
        await browser.wait(200)
        const edits = browser.requests.filter((r) => r.url.endsWith('/user/u1/edit')).map((r) => JSON.parse(r.body))
        report({{ errors: browser.errors, fields, sentPassword: edits.map((e) => 'password' in e), analytics: edits.map((e) => e.permissions.analytics) }})
    """, browser="page")

    assert result == {"errors": [], "fields": ["", ""], "sentPassword": [False], "analytics": ["view"]}
