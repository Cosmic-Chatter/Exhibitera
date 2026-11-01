"""Verify where Voting Kiosk, Survey Kiosk, and Word Cloud send the data they collect.

With Hub, kiosk records are stored by the definition's data ID, so renaming a definition doesn't split
its data. Definitions made before data IDs existed send only their name. Word Cloud text is stored by
collection name. Standalone kiosks store data with this Apps server by name, as before.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_node


def run_with_servers(standalone: bool, script: str) -> dict:
    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          return {{ body: {{ success: true, text: 'dinosaurs\\n' }} }}
        }}
        const exCommon = await import({page_scripts.module_url("apps/js/exhibitera_app_common.js")})
        console.log = () => {{}}
        exCommon.config.standalone = {json.dumps(standalone)}
        exCommon.config.serverAddress = 'http://hub.test:8082'
        exCommon.config.helperAddress = 'http://apps.test:8000'
        await browser.wait(50)
        const startup = browser.requests.length  // Requests made when the module loads
        const sent = () => browser.requests.slice(startup).map((r) => ({{
          method: r.method, url: decodeURIComponent(r.url), body: r.body == null ? null : JSON.parse(r.body)
        }}))
        {script}
    """)


def test_kiosk_records_go_to_hub_by_data_id():
    result = run_with_servers(False, """
        await exCommon.sendKioskData('survey_kiosk', { name: 'Lobby: survey', data_id: 'd1' }, { Answer: 'Yes' })
        await exCommon.sendKioskData('voting_kiosk', { name: 'Old vote' }, { A: 1 })
        report(sent())
    """)

    assert result == [
        {"method": "POST", "url": "http://hub.test:8082/external/v6.1/datasets/kiosk/append",
         "body": {"data_id": "d1", "name": "Lobby: survey", "app": "survey_kiosk", "data": {"Answer": "Yes"}}},
        {"method": "POST", "url": "http://hub.test:8082/external/v6.1/datasets/kiosk/append",
         "body": {"data_id": None, "name": "Old vote", "app": "voting_kiosk", "data": {"A": 1}}},
    ]


def test_standalone_kiosk_records_stay_with_apps():
    result = run_with_servers(True, """
        await exCommon.sendKioskData('survey_kiosk', { name: 'Lobby survey', data_id: 'd1' }, { Answer: 'Yes' })
        report(sent())
    """)

    assert result == [{"method": "POST", "url": "http://apps.test:8000/internal/data/Lobby survey/append",
                       "body": {"data": {"Answer": "Yes"}}}]


def test_word_cloud_text_goes_to_hub_by_collection():
    result = run_with_servers(False, """
        await exCommon.appendWordCloudText('Lobby: what did you like?', 'tornado')
        const text = await exCommon.getWordCloudText('Lobby: what did you like?')
        report({ text, sent: sent() })
    """)

    assert result == {"text": "dinosaurs\n", "sent": [
        {"method": "POST", "url": "http://hub.test:8082/external/v6.1/datasets/wordCloud/append",
         "body": {"collection": "Lobby: what did you like?", "text": "tornado"}},
        {"method": "GET", "url": "http://hub.test:8082/external/v6.1/datasets/wordCloud/text?collection=Lobby: what did you like?",
         "body": None},
    ]}


def test_standalone_word_cloud_text_stays_with_apps():
    result = run_with_servers(True, """
        await exCommon.appendWordCloudText('Lobby', 'tornado')
        await exCommon.getWordCloudText('Lobby')
        report(sent().map((r) => r.method + ' ' + r.url))
    """)

    assert result == ["POST http://apps.test:8000/internal/data/Word_Cloud_Lobby/rawText",
                      "GET http://apps.test:8000/internal/data/Word_Cloud_Lobby/rawText"]
