"""Verify exhibitera_core_api.js, the library third-party apps use inside Exhibitera Apps' Custom App.

See https://exhibitera.org/api/6/. Inside a Custom App, the library reaches Exhibitera through the Custom App page.
These used to fail:
- With local = false, raw text went to Hub whenever Apps had a Hub address, even when it was set to standalone.
- writeRawText() is documented as async, but didn't return its request, so it couldn't be awaited.
- getRawText() is documented to return '' when it can't read the file, but threw when the request failed.
- Outside a running Custom App, every function threw: in the setup page's preview, where settings now come from
  the definition being edited, and when the app is opened on its own, when raw text goes straight to Apps.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_node


def run_library(parent: str, script: str, fetch_reply: str = "{ success: true, text: 'from Apps' }") -> dict:
    """Import the library with the given window.parent, and run script.

    parent can use `exCommon`, a stand-in for the Custom App page's exCommon that records its requests.
    """

    return page_scripts.run(f"""
        const requests = []
        const exCommon = {{
          config: {{ standalone: false, definition: {{ properties: {{ time: 'night' }} }}, currentInteraction: false }},
          makeHelperRequest: async (options) => {{ requests.push(['Apps', options.endpoint, options.api, options.params ?? null]); return reply('Apps') }},
          makeServerRequest: async (options) => {{ requests.push(['Hub', options.endpoint, options.api, options.params ?? null]); return reply('Hub') }}
        }}
        let reply = (from) => ({{ success: true, text: 'from ' + from }})
        const fetched = []
        globalThis.fetch = async (url, init) => {{
          fetched.push([url, init?.method ?? 'GET', init?.body ? JSON.parse(init.body) : null])
          const body = {fetch_reply}
          if (body === 'error') throw new TypeError('Failed to fetch')
          return {{ ok: true, json: async () => body }}
        }}
        console.warn = () => {{}}
        window.parent = {parent}
        const core = await import({page_scripts.module_url("apps/js/exhibitera_core_api.js")})
        {script}
    """)


# Inside a Custom App

def test_settings_and_activity_go_through_the_custom_app_page():
    result = run_library("{ exCommon }", """
        const properties = core.getDefinitionProperties()
        core.setInteraction(true)
        const active = exCommon.config.currentInteraction
        core.setInteraction(false)
        report({ properties, active, ended: exCommon.config.currentInteraction })
    """)

    assert result == {"properties": {"time": "night"}, "active": True, "ended": False}


@pytest.mark.parametrize("standalone, local, sent_to", [(False, True, "Apps"), (False, False, "Hub"),
                                                        # Apps that doesn't use Hub keeps the data itself
                                                        (True, False, "Apps"), (True, True, "Apps")])
def test_raw_text_goes_to_apps_or_hub(standalone, local, sent_to):
    result = run_library("{ exCommon }", f"""
        exCommon.config.standalone = {json.dumps(standalone)}
        const written = await core.writeRawText('feedback', 'Great', 'a', {json.dumps(local)})
        const text = await core.getRawText('feedback', {json.dumps(local)})
        report({{ written, text, requests }})
    """)

    assert result == {"written": {"success": True, "text": f"from {sent_to}"}, "text": f"from {sent_to}",
                      "requests": [[sent_to, "/data/feedback/rawText", "/core", {"mode": "a", "text": "Great"}],
                                   [sent_to, "/data/feedback/rawText", "/core", None]]}


def test_failed_requests():
    result = run_library("{ exCommon }", """
        reply = () => { throw new Error('No connection') }
        const written = await core.writeRawText('feedback', 'Great')
        const text = await core.getRawText('feedback')
        reply = () => ({ success: false, reason: 'File not found' })
        report({ written, text, missing: await core.getRawText('feedback') })
    """)

    assert result == {"written": {"success": False, "reason": "Error: No connection"}, "text": "", "missing": ""}


# Outside a Custom App

@pytest.mark.parametrize("parent", ["window", "undefined",
                                    # Inside another website's page, which the browser won't let it read
                                    "new Proxy({}, { get () { throw new DOMException('Blocked', 'SecurityError') } })"])
def test_outside_a_custom_app(parent):
    result = run_library(parent, """
        const properties = core.getDefinitionProperties()
        core.setInteraction(true)
        const written = await core.writeRawText('feedback', 'Great', 'w', false)
        const text = await core.getRawText('feedback')
        report({ properties, written, text, fetched })
    """)

    # Raw text is saved with Exhibitera Apps directly. There's no Hub to send it to.
    assert result == {"properties": {}, "written": {"success": True, "text": "from Apps"}, "text": "from Apps",
                      "fetched": [["/core/data/feedback/rawText", "POST", {"mode": "w", "text": "Great"}],
                                  ["/core/data/feedback/rawText", "GET", None]]}


def test_outside_a_custom_app_without_apps():
    result = run_library("window", """
        report({ written: await core.writeRawText('feedback', 'Great'), text: await core.getRawText('feedback') })
    """, fetch_reply="'error'")

    assert result == {"written": {"success": False, "reason": "TypeError: Failed to fetch"}, "text": ""}


# The setup page's preview

@page_scripts.needs_jsdom
def test_the_preview_reaches_exhibitera_through_the_setup_page():
    definition = {"uuid": "def-A", "name": "Memory game", "app": "other", "mode": "files", "path": "",
                  "properties": {"time": "night"}, "style": {}}
    result = page_scripts.run(f"""
        const {{ readFileSync }} = await import('node:fs')
        const definition = {json.dumps(definition)}
        globalThis.server = (method, url) => {{
          const path = decodeURIComponent(new URL(url).pathname)
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path.startsWith('/internal/definitions/app/')) return {{ body: {{ success: true, definitions: {{ 'def-A': definition }} }} }}
          if (path === '/internal/files/availableContent') return {{ body: {{ success: true, content: [] }} }}
          if (path.startsWith('/_fonts/')) return {{ bytes: readFileSync({json.dumps(str(page_scripts.EXHIBITERA_DIR / "apps"))} + path) }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        const window = await browser.openPage('apps', 'other/setup.html', {{ search: '?definition=def-A' }})
        await browser.wait(1000)
        const exSetup = await import({page_scripts.module_url("apps/js/exhibitera_setup_common.js")})
        const before = window.exCommon.config.definition.properties
        // Settings that haven't been saved yet reach the preview too
        exSetup.updateWorkingDefinition(['properties'], {{ time: 'day' }})
        window.exCommon.config.currentInteraction = true
        report({{
          errors: browser.errors,
          before,
          after: window.exCommon.config.definition.properties,
          standalone: window.exCommon.config.standalone,
          requests: [typeof window.exCommon.makeHelperRequest, typeof window.exCommon.makeServerRequest]
        }})
    """, browser="page")

    assert result == {"errors": [], "before": {"time": "night"}, "after": {"time": "day"}, "standalone": True,
                      "requests": ["function", "function"]}
