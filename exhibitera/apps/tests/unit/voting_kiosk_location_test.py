"""Verify Voting Kiosk's location, which Hub uses to tag votes with the program running there.

The setup page offers Hub's groups as locations, only when Apps uses Hub. It starts blank, which opts out, and saves
the group's UUID. A saved location Hub no longer has stays selected, so saving other changes doesn't drop it.
The kiosk sends its location with each batch of votes, and how long after a program ends its votes still count,
as visitors often vote as they leave. That's 0 to 30 minutes, 5 by default, and only shown once a location is chosen.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

LOCATIONS = [{"uuid": "g2", "name": "Theater"}, {"uuid": "g1", "name": "Lobby"}]


def voting_definition(uuid: str, behavior: dict) -> dict:
    return {"uuid": uuid, "name": "Exit vote", "app": "voting_kiosk", "data_id": "data-1",
            "behavior": behavior, "text": {},
            "style": {"color": {}, "text_size": {}, "font": {}, "layout": {}},
            "option_order": ["o1", "o2"],
            "options": {"o1": {"uuid": "o1", "label": "Yes", "value": "Yes"},
                        "o2": {"uuid": "o2", "label": "No", "value": "No"}}}


def open_setup(behavior: dict, standalone: bool = False, locations_reply: str | None = None) -> dict:
    definition = voting_definition("def-A", behavior)
    if locations_reply is None:
        locations_reply = json.dumps({"body": {"success": True, "locations": LOCATIONS}})
    configuration = {"app": {}, "system": {"standalone": standalone},
                     "control_server": {"ip_address": "hub.test", "port": 8082}}
    return page_scripts.run(f"""
        const {{ readFileSync }} = await import('node:fs')
        const definition = {json.dumps(definition)}
        globalThis.server = (method, url) => {{
          const {{ host, pathname }} = new URL(url)
          const path = decodeURIComponent(pathname)
          if (host.startsWith('hub.test')) {{
            if (path.endsWith('/program/locations')) return {locations_reply}
            return {{ body: {{ success: false }} }}
          }}
          if (path === '/internal/system/configuration') return {{ body: {json.dumps(configuration)} }}
          if (path.startsWith('/internal/definitions/app/')) return {{ body: {{ success: true, definitions: {{ 'def-A': definition }} }} }}
          if (path === '/internal/files/availableContent') return {{ body: {{ success: true, content: [] }} }}
          if (path.startsWith('/_fonts/')) return {{ bytes: readFileSync({json.dumps(str(page_scripts.EXHIBITERA_DIR / "apps"))} + path) }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('apps', 'voting_kiosk/setup.html', {{ search: '?definition=def-A' }})
        await browser.wait(1500)
        const document = window.document
        const exSetup = await import({page_scripts.module_url("apps/js/exhibitera_setup_common.js")})
        const select = document.getElementById('locationSelect')
        const state = () => ({{
          shown: document.getElementById('locationCol').style.display !== 'none',
          options: [...select.options].map((option) => [option.textContent, option.value]),
          selected: select.value,
          warning: document.getElementById('locationLoadWarning').style.display !== 'none',
          minutesAfter: {{
            shown: document.getElementById('programWindowCol').style.display !== 'none',
            path: document.getElementById('behaviorInput_minutes_after_program').dataset.path,
            range: [document.getElementById('behaviorInput_minutes_after_program').dataset.min,
                    document.getElementById('behaviorInput_minutes_after_program').dataset.max],
            value: document.querySelector('#behaviorInput_minutes_after_program .exAS_slider')?.value
          }}
        }})
        const before = state()
        select.value = 'g2'
        select.dispatchEvent(new window.Event('change'))
        const saved = exSetup.config.workingDefinition.behavior.location
        const minutesAfterWithLocation = state().minutesAfter.shown
        select.value = ''
        select.dispatchEvent(new window.Event('change'))
        report({{ errors: browser.errors, before, saved, minutesAfterWithLocation,
                  minutesAfterWithoutLocation: state().minutesAfter.shown }})
    """, browser="page")


NONE = ["None (don't record programs)", ""]
MINUTES_AFTER = {"shown": True, "path": "behavior>minutes_after_program", "range": ["0", "30"], "value": "5"}
# Without a location, the time after a program isn't shown
NO_MINUTES_AFTER = {**MINUTES_AFTER, "shown": False}


def test_the_location_starts_blank_and_lists_hubs_groups():
    result = open_setup({})

    assert result["errors"] == []
    assert result["before"] == {"shown": True, "options": [NONE, ["Lobby", "g1"], ["Theater", "g2"]],
                                "selected": "", "warning": False, "minutesAfter": NO_MINUTES_AFTER}
    assert result["saved"] == "g2"
    # Choosing a location shows it, and choosing none hides it again
    assert result["minutesAfterWithLocation"] is True
    assert result["minutesAfterWithoutLocation"] is False


def test_a_saved_location_is_selected():
    assert open_setup({"location": "g1"})["before"]["selected"] == "g1"


def test_a_location_hub_no_longer_has_stays_selected():
    before = open_setup({"location": "gone"})["before"]

    assert before["options"] == [NONE, ["Lobby", "g1"], ["Theater", "g2"], ["Unknown location", "gone"]]
    assert before["selected"] == "gone"


@pytest.mark.parametrize("reply", ["'error'", json.dumps({"body": {"success": False}})])
def test_locations_that_cant_be_loaded(reply):
    before = open_setup({"location": "g1"}, locations_reply=reply)["before"]

    # The saved location is kept
    assert before == {"shown": True, "options": [NONE, ["Unknown location", "g1"]], "selected": "g1", "warning": True,
                      "minutesAfter": MINUTES_AFTER}


def test_standalone_apps_have_no_location():
    before = open_setup({}, standalone=True)["before"]

    assert before["shown"] is False
    assert before["minutesAfter"]["shown"] is False


def test_a_saved_time_after_a_program_is_shown():
    assert open_setup({"location": "g1", "minutes_after_program": 12})["before"]["minutesAfter"]["value"] == "12"


@pytest.mark.parametrize("behavior, sent", [({"location": "g1"}, ["g1", 5]),
                                            ({"location": "g1", "minutes_after_program": 20}, ["g1", 20]),
                                            ({"location": "g1", "minutes_after_program": 0}, ["g1", 0]),
                                            ({"location": ""}, [None, None]), ({}, [None, None])])
def test_the_kiosk_sends_its_location_with_its_votes(behavior, sent):
    definition = voting_definition("d1", {**behavior, "recording_interval": 1, "touch_cooldown": 0})
    configuration = {"app": {"definition": "d1"}, "system": {"standalone": False, "remote_display": True},
                     "control_server": {"ip_address": "hub.test", "port": 8082}}
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ host, pathname }} = new URL(url)
          if (host.startsWith('hub.test')) return {{ body: {{ success: true }} }}
          if (pathname === '/internal/system/configuration') return {{ body: {json.dumps(configuration)} }}
          if (pathname === '/internal/definitions/d1/load') return {{ body: {{ success: true, definition: {json.dumps(definition)} }} }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('apps', 'voting_kiosk/index.html')
        // The kiosk saves a screenshot as its thumbnail, which jsdom can't draw
        globalThis.html2canvas = window.html2canvas = () => new Promise(() => {{}})
        await browser.wait(500)
        window.document.querySelector('.button-col').click()
        await browser.wait(1500)
        const votes = browser.requests.filter((r) => r.url.endsWith('/datasets/kiosk/append')).map((r) => JSON.parse(r.body))
        report({{ errors: browser.errors, votes: votes.map((v) => ({{ yes: v.data.Yes, sent: [v.location ?? null, v.minutes_after_program ?? null] }})) }})
    """, browser="page")

    assert result == {"errors": [], "votes": [{"yes": 1, "sent": sent}]}
