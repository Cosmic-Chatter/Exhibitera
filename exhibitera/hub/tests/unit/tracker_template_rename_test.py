"""Verify creating, renaming and cloning Flexible Tracker templates in the console's Analytics tab.

As for exhibitions and programs, a Create menu offers "Create new" and "Clone selected". A new template
opens in the editor, where it can be named.

Data are stored by the template's UUID, so renaming a template keeps its data together. A clone is a new
template, with its own UUID, so it collects its own data.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.hub.tests.unit.tracker_template_test import ADMIN, TEMPLATE

pytestmark = page_scripts.needs_jsdom


def run_console(script: str):
    """Open the console with a fake Hub that keeps the templates saved to it, open t1 for editing, and run script."""

    return page_scripts.run(f"""
        const templates = {{ t1: {json.dumps(TEMPLATE)} }}
        globalThis.server = (method, url, body) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') {{
            return {{ body: Object.values(templates).map((t) => ({{ uuid: t.uuid, name: t.name }})) }}
          }}
          const load = pathname.match(/^\\/internal\\/tracker\\/template\\/([\\w-]+)$/)
          if (load && method === 'GET') return {{ body: {{ success: true, template: templates[load[1]] }} }}
          if (pathname === '/internal/tracker/template/create') {{
            const sent = JSON.parse(body)
            templates[sent.tracker_uuid] = sent.template
            return {{ body: {{ success: true }} }}
          }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        const document = window.document
        await browser.wait(1000)

        const editor = document.getElementById('trackerTemplateEditor')
        const select = document.getElementById('trackerTemplateSelect')
        const nameInput = document.getElementById('trackerTemplateEditorNameInput')
        const listedNames = () => [...select.options].map((o) => o.textContent)
        const saves = () => browser.requests.filter((r) => r.url.endsWith('/tracker/template/create')).length
        const rename = (value) => {{
          nameInput.value = value
          nameInput.dispatchEvent(new window.Event('input'))
        }}

        select.value = 't1'
        document.getElementById('showEditTrackerTemplateButton').click()
        await browser.wait(500)

        {script}
    """, browser="page")


def test_renaming_a_template_keeps_its_uuid():
    result = run_console("""
        const shown = nameInput.value
        rename('  Lobby flow  ')
        const unsaved = editor.dataset.template !== editor.dataset.savedTemplate
        document.getElementById('trackerTemplateEditorSaveButton').click()
        await browser.wait(500)
        report({
          errors: browser.errors,
          shown,
          unsaved,
          saved: [templates.t1.uuid, templates.t1.name, templates.t1.widget_order],
          listed: listedNames(),
          selected: select.value,
          savedAfter: editor.dataset.template === editor.dataset.savedTemplate,
          heading: editor.textContent.includes('Lobby flow') || nameInput.value === 'Lobby flow'
        })
    """)

    assert result == {"errors": [], "shown": "Gallery flow", "unsaved": True,
                      "saved": ["t1", "Lobby flow", ["w1", "w2", "w3"]], "listed": ["Lobby flow"],
                      "selected": "t1", "savedAfter": True, "heading": True}


def test_a_template_needs_a_name():
    result = run_console("""
        rename('   ')
        const before = saves()
        document.getElementById('trackerTemplateEditorSaveButton').click()
        await browser.wait(500)
        const dialog = document.getElementById('trackerNameRequiredModal')
        report({
          errors: browser.errors,
          asked: dialog.classList.contains('show'),
          message: dialog.querySelector('.modal-body').textContent.trim(),
          saved: saves() - before,
          name: templates.t1.name
        })
    """)

    assert result == {"errors": [], "asked": True,
                      "message": "A name is required. Enter a name for this template, then save again.",
                      "saved": 0, "name": "Gallery flow"}


def test_cloning_a_template_opens_a_copy_with_its_own_uuid():
    result = run_console("""
        document.getElementById('cloneTrackerTemplateButton').click()
        await browser.wait(800)
        const clone = Object.values(templates).find((t) => t.uuid !== 't1')
        report({
          errors: browser.errors,
          count: Object.keys(templates).length,
          clone: [clone.name, clone.widget_order, JSON.stringify(clone.widgets) === JSON.stringify(templates.t1.widgets)],
          original: templates.t1.name,
          listed: listedNames().sort(),
          selected: select.value === clone.uuid,
          editing: [JSON.parse(editor.dataset.template).uuid === clone.uuid, nameInput.value]
        })
    """)

    assert result == {"errors": [], "count": 2, "clone": ["Gallery flow 2", ["w1", "w2", "w3"], True],
                      "original": "Gallery flow", "listed": ["Gallery flow", "Gallery flow 2"], "selected": True,
                      "editing": [True, "Gallery flow 2"]}


def test_cloning_asks_about_unsaved_changes_first():
    result = run_console("""
        rename('Changed')
        const before = saves()
        document.getElementById('cloneTrackerTemplateButton').click()
        await browser.wait(500)
        report({
          errors: browser.errors,
          asked: document.getElementById('trackerUnsavedChangesModal').classList.contains('show'),
          saved: saves() - before
        })
    """)

    assert result == {"errors": [], "asked": True, "saved": 0}


def test_create_menu_matches_exhibitions_and_programs():
    result = run_console("""
        const menu = document.getElementById('createTrackerTemplateButton').closest('.dropdown')
        report({
          toggle: menu.querySelector('.dropdown-toggle').textContent.trim(),
          items: [...menu.querySelectorAll('.dropdown-item')].map((item) => [item.id, item.textContent.trim()]),
          nameField: document.getElementById('createTrackerTemplateName')
        })
    """)

    assert result == {"toggle": "Create",
                      "items": [["createTrackerTemplateButton", "Create new"], ["cloneTrackerTemplateButton", "Clone selected"]],
                      "nameField": None}


def test_create_new_opens_a_new_template_ready_to_name():
    result = run_console("""
        document.getElementById('createTrackerTemplateButton').click()
        await browser.wait(800)
        const created = Object.values(templates).find((t) => t.uuid !== 't1')
        report({
          errors: browser.errors,
          created: [created.name, created.widget_order],
          selected: select.value === created.uuid,
          editing: JSON.parse(editor.dataset.template).uuid === created.uuid,
          name: nameInput.value,
          nameReadyToType: document.activeElement === nameInput &&
            nameInput.selectionStart === 0 && nameInput.selectionEnd === nameInput.value.length
        })
    """)

    assert result == {"errors": [], "created": ["New template", []], "selected": True, "editing": True,
                      "name": "New template", "nameReadyToType": True}
