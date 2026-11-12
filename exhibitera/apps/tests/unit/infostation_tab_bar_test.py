"""Verify InfoStation's Tab bar height setting, which sets the height of the tab buttons in portrait.

It's a percent of the screen height, alongside Sidebar width, the percent of the screen width the tab buttons take in
landscape. Its default, 7%, is the height portrait tab buttons always had.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom


def infostation_definition(layout: dict) -> dict:
    return {"uuid": "d1", "app": "infostation", "name": "Fossils", "behavior": {},
            "style": {"layout": layout, "color": {}, "font": {}, "text_size": {}},
            "tabs": {"t1": {"uuid": "t1", "type": "text"}, "t2": {"uuid": "t2", "type": "text"}}, "tab_order": ["t1", "t2"],
            "language_order": ["en-gb"],
            "languages": {"en-gb": {"display_name": "English", "header": {"text": "Fossils"},
                                    "tabs": {"t1": {"uuid": "t1", "button_text": "One", "text": "One"},
                                             "t2": {"uuid": "t2", "button_text": "Two", "text": "Two"}}}}}


@pytest.mark.parametrize("layout, height", [({}, "7"), ({"tab_bar_height": 12}, "12")])
def test_the_setting_sizes_the_tab_bar(layout, height):
    configuration = {"app": {"definition": "d1"}, "system": {"standalone": True, "remote_display": True}}
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/system/configuration') return {{ body: {json.dumps(configuration)} }}
          if (pathname === '/internal/definitions/d1/load') return {{ body: {{ success: true, definition: {json.dumps(infostation_definition(layout))} }} }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('apps', 'infostation/index.html')
        await browser.wait(500)
        report({{ errors: browser.errors, height: window.document.documentElement.style.getPropertyValue('--tab-bar-height') }})
    """, browser="page")

    assert result == {"errors": [], "height": height}


@pytest.mark.parametrize("layout, shown", [({}, "7"), ({"tab_bar_height": 12, "sidebar_width": 40}, "12")])
def test_setup_shows_both_sliders(layout, shown):
    definition = {**infostation_definition(layout), "uuid": "def-A"}
    result = page_scripts.run(f"""
        const {{ readFileSync }} = await import('node:fs')
        const definition = {json.dumps(definition)}
        globalThis.server = (method, url) => {{
          const path = decodeURIComponent(new URL(url).pathname)
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path.startsWith('/internal/definitions/app/')) return {{ body: {{ success: true, definitions: {{ 'def-A': definition }} }} }}
          if (path === '/internal/files/availableContent') return {{ body: {{ success: true, content: [] }} }}
          if (path.startsWith('/_fonts/')) return {{ bytes: readFileSync({json.dumps(str(page_scripts.EXHIBITERA_DIR / "apps"))} + path) }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        const window = await browser.openPage('apps', 'infostation/setup.html', {{ search: '?definition=def-A' }})
        await browser.wait(1500)
        const slider = (id) => window.document.getElementById(id)
        const value = (id) => slider(id).querySelector('.exAS_slider').value
        report({{
          errors: browser.errors,
          tabBar: {{ name: slider('tabBarHeightSlider').dataset.name, path: slider('tabBarHeightSlider').dataset.path, value: value('tabBarHeightSlider') }},
          sidebar: value('sidebarSizeSlider')
        }})
    """, browser="page")

    assert result == {"errors": [], "tabBar": {"name": "Tab bar height", "path": "style>layout>tab_bar_height", "value": shown},
                      "sidebar": "40" if layout else "30"}
