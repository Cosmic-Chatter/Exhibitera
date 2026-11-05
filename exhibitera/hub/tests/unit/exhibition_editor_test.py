"""Verify the exhibition editor with components that Hub no longer has.

An exhibition keeps listing a component after the component is removed from Hub. The editor shows it by its saved
name, so it can still be removed from the exhibition, instead of leaving a card that can't be removed.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.hub.tests.unit.tracker_template_test import ADMIN

pytestmark = page_scripts.needs_jsdom

EXHIBITION = {"uuid": "e1", "name": "Summer", "commands": [],
              "components": [{"uuid": "gone", "id": "Old kiosk", "definition": "d1"}]}


def run_exhibition_editor(script: str):
    return page_scripts.run(f"""
        globalThis.server = (method, url, body) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/exhibition/e1/details') return {{ body: {{ success: true, exhibit: {json.dumps(EXHIBITION)} }} }}
          if (pathname === '/internal/exhibition/e1/edit') return {{ body: {{ success: true }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        const document = window.document
        await browser.wait(1000)
        const exhibits = await import({page_scripts.module_url("hub/js/features/exhibits.js")})
        await exhibits.editExhibitPopulateExhibitContent('e1')
        await browser.wait(200)
        const cards = () => [...document.querySelectorAll('#editExhibitExhibitContentList .manageExhibit-component-col')]
        {script}
    """, browser="page")


def test_missing_components_can_be_removed():
    result = run_exhibition_editor("""
        const card = cards()[0]
        const shown = { name: card?.querySelector('.fs-5')?.textContent, message: card?.querySelector('.alert')?.textContent }
        card?.querySelector('.btn-danger')?.click()
        document.getElementById('editExhibitSaveButton').click()
        await browser.wait(200)
        const saved = browser.requests.filter((r) => r.url.includes('/exhibition/e1/edit')).map((r) => JSON.parse(r.body).details.components)
        report({ errors: browser.errors, shown, cardsLeft: cards().length, saved })
    """)

    assert result["errors"] == []
    assert result["shown"] == {"name": "Old kiosk", "message": "Component not found"}
    assert result["cardsLeft"] == 0
    assert result["saved"] == [[]]


def test_missing_components_are_kept_unless_removed():
    # Saving other changes doesn't drop a component that's only missing for now, such as one not yet reconnected
    result = run_exhibition_editor("""
        document.getElementById('editExhibitSaveButton').click()
        await browser.wait(200)
        const saved = browser.requests.filter((r) => r.url.includes('/exhibition/e1/edit')).map((r) => JSON.parse(r.body).details.components)
        report({ errors: browser.errors, saved })
    """)

    assert result == {"errors": [], "saved": [[{"uuid": "gone", "id": "Old kiosk", "definition": "d1"}]]}


# The modifications window, which lists temporary changes to the current exhibition's definitions

def test_modifications_for_missing_components_can_be_removed():
    result = page_scripts.run(f"""
        globalThis.server = (method, url, body) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          if (pathname === '/internal/exhibition/modifications' && method === 'GET') {{
            return {{ body: {{ success: true, modifications: {{ components: [{{ uuid: 'gone', definition: 'd2' }}] }} }} }}
          }}
          if (pathname.endsWith('/details')) return {{ body: {{ success: true, exhibit: {json.dumps(EXHIBITION)} }} }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        const document = window.document
        await browser.wait(1000)
        const exhibits = await import({page_scripts.module_url("hub/js/features/exhibits.js")})
        await exhibits.showExhibitionModificationsModal()
        await browser.wait(200)

        const cards = () => [...document.querySelectorAll('#exhibitModificationsModalRow .component-name')]
        const shown = {{
          name: cards()[0]?.textContent,
          warning: document.querySelector('#exhibitModificationsModalRow .bad-connection-warning')?.textContent.trim()
        }}
        document.querySelector('#exhibitModificationsModalRow .btn-close')?.click()
        document.getElementById('exhibitModificationsModalSaveButton').click()
        await browser.wait(200)
        const removed = browser.requests.filter((r) => r.method === 'DELETE' && r.url.includes('/exhibition/modifications'))
          .map((r) => JSON.parse(r.body).to_remove)
        report({{ errors: browser.errors, shown, cardsLeft: cards().length, removed }})
    """, browser="page")

    assert result["errors"] == []
    # Modifications don't save a component's name, so it comes from the exhibition
    assert result["shown"] == {"name": "Old kiosk", "warning": "Component not found"}
    assert result["cardsLeft"] == 0
    assert result["removed"] == [["gone"]]
