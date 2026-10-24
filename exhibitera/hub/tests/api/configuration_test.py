"""Verify that the configuration endpoints only read and write system.json."""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
from conftest import INTERNAL_PREFIXES, INITIAL_SYSTEM_CONFIGURATION

# Other files in the configuration folder, which these endpoints must never expose
OTHER_FILES = {"users": [{"username": "someone", "password_hash": "secret-hash"}],
               "groups": [{"uuid": "g1", "name": "Group"}],
               "descriptions": {"component": "A description"}}


@pytest.fixture
def configuration_dir(hub_env):
    for name, contents in OTHER_FILES.items():
        with open(hub_env / "configuration" / f"{name}.json", "w", encoding="UTF-8") as f:
            json.dump(contents, f)
    return hub_env / "configuration"


def read(path):
    with open(path, "r", encoding="UTF-8") as f:
        return json.load(f)


@pytest.mark.parametrize("prefix", INTERNAL_PREFIXES)
def test_system_configuration_can_be_read(client, add_user, configuration_dir, prefix):
    response = client(add_user("viewer", settings="view")).get(f"{prefix}/system/configuration/system")

    assert response.json() == {"success": True, "configuration": INITIAL_SYSTEM_CONFIGURATION}


@pytest.mark.parametrize("prefix", INTERNAL_PREFIXES)
def test_system_configuration_can_be_updated(client, add_user, configuration_dir, prefix):
    response = client(add_user("editor", settings="edit")).post(f"{prefix}/system/configuration/system/update",
                                                                json={"configuration": {"gallery_name": "New"}})

    assert response.json() == {"success": True}
    assert read(configuration_dir / "system.json")["gallery_name"] == "New"
    assert hub_config.gallery_name == "New"


@pytest.mark.parametrize("prefix", INTERNAL_PREFIXES)
@pytest.mark.parametrize("target", [*OTHER_FILES, "new_file", "encryption_key", "root_admin"])
def test_other_configuration_cannot_be_read(client, add_user, configuration_dir, prefix, target):
    response = client(add_user("editor", settings="edit")).get(f"{prefix}/system/configuration/{target}")

    assert response.json() == {"success": False, "reason": "unknown_configuration"}


@pytest.mark.parametrize("prefix", INTERNAL_PREFIXES)
@pytest.mark.parametrize("target", [*OTHER_FILES, "new_file"])
def test_other_configuration_cannot_be_written(client, add_user, configuration_dir, prefix, target):
    response = client(add_user("editor", settings="edit")).post(f"{prefix}/system/configuration/{target}/update",
                                                                json={"configuration": {"replaced": True}})

    assert response.json() == {"success": False, "reason": "unknown_configuration"}
    for name, contents in OTHER_FILES.items():
        assert read(configuration_dir / f"{name}.json") == contents
    assert not (configuration_dir / "new_file.json").exists()
