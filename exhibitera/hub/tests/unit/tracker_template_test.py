"""Verify the Flexible Tracker template editor in the console's Analytics tab.

Templates are edited in the tab, beside a live preview of the tracker. Widgets are listed like items in
the Apps setup pages: choosing one opens its properties, with buttons to move or delete it.
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

# A saved template, including a timer from before "Record start time" existed
TEMPLATE = {"uuid": "t1", "name": "Gallery flow", "guest_facing": True, "widget_order": ["w1", "w2", "w3"],
            "widgets": {"w1": {"uuid": "w1", "type": "counter", "name": "Visitors", "label": ""},
                        "w2": {"uuid": "w2", "type": "timer", "name": "Fog Room", "label": "", "exclusive": False},
                        "w3": {"uuid": "w3", "type": "text", "name": "Notes", "label": "", "lines": 5}}}


def run_editor(script: str):
    """Open the console, open the template above in the editor, and run script."""

    return page_scripts.run(f"""
        globalThis.server = (method, url, body) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [{{ uuid: 't1', name: 'Gallery flow' }}] }}
          if (pathname === '/internal/tracker/template/t1') return {{ body: {{ success: true, template: {json.dumps(TEMPLATE)} }} }}
          if (pathname === '/internal/tracker/template/create') return {{ body: {{ success: true }} }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        const document = window.document
        await browser.wait(1000)
        const tracker = await import({page_scripts.module_url("hub/js/features/tracker.js")})

        const editor = document.getElementById('trackerTemplateEditor')
        const template = () => JSON.parse(editor.dataset.template)
        const listed = () => [...document.querySelectorAll('#trackerWidgetList button')].map((b) => b.textContent)
        const selected = () => document.querySelector('#trackerWidgetList button.active')?.textContent ?? null
        const choose = (name) => [...document.querySelectorAll('#trackerWidgetList button')].find((b) => b.textContent === name).click()
        const lastPreview = () => previews.at(-1)?.template
        const change = (el, value) => {{
          if (el.type === 'checkbox') el.checked = value
          else el.value = value
          el.dispatchEvent(new window.Event('change'))
        }}

        document.getElementById('trackerTemplateSelect').value = 't1'
        document.getElementById('showEditTrackerTemplateButton').click()
        await browser.wait(500)

        // Watch what the editor sends to the preview. Loading the preview the first time replaces its window,
        // so watch the loaded one and open the template again.
        const previews = []
        document.getElementById('trackerTemplatePreview').contentWindow.postMessage = (message) => previews.push(message)
        document.getElementById('showEditTrackerTemplateButton').click()
        await browser.wait(500)

        {script}
    """, browser="page")


def test_template_opens_in_the_tab_with_a_preview():
    result = run_editor("""
        report({
          errors: browser.errors,
          editorShown: document.getElementById('trackerTemplateEditor').style.display !== 'none',
          modalExists: document.getElementById('editTrackerTemplateModal') !== null,
          name: document.getElementById('trackerTemplateEditorName').textContent,
          guestFacing: document.getElementById('editTrackerTemplateGuestFacingCheckbox').checked,
          listed: listed(),
          selected: selected(),
          previewSrc: document.getElementById('trackerTemplatePreview').getAttribute('src'),
          previewed: lastPreview()?.widget_order
        })
    """)

    assert result == {"errors": [], "editorShown": True, "modalExists": False, "name": "Gallery flow",
                      "guestFacing": True, "listed": ["Visitors", "Fog Room", "Notes"], "selected": "Visitors",
                      "previewSrc": "tracker.html?preview=true", "previewed": ["w1", "w2", "w3"]}


def test_adding_a_widget_selects_it_and_updates_the_preview():
    result = run_editor("""
        document.querySelector('[data-add-tracker-widget="slider"]').click()
        await browser.wait(100)
        const added = template().widget_order.at(-1)
        report({
          errors: browser.errors,
          listed: listed(),
          selected: selected(),
          widget: template().widgets[added],
          previewed: lastPreview()?.widget_order.length
        })
    """)

    assert result["errors"] == []
    assert result["listed"] == ["Visitors", "Fog Room", "Notes", "New Slider"]
    assert result["selected"] == "New Slider"
    assert {key: result["widget"][key] for key in ["name", "type", "min", "max", "step", "start"]} == \
        {"name": "New Slider", "type": "slider", "min": 1, "max": 5, "step": 1, "start": 3}
    assert result["previewed"] == 4


def test_editing_a_widget_updates_the_list_and_preview():
    result = run_editor("""
        choose('Fog Room')
        change(document.getElementById('editTrackerTemplateName_w2'), 'Fog Chamber')
        const startTime = document.getElementById('editTrackerTemplateRecordStartTime_w2')
        const startTimeWas = startTime.checked
        change(startTime, true)
        report({
          errors: browser.errors,
          listed: listed(),
          selected: selected(),
          startTimeWas,
          saved: template().widgets.w2,
          previewed: lastPreview()?.widgets.w2.name
        })
    """)

    assert result["errors"] == []
    assert result["listed"] == ["Visitors", "Fog Chamber", "Notes"]
    assert result["selected"] == "Fog Chamber"
    assert result["startTimeWas"] is False
    assert result["saved"]["name"] == "Fog Chamber"
    assert result["saved"]["record_start_time"] is True
    assert result["previewed"] == "Fog Chamber"


def test_moving_and_deleting_widgets():
    result = run_editor("""
        choose('Visitors')
        document.getElementById('trackerWidgetDownButton').click()
        const movedDown = listed()
        document.getElementById('trackerWidgetUpButton').click()
        document.getElementById('trackerWidgetUpButton').click() // Already first, so nothing happens
        const movedBack = listed()
        choose('Fog Room')
        document.getElementById('trackerWidgetDeleteButton').click()
        const afterDelete = { listed: listed(), selected: selected() }
        for (let i = 0; i < 2; i++) document.getElementById('trackerWidgetDeleteButton').click()
        report({
          errors: browser.errors,
          movedDown, movedBack, afterDelete,
          empty: { listed: listed(), properties: document.getElementById('trackerWidgetEditPane').style.display },
          previewed: lastPreview()?.widget_order
        })
    """)

    assert result == {"errors": [], "movedDown": ["Fog Room", "Visitors", "Notes"],
                      "movedBack": ["Visitors", "Fog Room", "Notes"],
                      "afterDelete": {"listed": ["Visitors", "Notes"], "selected": "Notes"},
                      "empty": {"listed": [], "properties": "none"}, "previewed": []}


def test_new_timers_do_not_record_their_start_time_by_default():
    result = run_editor("""
        document.querySelector('[data-add-tracker-widget="timer"]').click()
        const added = template().widget_order.at(-1)
        report({
          errors: browser.errors,
          saved: template().widgets[added].record_start_time,
          checked: document.getElementById('editTrackerTemplateRecordStartTime_' + added).checked,
          label: document.getElementById('editTrackerTemplateRecordStartTime_' + added).parentElement.querySelector('label').textContent
        })
    """)

    assert result == {"errors": [], "saved": False, "checked": False, "label": "Record start time?"}


def test_saving_and_closing():
    result = run_editor("""
        change(document.getElementById('editTrackerTemplateGuestFacingCheckbox'), false)
        document.getElementById('trackerTemplateEditorSaveButton').click()
        await browser.wait(300)
        const save = browser.requests.filter((r) => r.url.endsWith('/tracker/template/create')).at(-1)
        const sent = JSON.parse(save.body)
        document.getElementById('trackerTemplateEditorCloseButton').click()
        await browser.wait(100) // Closing may first ask about unsaved changes
        report({
          errors: browser.errors,
          savedUUID: sent.tracker_uuid,
          savedGuestFacing: sent.template.guest_facing,
          savedOrder: sent.template.widget_order,
          editorShown: document.getElementById('trackerTemplateEditor').style.display !== 'none'
        })
    """)

    assert result == {"errors": [], "savedUUID": "t1", "savedGuestFacing": False,
                      "savedOrder": ["w1", "w2", "w3"], "editorShown": False}


# Unsaved changes, as in the Apps setup pages

UNSAVED = """
    const dialogShown = () => document.getElementById('trackerUnsavedChangesModal').classList.contains('show')
    const editorShown = () => document.getElementById('trackerTemplateEditor').style.display !== 'none'
    const choose_ = async (id) => {
      document.getElementById(id).click()
      await browser.wait(400)
    }
    const close = async () => {
      document.getElementById('trackerTemplateEditorCloseButton').click()
      await browser.wait(400)
    }
"""


def test_closing_without_changes_does_not_ask():
    result = run_editor(UNSAVED + """
        await close()
        report({ errors: browser.errors, asked: dialogShown(), editorShown: editorShown() })
    """)

    assert result == {"errors": [], "asked": False, "editorShown": False}


def test_closing_with_unsaved_changes_asks_first():
    result = run_editor(UNSAVED + """
        document.querySelector('[data-add-tracker-widget="number"]').click()
        await close()
        const asked = dialogShown()
        const text = document.getElementById('trackerUnsavedChangesModal').textContent
        await choose_('trackerUnsavedChangesKeepButton')
        const kept = { editorShown: editorShown(), listed: listed() }
        await close()
        await choose_('trackerUnsavedChangesDiscardButton')
        report({ errors: browser.errors, asked, mentionsName: text.includes('Gallery flow'), kept, closed: !editorShown() })
    """)

    assert result == {"errors": [], "asked": True, "mentionsName": True,
                      "kept": {"editorShown": True, "listed": ["Visitors", "Fog Room", "Notes", "New Number"]},
                      "closed": True}


def test_saved_or_reverted_changes_are_not_unsaved():
    result = run_editor(UNSAVED + """
        // A change made and then undone
        change(document.getElementById('editTrackerTemplateName_w1'), 'Guests')
        change(document.getElementById('editTrackerTemplateName_w1'), 'Visitors')
        await close()
        const askedAfterUndo = dialogShown()

        document.getElementById('showEditTrackerTemplateButton').click()
        await browser.wait(400)
        document.querySelector('[data-add-tracker-widget="number"]').click()
        document.getElementById('trackerTemplateEditorSaveButton').click()
        await browser.wait(300)
        await close()
        report({ errors: browser.errors, askedAfterUndo, askedAfterSave: dialogShown(), closed: !editorShown() })
    """)

    assert result == {"errors": [], "askedAfterUndo": False, "askedAfterSave": False, "closed": True}


def test_opening_or_creating_a_template_asks_first():
    result = run_editor(UNSAVED + """
        document.querySelector('[data-add-tracker-widget="number"]').click()

        document.getElementById('showEditTrackerTemplateButton').click()
        await browser.wait(400)
        const askedToOpen = dialogShown()
        await choose_('trackerUnsavedChangesKeepButton')
        const keptEdits = listed().length

        document.getElementById('createTrackerTemplateName').value = 'Second tracker'
        document.getElementById('createTrackerTemplateButton').click()
        await browser.wait(400)
        const askedToCreate = dialogShown()
        await choose_('trackerUnsavedChangesKeepButton')
        const created = browser.requests.filter((r) => r.url.endsWith('/tracker/template/create')).length

        document.getElementById('showEditTrackerTemplateButton').click()
        await browser.wait(400)
        await choose_('trackerUnsavedChangesDiscardButton')
        report({ errors: browser.errors, askedToOpen, keptEdits, askedToCreate, created, reopened: listed() })
    """)

    assert result == {"errors": [], "askedToOpen": True, "keptEdits": 4, "askedToCreate": True, "created": 0,
                      "reopened": ["Visitors", "Fog Room", "Notes"]}


def test_leaving_the_page_with_unsaved_changes_asks_first():
    result = run_editor(UNSAVED + """
        const leave = () => {
          const event = new window.Event('beforeunload', { cancelable: true })
          window.dispatchEvent(event)
          return event.defaultPrevented
        }
        const clean = leave()
        document.querySelector('[data-add-tracker-widget="number"]').click()
        const unsaved = leave()
        report({ errors: browser.errors, clean, unsaved })
    """)

    assert result == {"errors": [], "clean": False, "unsaved": True}


# The preview, sized like an iPad

def test_preview_is_an_ipad_sized_page_scaled_to_fit():
    result = run_editor("""
        const preview = document.getElementById('trackerTemplatePreview')
        const frame = document.getElementById('trackerTemplatePreviewFrame')
        Object.defineProperty(frame, 'clientWidth', { value: 512, configurable: true })
        window.dispatchEvent(new window.Event('resize'))
        await browser.wait(100)
        report({ errors: browser.errors, width: preview.style.width, height: preview.style.height,
                 transform: preview.style.transform })
    """)

    assert result == {"errors": [], "width": "1024px", "height": "768px", "transform": "scale(0.5)"}
