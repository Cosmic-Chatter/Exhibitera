"""Lock in the parts of Apps' API that Hub and third-party integrations depend on.

Hub calls these endpoints on Apps computers, which may be running an older version than Hub. The Core
API is for third-party integrations and must never lose an endpoint. Everything else is only called by
Apps' own pages and can change freely.
"""

# Third-party modules
from fastapi.routing import APIRoute
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
from exhibitera.common.protocol_router import url_prefixes
from exhibitera.common.tests import api_scanning

# The endpoints Hub and its web console call on Apps, for each protocol version
PROTOCOL_V6 = {
    ("GET", "/definitions"),
    ("GET", "/definitions/{this_uuid}/load"),
    ("POST", "/definitions/write"),
    ("GET", "/definitions/{this_uuid}/getContentList"),
    ("GET", "/definitions/{this_uuid}/thumbnail"),
    ("GET", "/files/availableContent"),
    ("POST", "/files/retrieve"),
    ("GET", "/DMX/scenes"),
    ("GET", "/DMX/scene/{uuid_str}/set"),
    ("GET", "/system/checkConnection"),
    ("GET", "/system/stats"),
    ("POST", "/system/configuration/update"),
    ("GET", "/system/screenshot"),
    ("GET", "/system/restart"),  # Sent by Hub at the component's API level
    ("GET", "/system/shutdown"),
}
PROTOCOL = {"6": PROTOCOL_V6, "6.1": PROTOCOL_V6}

# Third-party integrations may never be updated, so these must always exist
CORE = {
    ("GET", "/core/checkConnection"),
    ("POST", "/core/data/{name}/rawText"),
    ("GET", "/core/data/{name}/rawText"),
    ("GET", "/core/system/restart"),
    ("GET", "/core/system/shutdown"),
    ("GET", "/core/system/sleepDisplay"),
    ("GET", "/core/system/wakeDisplay"),
}

# The protocol version that the current Hub web console uses
CURRENT_HUB_VERSION = "6.1"

# Requests whose endpoint the scanner can't work out
KNOWN = {
    # queueCommand() sends '/restart' or '/shutdown', which BaseComponent.makeRequest() maps to the Core API
    ("GET", "/{x}", "hub/js/features/components.js"),
}


def apps_routes() -> set[tuple[str, str]]:
    return {(method, r.path) for r in apps.app.routes if isinstance(r, APIRoute) for method in r.methods}


@pytest.mark.parametrize("prefix, method, path",
                         [(prefix, m, p) for v, routes in PROTOCOL.items() for prefix in url_prefixes(v)
                          for m, p in sorted(routes)])
def test_protocol_endpoint_exists(prefix, method, path):
    assert (method, prefix + path) in apps_routes()


@pytest.mark.parametrize("version, prefix", [(v, prefix) for v in PROTOCOL for prefix in url_prefixes(v)])
def test_each_protocol_prefix_serves_only_its_version(version, prefix):
    # Apps' own pages use /internal, so nothing else belongs here
    served = {(method, path[len(prefix):]) for method, path in apps_routes() if path.startswith(prefix + "/")}

    assert served == PROTOCOL[version]


def test_unreleased_v6_1_prefix_is_not_served():
    assert [path for _, path in apps_routes() if path.startswith("/v6.1/")] == []


@pytest.mark.parametrize("method, path", sorted(CORE))
def test_core_endpoint_exists(method, path):
    assert (method, path) in apps_routes()


def hub_requests_to_apps():
    """The requests that Hub's web console sends to Apps computers."""

    files = api_scanning.javascript_files("hub/js")

    def to_apps(name, url):
        if name.endswith("exUtilities.makeRequest"):
            # Only requests to a component's helper address
            return url is not None and "serverAddress" not in url and not url.strip("'`").startswith("http")
        # BaseComponent.makeRequest() always goes to the component
        return name.endswith(".makeRequest") and not name.startswith(("hubTools", "exTools", "exUtilities"))

    found = [(m, t, location) for m, t, api, location in api_scanning.requests_in(files, to_apps) if api is None]
    found += [("GET", t, location) for t, location in api_scanning.helper_urls_in(files)]
    return found


def test_scanner_finds_the_hub_requests():
    templates = {(method, template) for method, template, _ in hub_requests_to_apps()}

    assert ("GET", "/definitions") in templates
    assert ("GET", "/definitions/{x}/thumbnail") in templates
    assert len(templates) >= 10


def test_hub_only_calls_protocol_endpoints():
    protocol = PROTOCOL[CURRENT_HUB_VERSION]
    offenders = []
    for method, template, location in hub_requests_to_apps():
        if (method, template, location.split(":")[0]) in KNOWN:
            continue
        if not any(m == method and api_scanning.matches_route(template, path) for m, path in protocol):
            offenders.append(f"{method} {template} ({location})")

    assert offenders == [], "Hub must only call Apps protocol endpoints. Add new ones to PROTOCOL."
