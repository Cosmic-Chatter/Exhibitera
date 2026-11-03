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
          if (pathname === '/internal/datasets/tracker/t1/summary') {{
            // Two records from 2 October on, five in all
            const count = new URL(url).searchParams.get('start') ? 2 : 5
            return {{ body: {{ success: true, columns: ['Date', 'Gallery', 'Notes'], first: '2026-10-01T09:30:00', last: '2026-10-03T16:45:59.900000', count }} }}
          }}
          if (pathname === '/internal/datasets/word_cloud/w1/summary') return {{ body: {{ success: true, columns: ['Text'], first: null, last: null, count: 7 }} }}
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
        ["Survey Kiosk", ["Exit survey"]],
        ["Voting Kiosk", ["Atrium vote"]],
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


def run_subset(script: str):
    return run_data_section("""
        const modal = document.getElementById('downloadTrackerDataSubsetModal')
        const start = document.getElementById('trackerDataSubsetStart')
        const end = document.getElementById('trackerDataSubsetEnd')
        const boxes = () => [...document.querySelectorAll('#trackerDataSubsetColumns input[type="checkbox"]')]
        const columns = () => boxes().map((box) => [box.nextElementSibling.textContent, box.checked])
        const count = () => document.getElementById('trackerDataSubsetCount').textContent
        const downloadButton = document.getElementById('trackerDataSubsetDownloadButton')
        const set = (el, value) => {
          if (el.type === 'checkbox') el.checked = value
          else el.value = value
          el.dispatchEvent(new window.Event('change', { bubbles: true }))
        }
        const openSubset = async (name) => {
          choose(name)
          document.getElementById('showDownloadTrackerDataSubsetButton').click()
          await browser.wait(400)
        }
    """ + script)


def test_download_menu_offers_all_or_subset():
    result = run_data_section("""
        const menuItems = [...document.querySelectorAll('#downloadTrackerDataMenu .dropdown-item')].map((b) => [b.id, b.textContent.trim()])
        report({ errors: browser.errors, menuItems })
    """)

    assert result == {"errors": [], "menuItems": [["downloadTrackerDataButton", "Download all"],
                                                  ["showDownloadTrackerDataSubsetButton", "Download subset"]]}


def test_subset_shows_the_time_range_columns_and_count():
    result = run_subset("""
        await openSubset('Q1: Lobby')
        const opened = { shown: modal.classList.contains('show'), name: document.getElementById('trackerDataSubsetName').textContent,
                         range: [start.value, end.value], columns: columns(), count: count(),
                         timeRange: document.getElementById('trackerDataSubsetTimeRange').style.display !== 'none' }
        set(start, '2026-10-02T00:00')
        await browser.wait(200)
        report({ errors: browser.errors, opened, count: count(), summaries: requested('/summary') })
    """)

    assert result == {"errors": [],
                      "opened": {"shown": True, "name": "Q1: Lobby", "range": ["2026-10-01T09:30", "2026-10-03T16:45"],
                                 "columns": [["Date", True], ["Gallery", True], ["Notes", True]], "count": "5 records",
                                 "timeRange": True},
                      "count": "2 records",
                      "summaries": ["GET /internal/datasets/tracker/t1/summary",
                                    "GET /internal/datasets/tracker/t1/summary"]}


def test_subset_download_sends_the_range_and_columns():
    result = run_subset("""
        await openSubset('Q1: Lobby')
        set(start, '2026-10-02T00:00')
        set(boxes()[2], false)
        await browser.wait(200)
        downloadButton.click()
        await browser.wait(400)
        const request = browser.requests.filter((r) => r.url.includes('/csv')).at(-1)
        const params = new URL(request.url).searchParams
        report({
          errors: browser.errors,
          path: new URL(request.url).pathname,
          // The end wasn't changed, so it isn't sent, and records without a time aren't left out by it
          params: { start: params.getAll('start'), end: params.getAll('end'), columns: params.getAll('columns') },
          downloads,
          closed: !modal.classList.contains('show')
        })
    """)

    assert result == {"errors": [], "path": "/internal/datasets/tracker/t1/csv",
                      "params": {"start": ["2026-10-02T00:00"], "end": [], "columns": ["Date", "Gallery"]},
                      "downloads": ["Q1_ Lobby.csv"], "closed": True}


def test_subset_needs_a_column():
    result = run_subset("""
        await openSubset('Q1: Lobby')
        document.getElementById('trackerDataSubsetSelectNone').click()
        const none = { columns: columns().map(([, checked]) => checked), disabled: downloadButton.disabled }
        document.getElementById('trackerDataSubsetSelectAll').click()
        report({ errors: browser.errors, none, all: { columns: columns().map(([, checked]) => checked), disabled: downloadButton.disabled } })
    """)

    assert result == {"errors": [], "none": {"columns": [False, False, False], "disabled": True},
                      "all": {"columns": [True, True, True], "disabled": False}}


def test_data_without_times_has_no_time_range():
    result = run_subset("""
        await openSubset('Lobby')
        report({
          errors: browser.errors,
          timeRange: document.getElementById('trackerDataSubsetTimeRange').style.display !== 'none',
          noTimes: document.getElementById('trackerDataSubsetNoTimes').style.display !== 'none',
          columns: columns(),
          count: count()
        })
    """)

    assert result == {"errors": [], "timeRange": False, "noTimes": True, "columns": [["Text", True]], "count": "7 records"}
