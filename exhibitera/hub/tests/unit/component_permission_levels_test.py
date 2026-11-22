"""Verify what the Components tab offers at each level of component permission.

- Content editors may send commands, such as refreshing or sleeping, as Hub allows them to.
- Viewers see a component's DMX scenes but can't set them. Scenes are set on the component itself, so Hub can't
  refuse them.
- Only full editors see a projector's settings, so only they ask Hub for its password, which Hub refuses to others.
- A component's maintenance status and notes can only be changed by users who may edit maintenance.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom


def user_with(level: str, maintenance: str = "none") -> dict:
    components = {"edit": [], "edit_content": [], "view": []}
    components[level] = ["__all"]
    return {"uuid": "u1", "username": "guide", "display_name": "Guide", "preferences": {},
            "permissions": {"analytics": "none", "components": components, "exhibits": "none", "maintenance": maintenance,
                            "programs": "none", "schedule": "none", "settings": "none", "users": "none"}}


def use_components_tab(level: str, maintenance: str = "none") -> dict:
    kiosk = {"class": "exhibitComponent", "uuid": "kiosk-1", "id": "Lobby kiosk", "groups": ["Default"],
             "helperAddress": "http://kiosk.test", "api_level": 6.1, "ip_address": "10.0.0.5", "latency": 0,
             "platform_details": {}, "maintenance_status": "On floor, working", "status": "ONLINE", "content": [],
             "definition": "", "notifications": {}, "permissions": {"refresh": True, "sleep": True},
             "description": ""}
    projector = {"class": "projector", "uuid": "proj-1", "id": "Lobby projector", "groups": ["Default"],
                 "ip_address": "10.0.0.6", "maintenance_status": "On floor, working", "status": "ONLINE",
                 "description": "", "state": {}}
    gallery = {"current_exhibit": "e1", "available_exhibits": [{"uuid": "e1", "name": "Main gallery"}],
               "exhibit_modified": False, "name": "Test gallery", "notifications": {}}

    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ host, pathname }} = new URL(url)
          if (host === 'kiosk.test') {{
            if (pathname.endsWith('/definitions')) return {{ body: {{ success: true, definitions: {{}} }} }}
            if (pathname.endsWith('/system/stats')) {{
              const stats = {{ cpu_load_pct: 5, ram_used_pct: 10, disk_pct_free: 50, disK_free_GB: 100 }}
              return {{ body: {{ success: true, system_stats: stats }} }}
            }}
            if (pathname.endsWith('/DMX/scenes')) return {{ body: {{ success: true, scenes: [{{ uuid: 's1', name: 'Warm' }}] }} }}
            return {{ body: {{ success: false }} }}
          }}
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(user_with(level, maintenance))} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        browser.sendUpdate({{ gallery: {json.dumps(gallery)}, components: [{json.dumps(kiosk)}, {json.dumps(projector)}] }})
        await browser.wait(300)
        const doc = window.document
        const menus = [...doc.querySelectorAll('#componentGroupsRow .dropdown-item')].map((item) => item.textContent)

        const componentInfo = await import({page_scripts.module_url("hub/js/features/component_info_modal.js")})
        componentInfo.showExhibitComponentInfo('kiosk-1', 'Default')
        await browser.wait(500)
        const maintenanceLocked = [doc.getElementById('componentInfoModalMaintenanceStatusSelector').disabled,
          doc.getElementById('componentInfoModalMaintenanceNote').disabled]
        doc.querySelector('#componentInfoModalDMXSceneList .dmx-entry')?.click()
        await browser.wait(200)

        componentInfo.showExhibitComponentInfo('proj-1', 'Default')
        await browser.wait(300)

        const paths = browser.requests.map((r) => new URL(r.url).pathname)
        report({{
          errors: browser.errors,
          commands: ['Refresh all components', 'Sleep all components', 'Refresh component', 'Sleep display']
            .filter((label) => menus.includes(label)),
          scenes: doc.querySelectorAll('#componentInfoModalDMXSceneList .dmx-entry').length,
          sceneSet: paths.some((p) => p.endsWith('/DMX/scene/s1/set')),
          passwordAsked: paths.includes('/internal/projector/proj-1/password'),
          maintenanceLocked
        }})
    """, browser="page")


ALL_COMMANDS = ["Refresh all components", "Sleep all components", "Refresh component", "Sleep display"]


@pytest.mark.parametrize("level, expected", [
    ("view", {"commands": [], "sceneSet": False, "passwordAsked": False}),
    ("edit_content", {"commands": ALL_COMMANDS, "sceneSet": True, "passwordAsked": False}),
    ("edit", {"commands": ALL_COMMANDS, "sceneSet": True, "passwordAsked": True}),
])
def test_each_level_gets_what_hub_allows(level, expected):
    result = use_components_tab(level)
    del result["maintenanceLocked"]

    assert result == {"errors": [], "scenes": 1, **expected}


@pytest.mark.parametrize("maintenance, locked", [("view", True), ("edit", False)])
def test_maintenance_status_matches_the_maintenance_permission(maintenance, locked):
    result = use_components_tab("view", maintenance)

    assert result["errors"] == []
    assert result["maintenanceLocked"] == [locked, locked]
