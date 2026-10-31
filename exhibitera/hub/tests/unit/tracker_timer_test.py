"""Verify the Flexible Tracker's timers, including the option to record when a timer was first started.

With "Record start time" on, a timer named "Tornado Machine" also records "Tornado Machine (Start time)":
the time it was first started in that record. Stopping and restarting it doesn't change that time, and a
timer that isn't started records no start time. See https://github.com/Cosmic-Chatter/Exhibitera/issues/90
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

TEMPLATE = {
    "uuid": "t1", "name": "Gallery flow",
    "widget_order": ["w1", "w2", "w3"],
    "widgets": {
        "w1": {"uuid": "w1", "type": "timer", "name": "Tornado Machine", "label": "", "exclusive": False,
               "record_start_time": True},
        "w2": {"uuid": "w2", "type": "timer", "name": "Wave Tank", "label": "", "exclusive": False,
               "record_start_time": False},
        # From before the option existed
        "w3": {"uuid": "w3", "type": "timer", "name": "Fog Room", "label": "", "exclusive": False},
    },
}


def run_tracker(script: str):
    """Open the tracker with the template above, run script, and report what it returns."""

    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname.endsWith('/tracker/templates/list')) return {{ body: [{{ uuid: 't1', name: 'Gallery flow' }}] }}
          if (pathname.endsWith('/tracker/template/t1')) return {{ body: {{ success: true, template: {json.dumps(TEMPLATE)} }} }}
          if (pathname.endsWith('/append')) return {{ body: {{ success: true }} }}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('hub', 'tracker.html', {{ search: '?layout=t1' }})
        const document = window.document
        await browser.wait(800)

        const click = (id) => document.getElementById(id).click()
        const startStop = (uuid) => click('TimerStartStopButton_' + uuid)
        const record = async () => {{
          click('recordButton')
          await browser.wait(100)
          const sent = browser.requests.filter((r) => r.url.endsWith('/append')).at(-1)
          return JSON.parse(sent.body).data
        }}
        // The tracker records local times without a time zone, like the record's Date
        const asTime = (text) => new Date(text).getTime()

        {script}
    """, browser="page")


def test_start_time_is_when_the_timer_was_first_started():
    result = run_tracker("""
        const before = Date.now()
        startStop('w1')
        const after = Date.now()
        await browser.wait(50)
        startStop('w1') // Stop
        await browser.wait(50)
        const restarted = Date.now()
        startStop('w1') // Start again
        await browser.wait(50)
        const data = await record()
        const started = asTime(data['Tornado Machine (Start time)'])
        report({
          errors: browser.errors,
          firstStart: started >= before - 1 && started <= after + 1,
          notRestart: started < restarted,
          sameFormatAsDate: data['Tornado Machine (Start time)'].length === data.Date.length
        })
    """)

    assert result == {"errors": [], "firstStart": True, "notRestart": True, "sameFormatAsDate": True}


def test_only_started_timers_with_the_option_record_a_start_time():
    result = run_tracker("""
        startStop('w2')
        startStop('w3')
        await browser.wait(50)
        const data = await record()
        report({ errors: browser.errors, keys: Object.keys(data).sort() })
    """)

    # Tornado Machine has the option but wasn't started; the others were started but don't have it
    assert result == {"errors": [], "keys": ["Date", "Fog Room", "Tornado Machine", "Wave Tank"]}


def test_each_record_has_its_own_start_time():
    result = run_tracker("""
        startStop('w1')
        await browser.wait(50)
        const first = await record()
        await browser.wait(50)
        const unused = await record() // The timer was reset and not started again
        const beforeSecond = Date.now()
        startStop('w1')
        await browser.wait(50)
        const second = await record()
        report({
          errors: browser.errors,
          unusedHasStartTime: 'Tornado Machine (Start time)' in unused,
          secondIsNew: asTime(second['Tornado Machine (Start time)']) >= beforeSecond - 1,
          firstIsEarlier: asTime(first['Tornado Machine (Start time)']) < asTime(second['Tornado Machine (Start time)'])
        })
    """)

    assert result == {"errors": [], "unusedHasStartTime": False, "secondIsNew": True, "firstIsEarlier": True}
