"""Verify that Ctrl-S (Cmd-S on a Mac) saves the definition in Apps setup pages.

The browser's own shortcut saves the web page, which isn't what staff mean while editing a definition. The
shortcut does what the Save button does, including the value in the field being typed in, but doesn't save
over a dialog, such as the setup wizard.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

DEFINITION = {"uuid": "def-A", "name": "Lobby", "app": "infostation", "style": {}, "behavior": {},
              "tabs": {}, "tab_order": [], "languages": {}, "language_order": []}


def run_setup(script: str):
    """Open InfoStation's setup page with a definition, run script, and report what it saved."""

    return page_scripts.run(f"""
        const {{ readFileSync }} = await import('node:fs')
        const definition = {json.dumps(DEFINITION)}
        globalThis.server = (method, url) => {{
          const path = decodeURIComponent(new URL(url).pathname)
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path.startsWith('/internal/definitions/app/')) {{
            return {{ body: {{ success: true, definitions: {{ 'def-A': definition }} }} }}
          }}
          if (path === '/internal/definitions/write') return {{ body: {{ success: true, uuid: 'def-A' }}, delay: 300 }}
          if (path === '/internal/files/availableContent') return {{ body: {{ success: true, content: [] }} }}
          if (path.startsWith('/_fonts/')) return {{ bytes: readFileSync({json.dumps(str(page_scripts.EXHIBITERA_DIR / "apps"))} + path) }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        const window = await browser.openPage('apps', 'infostation/setup.html', {{ search: '?definition=def-A' }})
        await browser.wait(1500)
        const document = window.document
        const press = (key, modifiers = {{}}, target = document.body) => {{
          const event = new window.KeyboardEvent('keydown', {{ key, bubbles: true, cancelable: true, ...modifiers }})
          target.dispatchEvent(event)
          return event.defaultPrevented
        }}
        // Previews are written too, under their own UUID
        const saves = () => browser.requests.filter((r) => r.url.endsWith('/definitions/write'))
          .map((r) => JSON.parse(r.body).definition).filter((d) => d.uuid === 'def-A')
        {script}
    """, browser="page")


@pytest.mark.parametrize("modifier", ["ctrlKey", "metaKey"])
def test_shortcut_saves_the_definition(modifier):
    result = run_setup(f"""
        const prevented = press('s', {{ {modifier}: true }})
        await browser.wait(1200)
        report({{ errors: browser.errors, prevented, saved: saves().map((d) => d.name),
                  button: document.getElementById('definitionSaveButton').textContent }})
    """)

    assert result == {"errors": [], "prevented": True, "saved": ["Lobby"], "button": "Saved"}


def test_shortcut_includes_the_field_being_typed_in():
    # The inactivity timeout is only recorded when the field is changed, which normally happens when leaving it
    result = run_setup("""
        const field = document.getElementById('inactivityTimeoutField')
        field.focus()
        field.value = '90'
        press('S', { ctrlKey: true, shiftKey: false }, field)
        await browser.wait(1200)
        report({ errors: browser.errors, saved: saves().map((d) => d.behavior.inactivity_timeout),
                 stillTyping: document.activeElement === field })
    """)

    assert result == {"errors": [], "saved": ["90"], "stillTyping": True}


def test_shortcut_saves_once_while_saving():
    result = run_setup("""
        press('s', { ctrlKey: true })
        await browser.wait(50)
        const prevented = press('s', { ctrlKey: true })
        await browser.wait(1200)
        report({ errors: browser.errors, prevented, saved: saves().length })
    """)

    assert result == {"errors": [], "prevented": True, "saved": 1}


def test_other_shortcuts_are_left_alone():
    result = run_setup("""
        const prevented = [press('s'), press('s', { ctrlKey: true, shiftKey: true }), press('s', { ctrlKey: true, altKey: true }),
                           press('a', { ctrlKey: true })]
        await browser.wait(1200)
        report({ errors: browser.errors, prevented, saved: saves().length })
    """)

    assert result == {"errors": [], "prevented": [False, False, False, False], "saved": 0}


def test_shortcut_doesnt_save_over_a_dialog():
    result = run_setup("""
        document.getElementById('setupWizardModal').classList.add('show')
        const prevented = press('s', { ctrlKey: true })
        await browser.wait(1200)
        report({ errors: browser.errors, prevented, saved: saves().length })
    """)

    # The browser still shouldn't save the web page
    assert result == {"errors": [], "prevented": True, "saved": 0}
