"""Verify Apps' command-line first-time setup, which Linux uses instead of a setup window.

It used to ask for an ID when using Hub, but Hub names components itself and ignores it.
"""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.apps.features.utilities as apps_utilities


class LoginReply:
    def json(self):
        return {"success": True, "user": {"permissions": {"settings": "edit"}}}


@pytest.fixture
def setup_run(monkeypatch):
    """Run the setup with scripted answers, and return the questions asked and the configuration saved."""

    asked = []
    saved = {}
    # An ID is given if asked, so a setup that asks finishes rather than asking again
    answers = {"Use Hub": "Y", "static IP address": "10.0.0.2", "Hub's port": "8082", "Username": "admin",
               "Enter port": "8000", "Enter ID": "Lobby kiosk"}

    def answer(prompt=""):
        asked.append(prompt)
        return next((reply for question, reply in answers.items() if question in prompt), "")

    monkeypatch.setattr("builtins.input", answer)
    monkeypatch.setattr(apps_utilities.getpass, "getpass", lambda prompt="": "password")
    monkeypatch.setattr(apps_utilities.requests, "post", lambda *args, **kwargs: LoginReply())
    monkeypatch.setattr(apps_utilities, "command_line_setup_print_gui", lambda: None)
    monkeypatch.setattr(apps_utilities, "find_available_port", lambda start=8000: 8000)
    monkeypatch.setattr(apps_utilities, "capture_screenshot", lambda: None)
    monkeypatch.setattr(apps_utilities, "update_configuration", lambda defaults, cull=False: saved.update(defaults))

    apps_utilities.handle_missing_defaults_file()
    return asked, saved


def test_setup_with_hub_doesnt_ask_for_an_id(setup_run):
    asked, saved = setup_run

    assert not any("ID" in question for question in asked)
    assert "id" not in saved["app"]
    # The rest of the setup is unchanged
    assert saved["system"]["standalone"] is False
    assert saved["control_server"] == {"ip_address": "10.0.0.2", "port": 8082}
    assert saved["system"]["port"] == 8000
    assert any("Press Enter to continue" in question for question in asked[1:])  # Before the screenshot check
