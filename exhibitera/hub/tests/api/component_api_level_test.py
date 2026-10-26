"""Verify that Hub's web console learns which protocol version each Apps computer speaks.

An Apps computer may run an older version than Hub, so the web console must call it at the protocol
version it reports, rather than the version Hub itself uses.
"""

# Standard modules
import re

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import api_scanning
import exhibitera.hub.api.internal.system.system as system_internal


def stream_entry(uuid: str) -> dict:
    return next(c for c in system_internal.get_webpage_update()["components"] if c["uuid"] == uuid)


@pytest.mark.parametrize("prefix, api_level", [("/v6", 6), ("/external/v6.1", 6.1)])
def test_update_stream_reports_each_components_api_level(client, hub_env, prefix, api_level):
    client().post(f"{prefix}/system/ping", json={"uuid": "apps-uuid", "id": "Kiosk", "api_level": api_level,
                                                "exhibiteraAppID": "media_player"})

    assert stream_entry("apps-uuid")["api_level"] == api_level


def test_api_level_is_zero_until_reported(client, hub_env, add_component):
    component = add_component(["G1"])

    assert stream_entry(component.uuid)["api_level"] == 0


# The web console's requests to Apps computers

HUB_JS = api_scanning.javascript_files("hub/js")


def source(relative_path: str) -> str:
    return (api_scanning.EXHIBITERA_DIR / relative_path).read_text(encoding="UTF-8")


def lines_matching(pattern: str) -> list[str]:
    found = []
    for path in HUB_JS:
        for number, line in enumerate(path.read_text(encoding="UTF-8").split("\n"), start=1):
            if re.search(pattern, line):
                found.append(f"{path.relative_to(api_scanning.EXHIBITERA_DIR)}:{number}: {line.strip()}")
    return found


def test_component_requests_use_the_components_api():
    component_class = source("hub/js/features/components.js")
    make_request = re.search(r"class ExhibitComponent .*?\n  makeRequest \(opt\) \{(.*?)\n  \}", component_class, re.S)

    assert "getHelperAPI ()" in component_class
    assert "this.getHelperAPI()" in make_request.group(1)


def test_urls_to_apps_use_the_components_api():
    # Neither Hub's own API version nor its internal API applies to an Apps computer
    offenders = lines_matching(r"getHelperURL\(\) \+ (exConfig|hubConfig)\.api")

    assert offenders == []


def test_requests_to_apps_go_through_the_component():
    # Calling exUtilities.makeRequest() with a helper address skips the component's API version
    found = api_scanning.requests_in(
        HUB_JS,
        lambda name, url: name.endswith("exUtilities.makeRequest") and url is not None
        and "serverAddress" not in url and not url.strip("'`").startswith("http"))

    assert [location for *_, location in found] == []


def test_definition_thumbnails_use_the_components_api():
    function = re.search(r"export function getDefinitionThumbnail \((.*?)\) \{(.*?)\n\}", source("common/utilities.js"), re.S)
    calls = lines_matching(r"getDefinitionThumbnail\(")

    assert "api" in function.group(1)
    assert "exConfig.api" not in function.group(2)
    assert calls and all("getHelperAPI()" in call for call in calls)
