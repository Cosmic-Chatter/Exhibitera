"""Verify that every Hub API endpoint declares its login requirement in its route decorator.

Each protected endpoint lists its permission check as a route dependency, e.g.
    @router.post("/create", dependencies=[Depends(hub_users.require_permission("exhibits", "edit"))])
so that a missing check is visible at a glance and can be verified here.
"""

# Standard modules
import inspect

# Third-party modules
from fastapi.routing import APIRoute
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users
import exhibitera.hub.Hub as hub
from conftest import INTERNAL_PREFIXES, make_permissions

# The permission each endpoint requires:
#   ("category", "level")                 -- the user needs this permission
#   ("components", "level", "group")      -- the user needs this permission for the component's groups
#   ("user",)                             -- any logged-in user

# Protocol 6, for released Apps 6.0, which never needs a login
PROTECTED_PROTOCOL_6 = {}

OPEN_PROTOCOL_6 = {
    ("GET", "/component/{uuid_str}/groups"),
    ("GET", "/data/{name}/rawText"),
    ("GET", "/system/checkConnection"),
    ("POST", "/analytics/{component_uuid}/append"),
    ("POST", "/data/{name}/append"),
    ("POST", "/data/{name}/rawText"),
    ("POST", "/system/ping"),
    ("POST", "/user/login"),
    ("POST", "/user/{user_uuid}/changePassword"),
}

# The internal API, used by Hub's own pages
PROTECTED_INTERNAL = {
    ("DELETE", "/component/{uuid_str}/delete"): ("settings", "edit"),
    ("DELETE", "/data/{name}"): ("analytics", "edit"),
    ("DELETE", "/exhibition/modifications"): ("exhibits", "edit"),
    ("DELETE", "/exhibition/{uuid_str}"): ("exhibits", "edit"),
    ("DELETE", "/group/{uuid_str}"): ("settings", "edit"),
    ("DELETE", "/maintenance/{uuid_str}"): ("maintenance", "edit"),
    ("DELETE", "/program/{program_uuid}/action/{action_uuid}"): ("programs", "edit"),
    ("DELETE", "/program/{this_uuid}"): ("programs", "edit"),
    ("DELETE", "/schedule/{schedule_name}"): ("schedule", "edit"),
    ("DELETE", "/schedule/{schedule_name}/action/{action_id}"): ("schedule", "edit"),
    ("DELETE", "/tracker/template/{tracker_uuid}"): ("analytics", "edit"),
    ("DELETE", "/user/{uuid_str}"): ("users", "edit"),
    ("GET", "/data/list"): ("analytics", "view"),
    ("GET", "/data/{name}/csv"): ("analytics", "view"),
    ("GET", "/exhibition/available"): ("user",),
    ("GET", "/exhibition/modifications"): ("exhibits", "view"),
    ("GET", "/exhibition/{uuid_str}/details"): ("user",),
    ("GET", "/group/archive/list"): ("settings", "view"),
    ("GET", "/group/{uuid_str}/details"): ("settings", "edit"),
    ("POST", "/group/{uuid_str}/restore"): ("settings", "edit"),
    ("GET", "/issue/archive/list/{match_uuid}"): ("maintenance", "view"),
    ("GET", "/issue/list/{match_uuid}"): ("maintenance", "view"),
    ("POST", "/issue/{issue_id}/archive"): ("maintenance", "edit"),
    ("DELETE", "/issue/{issue_id}"): ("maintenance", "edit"),
    ("GET", "/issue/{issue_id}/media"): ("maintenance", "view"),
    ("POST", "/issue/{issue_id}/restore"): ("maintenance", "edit"),
    ("GET", "/maintenance/"): ("maintenance", "view"),
    ("GET", "/maintenance/{uuid_str}"): ("maintenance", "view"),
    ("GET", "/program/archive/list"): ("programs", "view"),
    ("GET", "/program/{this_uuid}/checkSchedules"): ("programs", "view"),
    ("POST", "/program/{this_uuid}/restore"): ("programs", "edit"),
    ("GET", "/schedule/date_specific/list"): ("schedule", "view"),
    ("GET", "/schedule/{schedule_name}"): ("schedule", "view"),
    ("GET", "/schedule/{schedule_name}/JSONString"): ("schedule", "view"),
    ("GET", "/system/configuration/{target}"): ("settings", "view"),
    ("GET", "/system/updateStream"): ("user",),
    ("POST", "/component/WOL/create"): ("settings", "edit"),
    ("POST", "/component/WOL/{uuid_str}/edit"): ("components", "edit", "group"),
    ("POST", "/component/static/create"): ("settings", "edit"),
    ("POST", "/component/static/{uuid_str}/edit"): ("components", "edit", "group"),
    ("POST", "/component/{component_uuid}/definition/{definition_uuid}"): ("components", "edit_content", "group"),
    ("POST", "/component/{uuid_str}/edit"): ("components", "edit", "group"),
    ("POST", "/component/{uuid_str}/queueCommand"): ("components", "edit_content", "group"),
    ("POST", "/exhibition/applyModifications"): ("exhibits", "edit"),
    ("POST", "/exhibition/create"): ("exhibits", "edit"),
    ("POST", "/exhibition/{uuid_str}/edit"): ("exhibits", "edit"),
    ("POST", "/exhibition/{uuid_str}/set"): ("exhibits", "edit"),
    ("POST", "/group/create"): ("settings", "edit"),
    ("POST", "/group/{uuid_str}/edit"): ("settings", "edit"),
    ("POST", "/issue/create"): ("maintenance", "edit"),
    ("POST", "/issue/deleteMedia"): ("maintenance", "edit"),
    ("POST", "/issue/edit"): ("maintenance", "edit"),
    ("POST", "/issue/uploadMedia"): ("maintenance", "edit"),
    ("POST", "/maintenance/{uuid_str}"): ("maintenance", "edit"),
    ("POST", "/program/create"): ("programs", "edit"),
    ("POST", "/program/uploadMedia"): ("programs", "edit"),
    ("POST", "/program/{program_uuid}/action"): ("programs", "edit"),
    ("POST", "/program/{this_uuid}/update"): ("programs", "edit"),
    ("POST", "/projector/create"): ("settings", "edit"),
    ("POST", "/projector/{uuid_str}/edit"): ("components", "edit", "group"),
    ("POST", "/schedule/convert"): ("schedule", "edit"),
    ("POST", "/schedule/create"): ("schedule", "edit"),
    ("POST", "/schedule/{schedule_name}/action/{action_id}/update"): ("schedule", "edit"),
    ("POST", "/system/configuration/{target}/update"): ("settings", "edit"),
    ("POST", "/tracker/template/create"): ("analytics", "edit"),
    ("POST", "/user/create"): ("users", "edit"),
    ("POST", "/user/{user_uuid}/changePassword"): ("user",),
    ("POST", "/user/loginHandoff"): ("user",),
    ("GET", "/projector/{uuid_str}/password"): ("components", "edit", "group"),
    ("POST", "/user/{uuid_str}/edit"): ("users", "edit"),
    ("POST", "/user/{uuid_str}/editPreferences"): ("user",),
    ("POST", "/users/list"): ("user",),
}

OPEN_INTERNAL = {
    ("GET", "/group/{uuid_str}/name"),
    ("GET", "/program/"),
    ("GET", "/program/{this_uuid}"),
    ("GET", "/system/checkConnection"),
    ("GET", "/system/getHelpText"),
    ("GET", "/tracker/template/{template_uuid}"),
    ("GET", "/tracker/templates/list"),
    ("GET", "/user/{user_uuid}/displayName"),
    ("POST", "/data/{name}/append"),
    ("POST", "/schedule/getSecondsFromMidnight"),
    ("POST", "/user/login"),
}

# Protocol 6.1, for current Apps. Apps setup pages send the user's login for changePassword.
PROTECTED_PROTOCOL_6_1 = {
    ("POST", "/user/{user_uuid}/changePassword"): ("user",),
}

OPEN_PROTOCOL_6_1 = OPEN_PROTOCOL_6 - {("POST", "/user/{user_uuid}/changePassword")} | {
    ("GET", "/program/"),
    ("GET", "/program/location/{location}"),
    ("GET", "/program/locations"),
    ("GET", "/program/{this_uuid}"),
}

# Endpoints that are allowed to read the token themselves
TOKEN_READERS = {("POST", "/user/login")}

TABLES = {"/internal": (PROTECTED_INTERNAL, OPEN_INTERNAL),
          "/v6": (PROTECTED_PROTOCOL_6, OPEN_PROTOCOL_6),
          "/external/v6": (PROTECTED_PROTOCOL_6, OPEN_PROTOCOL_6),
          "/external/v6.1": (PROTECTED_PROTOCOL_6_1, OPEN_PROTOCOL_6_1)}


def api_routes(prefix: str) -> dict[tuple[str, str], APIRoute]:
    routes = {}
    for route in hub.app.routes:
        if isinstance(route, APIRoute) and route.path.startswith(prefix + "/"):
            for method in route.methods:
                routes[(method, route.path[len(prefix):])] = route
    return routes


def route_permission(route: APIRoute):
    """Return the permission declared by the route's decorator dependencies, or None."""

    declared = [getattr(d.dependency, "exhibitera_permission", None) for d in route.dependencies]
    declared = [x for x in declared if x is not None]
    assert len(declared) <= 1, f"{route.path} declares more than one permission check"
    return declared[0] if declared else None


def protected_cases():
    return [pytest.param(prefix, method, path, spec, id=f"{method} {prefix}{path}")
            for prefix, (protected, _) in TABLES.items()
            for (method, path), spec in protected.items()]


def open_cases():
    return [pytest.param(prefix, method, path, id=f"{method} {prefix}{path}")
            for prefix, (_, open_routes) in TABLES.items()
            for method, path in open_routes]


@pytest.mark.parametrize("prefix", TABLES.keys())
def test_every_route_is_listed(prefix):
    protected, open_routes = TABLES[prefix]
    routes = set(api_routes(prefix)) - {(m, p) for m, p in api_routes(prefix) if m == "HEAD"}

    assert routes - set(protected) - open_routes == set(), "New endpoints must be added to these tables"
    assert (set(protected) | open_routes) - routes == set()


@pytest.mark.parametrize("prefix, method, path, spec", protected_cases())
def test_protected_route_declares_permission_in_decorator(prefix, method, path, spec):
    assert route_permission(api_routes(prefix)[(method, path)]) == spec


@pytest.mark.parametrize("prefix, method, path", open_cases())
def test_open_route_declares_no_permission(prefix, method, path):
    assert route_permission(api_routes(prefix)[(method, path)]) is None


@pytest.mark.parametrize("prefix", TABLES.keys())
def test_no_endpoint_checks_the_token_itself(prefix):
    offenders = []
    for (method, path), route in api_routes(prefix).items():
        if (method, path) in TOKEN_READERS:
            continue
        source = inspect.getsource(route.endpoint)
        if "check_user_permission(" in source or "get_request_token(" in source or 'permission["' in source:
            offenders.append(f"{method} {prefix}{path}")

    assert offenders == []


# Behavior

def fill_path(path: str) -> str:
    return path.replace("{", "").replace("}", "")  # e.g. /issue/{issue_id}/delete -> /issue/issue_id/delete


def request(client, method, url):
    return client.request(method, url, json={} if method in ("POST", "PUT") else None)


@pytest.mark.parametrize("prefix, method, path, spec", protected_cases())
def test_protected_route_rejects_anonymous(client, prefix, method, path, spec):
    response = request(client(), method, prefix + fill_path(path))

    assert response.json() == {"success": False, "reason": "authentication_failed"}


@pytest.mark.parametrize("prefix, method, path, spec",
                         [case for case in protected_cases() if case.values[3] != ("user",)])
def test_protected_route_rejects_insufficient_permission(client, add_user, prefix, method, path, spec):
    response = request(client(add_user("no_permissions")), method, prefix + fill_path(path))

    assert response.json() == {"success": False, "reason": "insufficient_permission"}


# Endpoints that use the logged-in user

@pytest.fixture
def editor(add_user):
    return add_user("editor", maintenance="edit", programs="edit")


def editor_uuid():
    return next(u.uuid for u in hub_config.user_list if u.username == "editor")


@pytest.mark.parametrize("prefix", INTERNAL_PREFIXES)
def test_issue_changes_record_the_user(client, hub_env, editor, monkeypatch, prefix):
    monkeypatch.setattr(hub_config, "issue_list", [])
    api = client(editor)

    api.post(f"{prefix}/issue/create", json={"details": {"issueName": "Broken screen"}})
    issue = hub_config.issue_list[0].details
    assert issue["createdUsername"] == editor_uuid()

    api.post(f"{prefix}/issue/edit", json={"details": {"id": issue["id"], "priority": "high"}})
    assert hub_config.issue_list[0].details["lastUpdateUsername"] == editor_uuid()

    api.post(f"{prefix}/issue/{issue['id']}/archive")
    archive = api.get(f"{prefix}/issue/archive/list/__all").json()
    assert archive["issues"][0]["archivedUsername"] == editor_uuid()


def test_program_changes_record_the_user(client, hub_env, editor, monkeypatch):
    api = client(editor)

    response = api.post("/internal/program/create", json={"details": {"name": "Planetarium show"}})
    assert response.json()["success"] is True
    program = hub_config.program_list[0]
    assert program.get_dict()["creation_username"] == editor_uuid()

    api.delete(f"/internal/program/{program.uuid}")
    archive = api.get("/internal/program/archive/list").json()
    assert archive["programs"][0]["archivedUsername"] == editor_uuid()


# Users acting on their own account

@pytest.fixture
def two_users(add_user):
    own_token = add_user("own")
    admin_token = add_user("user_admin", users="edit")
    for user in hub_config.user_list:
        user.password_hash = hub_users.hash_password("password")
    return own_token, admin_token


def uuid_of(username):
    return next(u.uuid for u in hub_config.user_list if u.username == username)


@pytest.mark.parametrize("prefix", INTERNAL_PREFIXES)
def test_users_can_only_edit_their_own_preferences(client, two_users, prefix):
    own_token, admin_token = two_users
    body = {"preferences": {"status_mode": "maintenance"}}

    own = client(own_token).post(f"{prefix}/user/{uuid_of('own')}/editPreferences", json=body).json()
    other = client(admin_token).post(f"{prefix}/user/{uuid_of('own')}/editPreferences", json=body).json()

    assert own["success"] is True
    assert own["user"]["preferences"]["status_mode"] == "maintenance"
    assert other == {"success": False, "reason": "invalid_credentials"}


@pytest.mark.parametrize("prefix", ["/internal", "/external/v6.1"])
def test_users_can_change_their_own_password(client, two_users, prefix):
    own_token, _ = two_users
    response = client(own_token).post(f"{prefix}/user/{uuid_of('own')}/changePassword",
                                      json={"current_password": "password", "new_password": "new"})

    assert response.json() == {"success": True}


@pytest.mark.parametrize("prefix", ["/internal", "/external/v6.1"])
def test_changing_another_users_password_requires_users_edit(client, two_users, add_user, prefix):
    own_token, admin_token = two_users
    body = {"current_password": "password", "new_password": "new"}

    denied = client(own_token).post(f"{prefix}/user/{uuid_of('user_admin')}/changePassword", json=body)
    allowed = client(admin_token).post(f"{prefix}/user/{uuid_of('own')}/changePassword", json=body)

    assert denied.json() == {"success": False, "reason": "invalid_credentials"}
    assert allowed.json() == {"success": True}


def test_users_can_edit_their_own_preferences_with_no_permissions(client, add_user):
    token = add_user("nobody")
    response = client(token).post(f"/internal/user/{uuid_of('nobody')}/editPreferences",
                                  json={"preferences": {"status_mode": "maintenance"}})

    assert response.json()["success"] is True


# Component permissions are scoped to the component's current groups

@pytest.mark.parametrize("prefix", INTERNAL_PREFIXES)
@pytest.mark.parametrize("path, body", [
    ("/component/{uuid}/edit", {"description": "New description"}),
    ("/component/static/{uuid}/edit", {"description": "New description"}),
])
def test_component_edits_are_group_scoped(client, add_user, add_component, prefix, path, body):
    own = add_component(["G1"])
    other = add_component(["G2"])
    own.category = other.category = "static"
    token = add_user("g1_editor", components={"edit": ["G1"]})

    allowed = client(token).post(prefix + path.format(uuid=own.uuid), json=body).json()
    denied = client(token).post(prefix + path.format(uuid=other.uuid), json=body).json()

    assert allowed == {"success": True}
    assert own.config["description"] == "New description"
    assert denied == {"success": False, "reason": "insufficient_permission"}
    assert other.config["description"] == ""
