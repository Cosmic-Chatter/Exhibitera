"""Verify that InfoStation's setup page only lets you add tabs once the definition has a language.

A tab's button text and body are stored per language. Adding a tab with no languages gave it no text at all, and
adding a language afterwards left it blank. Like Media Browser and Timeline Explorer, the content section should
prompt you to add a language first.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom


def test_tabs_need_a_language():
    # A definition can have tabs but no languages, if its last language was deleted
    definition = {"uuid": "def-A", "name": "No language", "app": "infostation", "style": {}, "behavior": {},
                  "tabs": {"t1": {"type": "text", "uuid": "t1"}}, "tab_order": ["t1"],
                  "languages": {}, "language_order": []}

    result = page_scripts.run(f"""
        const definition = {json.dumps(definition)}
        globalThis.server = (method, url) => {{
          const path = new URL(url).pathname
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path.startsWith('/internal/definitions/app/')) {{
            return {{ body: {{ success: true, definitions: {{ 'def-A': definition }} }} }}
          }}
          if (path === '/internal/files/availableContent') return {{ body: {{ success: true, content: [] }} }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        const window = await browser.openPage('apps', 'infostation/setup.html', {{ search: '?definition=def-A' }})
        await browser.wait(1500)
        const document = window.document
        const exSetup = await import({page_scripts.module_url("apps/js/exhibitera_setup_common.js")})
        const display = (id) => document.getElementById(id).style.display
        const state = () => ({{ prompt: display('contentNoLanguagesAlert'), tabEditor: display('contentInterface') }})

        const withoutLanguage = state()

        // Add the language that the picker starts on
        document.querySelector('#languagePicker button.btn-primary').click()
        await browser.wait(200)
        const withLanguage = state()

        document.getElementById('addTabButton').click()
        await browser.wait(200)
        const def = exSetup.config.workingDefinition
        const newTab = def.tab_order[1]
        report({{
          errors: browser.errors,
          withoutLanguage,
          withLanguage,
          languages: def.language_order,
          newTabText: def.languages[def.language_order[0]].tabs[newTab].button_text
        }})
    """, browser="page")

    assert result == {"errors": [],
                      "withoutLanguage": {"prompt": "block", "tabEditor": "none"},
                      "withLanguage": {"prompt": "none", "tabEditor": "flex"},
                      "languages": ["en-gb"],
                      "newTabText": "New Tab"}
