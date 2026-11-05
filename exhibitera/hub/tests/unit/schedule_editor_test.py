"""Verify the schedule's action editor with components that are offline or that Hub no longer has.

"Set definition" and "Set DMX scene" list their options by asking the component. When it can't answer, the editor
says why and won't save the action without a value. When editing, targets that Hub no longer has stay selected, so
saving other changes doesn't drop them.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.hub.tests.unit.tracker_template_test import ADMIN

pytestmark = page_scripts.needs_jsdom

# c1 answers, c2 has no address yet, and c3 has an address but doesn't answer
COMPONENTS = [{"uuid": "c1", "id": "Lobby kiosk", "helperAddress": "http://c1", "answers": True},
              {"uuid": "c2", "id": "New kiosk", "helperAddress": "", "answers": False},
              {"uuid": "c3", "id": "Unplugged kiosk", "helperAddress": "http://c3", "answers": False}]


def run_schedule_editor(script: str):
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
              if (endpoint === '/definitions') return {{ success: true, definitions: {{ d1: {{ uuid: 'd1', name: 'Welcome', app: 'media_player' }} }} }}
              return {{ success: true, scenes: [{{ uuid: 's1', name: 'Bright' }}] }}
            }}
          }})
        }}

        const el = (id) => document.getElementById(id)
        const choose = async (id, value) => {{
          el(id).value = value
          el(id).dispatchEvent(new window.Event('change'))
          await browser.wait(100)
        }}
        const edit = async (action, target, value = null) => {{
          schedules.scheduleConfigureEditModal('monday', 'day-specific', false, 'a1', 3600, action, target, value)
          await browser.wait(200)
        }}
        const save = async () => {{
          const before = browser.requests.length
          el('scheduleEditSubmitButton').click()
          await browser.wait(200)
          return browser.requests.slice(before).filter((r) => r.url.includes('/update')).map((r) => JSON.parse(r.body))
        }}
        // The warning that's shown, if any
        const warning = () => el('scheduleEditErrorAlert').style.display === 'none' ? '' : el('scheduleEditErrorAlert').textContent
        const selectedTargets = () => [...el('scheduleTargetSelector').selectedOptions].map((o) => [o.textContent, JSON.parse(o.value)])
        const newAction = async (action, component) => {{
          schedules.scheduleConfigureEditModal('monday', 'day-specific', true)
          await browser.wait(100)
          el('scheduleActionTimeInput').value = '9:00 AM'
          await choose('scheduleActionSelector', action)
          await choose('scheduleTargetSelector', JSON.stringify({{ type: 'component', uuid: component }}))
        }}
        {script}
    """, browser="page")


def test_actions_need_a_value_from_the_component():
    result = run_schedule_editor("""
        const results = {}
        for (const [action, component] of [['set_definition', 'c2'], ['set_definition', 'c3'], ['set_dmx_scene', 'c3']]) {
          await newAction(action, component)
          const shown = warning()
          results[action + ' ' + component] = { shown, sent: (await save()).length, onSave: warning() }
        }
        report({ errors: browser.errors, results })
    """)

    assert result["errors"] == []
    not_responding = "This component is not responding, so its definitions can't be listed"
    assert result["results"] == {
        "set_definition c2": {"shown": not_responding, "sent": 0, "onSave": not_responding},
        # A component that doesn't answer gets the same warning as one without an address
        "set_definition c3": {"shown": not_responding, "sent": 0, "onSave": not_responding},
        "set_dmx_scene c3": {"shown": "This component is not responding, so its DMX scenes can't be listed",
                             "sent": 0, "onSave": "This component is not responding, so its DMX scenes can't be listed"}}


def test_actions_with_a_value_are_saved():
    result = run_schedule_editor("""
        await newAction('set_definition', 'c3')
        // Choosing a component that answers clears the warning
        await choose('scheduleTargetSelector', JSON.stringify({ type: 'component', uuid: 'c1' }))
        const shown = warning()
        await choose('scheduleValueSelector', 'd1')
        report({ errors: browser.errors, shown, sent: await save() })
    """)

    assert result["errors"] == []
    assert result["shown"] == ""
    assert [(s["target_to_set"], s["value_to_set"]) for s in result["sent"]] == [([{"type": "component", "uuid": "c1"}], "d1")]


def test_editing_an_action_for_a_missing_component():
    result = run_schedule_editor("""
        await edit('set_definition', [{ type: 'component', uuid: 'gone' }], 'd1')
        report({ errors: browser.errors, selected: selectedTargets(), shown: warning(), sent: (await save()).length })
    """)

    assert result == {"errors": [], "selected": [["Not found: gone", {"type": "component", "uuid": "gone"}]],
                      "shown": "This component can't be found, so its definitions can't be listed", "sent": 0}


def test_editing_keeps_targets_that_are_missing():
    result = run_schedule_editor("""
        const target = [{ type: 'component', uuid: 'gone' }, { type: 'component', uuid: 'c1' }]
        await edit('power_on', target)
        const selected = selectedTargets()
        el('scheduleActionTimeInput').value = '10:00 AM'
        report({ errors: browser.errors, selected, sent: (await save()).map((s) => s.target_to_set) })
    """)

    assert result["errors"] == []
    assert result["selected"] == [["Lobby kiosk", {"type": "component", "uuid": "c1"}],
                                  ["Not found: gone", {"type": "component", "uuid": "gone"}]]
    # Saving keeps the missing component unless it's deselected
    assert result["sent"] == [[{"type": "component", "uuid": "c1"}, {"type": "component", "uuid": "gone"}]]
