"""Verify the Flexible Tracker's widget options: required widgets, limits, and slider end labels.

Dropdown, Number, and Text widgets can be required. Number widgets can have a minimum and maximum, counters
can have a maximum, and sliders can have labels for their ends. The tracker doesn't save a record until required widgets are filled
in and numbers are within their limits, and marks the widgets that need attention instead.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.hub.tests.unit.tracker_template_test import run_editor

pytestmark = page_scripts.needs_jsdom

TEMPLATE = {"uuid": "t1", "name": "Exit survey",
            "widget_order": ["w1", "w2", "w3", "w4", "w5", "w6", "w7"],
            "widgets": {"w1": {"uuid": "w1", "type": "dropdown", "name": "Gallery", "label": "", "multiple": False,
                               "options": ["North", "South"], "required": True},
                        "w2": {"uuid": "w2", "type": "number", "name": "Group size", "label": "", "required": True,
                               "min": 1, "max": 10},
                        "w3": {"uuid": "w3", "type": "text", "name": "Notes", "label": "", "lines": 3, "required": True},
                        "w4": {"uuid": "w4", "type": "number", "name": "Age", "label": "", "min": 0},
                        "w5": {"uuid": "w5", "type": "slider", "name": "Enjoyment", "label": "", "min": 1, "max": 5,
                               "step": 1, "start": 3, "min_label": "Not at all", "max_label": "Very much"},
                        "w6": {"uuid": "w6", "type": "timer", "name": "Visit", "label": "", "exclusive": False},
                        "w7": {"uuid": "w7", "type": "counter", "name": "Questions", "label": "", "max": 2}}}


def run_tracker(script: str):
    return page_scripts.run(f"""
        const template = {json.dumps(TEMPLATE)}
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname.endsWith('/tracker/templates/list')) return {{ body: [{{ uuid: 't1', name: 'Exit survey' }}] }}
          if (pathname.endsWith('/tracker/template/t1')) return {{ body: {{ success: true, template }} }}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('hub', 'tracker.html', {{ search: '?layout=t1' }})
        const document = window.document
        await browser.wait(800)
        const el = (id) => document.getElementById(id)
        const appended = () => browser.requests.filter((r) => r.url.includes('/append')).map((r) => JSON.parse(r.body).data)
        const invalid = () => ['w1', 'w2', 'w3', 'w4'].filter((id) => el(id + '_input').classList.contains('is-invalid'))
        const feedback = (id) => el(id + '_feedback').textContent
        const fill = (id, value) => {{
          el(id + '_input').value = value
          el(id + '_input').dispatchEvent(new window.Event(el(id + '_input').tagName === 'SELECT' ? 'change' : 'input'))
        }}
        const record = async () => {{
          el('recordButton').click()
          await browser.wait(200)
        }}
        {script}
    """, browser="page")


def test_required_widgets_must_be_filled_in_before_recording():
    result = run_tracker("""
        el('TimerStartStopButton_w6').click()
        await browser.wait(50)
        await record()
        const missing = {
          sent: appended().length,
          invalid: invalid(),
          feedback: feedback('w1'),
          focused: document.activeElement?.id,
          timerRunning: el('TimerStartStopButton_w6').textContent
        }

        // Filling a widget in clears its mark
        fill('w1', 'South')
        const afterFill = invalid()
        fill('w2', '4')
        fill('w3', 'Loved the fog room')
        await record()
        report({ errors: browser.errors, missing, afterFill, sent: appended(), invalidAfter: invalid() })
    """)

    assert result["errors"] == []
    # Nothing is saved, the first widget that needs attention is focused, and timers keep running
    assert result["missing"] == {"sent": 0, "invalid": ["w1", "w2", "w3"], "feedback": "Required",
                                 "focused": "w1_input", "timerRunning": "Stop"}
    assert result["afterFill"] == ["w2", "w3"]
    assert len(result["sent"]) == 1
    assert {key: result["sent"][0][key] for key in ["Gallery", "Group size", "Notes"]} == \
        {"Gallery": "South", "Group size": 4, "Notes": "Loved the fog room"}
    assert result["invalidAfter"] == []


def test_numbers_must_be_within_their_limits():
    result = run_tracker("""
        fill('w1', 'North')
        fill('w3', 'Busy')
        fill('w2', '40')
        fill('w4', '-1')
        await record()
        const outside = { sent: appended().length, invalid: invalid(), between: feedback('w2'), atLeast: feedback('w4') }
        fill('w2', '10')
        fill('w4', '')
        await record()
        report({
          errors: browser.errors,
          outside,
          limits: [el('w2_input').getAttribute('min'), el('w2_input').getAttribute('max'), el('w4_input').getAttribute('max')],
          sent: appended().map((r) => [r['Group size'], r.Age])
        })
    """)

    assert result["errors"] == []
    assert result["outside"] == {"sent": 0, "invalid": ["w2", "w4"], "between": "Enter a number from 1 to 10.",
                                 "atLeast": "Enter a number of at least 0."}
    assert result["limits"] == ["1", "10", None]
    # An optional number can be left empty
    assert result["sent"] == [[10, None]]


def test_clear_removes_the_marks():
    result = run_tracker("""
        await record()
        el('clearButton').click()
        report({ errors: browser.errors, invalid: invalid() })
    """)

    assert result == {"errors": [], "invalid": []}


def test_counters_stop_at_their_maximum():
    result = run_tracker("""
        const [minus, plus] = [...document.querySelector('[data-uuid="w7"]').querySelectorAll('.counter-button')]
        const count = () => el('w7_counter').getAttribute('data-count')
        const atStart = { count: count(), minusDisabled: minus.disabled }
        plus.click()
        plus.click()
        plus.click()
        const atMax = { count: count(), shown: el('w7_counter').textContent, plusDisabled: plus.disabled, minusDisabled: minus.disabled }
        minus.click()
        const belowMax = { count: count(), plusDisabled: plus.disabled }
        plus.click()
        el('clearButton').click()
        report({ errors: browser.errors, atStart, atMax, belowMax, afterClear: { count: count(), plusDisabled: plus.disabled, minusDisabled: minus.disabled } })
    """)

    # + is disabled at the maximum and - at zero, so staff can see they've reached the end
    assert result == {"errors": [], "atStart": {"count": "0", "minusDisabled": True},
                      "atMax": {"count": "2", "shown": "2", "plusDisabled": True, "minusDisabled": False},
                      "belowMax": {"count": "1", "plusDisabled": False},
                      "afterClear": {"count": "0", "plusDisabled": False, "minusDisabled": True}}


def test_sliders_show_their_end_labels():
    result = run_tracker("""
        report({ errors: browser.errors, labels: [el('w5_min_label')?.textContent, el('w5_max_label')?.textContent] })
    """)

    assert result == {"errors": [], "labels": ["Not at all", "Very much"]}


def test_editor_sets_required_number_limits_and_slider_labels():
    result = run_editor("""
        choose('Notes')
        const textRequired = document.getElementById('editTrackerTemplateRequired_w3')
        change(textRequired, true)

        document.querySelector('[data-add-tracker-widget="number"]').click()
        await browser.wait(100)
        const number = template().widget_order.at(-1)
        change(document.getElementById('editTrackerTemplateRequired_' + number), true)
        change(document.getElementById('editTrackerTemplateNumberMin' + number), '0')
        change(document.getElementById('editTrackerTemplateNumberMax' + number), '12.5')
        const withLimits = template().widgets[number]
        // A blank limit means no limit
        change(document.getElementById('editTrackerTemplateNumberMax' + number), '')

        document.querySelector('[data-add-tracker-widget="slider"]').click()
        await browser.wait(100)
        const slider = template().widget_order.at(-1)
        change(document.getElementById('editTrackerTemplateSliderMinLabel' + slider), 'Low')
        change(document.getElementById('editTrackerTemplateSliderMaxLabel' + slider), 'High')

        // Widgets that always have a value can't be required
        choose('Visitors')
        const counterRequired = document.getElementById('editTrackerTemplateRequired_w1')

        // Counters can have a maximum
        change(document.getElementById('editTrackerTemplateCounterMaxw1'), '20')
        const counterMax = template().widgets.w1.max
        change(document.getElementById('editTrackerTemplateCounterMaxw1'), '')

        report({
          errors: browser.errors,
          text: template().widgets.w3.required,
          withLimits: [withLimits.required, withLimits.min, withLimits.max],
          maxCleared: 'max' in template().widgets[number],
          slider: [template().widgets[slider].min_label, template().widgets[slider].max_label],
          previewed: lastPreview()?.widgets[slider].max_label,
          counterRequired: counterRequired !== null,
          counterMax: [counterMax, 'max' in template().widgets.w1]
        })
    """)

    assert result == {"errors": [], "text": True, "withLimits": [True, 0, 12.5], "maxCleared": False,
                      "slider": ["Low", "High"], "previewed": "High", "counterRequired": False,
                      "counterMax": [20, False]}


def test_editor_lists_dropdown_options_one_per_row():
    result = run_editor("""
        document.querySelector('[data-add-tracker-widget="dropdown"]').click()
        await browser.wait(100)
        const dropdown = template().widget_order.at(-1)
        const dropdownName = template().widgets[dropdown].name
        const list = () => document.getElementById('editTrackerTemplateOptions_' + dropdown)
        const rows = () => [...list().querySelectorAll('.tracker-option-row')]
        const values = () => rows().map((row) => row.querySelector('input').value)
        const button = (index, action) => rows()[index].querySelector(`[data-option-action="${action}"]`)
        const options = () => template().widgets[dropdown].options
        const startsEmpty = rows().length

        document.getElementById('editTrackerTemplateAddOption_' + dropdown).click()
        const addedFocused = document.activeElement === rows()[0].querySelector('input')
        change(rows()[0].querySelector('input'), 'North')
        // Enter adds the next option
        rows()[0].querySelector('input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        const enterFocused = document.activeElement === rows()[1].querySelector('input')
        change(rows()[1].querySelector('input'), 'South')
        document.getElementById('editTrackerTemplateAddOption_' + dropdown).click()
        // Commas are part of an option, rather than separating options
        change(rows()[2].querySelector('input'), 'Gift shop, café')
        const added = options()

        const ends = [button(0, 'up').disabled, button(2, 'down').disabled, button(1, 'up').disabled]
        button(2, 'up').click()
        const moved = options()
        button(0, 'remove').click()
        const removed = options()

        // A blank option isn't saved
        document.getElementById('editTrackerTemplateAddOption_' + dropdown).click()
        const withBlank = options()

        // The rows show the saved options when the widget is opened again
        choose('Visitors')
        choose(dropdownName)
        report({
          errors: browser.errors,
          startsEmpty,
          addedFocused,
          enterFocused,
          added,
          ends,
          moved,
          removed,
          withBlank,
          reopened: values(),
          previewed: lastPreview()?.widgets[dropdown].options
        })
    """)

    assert result == {"errors": [], "startsEmpty": 0, "addedFocused": True, "enterFocused": True,
                      "added": ["North", "South", "Gift shop, café"],
                      "ends": [True, True, False],
                      "moved": ["North", "Gift shop, café", "South"],
                      "removed": ["Gift shop, café", "South"],
                      "withBlank": ["Gift shop, café", "South"],
                      "reopened": ["Gift shop, café", "South"],
                      "previewed": ["Gift shop, café", "South"]}
