"""Verify that Apps setup pages tell staff whether a definition saved, and don't silently drop edits.

A failed save used to show nothing, and starting a new definition, opening another one, or leaving the
page discarded unsaved edits without asking. Opening a definition fills in the editor and can add
defaults to it, which isn't an edit, so only changes after the person starts working count.
"""

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_node

# Opens a definition the way each app's editDefinition() does, including a default filled in by code
SETUP = """
const state = { saveReply: { body: { success: true, uuid: 'def-A' } } }
globalThis.server = (method, url) => {
  const path = new URL(url).pathname
  if (path === '/internal/definitions/write') return state.saveReply
  if (path === '/internal/definitions/app/media_player') return { body: { success: true, definitions: {} } }
  return { body: { version: {} } }
}
globalThis.bootstrap = {
  Modal: {
    getOrCreateInstance: (el) => ({
      show () { el.shown = true },
      hide () {
        el.shown = false
        browser.personDoes('hidden.bs.modal', el)
      }
    })
  },
  Popover: class {}
}
console.log = () => {}
const exSetup = await import(MODULE)

const definition = { uuid: 'def-A', name: 'Lobby', app: 'media_player', style: { color: { text: 'white' } } }
exSetup.config.app = 'media_player'
exSetup.config.initialDefinition = structuredClone(definition)
exSetup.config.workingDefinition = structuredClone(definition)
document.getElementById('definitionNameInput').value = 'Lobby'
exSetup.updateWorkingDefinition(['setup', 'preview_ratio'], '16x9')

const edit = () => {
  browser.personDoes('input')
  exSetup.updateWorkingDefinition(['style', 'color', 'text'], 'red')
}
const allText = (el) => [el.textContent, ...el.children.map(allText)].join(' ')
const shownDialog = () => browser.findElement((el) => el.shown === true)
const dialogButton = (label) => browser.findElement((el) => el.tagName === 'BUTTON' && el.textContent === label)
const saveButton = document.getElementById('definitionSaveButton')
"""


def run_setup(script: str):
    return page_scripts.run(SETUP.replace("MODULE", page_scripts.module_url("apps/js/exhibitera_setup_common.js"))
                            + script)


def test_opening_a_definition_is_not_an_unsaved_change():
    result = run_setup("""
        browser.personDoes('pointerdown')
        report(exSetup.definitionHasUnsavedChanges())
    """)

    assert result is False


def test_editing_is_an_unsaved_change():
    assert run_setup("edit(); report(exSetup.definitionHasUnsavedChanges())") is True


def test_renaming_is_an_unsaved_change():
    result = run_setup("""
        browser.personDoes('keydown')
        document.getElementById('definitionNameInput').value = 'Foyer'
        report(exSetup.definitionHasUnsavedChanges())
    """)

    assert result is True


def test_saving_clears_unsaved_changes():
    result = run_setup("""
        edit()
        await exSetup.saveDefinition()
        report({ unsaved: exSetup.definitionHasUnsavedChanges(), dialog: shownDialog() != null })
    """)

    assert result == {"unsaved": False, "dialog": False}


BUTTON_STATE = "({ text: saveButton.textContent, disabled: saveButton.disabled })"
SAVE = {"text": "Save", "disabled": False}
SAVING = {"text": "Saving…", "disabled": True}
SAVED = {"text": "Saved", "disabled": False}


def test_saving_stays_long_enough_to_read():
    # Saving to Apps on the same computer takes milliseconds, which would make 'Saving…' flash
    result = run_setup(f"""
        edit()
        const saving = exSetup.saveDefinition()
        const start = {BUTTON_STATE}
        await saving
        const saved = {BUTTON_STATE}
        await browser.wait(500)
        const later = {BUTTON_STATE}
        await browser.wait(400)
        report({{ start, saved, later, done: {BUTTON_STATE} }})
    """)

    assert result == {"start": SAVING, "saved": SAVING, "later": SAVING, "done": SAVED}


def test_slow_save_shows_saving_until_it_finishes():
    result = run_setup(f"""
        edit()
        state.saveReply.delay = 1200
        const saving = exSetup.saveDefinition()
        await browser.wait(1000)
        const during = {BUTTON_STATE}
        await saving
        await browser.wait(50)
        report({{ during, done: {BUTTON_STATE} }})
    """)

    assert result == {"during": SAVING, "done": SAVED}


def test_saved_returns_to_save_after_two_seconds():
    result = run_setup(f"""
        edit()
        await exSetup.saveDefinition()
        await browser.wait(750 + 1800)
        const before = {BUTTON_STATE}
        await browser.wait(400)
        report({{ before, after: {BUTTON_STATE} }})
    """)

    assert result == {"before": SAVED, "after": SAVE}


@pytest.mark.parametrize("reply", ["'error'", "{ body: { success: false, reason: 'unsafe_filename' } }"])
def test_failed_save_keeps_the_changes_and_says_so(reply):
    result = run_setup(f"""
        edit()
        state.saveReply = {reply}
        await browser.settle(exSetup.saveDefinition())
        await browser.wait(800)
        const dialog = shownDialog()
        report({{
          unsaved: exSetup.definitionHasUnsavedChanges(),
          dialog: dialog ? allText(dialog) : null,
          button: {BUTTON_STATE}
        }})
    """)

    assert result["unsaved"] is True
    assert "not saved" in result["dialog"].lower()
    assert result["button"] == SAVE


def test_leaving_with_unsaved_changes_asks_first():
    result = run_setup("""
        browser.personDoes('pointerdown')
        const before = browser.personDoes('beforeunload', window).defaultPrevented
        edit()
        report({ before, after: browser.personDoes('beforeunload', window).defaultPrevented })
    """)

    assert result == {"before": False, "after": True}


def test_no_question_without_unsaved_changes():
    result = run_setup("""
        browser.personDoes('pointerdown')
        report({ discard: await exSetup.confirmDiscardChanges(), dialog: shownDialog() != null })
    """)

    assert result == {"discard": True, "dialog": False}


@pytest.mark.parametrize("choice, expected", [("Discard changes", True), ("Keep editing", False), (None, False)])
def test_discarding_unsaved_changes_asks_first(choice, expected):
    choose = (f"dialogButton({choice!r}).click()" if choice
              else "browser.personDoes('hidden.bs.modal', shownDialog())")  # Closed some other way
    result = run_setup(f"""
        edit()
        const answer = exSetup.confirmDiscardChanges()
        const asked = shownDialog() != null
        {choose}
        report({{ asked, discard: await answer }})
    """)

    assert result == {"asked": True, "discard": expected}
