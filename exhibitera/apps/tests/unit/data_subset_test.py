"""Verify downloading part of a data file in standalone Apps, as on Hub.

The settings page's Data tab can download the records in a time range, with chosen columns. Times are local,
as records store them, and the end includes the whole day or minute it gives.
"""

# Third-party modules
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
import exhibitera.common.config as ex_config
from exhibitera.common.tests import page_scripts

RECORDS = [{"Date": "2026-10-01T09:30:00.000", "Gallery": "North", "Visitors": 3, "Topics": ["Fossils"]},
           {"Date": "2026-10-02T14:05:30.500", "Gallery": "South", "Visitors": 5, "Topics": ["Fossils", "Gems"]},
           {"Date": "2026-10-03T16:45:59.900", "Gallery": "North", "Visitors": 2},
           {"Gallery": "East", "Visitors": 1}]


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Return a client for Apps with a data file of the records above, named "Exit survey"."""

    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    (tmp_path / "data").mkdir()
    client = TestClient(apps.app)
    for record in RECORDS:
        client.post("/internal/data/Exit survey/append", json={"data": record})
    return client


def csv_lines(response) -> list[str]:
    return response.json()["csv"].strip().splitlines()


def test_summary_lists_columns_and_time_range(client):
    summary = client.get("/internal/data/Exit survey/summary").json()

    assert summary == {"success": True, "columns": ["Date", "Gallery", "Topics", "Visitors"],
                       "first": "2026-10-01T09:30:00", "last": "2026-10-03T16:45:59.900000", "count": 4}


def test_summary_counts_records_in_a_time_range(client):
    def count(**params):
        return client.get("/internal/data/Exit survey/summary", params=params).json()["count"]

    assert count(start="2026-10-02T14:05", end="2026-10-03T16:45") == 2
    assert count(start="2026-10-02", end="2026-10-03") == 2
    assert count() == 4


def test_csv_can_be_limited_to_a_time_range_and_columns(client):
    lines = csv_lines(client.get("/internal/data/Exit survey/csv", params={
        "start": "2026-10-02T00:00", "end": "2026-10-03T23:59", "columns": ["Date", "Topics"]}))

    assert lines[0] == "Date,Topics - Fossils,Topics - Gems"
    assert len(lines) == 3


def test_csv_without_a_subset_is_unchanged(client):
    lines = csv_lines(client.get("/internal/data/Exit survey/csv"))

    assert lines[0].startswith("Date,Gallery,")
    assert len(lines) == 5


@pytest.mark.parametrize("time", ["yesterday", "2026-13-45T99:00", "2026-10-02T00:00Z"])
def test_invalid_times_are_refused(client, time):
    summary = client.get("/internal/data/Exit survey/summary", params={"start": time}).json()
    download = client.get("/internal/data/Exit survey/csv", params={"end": time}).json()

    assert summary == {"success": False, "reason": "invalid_time"}
    assert (download["success"], download["reason"]) == (False, "invalid_time")


def test_missing_files_have_no_summary(client):
    assert client.get("/internal/data/missing/summary").json() == {"success": False, "reason": "unknown_file"}


# The settings page's Data tab

def run_data_tab(script: str):
    return page_scripts.run("""
        globalThis.server = (method, url) => {
          const { pathname, searchParams } = new URL(url)
          if (pathname === '/internal/data/') return { body: { success: true, files: ['Exit survey.txt', 'Word_Cloud_Lobby.txt'] } }
          if (pathname === '/internal/data/Exit%20survey/csv') return { body: { success: true, csv: 'a,b\\n1,2' } }
          if (pathname === '/internal/data/Exit%20survey/summary') {
            // Two records from 2 October on, five in all
            const count = searchParams.get('start') ? 2 : 5
            return { body: { success: true, columns: ['Date', 'Gallery', 'Notes'], first: '2026-10-01T09:30:00', last: '2026-10-03T16:45:59.900000', count } }
          }
          if (pathname === '/internal/data/Word_Cloud_Lobby/summary') return { body: { success: true, columns: [], first: null, last: null, count: 0 } }
          if (pathname === '/internal/definitions') return { body: { success: true, definitions: {} } }
          if (pathname === '/internal/DMX/scenes') return { body: { success: true, scenes: [] } }
          if (pathname.endsWith('/groups')) return { body: { success: true, groups: [] } }
          if (pathname.endsWith('/user/login')) return { body: { success: false } }
          return { body: { success: true } }
        }
        console.log = () => {}
        console.error = () => {}
        const window = await browser.openPage('apps', 'setup.html')
        const document = window.document
        await browser.wait(800)

        // Record downloads instead of saving them. On the Apps computer's own window, Apps shows a save
        // dialog instead, so count those too.
        const browserDownloads = []
        window.URL.createObjectURL = () => 'blob:test'
        window.HTMLAnchorElement.prototype.click = function () { browserDownloads.push(this.download) }
        const saveDialogs = () => browser.requests.filter((r) => r.url.includes('/app/saveFile')).map((r) => JSON.parse(r.body).filename)

        const select = document.getElementById('dataSelect')
        const modal = document.getElementById('dataSubsetModal')
        const start = document.getElementById('dataSubsetStart')
        const boxes = () => [...document.querySelectorAll('#dataSubsetColumns input[type="checkbox"]')]
        const columns = () => boxes().map((box) => [box.nextElementSibling.textContent, box.checked])
        const count = () => document.getElementById('dataSubsetCount').textContent
        const requested = (part) => browser.requests.filter((r) => r.url.includes(part)).map((r) => r.method + ' ' + new URL(r.url).pathname)
        const set = (el, value) => {
          if (el.type === 'checkbox') el.checked = value
          else el.value = value
          el.dispatchEvent(new window.Event('change', { bubbles: true }))
        }
    """ + script, browser="page")


@page_scripts.needs_jsdom
def test_data_tab_offers_all_or_subset():
    result = run_data_tab("""
        select.value = 'Exit survey'
        document.getElementById('dataDownloadButton').click()
        await browser.wait(200)
        report({
          errors: browser.errors,
          menuItems: [...document.querySelectorAll('#dataDownloadMenu .dropdown-item')].map((b) => [b.id, b.textContent.trim()]),
          requested: requested('/csv'),
          downloads: [...browserDownloads, ...saveDialogs()]
        })
    """)

    assert result["errors"] == []
    assert result["menuItems"] == [["dataDownloadButton", "Download all"],
                                   ["dataDownloadSubsetShowModalButton", "Download subset"]]
    # Download all downloads the whole file, as before
    assert result["requested"] == ["GET /internal/data/Exit%20survey/csv"]
    assert len(result["downloads"]) == 1


@page_scripts.needs_jsdom
def test_data_tab_downloads_a_subset():
    result = run_data_tab("""
        select.value = 'Exit survey'
        document.getElementById('dataDownloadSubsetShowModalButton').click()
        await browser.wait(400)
        const opened = { shown: modal.classList.contains('show'), name: document.getElementById('dataSubsetName').textContent,
                         columns: columns(), count: count() }
        set(start, '2026-10-02T00:00')
        set(boxes()[2], false)
        await browser.wait(200)
        const narrowed = count()
        document.getElementById('dataSubsetDownloadButton').click()
        await browser.wait(400)
        const request = browser.requests.filter((r) => r.url.includes('/csv')).at(-1)
        const params = new URL(request.url).searchParams
        report({
          errors: browser.errors,
          opened,
          narrowed,
          params: { start: params.getAll('start'), end: params.getAll('end'), columns: params.getAll('columns') },
          downloads: [...browserDownloads, ...saveDialogs()],
          closed: !modal.classList.contains('show')
        })
    """)

    assert result == {"errors": [],
                      "opened": {"shown": True, "name": "Exit survey",
                                 "columns": [["Date", True], ["Gallery", True], ["Notes", True]], "count": "5 records"},
                      "narrowed": "2 records",
                      "params": {"start": ["2026-10-02T00:00"], "end": [], "columns": ["Date", "Gallery"]},
                      "downloads": ["Exit survey.csv"], "closed": True}


@page_scripts.needs_jsdom
def test_data_without_times_has_no_time_range():
    result = run_data_tab("""
        select.value = 'Word_Cloud_Lobby'
        document.getElementById('dataDownloadSubsetShowModalButton').click()
        await browser.wait(400)
        report({
          errors: browser.errors,
          timeRange: document.getElementById('dataSubsetTimeRange').style.display !== 'none',
          noTimes: document.getElementById('dataSubsetNoTimes').style.display !== 'none'
        })
    """)

    assert result == {"errors": [], "timeRange": False, "noTimes": True}
