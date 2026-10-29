"""Verify switching the current exhibition, including to one that no longer exists.

Hub used to save a new current exhibition before checking it existed. Asking for a deleted exhibition,
such as from a console whose list hadn't refreshed yet, left Hub pointing at an exhibition it didn't
have, and every console stopped refreshing until Hub restarted.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.api.internal.system.system as hub_system
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.exhibitions as hub_exhibitions


@pytest.fixture
def exhibitions(hub_env):
    """Create two exhibitions, with the first one current, and return their UUIDs."""

    main = hub_exhibitions.create_exhibition("Main gallery", None)
    special = hub_exhibitions.create_exhibition("Special exhibition", None)
    hub_exhibitions.check_available_exhibitions()
    assert hub_exhibitions.load_exhibition(main)[0] is True
    return main, special


def console_gallery_update() -> dict:
    """Return the gallery details that consoles receive, as they receive them."""

    return json.loads(json.dumps(hub_system.get_webpage_update(), default=str))["gallery"]


def saved_current_exhibition(hub_env) -> str | None:
    with open(hub_env / "configuration" / "system.json", encoding="UTF-8") as f:
        return json.load(f).get("current_exhibit")


def test_switching_to_an_exhibition(client, add_user, hub_env, exhibitions):
    main, special = exhibitions
    token = add_user("staff", exhibits="edit")

    response = client(token).post(f"/internal/exhibition/{special}/set")

    assert response.json() == {"success": True, "reason": ""}
    assert hub_config.current_exhibit == special
    assert saved_current_exhibition(hub_env) == special


def test_reloading_the_current_exhibition(client, add_user, hub_env, exhibitions):
    main, _ = exhibitions
    token = add_user("staff", exhibits="edit")

    response = client(token).post(f"/internal/exhibition/{main}/set")

    assert response.json()["success"] is True
    assert hub_config.current_exhibit == main


def test_switching_to_a_missing_exhibition_changes_nothing(client, add_user, hub_env, exhibitions):
    main, _ = exhibitions
    token = add_user("staff", exhibits="edit")
    saved_before = saved_current_exhibition(hub_env)

    response = client(token).post("/internal/exhibition/deleted-exhibition/set")

    assert response.json() == {"success": False, "reason": "does_not_exist"}
    assert hub_config.current_exhibit == main
    assert saved_current_exhibition(hub_env) == saved_before


def test_console_update_names_a_listed_exhibition_after_a_failed_switch(client, add_user, hub_env, exhibitions):
    token = add_user("staff", exhibits="edit")
    client(token).post("/internal/exhibition/deleted-exhibition/set")

    # The console looks up the current exhibition in the list it's sent
    gallery = console_gallery_update()

    assert gallery["current_exhibit"] in [exhibit["uuid"] for exhibit in gallery["available_exhibits"]]
