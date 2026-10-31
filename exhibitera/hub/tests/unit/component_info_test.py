"""Verify the console's component dialog for components that report different platform details.

Components report their operating system in their pings, which the maintenance panel uses to decide
whether to show CPU use (Windows doesn't report it). Third-party components may not report an operating
system at all, and the panel used to throw an error for them.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

ADMIN = {"uuid": "u1", "username": "admin", "display_name": "Admin", "preferences": {},
         "permissions": {"analytics": "edit", "components": {"edit": ["__all"], "edit_content": ["__all"], "view": ["__all"]},
                         "exhibits": "edit", "maintenance": "edit", "programs": "edit", "schedule": "edit",
                         "settings": "edit", "users": "edit"}}


MAINTENANCE_REPORT = {"success": True, "status": {"status": "On floor, working", "notes": "",
                                                   "working_pct": 100, "not_working_pct": 0}}


def open_component_dialog(platform_details: dict, maintenance_reply: dict = MAINTENANCE_REPORT) -> dict:
    component = {"class": "exhibitComponent", "uuid": "kiosk-1", "id": "Lobby kiosk", "groups": ["Default"],
                 "helperAddress": "http://kiosk.test", "api_level": 6.1, "ip_address": "10.0.0.5", "latency": 0,
                 "platform_details": platform_details, "maintenance_status": "On floor, working", "status": "ONLINE",
                 "content": [], "definition": "", "notifications": {}, "permissions": {}, "description": ""}
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
            return {{ body: {{ success: false }} }}
          }}
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          if (pathname === '/internal/maintenance/kiosk-1') return {{ body: {json.dumps(maintenance_reply)} }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        browser.sendUpdate({{ gallery: {json.dumps(gallery)}, components: [{json.dumps(component)}] }})
        await browser.wait(300)
        const componentInfo = await import({page_scripts.module_url("hub/js/features/component_info_modal.js")})
        componentInfo.showExhibitComponentInfo('kiosk-1')
        await browser.wait(1500)
        report({{
          errors: browser.errors,
          cpuShown: window.document.getElementById('componentInfoModalMaintenanceCPUBar').style.display
        }})
    """, browser="page")


@pytest.mark.parametrize("platform_details, cpu_shown", [({}, "block"),
                                                         ({"browser": "Chrome 120"}, "block"),
                                                         ({"operating_system": "OS X 14"}, "block"),
                                                         ({"operating_system": "Windows 11"}, "none")])
def test_maintenance_panel_handles_any_platform_details(platform_details, cpu_shown):
    assert open_component_dialog(platform_details) == {"errors": [], "cpuShown": cpu_shown}


@pytest.mark.parametrize("reason", ["insufficient_permission", "invalid_uuid"])
def test_maintenance_panel_handles_a_refused_status_request(reason):
    result = open_component_dialog({"operating_system": "OS X 14"}, {"success": False, "reason": reason})

    assert result["errors"] == []
