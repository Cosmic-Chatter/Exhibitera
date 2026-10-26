"""Verify that Apps' own pages use Apps' internal API, and the protocol only for calls to Hub.

The internal API (/internal) is only called by pages that this Apps server serves, which always come
from the same release, so it doesn't need versions.
"""

# Standard modules
import re

# Third-party modules
from fastapi.routing import APIRoute
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
from exhibitera.common.tests import api_scanning

APPS_JS = api_scanning.javascript_files("apps")


def source(relative_path: str) -> str:
    return (api_scanning.EXHIBITERA_DIR / relative_path).read_text(encoding="UTF-8")


def apps_routes() -> set[tuple[str, str]]:
    return {(method, r.path) for r in apps.app.routes if isinstance(r, APIRoute) for method in r.methods}


def test_apps_api_prefix_is_internal():
    config = re.search(r"export const config = \{(.*?)\n\}", source("apps/js/exhibitera_app_common.js"), re.S)

    assert re.search(r"^\s*api: '/internal',", config.group(1), re.M)


def test_requests_to_this_server_default_to_the_internal_api():
    function = re.search(r"export function makeHelperRequest \(opt\) \{(.*?)\n\}",
                         source("apps/js/exhibitera_app_common.js"), re.S)

    assert "config.api" in function.group(1)


def test_urls_to_this_server_use_the_internal_api():
    # exConfig.api is the protocol version, which is only for requests to Hub
    offenders = []
    for path in APPS_JS:
        for number, line in enumerate(path.read_text(encoding="UTF-8").split("\n"), start=1):
            if "exConfig.api" in line and "exConfig.api_level" not in line:
                offenders.append(f"{path.relative_to(api_scanning.EXHIBITERA_DIR)}:{number}: {line.strip()}")

    assert offenders == []


def requests_to_this_server():
    return api_scanning.requests_in(APPS_JS, lambda name, url: name.endswith("makeHelperRequest"))


def test_scanner_finds_requests_to_this_server():
    templates = {(method, template) for method, template, _, _ in requests_to_this_server()}

    assert ("GET", "/definitions/{x}/load") in templates
    assert len(templates) >= 20


def test_every_request_to_this_server_has_an_internal_route():
    routes = apps_routes()
    offenders = []
    for method, template, api, location in requests_to_this_server():
        if api == "":
            continue  # A static file, such as uploaded content
        prefix = api if api is not None else "/internal"
        if not any(m == method and api_scanning.matches_route(prefix + template, path) for m, path in routes):
            offenders.append(f"{method} {prefix}{template} ({location})")

    assert offenders == []


@pytest.mark.parametrize("method, path", [
    ("GET", "/internal/definitions"),
    ("DELETE", "/internal/definitions/{this_uuid}"),
    ("POST", "/internal/files/upload"),
    ("GET", "/internal/files/{filename}/thumbnail/{width}"),
    ("GET", "/internal/system/configuration"),
    ("GET", "/internal/DMX/scenes"),
    ("POST", "/internal/data/{name}/rawText"),
])
def test_internal_routes_exist(method, path):
    assert (method, path) in apps_routes()


def test_pages_talk_to_the_server_that_served_them():
    # Requests made while the page loads go to config.helperAddress before configureApp() runs, so its
    # default must be this server, not a fixed address like http://localhost:8000
    config = re.search(r"export const config = \{(.*?)\n\}", source("apps/js/exhibitera_app_common.js"), re.S)

    assert re.search(r"^\s*helperAddress: window\.location\.origin,", config.group(1), re.M)
