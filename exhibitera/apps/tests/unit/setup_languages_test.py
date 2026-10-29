"""Verify that setup pages can open a definition that has items but no languages.

Deleting a definition's last language keeps its items. Media Browser and Timeline Explorer used to fail
partway through opening such a definition, leaving the item list empty. Their items should be listed by
filename, with the existing prompt to add a language.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

ITEMS = {"i1": {"uuid": "i1", "filename": "fossil.jpg", "filter_data": {}},
         "i2": {"uuid": "i2", "filename": "shell.jpg", "filter_data": {}}}


@pytest.mark.parametrize("app", ["media_browser", "timeline_explorer"])
def test_definition_without_languages_opens(app):
    definition = {"uuid": "def-A", "name": "No language", "app": app, "content": ITEMS,
                  "content_order": ["i1", "i2"], "languages": {}, "language_order": [], "style": {}}

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
        const window = await browser.openPage('apps', '{app}/setup.html', {{ search: '?definition=def-A' }})
        await browser.wait(1500)
        const document = window.document
        report({{
          errors: browser.errors,
          items: [...document.querySelectorAll('#itemsList button')].map((b) => b.textContent),
          languagePrompt: document.getElementById('contentNoLanguagesAlert').style.display
        }})
    """, browser="page")

    assert result == {"errors": [], "items": ["fossil.jpg", "shell.jpg"], "languagePrompt": "block"}
