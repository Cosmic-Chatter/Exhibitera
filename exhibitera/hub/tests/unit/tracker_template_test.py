"""Verify the Flexible Tracker template editor's options for timers.

"Record start time" is a checkbox for each timer, off by default, and saved in the template as
record_start_time. See https://github.com/Cosmic-Chatter/Exhibitera/issues/90
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

# A template from before the option existed
OLD_TEMPLATE = {"uuid": "t1", "name": "Gallery flow", "widget_order": ["w1"],
                "widgets": {"w1": {"uuid": "w1", "type": "timer", "name": "Fog Room", "label": "", "exclusive": False}}}


def test_record_start_time_checkbox():
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        const document = window.document
        await browser.wait(1000)
        const tracker = await import({page_scripts.module_url("hub/js/features/tracker.js")})

        const modal = document.getElementById('editTrackerTemplateModal')
        const template = () => JSON.parse(modal.dataset.template)
        const openWidget = (uuid) => {{
          const header = document.getElementById('editTrackerWidgetNameField_' + uuid)
          const widget = header.closest('.mx-1')
          ;[...widget.querySelectorAll('div')].find((el) => el.textContent === 'Edit' && el.style.cursor === 'pointer').click()
          return document.getElementById('editTrackerTemplateRecordStartTime_' + uuid)
        }}

        // An existing timer from an older template
        modal.dataset.template = JSON.stringify({json.dumps(OLD_TEMPLATE)})
        tracker.editTrackerTemplateModalAddWidget('Tornado Machine', 'timer')
        const newUUID = template().widget_order.at(-1)
        const oldBox = openWidget('w1')
        const oldChecked = oldBox.checked

        // A new timer
        const newDefault = template().widgets[newUUID].record_start_time
        const newBox = openWidget(newUUID)
        const newChecked = newBox.checked
        newBox.checked = true
        newBox.dispatchEvent(new window.Event('change'))
        const savedOn = template().widgets[newUUID].record_start_time
        const reopened = openWidget(newUUID).checked
        const offBox = openWidget(newUUID)
        offBox.checked = false
        offBox.dispatchEvent(new window.Event('change'))

        report({{
          errors: browser.errors,
          oldChecked, newDefault, newChecked, savedOn, reopened,
          savedOff: template().widgets[newUUID].record_start_time,
          label: newBox.parentElement.querySelector('label').textContent
        }})
    """, browser="page")

    assert result == {"errors": [], "oldChecked": False, "newDefault": False, "newChecked": False,
                      "savedOn": True, "reopened": True, "savedOff": False, "label": "Record start time?"}
