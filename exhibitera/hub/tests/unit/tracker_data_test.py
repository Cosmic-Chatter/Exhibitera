"""Verify the Data section of the console's Analytics tab.

Data is listed by name, grouped by the app that collected it, with archived templates' data marked.
Downloads are named by Hub, which replaces characters that can't be used in file names. Files stored
by name, such as those written through the Core API, are listed separately under "Other files".
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

ADMIN = {"uuid": "u1", "username": "admin", "display_name": "Admin", "preferences": {},
         "permissions": {"analytics": "edit", "components": {"edit": ["__all"], "edit_content": ["__all"], "view": ["__all"]},
                         "exhibits": "edit", "maintenance": "edit", "programs": "edit", "schedule": "edit",
                         "settings": "edit", "users": "edit"}}

LIST = {"success": True,
        "datasets": [{"kind": "tracker", "id": "t1", "name": "Q1: Lobby", "app": "flexible_tracker", "archived": False},
                     {"kind": "tracker", "id": "t0", "name": "Old flow", "app": "flexible_tracker", "archived": True},
                     {"kind": "kiosk", "id": "d1", "name": "Atrium vote", "app": "voting_kiosk", "archived": False},
                     {"kind": "kiosk", "id": "d2", "name": "Exit survey", "app": "survey_kiosk", "archived": False},
                     {"kind": "word_cloud", "id": "w1", "name": "Lobby", "app": "word_cloud", "archived": False}],
        "files": ["sensor log"]}


def run_data_section(script: str):
    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          if (pathname === '/internal/datasets/list') return {{ body: {json.dumps(LIST)} }}
          if (pathname === '/internal/datasets/tracker/t1/csv') return {{ body: {{ success: true, csv: 'a,b\\n1,2', filename: 'Q1_ Lobby.csv' }} }}
          if (pathname === '/internal/data/sensor%20log/csv') return {{ body: {{ success: true, csv: '12.5', filename: 'sensor log.csv' }} }}
          if (method === 'DELETE') return {{ body: {{ success: true }} }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        const document = window.document
        await browser.wait(1000)

        // Record downloads instead of navigating
        const downloads = []
        window.URL.createObjectURL = () => 'blob:test'
        window.HTMLAnchorElement.prototype.click = function () {{ downloads.push(this.download) }}

        const select = document.getElementById('trackerDataSelect')
        const choose = (text) => {{
          select.value = [...select.options].find((o) => o.textContent === text).value
        }}
        const requested = (part) => browser.requests.filter((r) => r.url.includes(part)).map((r) => r.method + ' ' + new URL(r.url).pathname)

        document.getElementById('getAvailableTrackerDataButton').click()
        await browser.wait(300)
        {script}
    """, browser="page")


def test_data_is_listed_by_name_and_grouped_by_app():
    result = run_data_section("""
        report({
          errors: browser.errors,
          groups: [...select.querySelectorAll('optgroup')].map((g) => [g.label, [...g.querySelectorAll('option')].map((o) => o.textContent)])
        })
    """)

    assert result == {"errors": [], "groups": [
        ["Flexible Tracker", ["Old flow (archived)", "Q1: Lobby"]],
        ["Voting Kiosk", ["Atrium vote"]],
        ["Survey Kiosk", ["Exit survey"]],
        ["Word Cloud", ["Lobby"]],
        ["Other files", ["sensor log"]],
    ]}


def test_downloads_use_the_name_hub_gives():
    result = run_data_section("""
        choose('Q1: Lobby')
        document.getElementById('downloadTrackerDataButton').click()
        await browser.wait(200)
        choose('sensor log')
        document.getElementById('downloadTrackerDataButton').click()
        await browser.wait(200)
        report({ errors: browser.errors, requested: requested('/csv'), downloads })
    """)

    assert result == {"errors": [],
                      "requested": ["GET /internal/datasets/tracker/t1/csv", "GET /internal/data/sensor%20log/csv"],
                      "downloads": ["Q1_ Lobby.csv", "sensor log.csv"]}


def test_deleting_data_confirms_its_name():
    result = run_data_section("""
        choose('Old flow (archived)')
        document.getElementById('showDeleteTrackerDataModalButton').click()
        await browser.wait(300)
        const shownName = document.getElementById('deleteTrackerDataModalDeletedName').textContent
        document.getElementById('deleteTrackerDataModalDeletedInput').value = 'Old flow'
        document.getElementById('deleteTrackerDataFromModalButton').click()
        await browser.wait(300)
        choose('sensor log')
        document.getElementById('showDeleteTrackerDataModalButton').click()
        await browser.wait(300)
        document.getElementById('deleteTrackerDataModalDeletedInput').value = 'sensor log'
        document.getElementById('deleteTrackerDataFromModalButton').click()
        await browser.wait(300)
        report({ errors: browser.errors, shownName, requested: requested('').filter((r) => r.startsWith('DELETE')) })
    """)

    assert result == {"errors": [], "shownName": "Old flow",
                      "requested": ["DELETE /internal/datasets/tracker/t0", "DELETE /internal/data/sensor%20log"]}
