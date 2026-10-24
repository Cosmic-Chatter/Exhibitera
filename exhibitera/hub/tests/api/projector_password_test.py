"""Verify that projector passwords are only sent to users who can edit that projector."""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.api.internal.system.system as system_internal
import exhibitera.hub.features.components as hub_components

PASSWORD = "pjlink-secret"


@pytest.fixture
def projector(hub_env, monkeypatch):
    # Don't contact the (nonexistent) projector
    monkeypatch.setattr(hub_components.Projector, "update", lambda self: None)
    monkeypatch.setattr(hub_components.Projector, "poll_latency", lambda self: None)
    return hub_components.add_projector("Test projector", ["G1"], "10.0.0.1", password=PASSWORD)


def test_update_stream_does_not_include_passwords(projector):
    update = system_internal.get_webpage_update()

    projectors = [c for c in update["components"] if c["class"] == "projector"]
    assert len(projectors) == 1
    assert "password" not in projectors[0]
    assert PASSWORD not in str(update)


def test_editor_can_read_the_password(client, add_user, projector):
    token = add_user("editor", components={"edit": ["G1"]})

    response = client(token).get(f"/v6.1/projector/{projector.uuid}/password")

    assert response.json() == {"success": True, "password": PASSWORD}


def test_projector_without_a_password(client, add_user, projector):
    projector.password = None
    token = add_user("editor", components={"edit": ["G1"]})

    response = client(token).get(f"/v6.1/projector/{projector.uuid}/password")

    assert response.json() == {"success": True, "password": ""}


@pytest.mark.parametrize("permissions", [
    {},
    {"components": {"view": ["__all"]}},
    {"components": {"edit_content": ["__all"]}},
    {"components": {"edit": ["G2"]}},
    {"settings": "edit"},
])
def test_others_cannot_read_the_password(client, add_user, projector, permissions):
    token = add_user("other", **permissions)

    response = client(token).get(f"/v6.1/projector/{projector.uuid}/password")

    assert response.json() == {"success": False, "reason": "insufficient_permission"}


def test_anonymous_cannot_read_the_password(client, projector):
    response = client().get(f"/v6.1/projector/{projector.uuid}/password")

    assert response.json() == {"success": False, "reason": "authentication_failed"}


def test_unknown_projector(client, add_user, hub_env):
    token = add_user("editor", components={"edit": ["__all"]})

    response = client(token).get("/v6.1/projector/does-not-exist/password")

    assert response.json() == {"success": False, "reason": "Projector does not exist"}


def test_editing_without_a_password_keeps_it(client, add_user, projector):
    token = add_user("editor", components={"edit": ["G1"]})

    client(token).post(f"/v6.1/projector/{projector.uuid}/edit", json={"description": "Lobby"})

    assert projector.password == PASSWORD
