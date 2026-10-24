"""Verify that Hub's web pages use Hub's internal API, and the protocol only for Apps computers.

The internal API (/internal) is only called by pages that Hub serves, which always come from the same
release, so it doesn't need versions. Requests to Apps computers must use the protocol, since an Apps
computer may run an older version than Hub.
"""

# Standard modules
import re

# Third-party modules
from fastapi.routing import APIRoute
import pytest

# Exhibitera modules
from exhibitera.common.tests import api_scanning
import exhibitera.hub.Hub as hub

HUB_JS = api_scanning.javascript_files("hub/js")


def source(relative_path: str) -> str:
    return (api_scanning.EXHIBITERA_DIR / relative_path).read_text(encoding="UTF-8")


def lines_matching(pattern: str):
    found = []
    for path in HUB_JS:
        for number, line in enumerate(path.read_text(encoding="UTF-8").split("\n"), start=1):
            if re.search(pattern, line):
                found.append(f"{path.relative_to(api_scanning.EXHIBITERA_DIR)}:{number}: {line.strip()}")
    return found


def test_hub_api_prefix_is_internal():
    assert re.search(r"^\s*api: '/internal',", source("hub/config.js"), re.M)


def test_requests_to_hub_default_to_the_internal_api():
    function = re.search(r"export function makeServerRequest \(opt\) \{(.*?)\n\}", source("hub/js/tools.js"), re.S)

    assert "hubConfig.api" in function.group(1)


def test_urls_to_hub_use_the_internal_api():
    # URLs built by hand (event streams, uploads) must not use the protocol version
    offenders = lines_matching(r"serverAddress \+ exConfig\.api|open\('\w+', exConfig\.api")

    assert offenders == []


def test_urls_to_apps_use_the_protocol():
    # A component's helper address is an Apps computer, which doesn't serve /internal
    offenders = lines_matching(r"getHelperURL\(\) \+ hubConfig\.api")

    assert offenders == []


def test_tracker_page_uses_the_internal_api():
    offenders = [line for line in lines_matching(r"xhr\.open\(") if "tracker_app.js" in line and "/internal" not in line
                 and "hubConfig.api" not in line]

    assert offenders == []


@pytest.mark.parametrize("path", ["/internal/system/checkConnection", "/internal/system/updateStream",
                                  "/internal/user/login", "/internal/issue/uploadMedia"])
def test_internal_routes_exist(path):
    paths = {r.path for r in hub.app.routes if isinstance(r, APIRoute)}

    assert path in paths
