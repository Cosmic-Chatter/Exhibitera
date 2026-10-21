"""Shared fixtures for testing the Hub API.

Every test runs against a temporary user files directory with a throwaway encryption key,
so the real configuration, users, and exhibit data are never read or modified.
"""

# Standard modules
import json
import os

# Third-party modules
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.users as hub_users
import exhibitera.hub.Hub as hub

API_PREFIXES = ["/v6", "/v6.1"]

USER_DIRECTORIES = ["analytics", "components", "configuration", "data", "exhibits",
                    os.path.join("flexible-tracker", "templates"), "issues", "programs", "schedules", "static"]

INITIAL_SYSTEM_CONFIGURATION = {"current_exhibit": "Default", "gallery_name": "Test gallery",
                                "ip_address": "localhost", "port": 8000}


def make_permissions(**overrides) -> dict:
    """Return a permissions dict granting nothing, except for the given overrides."""

    permissions = {
        "analytics": "none",
        "components": {"edit": [], "edit_content": [], "view": []},
        "exhibits": "none",
        "maintenance": "none",
        "programs": "none",
        "schedule": "none",
        "settings": "none",
        "users": "none"
    }
    for key, value in overrides.items():
        if key == "components":
            permissions["components"].update(value)
        else:
            permissions[key] = value
    return permissions


@pytest.fixture
def hub_env(tmp_path, monkeypatch):
    """Point Hub at a temporary user directory and reset its global state."""

    for directory in USER_DIRECTORIES:
        os.makedirs(tmp_path / directory)
    with open(tmp_path / "configuration" / "system.json", "w", encoding="UTF-8") as f:
        json.dump(INITIAL_SYSTEM_CONFIGURATION, f)

    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    monkeypatch.setattr(hub_config, "encryption_key", Fernet.generate_key())
    monkeypatch.setattr(hub_config, "user_list", [])
    monkeypatch.setattr(hub_config, "user_display_name_cache", {})
    monkeypatch.setattr(hub_config, "componentList", [])
    monkeypatch.setattr(hub_config, "projectorList", [])
    monkeypatch.setattr(hub_config, "wakeOnLANList", [])
    monkeypatch.setattr(hub_config, "group_list", [])
    monkeypatch.setattr(hub_config, "exhibit_list", [])
    monkeypatch.setattr(hub_config, "program_list", [])
    monkeypatch.setattr(hub_config, "exhibit_configuration", {"components": []})
    monkeypatch.setattr(hub_config, "exhibit_modifications", {"components": []})

    # Values that system.json updates write into the global config
    for attribute in ["current_exhibit", "gallery_name", "ip_address", "port"]:
        monkeypatch.setattr(hub_config, attribute, getattr(hub_config, attribute))
    monkeypatch.setattr(ex_config, "debug", ex_config.debug)

    # Don't start background network polling for test components
    monkeypatch.setattr(hub_components.ExhibitComponent, "poll_latency", lambda self: None)

    return tmp_path


@pytest.fixture
def add_user(hub_env):
    """Factory that creates a user with the given permissions and returns their auth token."""

    def _add_user(username: str, **permissions) -> str:
        user = hub_users.User(username, username, "not-a-real-hash", make_permissions(**permissions))
        hub_config.user_list.append(user)
        return hub_users.encrypt_token(user.uuid)

    return _add_user


@pytest.fixture
def add_component(hub_env):
    """Factory that creates a dynamic exhibit component in the given groups."""

    def _add_component(groups: list[str]) -> hub_components.ExhibitComponent:
        return hub_components.add_exhibit_component("Test component", groups)

    return _add_component


@pytest.fixture
def client(hub_env):
    """Return a factory for TestClients, optionally sending the given auth token as a cookie."""

    def _client(token: str | None = None) -> TestClient:
        cookies = {"authToken": token} if token is not None else None
        return TestClient(hub.app, cookies=cookies)

    return _client
