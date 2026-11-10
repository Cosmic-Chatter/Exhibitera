"""Verify the permissions Apps' settings page shows for a component that hasn't set them all.

Each permission that isn't set is shown as what Apps does: only refreshing and restarting are allowed. The page used to show
sleeping as allowed, though Apps refuses to sleep unless it's been allowed.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

UNSET = {"audio": "false", "refresh": "true", "restart": "true", "shutdown": "false", "sleep": "false"}


@pytest.mark.parametrize("permissions, shown", [
    ({}, UNSET),
    ({"audio": True, "restart": False}, {**UNSET, "audio": "true", "restart": "false"})])
def test_unset_permissions_show_what_apps_does(permissions, shown):
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/definitions') return {{ body: {{ success: true, definitions: {{}} }} }}
          if (pathname === '/internal/data/') return {{ body: {{ success: true, files: [] }} }}
          if (pathname === '/internal/DMX/scenes') return {{ body: {{ success: true, scenes: [] }} }}
          if (pathname.endsWith('/groups')) return {{ body: {{ success: true, groups: [] }} }}
          if (pathname.endsWith('/user/login')) return {{ body: {{ success: false }} }}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('apps', 'setup.html')
        await browser.wait(800)
        const exCommon = await import({page_scripts.module_url("apps/js/exhibitera_app_common.js")})
        exCommon.config.updateParser({{ permissions: {json.dumps(permissions)} }})
        const value = (name) => window.document.getElementById('permissions' + name + 'Input').value
        report({{
          errors: browser.errors,
          shown: {{ audio: value('Audio'), refresh: value('Refresh'), restart: value('Restart'), shutdown: value('Shutdown'), sleep: value('Sleep') }}
        }})
    """, browser="page")

    assert result == {"errors": [], "shown": shown}
