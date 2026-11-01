"""Verify the Flexible Tracker's preview mode, which the template editor shows beside the template.

In preview mode the tracker shows whatever template the editor sends it, including unsaved changes, and
Record doesn't send anything to Hub. Instead it shows the record that would have been saved.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

TEMPLATE = {"uuid": "t1", "name": "Gallery flow", "widget_order": ["w1", "w2"],
            "widgets": {"w1": {"uuid": "w1", "type": "counter", "name": "Visitors", "label": ""},
                        "w2": {"uuid": "w2", "type": "timer", "name": "Tornado Machine", "label": "",
                               "exclusive": False, "record_start_time": True}}}


def run_preview(script: str):
    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname.endsWith('/tracker/templates/list')) return {{ body: [{{ uuid: 't1', name: 'Gallery flow' }}] }}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('hub', 'tracker.html', {{ search: '?preview=true' }})
        const document = window.document
        await browser.wait(500)
        // The editor sends templates from the same origin
        const send = (template) => window.dispatchEvent(new window.MessageEvent('message', {{
          data: {{ type: 'trackerPreview', template }}, origin: window.location.origin
        }}))
        const template = {json.dumps(TEMPLATE)}
        const shown = (id) => document.getElementById(id).style.display !== 'none'
        const cardNames = () => [...document.querySelectorAll('#cardRow .card-title, #cardRow h5, #cardRow h4')].map((el) => el.textContent)
        {script}
    """, browser="page")


def test_preview_shows_the_template_it_is_sent():
    result = run_preview("""
        send(template)
        await browser.wait(100)
        const first = document.getElementById('cardRow').textContent
        template.widgets.w1.name = 'Guests'
        send(template)
        await browser.wait(100)
        report({
          errors: browser.errors,
          first: first.includes('Visitors') && first.includes('Tornado Machine'),
          updated: document.getElementById('cardRow').textContent.includes('Guests'),
          templateChooser: shown('definitionListCol'),
          notice: shown('previewNotice')
        })
    """)

    assert result == {"errors": [], "first": True, "updated": True, "templateChooser": False, "notice": True}


def test_preview_ignores_messages_from_other_origins():
    result = run_preview("""
        window.dispatchEvent(new window.MessageEvent('message', {
          data: { type: 'trackerPreview', template }, origin: 'http://elsewhere.test'
        }))
        await browser.wait(100)
        report({ errors: browser.errors, cards: document.getElementById('cardRow').children.length })
    """)

    assert result == {"errors": [], "cards": 0}


def test_preview_record_is_shown_in_a_dismissable_overlay_but_not_saved():
    result = run_preview("""
        send(template)
        await browser.wait(100)
        document.getElementById('TimerStartStopButton_w2').click()
        await browser.wait(50)
        document.getElementById('recordButton').click()
        await browser.wait(400)
        const overlay = document.getElementById('previewRecordModal')
        const shownAfterRecord = overlay.classList.contains('show')
        const text = overlay.textContent
        overlay.querySelector('[data-bs-dismiss="modal"]').click()
        await browser.wait(400)
        report({
          errors: browser.errors,
          sentToHub: browser.requests.some((r) => r.url.includes('/data/')),
          shownAfterRecord,
          text,
          dismissed: !overlay.classList.contains('show'),
          inlineRecord: document.getElementById('previewRecord') !== null,
          timerReset: document.getElementById('TimerStartStopButton_w2').textContent
        })
    """)

    assert result["errors"] == []
    assert result["sentToHub"] is False
    assert result["shownAfterRecord"] is True
    for text in ["not saved", "Visitors", "Tornado Machine", "Tornado Machine (Start time)", "Date"]:
        assert text in result["text"]
    assert result["dismissed"] is True
    assert result["inlineRecord"] is False
    assert result["timerReset"] == "Start"


def test_tracker_still_saves_outside_preview():
    result = page_scripts.run(f"""
        const template = {json.dumps(TEMPLATE)}
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname.endsWith('/tracker/templates/list')) return {{ body: [{{ uuid: 't1', name: 'Gallery flow' }}] }}
          if (pathname.endsWith('/tracker/template/t1')) return {{ body: {{ success: true, template }} }}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('hub', 'tracker.html', {{ search: '?layout=t1' }})
        await browser.wait(800)
        window.document.getElementById('recordButton').click()
        await browser.wait(200)
        report({{
          errors: browser.errors,
          saved: browser.requests.some((r) => r.url.endsWith('/data/Gallery%20flow/append')),
          notice: window.document.getElementById('previewNotice').style.display
        }})
    """, browser="page")

    assert result == {"errors": [], "saved": True, "notice": "none"}
