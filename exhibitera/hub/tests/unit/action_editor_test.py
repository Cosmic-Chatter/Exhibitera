"""Verify the action editors for schedules, programs, and exhibitions, with components that are offline or gone.

"Set definition" and "Set DMX scene" list their options by asking the component. When it can't answer, the editor
says why and won't save the action without a value. When editing, the saved value is selected, and targets that Hub
no longer has stay selected, so saving other changes doesn't change or drop them.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.hub.tests.unit.tracker_template_test import ADMIN

pytestmark = page_scripts.needs_jsdom

# c1 answers, c2 has no address yet, and c3 has an address but doesn't answer. c4 and c5 answer, but can't list
# lighting scenes: c4 doesn't have DMX set up, and c5 can't find its DMX controller.
COMPONENTS = [{"uuid": "c1", "id": "Lobby kiosk", "helperAddress": "http://c1", "answers": True},
              {"uuid": "c2", "id": "New kiosk", "helperAddress": "", "answers": False},
              {"uuid": "c3", "id": "Unplugged kiosk", "helperAddress": "http://c3", "answers": False},
              {"uuid": "c4", "id": "Video wall", "helperAddress": "http://c4", "answers": True, "dmx": "no_config_file"},
              {"uuid": "c5", "id": "Light booth", "helperAddress": "http://c5", "answers": True, "dmx": "device_not_found"}]

EDITORS = ["schedule", "program", "exhibition"]
# Exhibitions can't set definitions
DEFINITION_EDITORS = ["schedule", "program"]


def run_editor(editor: str, script: str):
    """Open the console with the components above, and run script with helpers for the given action editor."""

    return page_scripts.run(f"""
        globalThis.server = (method, url, body) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        const document = window.document
        await browser.wait(1000)
        const schedules = await import({page_scripts.module_url("hub/js/features/schedules.js")})
        const programs = await import({page_scripts.module_url("hub/js/features/programs.js")})
        const exhibits = await import({page_scripts.module_url("hub/js/features/exhibits.js")})
        const hubConfig = (await import({page_scripts.module_url("hub/config.js")})).default

        for (const details of {json.dumps(COMPONENTS)}) {{
          hubConfig.exhibitComponents.push({{
            ...details,
            type: 'exhibit_component',
            status: hubConfig.STATUS.ONLINE,
            getHelperURL: () => details.helperAddress,
            getHelperAPI: () => '',
            makeRequest: async ({{ endpoint }}) => {{
              if (!details.answers) throw new Error('No answer')
              if (endpoint === '/definitions') {{
                return {{ success: true, definitions: {{ d1: {{ uuid: 'd1', name: 'Welcome', app: 'media_player' }},
                                                       d2: {{ uuid: 'd2', name: 'Closing', app: 'media_player' }} }} }}
              }}
              if (details.dmx) return {{ success: false, reason: details.dmx }}
              return {{ success: true, scenes: [{{ uuid: 's1', name: 'Bright' }}, {{ uuid: 's2', name: 'Dim' }}] }}
            }}
          }})
        }}

        const el = (id) => document.getElementById(id)
        const requested = (part) => browser.requests.filter((r) => r.url.includes(part)).map((r) => JSON.parse(r.body))
        el('saveProgramButton').dataset.uuid = 'p1'

        // How to open, save, and read each editor. saved() lists the target and value of each action saved.
        const editors = {{
          schedule: {{
            ids: {{ action: 'scheduleActionSelector', target: 'scheduleTargetSelector', value: 'scheduleValueSelector', warning: 'scheduleEditErrorAlert', save: 'scheduleEditSubmitButton' }},
            open: async (item) => {{
              if (item == null) {{
                schedules.scheduleConfigureEditModal('monday', 'day-specific', true)
                el('scheduleActionTimeInput').value = '9:00 AM'
              }} else schedules.scheduleConfigureEditModal('monday', 'day-specific', false, 'a1', 3600, item.action, item.target, item.value)
            }},
            saved: () => requested('/update').map((r) => [r.target_to_set, r.value_to_set])
          }},
          program: {{
            ids: {{ action: 'programActionSelector', target: 'programActionTargetSelector', value: 'programActionValueSelector', warning: 'programActionEditErrorAlert', save: 'programActionEditSubmitButton' }},
            open: async (item) => {{
              await programs.showprogramActionEditModal(item == null ? null : {{ uuid: 'a1', time_offset: 0, ...item }})
              el('programActionTimeInput').value = '0'
            }},
            saved: () => requested('/program/p1/action').map((r) => [r.action.target, r.action.value])
          }},
          exhibition: {{
            ids: {{ action: 'editExhibitActionSelector', target: 'editExhibitActionTargetSelector', value: 'editExhibitActionValueSelector', warning: 'editExhibitActionEditErrorAlert', save: 'editExhibitActionEditSubmitButton' }},
            open: async (item) => {{
              // Exhibition actions are saved to the list in the exhibition editor
              el('editExhibitActionsList').innerHTML = '<div id="actionListing_a1"></div>'
              await exhibits.showEditExhibitActionModal(item == null ? null : {{ uuid: 'a1', ...item }})
            }},
            saved: () => [...document.querySelectorAll('#editExhibitActionsList .actionListing')]
              .map((listing) => JSON.parse(listing.dataset.action)).map((a) => [a.target, a.value])
          }}
        }}
        const editor = editors[{json.dumps(editor)}]
        const ids = editor.ids

        const choose = async (role, value) => {{
          el(ids[role]).value = value
          el(ids[role]).dispatchEvent(new window.Event('change'))
          await browser.wait(100)
        }}
        const edit = async (item) => {{
          await editor.open(item)
          await browser.wait(200)
        }}
        const newAction = async (action, component) => {{
          await editor.open(null)
          await browser.wait(100)
          await choose('action', action)
          await choose('target', JSON.stringify({{ type: 'component', uuid: component }}))
        }}
        const save = async () => {{
          el(ids.save).click()
          await browser.wait(200)
          return editor.saved()
        }}
        // The warning that's shown, if any
        const warning = () => el(ids.warning).style.display === 'none' ? '' : el(ids.warning).textContent
        const selectedTargets = () => [...el(ids.target).selectedOptions].map((o) => [o.textContent, JSON.parse(o.value)])
        {script}
    """, browser="page")


def not_responding(options):
    return f"This component is not responding, so its {options} can't be listed"


@pytest.mark.parametrize("editor", EDITORS)
def test_actions_need_a_value_from_the_component(editor):
    actions = [["set_dmx_scene", "c2"], ["set_dmx_scene", "c3"]]
    if editor in DEFINITION_EDITORS:
        actions += [["set_definition", "c2"], ["set_definition", "c3"]]
    result = run_editor(editor, f"""
        const results = {{}}
        for (const [action, component] of {json.dumps(actions)}) {{
          await newAction(action, component)
          const shown = warning()
          results[action + ' ' + component] = {{ shown, saved: (await save()).length, onSave: warning() }}
        }}
        report({{ errors: browser.errors, results }})
    """)

    assert result["errors"] == []
    # A component that doesn't answer gets the same warning as one without an address
    expected = {"set_dmx_scene c2": not_responding("lighting scenes"), "set_dmx_scene c3": not_responding("lighting scenes")}
    if editor in DEFINITION_EDITORS:
        expected |= {"set_definition c2": not_responding("definitions"),
                     "set_definition c3": not_responding("definitions")}
    assert result["results"] == {key: {"shown": message, "saved": 0, "onSave": message}
                                 for key, message in expected.items()}


@pytest.mark.parametrize("editor", EDITORS)
def test_actions_with_a_value_are_saved(editor):
    result = run_editor(editor, """
        await newAction('set_dmx_scene', 'c3')
        // Choosing a component that answers clears the warning
        await choose('target', JSON.stringify({ type: 'component', uuid: 'c1' }))
        const shown = warning()
        await choose('value', 's2')
        report({ errors: browser.errors, shown, saved: await save() })
    """)

    assert result == {"errors": [], "shown": "", "saved": [[[{"type": "component", "uuid": "c1"}], "s2"]]}


@pytest.mark.parametrize("editor", EDITORS)
def test_editing_keeps_the_saved_value(editor):
    result = run_editor(editor, """
        await edit({ action: 'set_dmx_scene', target: [{ type: 'component', uuid: 'c1' }], value: 's2' })
        const shown = el(ids.value).value
        const saved = await save()
        // A new action starts from the first value again
        await newAction('set_dmx_scene', 'c1')
        report({ errors: browser.errors, shown, saved, newValue: el(ids.value).value })
    """)

    assert result == {"errors": [], "shown": "s2", "saved": [[[{"type": "component", "uuid": "c1"}], "s2"]],
                      "newValue": "s1"}


@pytest.mark.parametrize("editor", DEFINITION_EDITORS)
def test_editing_keeps_the_saved_definition(editor):
    result = run_editor(editor, """
        await edit({ action: 'set_definition', target: [{ type: 'component', uuid: 'c1' }], value: 'd2' })
        report({ errors: browser.errors, shown: el(ids.value).value, saved: await save() })
    """)

    assert result == {"errors": [], "shown": "d2", "saved": [[[{"type": "component", "uuid": "c1"}], "d2"]]}


@pytest.mark.parametrize("editor", EDITORS)
def test_editing_an_action_for_a_missing_component(editor):
    result = run_editor(editor, """
        await edit({ action: 'set_dmx_scene', target: [{ type: 'component', uuid: 'gone' }], value: 's1' })
        report({ errors: browser.errors, selected: selectedTargets(), shown: warning(), saved: (await save()).length })
    """)

    assert result == {"errors": [], "selected": [["Not found: gone", {"type": "component", "uuid": "gone"}]],
                      "shown": "This component can't be found, so its lighting scenes can't be listed", "saved": 0}


@pytest.mark.parametrize("editor", EDITORS)
def test_editing_keeps_targets_that_are_missing(editor):
    result = run_editor(editor, """
        await edit({ action: 'power_on', target: [{ type: 'component', uuid: 'gone' }, { type: 'component', uuid: 'c1' }] })
        report({ errors: browser.errors, selected: selectedTargets(), saved: (await save()).map(([target]) => target) })
    """)

    assert result["errors"] == []
    assert result["selected"] == [["Lobby kiosk", {"type": "component", "uuid": "c1"}],
                                  ["Not found: gone", {"type": "component", "uuid": "gone"}]]
    # Saving keeps the missing component unless it's deselected
    assert result["saved"] == [[{"type": "component", "uuid": "c1"}, {"type": "component", "uuid": "gone"}]]


@pytest.mark.parametrize("editor", EDITORS)
def test_components_that_answer_say_why_they_have_no_scenes(editor):
    result = run_editor(editor, """
        const results = {}
        for (const component of ['c4', 'c5']) {
          await newAction('set_dmx_scene', component)
          results[component] = { shown: warning(), saved: (await save()).length }
        }
        report({ errors: browser.errors, results })
    """)

    assert result == {"errors": [], "results": {
        "c4": {"shown": "This component doesn't have DMX lighting set up", "saved": 0},
        "c5": {"shown": "This component can't find its DMX controller, so its lighting scenes can't be listed",
               "saved": 0}}}
