"""Verify that a ping can't use its uuid to write files outside the components folder.

Hub saves each component to components/<uuid>.json, and anyone on the network can send a ping.
"""

# Standard modules
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.hub.features.components as hub_components

PING_ENDPOINTS = ["/v6/system/ping", "/external/v6.1/system/ping", "/core/ping"]
UNSAFE_UUIDS = ["../configuration/system", "../configuration/users", "..", "a/b", "a\\b"]


def user_files() -> dict[str, bytes]:
    """Return the contents of every file in Hub's user directory."""

    contents = {}
    for folder, _, files in os.walk(ex_config.application_path):
        for name in files:
            path = os.path.join(folder, name)
            with open(path, "rb") as f:
                contents[os.path.relpath(path, ex_config.application_path)] = f.read()
    return contents


@pytest.mark.parametrize("endpoint", PING_ENDPOINTS)
@pytest.mark.parametrize("uuid_str", UNSAFE_UUIDS)
def test_unsafe_uuid_is_rejected(client, hub_env, endpoint, uuid_str):
    before = user_files()

    response = client().post(endpoint, json={"uuid": uuid_str, "id": "Intruder"})

    assert response.json() == {"success": False, "reason": "unsafe_uuid"}
    assert user_files() == before
    assert hub_components.get_exhibit_component(uuid_str) is None


@pytest.mark.parametrize("endpoint", PING_ENDPOINTS)
def test_safe_uuid_is_saved_in_the_components_folder(client, hub_env, endpoint):
    client().post(endpoint, json={"uuid": "3f2c1a9e-1d2b-4c5d-8e7f-0a1b2c3d4e5f", "id": "Kiosk"})

    assert "components/3f2c1a9e-1d2b-4c5d-8e7f-0a1b2c3d4e5f.json" in user_files()
