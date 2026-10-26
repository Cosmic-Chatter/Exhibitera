"""Verify how Hub registers and controls third-party components, which use the Core API."""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.features.components as hub_components


@pytest.fixture
def sent(monkeypatch):
    """Record the URLs that Hub sends commands to."""

    urls = []
    monkeypatch.setattr(hub_components.requests, "get", lambda url, *args, **kwargs: urls.append(url))
    return urls


def test_core_ping_registers_a_third_party_component(client, hub_env):
    response = client().post("/core/ping", json={"uuid": "third-party-uuid", "id": "Sensor"})

    assert response.json()["success"] is True
    component = hub_components.get_exhibit_component("third-party-uuid")
    assert component.config["app_id"] == "third_party"
    assert component.config["api_level"] == 0


@pytest.mark.parametrize("command", ["restart", "shutdown"])
def test_third_party_commands_use_the_core_api(client, hub_env, sent, command):
    client().post("/core/ping", json={"uuid": "third-party-uuid", "id": "Sensor",
                                      "helper_address": "http://10.0.0.5:9000"})
    component = hub_components.get_exhibit_component("third-party-uuid")

    component.queue_command(command)

    assert sent == [f"{component.helper_address}/core/{command}"]


@pytest.mark.parametrize("command", ["restart", "shutdown"])
@pytest.mark.parametrize("api_level, prefix", [(6, "/v6"), (6.1, "/external/v6.1")])
def test_exhibitera_apps_commands_use_their_api_level(client, hub_env, sent, command, api_level, prefix):
    # Released Apps 6.0 only serves /v6
    client().post("/external/v6.1/system/ping",
                  json={"uuid": "apps-uuid", "id": "Kiosk", "exhibiteraAppID": "media_player",
                        "api_level": api_level, "helper_address": "http://10.0.0.6:8000"})
    component = hub_components.get_exhibit_component("apps-uuid")

    component.queue_command(command)

    assert sent == [f"{component.helper_address}{prefix}/system/{command}"]
