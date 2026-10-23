"""Verify that Hub API endpoints enforce authentication and permissions.

Run from the repository root with:
    python -m pytest exhibitera/hub/tests/api
"""

# Standard modules
import json
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users
from conftest import API_PREFIXES, INITIAL_SYSTEM_CONFIGURATION, make_permissions

AUTH_FAILURES = {"authentication_failed", "insufficient_permission"}

# Each locked endpoint: (method, path, JSON body, required permission).
# `{component}` is replaced with the UUID of a test component in group "G1".
# A required permission of None means any logged-in user is allowed.
LOCKED_ENDPOINTS = [
    ("POST", "/component/{component}/queueCommand", {"command": "refresh_page"}, ("components", "edit_content")),
    ("DELETE", "/component/{component}/delete", None, ("settings", "edit")),
    ("POST", "/component/{component}/definition/test-definition", None, ("components", "edit_content")),
    ("POST", "/exhibition/missing-exhibition/set", None, ("exhibits", "edit")),
    ("GET", "/system/configuration/test_config", None, ("settings", "view")),
    ("POST", "/system/configuration/test_config/update", {"configuration": {"key": "value"}}, ("settings", "edit")),
    ("POST", "/users/list", {}, None),
    ("GET", "/data/list", None, ("analytics", "view")),
    ("GET", "/data/test_data/csv", None, ("analytics", "view")),
    ("GET", "/exhibition/available", None, None),
    ("GET", "/exhibition/missing-exhibition/details", None, None),
]

# Endpoints called by Apps components and kiosks, which never have a logged-in user
OPEN_ENDPOINTS = [
    ("POST", "/system/ping", {"uuid": "{component}"}),
    ("GET", "/system/checkConnection", None),
    ("POST", "/analytics/{component}/append", {"data": {"key": "value"}}),
    ("POST", "/data/test_data/append", {"data": {"key": "value"}}),
    ("POST", "/data/Word_Cloud_test/rawText", {"text": "hello", "mode": "a"}),
    ("GET", "/data/Word_Cloud_test/rawText", None),
    ("GET", "/component/{component}/groups", None),
    ("GET", "/tracker/templates/list", None),
    ("GET", "/tracker/template/missing-template", None),
    ("GET", "/user/missing-user/displayName", None),
    ("GET", "/system/getHelpText", None),
    ("POST", "/schedule/getSecondsFromMidnight", {"time_str": "10:00 AM"}),
]

# Group name lookup and programs only exist in v6.1
OPEN_ENDPOINTS_V6_1 = [
    ("GET", "/group/missing-group/name", None),
    ("GET", "/program/", None),
    ("GET", "/program/location/Lobby", None),
    ("GET", "/program/locations", None),
    ("GET", "/program/missing-program", None),
]

CORE_OPEN_ENDPOINTS = [
    ("POST", "/core/ping", {"uuid": "{component}"}),
    ("GET", "/core/checkConnection", None),
    ("POST", "/core/data/Word_Cloud_test/rawText", {"text": "hello", "mode": "a"}),
    ("GET", "/core/data/Word_Cloud_test/rawText", None),
]


def locked_cases():
    cases = [(prefix, *endpoint) for prefix in API_PREFIXES for endpoint in LOCKED_ENDPOINTS]
    return [pytest.param(*case, id=f"{case[1]} {case[0]}{case[2]}") for case in cases]


def permission_cases():
    return [case for case in locked_cases() if case.values[4] is not None]


def open_cases():
    cases = [(prefix + path, method, body) for prefix in API_PREFIXES for method, path, body in OPEN_ENDPOINTS]
    cases += [("/v6.1" + path, method, body) for method, path, body in OPEN_ENDPOINTS_V6_1]
    cases += [(path, method, body) for method, path, body in CORE_OPEN_ENDPOINTS]
    return [pytest.param(*case, id=f"{case[1]} {case[0]}") for case in cases]


def grant(permission: tuple[str, str]) -> dict:
    """Return the keyword arguments for add_user() that grant exactly this permission."""

    category, level = permission
    if category == "components":
        return {"components": {level: ["__all"]}}
    return {category: level}


def failure_reason(response) -> str | None:
    """Return the failure reason from a response, if it has one. Some endpoints return bare lists."""

    body = response.json()
    return body.get("reason") if isinstance(body, dict) else None


def read_system_configuration(hub_env) -> dict:
    with open(hub_env / "configuration" / "system.json", "r", encoding="UTF-8") as f:
        return json.load(f)


def call(client, method: str, path: str, body, component_uuid: str):
    path = path.replace("{component}", component_uuid)
    if isinstance(body, dict):
        body = {k: (v.replace("{component}", component_uuid) if isinstance(v, str) else v) for k, v in body.items()}
    return client.request(method, path, json=body)


@pytest.fixture
def component(add_component):
    return add_component(["G1"])


# Locked endpoints

@pytest.mark.parametrize("prefix, method, path, body, permission", locked_cases())
def test_locked_endpoint_rejects_anonymous(client, component, prefix, method, path, body, permission):
    response = call(client(), method, prefix + path, body, component.uuid)

    assert response.status_code == 200
    assert response.json() == {"success": False, "reason": "authentication_failed"}


@pytest.mark.parametrize("prefix, method, path, body, permission", locked_cases())
def test_locked_endpoint_rejects_invalid_token(client, component, prefix, method, path, body, permission):
    response = call(client("not-a-valid-token"), method, prefix + path, body, component.uuid)

    assert response.json() == {"success": False, "reason": "authentication_failed"}


@pytest.mark.parametrize("prefix, method, path, body, permission", permission_cases())
def test_locked_endpoint_rejects_insufficient_permission(client, add_user, component,
                                                         prefix, method, path, body, permission):
    token = add_user("no_permissions")
    response = call(client(token), method, prefix + path, body, component.uuid)

    assert response.json() == {"success": False, "reason": "insufficient_permission"}


@pytest.mark.parametrize("prefix, method, path, body, permission", locked_cases())
def test_locked_endpoint_allows_permitted_user(client, add_user, component, prefix, method, path, body, permission):
    token = add_user("permitted", **(grant(permission) if permission is not None else {}))
    response = call(client(token), method, prefix + path, body, component.uuid)

    assert response.status_code == 200
    assert failure_reason(response) not in AUTH_FAILURES


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_view_permission_cannot_update_configuration(client, add_user, prefix):
    token = add_user("viewer", settings="view")
    response = client(token).post(f"{prefix}/system/configuration/test_config/update",
                                  json={"configuration": {"key": "value"}})

    assert response.json() == {"success": False, "reason": "insufficient_permission"}


# Component permissions are scoped by group

@pytest.mark.parametrize("prefix", API_PREFIXES)
@pytest.mark.parametrize("path, body", [
    ("/component/{component}/queueCommand", {"command": "refresh_page"}),
    ("/component/{component}/definition/test-definition", None),
])
def test_component_permission_is_group_scoped(client, add_user, add_component, prefix, path, body):
    own_group = add_component(["G1"])
    other_group = add_component(["G2"])
    token = add_user("g1_editor", components={"edit_content": ["G1"]})

    allowed = call(client(token), "POST", prefix + path, body, own_group.uuid)
    denied = call(client(token), "POST", prefix + path, body, other_group.uuid)

    assert failure_reason(allowed) not in AUTH_FAILURES
    assert denied.json() == {"success": False, "reason": "insufficient_permission"}


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_component_edit_permission_implies_edit_content(client, add_user, component, prefix):
    token = add_user("editor", components={"edit": ["G1"]})
    response = client(token).post(f"{prefix}/component/{component.uuid}/queueCommand",
                                  json={"command": "refresh_page"})

    assert response.json() == {"success": True, "reason": ""}


# Rejected requests must not have side effects

@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_anonymous_queue_command_is_not_queued(client, component, prefix):
    client().post(f"{prefix}/component/{component.uuid}/queueCommand", json={"command": "refresh_page"})

    assert component.config["commands"] == []


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_permitted_queue_command_is_queued(client, add_user, component, prefix):
    token = add_user("content_editor", components={"edit_content": ["G1"]})
    client(token).post(f"{prefix}/component/{component.uuid}/queueCommand", json={"command": "refresh_page"})

    assert component.config["commands"] == ["refresh_page"]


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_anonymous_delete_keeps_component(client, component, prefix):
    client().delete(f"{prefix}/component/{component.uuid}/delete")

    assert component in hub_config.componentList


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_anonymous_configuration_update_is_not_written(client, hub_env, prefix):
    client().post(f"{prefix}/system/configuration/system/update", json={"configuration": {"port": 1}})
    client().post(f"{prefix}/system/configuration/test_config/update", json={"configuration": {"key": "value"}})

    assert read_system_configuration(hub_env) == INITIAL_SYSTEM_CONFIGURATION
    assert not os.path.exists(hub_env / "configuration" / "test_config.json")


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_anonymous_exhibition_set_is_ignored(client, hub_env, prefix):
    client().post(f"{prefix}/exhibition/some-exhibition/set")

    assert read_system_configuration(hub_env) == INITIAL_SYSTEM_CONFIGURATION


# The update stream

@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_update_stream_rejects_anonymous(client, prefix):
    response = client().get(f"{prefix}/system/updateStream")

    assert response.json() == {"success": False, "reason": "authentication_failed"}


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_update_stream_requires_only_a_logged_in_user(client, prefix):
    # The stream never ends, so check the route's dependency instead of reading the response
    route = next(r for r in client().app.routes if getattr(r, "path", "") == f"{prefix}/system/updateStream")

    assert hub_users.require_user in [dependency.call for dependency in route.dependant.dependencies]


# Endpoints used by Apps must stay open

@pytest.mark.parametrize("path, method, body", open_cases())
def test_open_endpoint_allows_anonymous(client, component, path, method, body):
    response = call(client(), method, path, body, component.uuid)

    assert response.status_code == 200
    assert failure_reason(response) not in AUTH_FAILURES


# Endpoints that already required a login must keep the same failure responses

@pytest.mark.parametrize("prefix", API_PREFIXES)
@pytest.mark.parametrize("method, path, body", [
    ("DELETE", "/data/test_data", None),  # Uses the require_permission dependency
    ("POST", "/tracker/template/create", {"name": "test"}),  # Uses the require_permission dependency
    ("POST", "/component/static/create", {"id": "test", "groups": []}),  # Checks permission manually
])
def test_existing_protected_endpoint_responses_unchanged(client, add_user, prefix, method, path, body):
    anonymous = client().request(method, prefix + path, json=body)
    unprivileged = client(add_user("no_permissions")).request(method, prefix + path, json=body)

    assert anonymous.json() == {"success": False, "reason": "authentication_failed"}
    assert unprivileged.json() == {"success": False, "reason": "insufficient_permission"}


# Apps pages are cross-origin and can't send Hub's cookie, so they send the token in a header instead

def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("prefix, method, path, body, permission", locked_cases())
def test_locked_endpoint_accepts_bearer_token(client, add_user, component, prefix, method, path, body, permission):
    token = add_user("permitted", **(grant(permission) if permission is not None else {}))
    path = (prefix + path).replace("{component}", component.uuid)
    response = client().request(method, path, json=body, headers=bearer(token))

    assert failure_reason(response) not in AUTH_FAILURES


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_manually_checked_endpoint_accepts_bearer_token(client, add_user, prefix):
    token = add_user("settings_editor", settings="edit")
    response = client().post(f"{prefix}/component/static/create", json={"id": "test", "groups": []},
                             headers=bearer(token))

    assert response.json().get("success") is True


@pytest.mark.parametrize("prefix", API_PREFIXES)
def test_invalid_bearer_token_is_rejected(client, prefix):
    response = client().get(f"{prefix}/system/configuration/test_config", headers=bearer("not-a-valid-token"))

    assert response.json() == {"success": False, "reason": "authentication_failed"}


def test_bearer_token_takes_precedence_over_cookie(client, add_user):
    token = add_user("viewer", settings="view")
    response = client("not-a-valid-token").get("/v6.1/system/configuration/test_config", headers=bearer(token))

    assert failure_reason(response) not in AUTH_FAILURES


def test_non_bearer_authorization_header_falls_back_to_cookie(client, add_user):
    token = add_user("viewer", settings="view")
    response = client(token).get("/v6.1/system/configuration/test_config",
                                 headers={"Authorization": "Basic dXNlcjpwYXNz"})

    assert failure_reason(response) not in AUTH_FAILURES


def test_login_accepts_bearer_token(client, add_user):
    token = add_user("any_user")
    response = client().post("/v6.1/user/login", json={}, headers=bearer(token))

    assert response.json()["success"] is True
    assert response.json()["user"]["username"] == "any_user"


def test_change_password_accepts_bearer_token(client, hub_env):
    user = hub_users.User("changer", "changer", hub_users.hash_password("old-password"), make_permissions())
    hub_config.user_list.append(user)
    token = hub_users.encrypt_token(user.uuid)

    response = client().post(f"/v6.1/user/{user.uuid}/changePassword",
                             json={"current_password": "old-password", "new_password": "new-password"},
                             headers=bearer(token))

    assert response.json() == {"success": True}


def test_cross_origin_preflight_allows_authorization_header(client):
    response = client().options("/v6.1/program/locations", headers={
        "Origin": "http://10.0.0.50:8000",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })

    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
