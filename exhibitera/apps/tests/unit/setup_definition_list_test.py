"""Verify the list of definitions on the setup pages, including definitions saved without a name.

Definitions made by hand, or by older versions, may have no name. The list used to sort by name without
checking, so one unnamed definition left a setup page with an empty list. Opening such a definition also
showed "undefined" as its name.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

DEFINITIONS = {
    "lobby": {"uuid": "lobby", "name": "lobby loop", "app": "media_player"},
    "unnamed": {"uuid": "unnamed", "app": "media_player"},
    "atrium": {"uuid": "atrium", "name": "Atrium", "app": "media_player"},
}


def open_media_player_setup(script: str):
    return page_scripts.run(f"""
        const definitions = {json.dumps(DEFINITIONS)}
        globalThis.server = (method, url) => {{
          const path = new URL(url).pathname
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path.startsWith('/internal/definitions/app/')) return {{ body: {{ success: true, definitions }} }}
          if (path === '/internal/files/availableContent') {{
            return {{ body: {{ content: [], content_details: [], static: [], static_details: [] }} }}
          }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('apps', 'media_player/setup.html')
        const document = window.document
        const exSetup = await import({page_scripts.module_url("apps/js/exhibitera_setup_common.js")})
        await browser.wait(1500)
        {script}
    """, browser="page")


def test_unnamed_definitions_are_listed():
    result = open_media_player_setup("""
        const options = [...document.getElementById('availableDefinitionSelect').options]
        report({ listed: options.map((o) => [o.value, o.textContent]), errors: browser.errors })
    """)

    assert result == {"listed": [["unnamed", "Unnamed definition"], ["atrium", "Atrium"], ["lobby", "lobby loop"]],
                      "errors": []}


def test_opening_an_unnamed_definition_leaves_the_name_blank():
    result = open_media_player_setup("""
        // Give the unnamed definition the fields Media Player expects, but no name
        const definition = structuredClone(exSetup.config.blankDefinition)
        Object.assign(definition, { uuid: 'unnamed', app: 'media_player' })
        delete definition.name
        exSetup.populateAvailableDefinitions({ ...definitions, unnamed: definition })
        exSetup.config.loadDefinition('unnamed')
        await browser.wait(500)
        report({ name: document.getElementById('definitionNameInput').value, errors: browser.errors })
    """)

    assert result == {"name": "", "errors": []}
