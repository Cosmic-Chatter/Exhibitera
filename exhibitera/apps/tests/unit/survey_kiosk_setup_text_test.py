"""Verify that Survey Kiosk's setup page edits the Start over button and "Are you still working?" text per language.

Each language has a tab with the three texts. A text that's left empty is shown in English, as its placeholder says.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

DEFINITION = {"uuid": "def-A", "name": "Exit survey", "app": "survey_kiosk",
              "style": {"color": {}, "text_size": {}, "font": {}, "layout": {}}, "behavior": {}, "text": {},
              "item_order": [], "items": {},
              "language_order": ["en-gb", "fr"],
              "languages": {"en-gb": {"display_name": "English", "english_name": "English", "items": {}},
                            "fr": {"display_name": "Français", "english_name": "French", "items": {},
                                   "interface": {"restart": "Recommencer"}}}}


def test_each_language_has_its_own_text():
    result = page_scripts.run(f"""
        const {{ readFileSync }} = await import('node:fs')
        const definition = {json.dumps(DEFINITION)}
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
        const window = await browser.openPage('apps', 'survey_kiosk/setup.html', {{ search: '?definition=def-A' }})
        await browser.wait(1500)
        const document = window.document
        const exSetup = await import({page_scripts.module_url("apps/js/exhibitera_setup_common.js")})
        const field = (code, key) => document.getElementById(`interfaceText_${{code}}_${{key}}`)
        const fields = (code) => Object.fromEntries(['restart', 'still_working', 'keep_working']
          .map((key) => [key, {{ value: field(code, key).value, placeholder: field(code, key).placeholder }}]))

        const tabs = [...document.querySelectorAll('#interfaceTextNav button')].map((tab) => tab.textContent)
        const shown = {{ en: fields('en-gb'), fr: fields('fr') }}

        field('fr', 'keep_working').value = '  Continuer '
        field('fr', 'keep_working').dispatchEvent(new window.Event('change'))
        report({{ errors: browser.errors, tabs, shown, saved: exSetup.config.workingDefinition.languages.fr.interface }})
    """, browser="page")

    english = {"restart": "Start over", "still_working": "Are you still working?", "keep_working": "Keep working"}
    assert result["errors"] == []
    assert result["tabs"] == ["English (U.K.)", "French"]
    assert result["shown"] == {
        "en": {key: {"value": "", "placeholder": text} for key, text in english.items()},
        "fr": {key: {"value": "Recommencer" if key == "restart" else "", "placeholder": text}
               for key, text in english.items()}}
    assert result["saved"] == {"restart": "Recommencer", "keep_working": "Continuer"}
