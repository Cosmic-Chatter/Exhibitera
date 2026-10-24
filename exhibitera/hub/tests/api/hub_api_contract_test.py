"""Lock in the parts of Hub's API that other software depends on.

Hub serves three kinds of API:
- The protocol, which Apps calls. Each version must keep working for Apps installs on that version.
- The Core API, for third-party integrations. It must never lose an endpoint.
- Everything else, which only Hub's own web pages call. It can change freely.

These tests fail if a protocol or Core endpoint disappears, or if Apps starts calling an endpoint
that isn't part of the protocol.
"""

# Standard modules
import pathlib
import re

# Third-party modules
from fastapi.routing import APIRoute
import pytest

# Exhibitera modules
from exhibitera.common.tests import api_scanning
import exhibitera.hub.Hub as hub

# The endpoints Apps calls on Hub, for each protocol version
PROTOCOL_V6 = {
    ("POST", "/system/ping"),
    ("GET", "/system/checkConnection"),
    ("POST", "/analytics/{component_uuid}/append"),
    ("POST", "/data/{name}/append"),
    ("POST", "/data/{name}/rawText"),
    ("GET", "/data/{name}/rawText"),
    ("GET", "/component/{uuid_str}/groups"),
    ("POST", "/user/login"),
    ("POST", "/user/{user_uuid}/changePassword"),
}
PROTOCOL = {
    "6": PROTOCOL_V6,
    "6.1": PROTOCOL_V6 | {
        # For Apps setup pages and kiosks
        ("GET", "/program/"),
        ("GET", "/program/location/{location}"),
        ("GET", "/program/locations"),
        ("GET", "/program/{this_uuid}"),
    },
}

# Third-party integrations may never be updated, so these must always exist
CORE = {
    ("POST", "/core/ping"),
    ("GET", "/core/checkConnection"),
    ("POST", "/core/data/{name}/rawText"),
    ("GET", "/core/data/{name}/rawText"),
}

# The protocol version that the current Apps code uses
CURRENT_APPS_VERSION = "6.1"


def hub_routes() -> set[tuple[str, str]]:
    return {(method, r.path) for r in hub.app.routes if isinstance(r, APIRoute) for method in r.methods}


@pytest.mark.parametrize("version, method, path",
                         [(v, m, p) for v, routes in PROTOCOL.items() for m, p in sorted(routes)])
def test_protocol_endpoint_exists(version, method, path):
    assert (method, f"/v{version}{path}") in hub_routes()


def test_v6_serves_only_the_protocol():
    # /v6 exists for released Apps 6.0. Hub's own pages use /internal.
    v6_routes = {(method, path[len("/v6"):]) for method, path in hub_routes() if path.startswith("/v6/")}

    assert v6_routes == PROTOCOL["6"]


@pytest.mark.parametrize("method, path", sorted(CORE))
def test_core_endpoint_exists(method, path):
    assert (method, path) in hub_routes()


def apps_requests_to_hub():
    """The requests that Apps pages send to Hub."""

    files = api_scanning.javascript_files("apps", "common")
    return api_scanning.requests_in(
        files,
        lambda name, url: name.endswith(("makeServerRequest", "makeAuthenticatedServerRequest"))
        or (name.endswith("exUtilities.makeRequest") and url is not None and "serverAddress" in url))


def test_scanner_finds_the_apps_requests():
    # A sanity check, so that the next test can't pass by finding nothing
    templates = {(method, template) for method, template, _, _ in apps_requests_to_hub()}

    assert ("POST", "/system/ping") in templates
    assert ("POST", "/user/login") in templates
    assert len(templates) >= 8


def test_apps_only_calls_protocol_endpoints():
    protocol = PROTOCOL[CURRENT_APPS_VERSION]
    offenders = []
    for method, template, api, location in apps_requests_to_hub():
        if api is not None:
            continue  # Explicitly uses another API, such as /core
        if not any(m == method and api_scanning.matches_route(template, path) for m, path in protocol):
            offenders.append(f"{method} {template} ({location})")

    assert offenders == [], "Apps must only call Hub protocol endpoints. Add new ones to PROTOCOL."


def test_apps_core_requests_use_core_endpoints():
    for method, template, api, location in apps_requests_to_hub():
        if api == "/core":
            assert any(m == method and api_scanning.matches_route("/core" + template, path) for m, path in CORE), location


@pytest.mark.xfail(strict=True, reason="Apps' Python calls Hub without an API version; fixed in a later step")
def test_apps_python_calls_hub_with_an_api_version():
    unversioned = []
    for path in sorted((api_scanning.EXHIBITERA_DIR / "apps").rglob("*.py")):
        if "tests" in path.parts:
            continue
        for number, line in enumerate(path.read_text(encoding="UTF-8").split("\n"), start=1):
            if re.search(r"requests\.(get|post)\(.*(server_address|\{ip\}:\{port\})", line) \
                    and not re.search(r"/v\d|/core/|api", line):
                unversioned.append(f"{path.relative_to(api_scanning.EXHIBITERA_DIR)}:{number}")

    assert unversioned == []
