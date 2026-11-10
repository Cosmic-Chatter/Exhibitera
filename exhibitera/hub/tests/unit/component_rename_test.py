"""Verify that renaming a component shows the new name in the console's component panel straight away.

Hub saves the new name and sends it with its next update, but the console didn't use it, so the panel kept the old
name until the page was reloaded.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.hub.tests.unit.component_info_test import ADMIN

pytestmark = page_scripts.needs_jsdom


def component(name: str) -> dict:
    return {"class": "exhibitComponent", "uuid": "kiosk-1", "id": name, "groups": ["Default"],
            "helperAddress": "http://kiosk.test", "api_level": 6.1, "ip_address": "10.0.0.5", "latency": 0,
            "platform_details": {}, "maintenance_status": "On floor, working", "status": "ONLINE",
            "content": [], "definition": "", "notifications": {}, "permissions": {}, "description": ""}


def test_a_new_name_shows_straight_away():
    gallery = {"current_exhibit": "e1", "available_exhibits": [{"uuid": "e1", "name": "Main gallery"}],
               "exhibit_modified": False, "name": "Test gallery", "notifications": {}}

    result = page_scripts.run(f"""
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
        const shown = () => [...window.document.querySelectorAll('#componentGroupsRow .componentStatusButton')]
          .map((button) => button.querySelector('.fw-medium').textContent.trim())

        browser.sendUpdate({{ gallery: {json.dumps(gallery)}, components: [{json.dumps(component("Lobby kiosk"))}] }})
        await browser.wait(300)
        const before = shown()

        // Hub sends the new name with its next update
        browser.sendUpdate({{ gallery: {json.dumps(gallery)}, components: [{json.dumps(component("Fossil hall kiosk"))}] }})
        await browser.wait(300)
        const hubTools = await import({page_scripts.module_url("hub/js/tools.js")})
        report({{ errors: browser.errors, before, after: shown(), name: hubTools.getExhibitComponent('kiosk-1').id }})
    """, browser="page")

    assert result == {"errors": [], "before": ["Lobby kiosk"], "after": ["Fossil hall kiosk"],
                      "name": "Fossil hall kiosk"}
