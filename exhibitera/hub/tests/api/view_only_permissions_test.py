"""Verify that the console's Exhibitions and Programs tabs offer no editing to a user who may only view them.

A beta tester with view permission for programs and exhibitions saw the same controls as an editor. Hub refuses the
changes, so the controls only led to failed saves. The Schedule and Maintenance tabs already hide them.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts


def user_with(level: str) -> dict:
    return {"uuid": "u1", "username": "guide", "display_name": "Guide", "preferences": {},
            "permissions": {"analytics": "none", "components": {"edit": [], "edit_content": [], "view": []},
                            "exhibits": level, "maintenance": "none", "programs": level, "schedule": "none",
                            "settings": "none", "users": "none"}}


EXHIBIT = {"uuid": "e1", "name": "Main", "components": [{"uuid": "c1", "id": "kiosk", "definition": "d1"}],
           "commands": [{"uuid": "a1", "action": "note", "value": "Hello"}]}
PROGRAM = {"uuid": "p1", "name": "Show", "description": "", "location": "", "duration": 30, "capacity": None,
           "actions": {"a1": {"uuid": "a1", "time_in_seconds": 0, "action": "note", "value": "Hello"}}}


def open_tabs(level: str) -> dict:
    """Log in with the given permission for exhibitions and programs, open an exhibition and a program, and report
    which editing controls can be seen or used."""

    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(user_with(level))} }} }}
          if (pathname === '/internal/exhibition/e1/details') return {{ body: {{ success: true, exhibit: {json.dumps(EXHIBIT)} }} }}
          if (pathname === '/internal/program/p1') return {{ body: {{ success: true, program: {json.dumps(PROGRAM)} }} }}
          if (pathname === '/internal/program/archive/list') return {{ body: {{ success: true, programs: [{{ uuid: 'p2', name: 'Old' }}] }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        const exhibits = await import({page_scripts.module_url("hub/js/features/exhibits.js")})
        const programs = await import({page_scripts.module_url("hub/js/features/programs.js")})
        const doc = window.document
        const el = (id) => doc.getElementById(id)

        // Hidden by its own style or an ancestor's
        const shown = (node) => {{
          for (let n = node; n && n !== doc.body; n = n.parentElement) {{
            if (window.getComputedStyle(n).display === 'none') return false
          }}
          return true
        }}

        await exhibits.editExhibitPopulateExhibitContent('e1')
        await browser.wait(200)
        await programs.editProgram('p1')
        programs.showArchivedProgramsModal()
        await browser.wait(200)

        report({{
          errors: browser.errors,
          exhibits: {{
            editLabel: el('editExhibitButton').textContent,
            set: shown(el('setExhibitButton')),
            create: shown(el('createExhibitButton').closest('.dropdown')),
            delete: shown(el('exhibitDeleteSelectorButton')),
            add: shown(el('editExhibitAddComponentButton').closest('.dropdown')),
            save: shown(el('editExhibitSaveButton')),
            nameEditable: !el('editExhibitName').readOnly && !el('editExhibitName').disabled,
            removeComponent: [...doc.querySelectorAll('.manageExhibit-component-col .btn-danger')].some(shown),
            editAction: [...el('editExhibitActionsList').querySelectorAll('button')].some(shown)
          }},
          programs: {{
            editLabel: el('editProgramButton').textContent,
            create: shown(el('createProgramButton').closest('.dropdown')),
            delete: shown(el('deleteSelectedProgramButton')),
            save: shown(el('saveProgramButton')),
            fieldsEditable: ['editProgramNameField', 'editProgramDescriptionField', 'editProgramLocationField',
              'editProgramDurationField', 'editProgramCapacityField'].filter((id) => !el(id).disabled),
            upload: [shown(el('editProgramThumbnailButton').closest('label')), shown(el('editProgramTrailerButton').closest('label'))],
            addAction: shown(el('editProgramAddActionButton')),
            editAction: [...el('editProgramActionList').querySelectorAll('button')].some(shown),
            restore: [...el('archivedProgramsModalList').querySelectorAll('button')].some(shown)
          }}
        }})
    """, browser="page")


@page_scripts.needs_jsdom
def test_viewers_see_no_editing_controls():
    result = open_tabs("view")

    assert result == {
        "errors": [],
        "exhibits": {"editLabel": "View", "set": False, "create": False, "delete": False, "add": False,
                     "save": False, "nameEditable": False, "removeComponent": False, "editAction": False},
        "programs": {"editLabel": "View", "create": False, "delete": False, "save": False, "fieldsEditable": [],
                     "upload": [False, False], "addAction": False, "editAction": False, "restore": False}
    }


@page_scripts.needs_jsdom
def test_editors_keep_their_controls():
    result = open_tabs("edit")

    assert result == {
        "errors": [],
        "exhibits": {"editLabel": "Edit", "set": True, "create": True, "delete": True, "add": True,
                     "save": True, "nameEditable": True, "removeComponent": True, "editAction": True},
        "programs": {"editLabel": "Edit", "create": True, "delete": True, "save": True,
                     "fieldsEditable": ["editProgramNameField", "editProgramDescriptionField",
                                        "editProgramLocationField", "editProgramDurationField",
                                        "editProgramCapacityField"],
                     "upload": [True, True], "addAction": True, "editAction": True, "restore": True}
    }


@page_scripts.needs_jsdom
@pytest.mark.parametrize("level, label", [("view", "View future date"), ("edit", "Manage future date")])
def test_the_future_date_button_matches_the_schedule_permission(level, label):
    user = user_with("none")
    user["permissions"]["schedule"] = level
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(user)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        report(window.document.getElementById('manageFutureDateButton').textContent)
    """, browser="page")

    assert result == label


@page_scripts.needs_jsdom
@pytest.mark.parametrize("level", ["view", "edit"])
def test_the_users_tab_matches_the_users_permission(level):
    user = user_with("none")
    user["permissions"]["users"] = level
    other = {"uuid": "u2", "username": "other", "display_name": "Other", "preferences": {},
             "permissions": {**user_with("none")["permissions"],
                             "components": {"edit": [], "edit_content": [], "view": ["g1"]}}}
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(user)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        const users = await import({page_scripts.module_url("hub/js/features/users.js")})
        const doc = window.document
        const el = (id) => doc.getElementById(id)
        const shown = (node) => {{
          for (let n = node; n && n !== doc.body; n = n.parentElement) {{
            if (window.getComputedStyle(n).display === 'none') return false
          }}
          return true
        }}

        users.showEditUserModal({json.dumps(other)})
        const fields = [...doc.querySelectorAll('#editUserModal .editUserField, #editUserModal .editUserGroupSelect')]
        report({{
          errors: browser.errors,
          create: shown(el('showEditUserModalButton')),
          title: el('editUserModalTitle').textContent,
          editable: fields.filter((f) => !f.disabled).length > 0,
          allLocked: fields.every((f) => f.disabled),
          password: [shown(el('editUserPassword1Input')), shown(el('editUserPassword2Input'))],
          delete: shown(el('editUserDeleteButton'))
        }})
    """, browser="page")

    viewer = level == "view"
    assert result == {"errors": [], "create": not viewer, "title": "View user" if viewer else "Edit user",
                      "editable": not viewer, "allLocked": viewer, "password": [not viewer, not viewer],
                      "delete": not viewer}


@page_scripts.needs_jsdom
@pytest.mark.parametrize("level", ["view", "edit"])
def test_the_settings_tab_matches_the_settings_permission(level):
    user = user_with("none")
    user["permissions"]["settings"] = level
    groups = [{"uuid": "g1", "name": "Lobby", "description": "Front"}]
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(user)} }} }}
          if (pathname === '/internal/group/archive/list') return {{ body: {{ success: true, groups: [{{ uuid: 'g2', name: 'Old', description: '' }}] }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        const groups = await import({page_scripts.module_url("hub/js/features/groups.js")})
        const hubConfig = (await import({page_scripts.module_url("hub/config.js")})).default
        const doc = window.document
        const el = (id) => doc.getElementById(id)
        const shown = (node) => {{
          for (let n = node; n && n !== doc.body; n = n.parentElement) {{
            if (window.getComputedStyle(n).display === 'none') return false
          }}
          return true
        }}

        hubConfig.groups = {json.dumps(groups)}
        groups.populateGroupsRow()
        groups.showArchivedGroupsModal()
        await browser.wait(200)
        report({{
          errors: browser.errors,
          addGroup: shown(el('settingsAddGroupButton')),
          groupButtons: el('settingsGroupsRow').querySelectorAll('button').length,
          groupName: el('settingsGroupsRow').textContent.includes('Lobby'),
          restore: [...el('archivedGroupsModalList').querySelectorAll('button')].some(shown),
          lockedFields: [...doc.querySelectorAll('.hubSettingsInputField')].map((f) => f.disabled)
        }})
    """, browser="page")

    viewer = level == "view"
    assert result == {"errors": [], "addGroup": not viewer, "groupButtons": 0 if viewer else 4, "groupName": True,
                      "restore": not viewer, "lockedFields": [viewer] * 4}


@page_scripts.needs_jsdom
@pytest.mark.parametrize("level", ["view", "edit"])
def test_adding_components_matches_the_settings_permission(level):
    # Hub only adds projectors, static components and Wake on LAN devices for users who may edit settings
    user = user_with("none")
    user["permissions"]["settings"] = level
    user["permissions"]["components"]["edit"] = ["__all"]
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(user)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        const doc = window.document
        const shown = (node) => {{
          for (let n = node; n && n !== doc.body; n = n.parentElement) {{
            if (window.getComputedStyle(n).display === 'none') return false
          }}
          return true
        }}
        report({{
          errors: browser.errors,
          add: ['showAddProjetorModalButton', 'showAddStaticComponentModalButton', 'showAddWakeOnLANModalButton']
            .map((id) => shown(doc.getElementById(id).closest('.dropdown')))
        }})
    """, browser="page")

    assert result == {"errors": [], "add": [level == "edit"] * 3}


@page_scripts.needs_jsdom
@pytest.mark.parametrize("level", ["view", "edit"])
def test_the_analytics_tab_matches_the_analytics_permission(level):
    user = user_with("none")
    user["permissions"]["analytics"] = level
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(user)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        const doc = window.document
        const shown = (node) => {{
          for (let n = node; n && n !== doc.body; n = n.parentElement) {{
            if (window.getComputedStyle(n).display === 'none') return false
          }}
          return true
        }}
        const ids = ['launchTrackerButton', 'showEditTrackerTemplateButton', 'createTrackerTemplateButton',
          'deleteTrackerTemplateButton', 'downloadTrackerDataButton', 'showDeleteTrackerDataModalButton']
        report({{ errors: browser.errors, shown: Object.fromEntries(ids.map((id) => [id, shown(doc.getElementById(id).closest('[class*="col-"]'))])) }})
    """, browser="page")

    editor = level == "edit"
    assert result == {"errors": [], "shown": {"launchTrackerButton": True, "showEditTrackerTemplateButton": editor,
                                              "createTrackerTemplateButton": editor,
                                              "deleteTrackerTemplateButton": editor, "downloadTrackerDataButton": True,
                                              "showDeleteTrackerDataModalButton": editor}}


@page_scripts.needs_jsdom
@pytest.mark.parametrize("level", ["view", "edit"])
def test_the_future_date_dialog_matches_the_schedule_permission(level):
    user = user_with("none")
    user["permissions"]["schedule"] = level
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(user)} }} }}
          if (pathname === '/internal/schedule/date_specific/list') return {{ body: {{ success: true, schedules: ['2030-01-01', '2030-01-02'] }} }}
          if (pathname === '/internal/schedule/2030-01-01') return {{ body: {{ success: true, schedule: {{}} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        const schedules = await import({page_scripts.module_url("hub/js/features/schedules.js")})
        const doc = window.document
        const el = (id) => doc.getElementById(id)
        const shown = (node) => {{
          for (let n = node; n && n !== doc.body; n = n.parentElement) {{
            if (window.getComputedStyle(n).display === 'none') return false
          }}
          return true
        }}
        const state = () => ({{
          download: shown(el('manageFutureDateDownloadAsJSONDropdown')),
          create: shown(el('manageFutureDateCreateScheduleButtonContainer'))
        }})

        // As if a viewer had opened the dialog earlier, without the page reloading
        el('manageFutureDateCalendarInput').style.display = 'none'
        schedules.showManageFutureDateModal()
        await browser.wait(200)
        const opened = {{ datePicker: shown(el('manageFutureDateCalendarInput')), ...state() }}

        el('futureDateButton_2030-01-01').click()
        await browser.wait(200)
        const loaded = state()

        // A date whose schedule can't be loaded
        el('futureDateButton_2030-01-02').click()
        await browser.wait(200)
        report({{ errors: browser.errors, opened, loaded, failed: state() }})
    """, browser="page")

    editor = level == "edit"
    assert result == {"errors": [], "opened": {"datePicker": editor, "download": False, "create": editor},
                      "loaded": {"download": True, "create": False},
                      "failed": {"download": False, "create": editor}}
