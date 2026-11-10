"""Verify the actions the console's component menu offers, and the requests they send.

The menu offers the actions a component allows. A new component hasn't set its permissions, so it offers what the
component does when they aren't set, which is to allow refreshing and restarting, as the settings page shows.

Restarting and powering off are sent straight to Apps, through its Core API. Powering off used to ask for a restart.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.hub.tests.unit.component_info_test import ADMIN

pytestmark = page_scripts.needs_jsdom


def use_menu(permissions: dict | None, click: str | None = None) -> dict:
    """Show the menu for a component with the given permissions, and click the named action, if any."""

    component = {"class": "exhibitComponent", "uuid": "kiosk-1", "id": "Lobby kiosk", "groups": ["Default"],
                 "helperAddress": "http://kiosk.test", "api_level": 6.1, "ip_address": "10.0.0.5", "latency": 0,
                 "platform_details": {}, "maintenance_status": "On floor, working", "status": "ONLINE",
                 "content": [], "definition": "", "notifications": {}, "permissions": permissions or {},
                 "description": ""}
    if permissions is None:
        del component["permissions"]
    gallery = {"current_exhibit": "e1", "available_exhibits": [{"uuid": "e1", "name": "Main gallery"}],
               "exhibit_modified": False, "name": "Test gallery", "notifications": {}}

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
        browser.sendUpdate({{ gallery: {json.dumps(gallery)}, components: [{json.dumps(component)}] }})
        await browser.wait(300)
        const hubTools = await import({page_scripts.module_url("hub/js/tools.js")})
        const menu = window.document.createElement('div')
        hubTools.getExhibitComponent('kiosk-1').populateActionMenu(menu, 'Default', 'edit')
        // The actions the component allows. View details is always offered.
        const actions = [...menu.querySelectorAll('.dropdown-item')].map((item) => item.textContent)
          .filter((label) => label !== 'View details')

        const before = browser.requests.length
        const click = {json.dumps(click)}
        if (click) [...menu.querySelectorAll('.dropdown-item')].find((item) => item.textContent === click).click()
        await browser.wait(200)
        report({{
          errors: browser.errors,
          actions,
          sent: browser.requests.slice(before).map((r) => r.method + ' ' + new URL(r.url).host + new URL(r.url).pathname
            + (r.body ? ' ' + r.body : ''))
        }})
    """, browser="page")


@pytest.mark.parametrize("permissions", [None, {}])
def test_a_new_component_offers_what_it_allows(permissions):
    result = use_menu(permissions)

    assert result["errors"] == []
    assert result["actions"] == ["Refresh component", "Restart component"]


def test_actions_follow_the_permissions():
    everything = {"refresh": True, "sleep": True, "restart": True, "shutdown": True}
    assert use_menu(everything)["actions"] == ["Refresh component", "Sleep display", "Wake display",
                                                "Restart component", "Power off component"]
    assert use_menu({"refresh": False, "restart": False})["actions"] == []


@pytest.mark.parametrize("action, path", [("Restart component", "/core/system/restart"),
                                          ("Power off component", "/core/system/shutdown")])
def test_restarting_and_powering_off_go_to_apps(action, path):
    result = use_menu({"restart": True, "shutdown": True}, click=action)

    assert result["errors"] == []
    assert result["sent"] == ["GET kiosk.test" + path]
