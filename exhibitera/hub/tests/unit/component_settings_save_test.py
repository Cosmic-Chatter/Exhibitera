"""Verify that editing a setting in the console's component dialog shows its save button straight away.

The button used to appear only once a text field lost focus, so staff typing a new name didn't see a way to save it.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.hub.tests.unit.component_info_test import ADMIN

pytestmark = page_scripts.needs_jsdom

# The text fields in each group of settings, and the save button for the group
TEXT_FIELDS = {
    "componentInfoModalBasicSettingsSaveButton": ["componentInfoModalBasicSettingsID",
                                                  "componentInfoModalExhibitDescriptionInput"],
    "componentInfoModalProjectorSettingsSaveButton": ["componentInfoModalProjectorSettingsID",
                                                      "componentInfoModalProjectorSettingsIPAddress",
                                                      "componentInfoModalProjectorSettingsPassword",
                                                      "componentInfoModalProjectorDescriptionInput"],
    "componentInfoModalStaticSettingsSaveButton": ["componentInfoModalStaticSettingsID",
                                                   "componentInfoModalStaticDescriptionInput"],
    "componentInfoModalWakeOnLANSettingsSaveButton": ["componentInfoModalWakeOnLANSettingsID",
                                                      "componentInfoModalWakeOnLANSettingsMAC",
                                                      "componentInfoModalWakeOnLANSettingsIPAddress",
                                                      "componentInfoModalWakeOnLANDescriptionInput"]}
FIELDS = [(button, field) for button, fields in TEXT_FIELDS.items() for field in fields]


def type_into(fields: list[tuple[str, str]], event: str = "input") -> dict:
    """Type into each field, sending only the given event, and report whether its save button was shown."""

    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        const el = (id) => window.document.getElementById(id)
        const shown = {{}}
        for (const [button, field] of {json.dumps(fields)}) {{
          el(button).style.display = 'none'
          el(field).value = 'Typed'
          // Typing sends input events. Leaving the field afterward would send a change event.
          el(field).dispatchEvent(new window.Event('{event}', {{ bubbles: true }}))
          shown[field] = el(button).style.display !== 'none'
        }}
        report({{ errors: browser.errors, shown }})
    """, browser="page")


def test_typing_shows_the_save_button():
    result = type_into(FIELDS)

    assert result["errors"] == []
    assert result["shown"] == {field: True for _, field in FIELDS}


@pytest.mark.parametrize("field", ["componentInfoModalBasicSettingsGroup", "componentInfoModalSettingsAllowRestart"])
def test_choosing_from_a_list_shows_the_save_button(field):
    button = ("componentInfoModalSettingsSaveButton" if "Allow" in field
              else "componentInfoModalBasicSettingsSaveButton")

    assert type_into([(button, field)], event="change")["shown"] == {field: True}
