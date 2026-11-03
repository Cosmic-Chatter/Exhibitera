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
        // Bootstrap's display classes, such as d-flex, are !important, so they beat style.display = 'none'.
        // jsdom doesn't apply CSS, so check for them here.
        const shown = (id) => {{
          const el = document.getElementById(id)
          if (el.classList.contains('d-none')) return false
          return el.style.display !== 'none' || [...el.classList].some((c) => /^d-(block|flex|inline|grid)/.test(c))
        }}
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
    for text in ["wasn't sent to Hub", "Visitors", "Tornado Machine", "Tornado Machine (Start time)", "Date"]:
        assert text in result["text"]
    assert result["dismissed"] is True
    assert result["inlineRecord"] is False
    assert result["timerReset"] == "Start"


def run_tracker(script: str, append_reply: str, setup: str = "", template: dict = TEMPLATE):
    return page_scripts.run(f"""
        const template = {json.dumps(template)}
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname.endsWith('/tracker/templates/list')) return {{ body: [{{ uuid: 't1', name: 'Gallery flow' }}] }}
          if (pathname.endsWith('/tracker/template/t1')) return {{ body: {{ success: true, template }} }}
          if (pathname.endsWith('/append')) return {append_reply}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('hub', 'tracker.html', {{ search: '?layout=t1' }})
        const document = window.document
        await browser.wait(800)
        // Bootstrap's display classes, such as d-flex, are !important, so they beat style.display = 'none'.
        // jsdom doesn't apply CSS, so check for them here.
        const shown = (id) => {{
          const el = document.getElementById(id)
          if (el.classList.contains('d-none')) return false
          return el.style.display !== 'none' || [...el.classList].some((c) => /^d-(block|flex|inline|grid)/.test(c))
        }}
        const count = () => document.getElementById('w1_counter').getAttribute('data-count')
        // Indicators in the page never cover the widgets, even with the soft keyboard up. They're outside the
        // template chooser, which is hidden while Hub can't be reached.
        const inThePage = (el) => el.closest('.position-fixed') === null && el.closest('#definitionListCol') === null
        // Tapping an indicator shows its details in a popover
        const popoverText = async (id) => {{
          document.getElementById(id).focus()
          await browser.wait(400)
          const text = document.querySelector('.popover')?.textContent ?? ''
          document.getElementById(id).blur()
          await browser.wait(400)
          return text
        }}
        const appended = () => browser.requests.filter((r) => r.url.includes('/append')).map((r) => JSON.parse(r.body))
        {setup}
        // Count one visitor, then record
        document.getElementById('w1_counter').setAttribute('data-count', '1')
        document.getElementById('recordButton').click()
        await browser.wait(200)
        {script}
    """, browser="page")


def test_tracker_saves_records_by_template_uuid():
    result = run_tracker("""
        report({
          errors: browser.errors,
          saved: browser.requests.filter((r) => r.url.includes('/append')).map((r) => new URL(r.url).pathname),
          data: appended()[0].data.Visitors,
          // An ID lets Hub skip a record that's sent again because its reply was lost
          hasID: typeof appended()[0].record_id === 'string' && appended()[0].record_id.length > 0,
          notice: document.getElementById('previewNotice').style.display,
          cleared: count() === '0',
          error: shown('recordErrorNotice')
        })
    """, "{ body: { success: true } }")

    assert result == {"errors": [], "saved": ["/internal/datasets/tracker/t1/append"], "data": 1, "hasID": True,
                      "notice": "none", "cleared": True, "error": False}


def test_tracker_keeps_records_on_the_device_while_hub_is_unreachable():
    result = run_tracker("""
        const waiting = () => shown('recordsWaitingNotice') ? document.getElementById('recordsWaitingNotice').textContent.trim() : ''
        const afterFirst = { cleared: count() === '0', error: shown('recordErrorNotice'), saved: shown('recordSavedNotice'), waiting: waiting() }

        // Hub goes away entirely
        globalThis.server = () => 'error'
        await browser.wait(700)
        const offline = { warning: shown('connectionWarning'), recordEnabled: !document.getElementById('recordButton').disabled,
                          warningText: document.getElementById('connectionWarning').textContent.trim(),
                          warningInThePage: inThePage(document.getElementById('connectionWarning')),
                          chooser: shown('definitionListCol'),
                          warningPopover: await popoverText('connectionWarning') }
        document.getElementById('w1_counter').setAttribute('data-count', '2')
        document.getElementById('recordButton').click()
        await browser.wait(200)
        const afterSecond = { cleared: count() === '0', waiting: waiting(), popover: await popoverText('recordsWaitingNotice') }
        const keptIDs = JSON.parse(window.localStorage.getItem('exhibitera_tracker_waiting_records')).map((r) => r.id)

        // Hub comes back
        const sent = []
        globalThis.server = (method, url, body) => {
          if (url.includes('/append')) sent.push(JSON.parse(body))
          return { body: { success: true } }
        }
        await browser.wait(1000)
        const notice = document.getElementById('recordsWaitingNotice')
        report({
          errors: browser.errors,
          afterFirst,
          offline,
          afterSecond,
          sent: sent.map((r) => r.data.Visitors),
          sameIDs: sent.map((r) => r.record_id).join() === keptIDs.join(),
          waitingAfter: waiting(),
          warningAfter: shown('connectionWarning'),
          waitingInThePage: inThePage(notice),
          chooserAfter: shown('definitionListCol')
        })
    """, "'error'")

    assert result["errors"] == []
    assert result["afterFirst"] == {"cleared": True, "error": False, "saved": False, "waiting": "1"}
    assert result["offline"] == {"warning": True, "recordEnabled": True, "warningText": "!", "warningInThePage": True, "chooser": False,
                                 "warningPopover": "Hub can't be reached. Records are kept on this device until it's back."}
    assert result["afterSecond"] == {"cleared": True, "waiting": "2",
                                     "popover": "2 records are saved on this device, waiting to send to Hub."}
    # Sent once each, in the order they were recorded, with the IDs they were kept with
    assert result["sent"] == [1, 2]
    assert result["sameIDs"] is True
    assert result["waitingAfter"] == ""
    assert result["warningAfter"] is False
    assert result["waitingInThePage"] is True
    # Templates can't be loaded without Hub, so the chooser is hidden until it's back
    assert result["chooserAfter"] is True


def test_tracker_tries_again_later_if_hub_refuses_a_record():
    result = run_tracker("""
        const kept = shown('recordsWaitingNotice')
        globalThis.server = () => ({ body: { success: true } })
        await browser.wait(1000)
        const soon = appended().length
        await browser.wait(3000)
        report({ errors: browser.errors, kept, soon, later: appended().length, waiting: shown('recordsWaitingNotice') })
    """, "{ body: { success: false, reason: 'Could not write the file' } }")

    # Waits a few seconds rather than asking again every half second
    assert result == {"errors": [], "kept": True, "soon": 1, "later": 2, "waiting": False}


def test_records_for_deleted_templates_are_dropped():
    result = run_tracker("""
        await browser.wait(4000)
        report({
          errors: browser.errors,
          cleared: count() === '0',
          error: shown('recordErrorNotice'),
          saved: shown('recordSavedNotice'),
          waiting: shown('recordsWaitingNotice'),
          sends: appended().length
        })
    """, "{ body: { success: false, reason: 'unknown_template' } }")

    assert result == {"errors": [], "cleared": True, "error": False, "saved": False, "waiting": False, "sends": 1}


def test_tracker_keeps_the_record_in_its_inputs_without_browser_storage():
    # In a private window, or with site data blocked, the record can only be kept on screen
    result = run_tracker("""
        const afterFailure = { cleared: count() === '0', error: shown('recordErrorNotice'), waiting: shown('recordsWaitingNotice') }
        globalThis.server = () => ({ body: { success: true } })
        document.getElementById('recordButton').click()
        await browser.wait(200)
        report({ errors: browser.errors, afterFailure, cleared: count() === '0', error: shown('recordErrorNotice'), saved: shown('recordSavedNotice') })
    """, "'error'", setup="""
        Object.defineProperty(window, 'localStorage', { get () { throw new Error('Access denied') }, configurable: true })
    """)

    assert result == {"errors": [], "afterFailure": {"cleared": False, "error": True, "waiting": False},
                      "cleared": True, "error": False, "saved": True}


def test_counters_do_not_go_below_zero():
    result = run_preview("""
        send(template)
        await browser.wait(100)
        const [minus, plus] = [...document.querySelectorAll('#cardRow .counter-button')]
        const counter = document.getElementById('w1_counter')
        minus.click()
        const fromZero = [counter.getAttribute('data-count'), counter.textContent]
        plus.click()
        minus.click()
        minus.click()
        report({ errors: browser.errors, fromZero, afterOne: [counter.getAttribute('data-count'), counter.textContent] })
    """)

    assert result == {"errors": [], "fromZero": ["0", "0"], "afterOne": ["0", "0"]}


def test_template_chooser_is_hidden_for_guest_facing_templates():
    result = run_tracker("""
        report({ errors: browser.errors, chooser: shown('definitionListCol'), title: shown('titleCol') })
    """, "{ body: { success: true } }", template={**TEMPLATE, "guest_facing": True})

    assert result == {"errors": [], "chooser": False, "title": False}


def test_template_chooser_lists_the_available_templates():
    result = run_tracker("""
        report({ errors: browser.errors, options: [...document.getElementById('definitionListDropdown').options].map((o) => [o.value, o.textContent]) })
    """, "{ body: { success: true } }")

    assert result == {"errors": [], "options": [["", ""], ["t1", "Gallery flow"]]}


def test_tracker_confirms_saved_records_briefly():
    # So staff know the record reached Hub and don't record it twice
    result = run_tracker("""
        const afterRecord = { saved: shown('recordSavedNotice'), error: shown('recordErrorNotice') }
        await browser.wait(2500)
        report({ errors: browser.errors, afterRecord, later: shown('recordSavedNotice') })
    """, "{ body: { success: true } }")

    assert result == {"errors": [], "afterRecord": {"saved": True, "error": False}, "later": False}


def test_tracker_does_not_confirm_records_kept_on_the_device():
    result = run_tracker("""
        report({ errors: browser.errors, saved: shown('recordSavedNotice'), waiting: shown('recordsWaitingNotice') })
    """, "'error'")

    assert result == {"errors": [], "saved": False, "waiting": True}


def test_saved_message_floats_over_the_page():
    # Widgets mustn't move when it appears, or a quick tap could hit the wrong button
    result = run_tracker("""
        const notice = document.getElementById('recordSavedNotice')
        report({
          errors: browser.errors,
          floats: notice.classList.contains('position-fixed') || notice.style.position === 'fixed',
          letsTapsThrough: notice.style.pointerEvents === 'none',
          shown: shown('recordSavedNotice')
        })
    """, "{ body: { success: true } }")

    assert result == {"errors": [], "floats": True, "letsTapsThrough": True, "shown": True}
