"""Verify the file picker: choosing files, uploads, and saying when an upload, rename, delete, or download fails.

After an upload, the list of files is rebuilt, so the new files could be anywhere in a long list and nothing was
selected. The list should scroll to the first new file and select the new files, or only the first one when just
one file can be chosen. Rebuilding the list used to drop the files already selected and ignore the search.

Failures used to show nothing: a failed upload left the progress bar up with no way to try again.

Choose did nothing useful with no file selected, and the buttons for several selected files could disappear while they
were still selected, such as after downloading them.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

EXISTING = [f"photo{i:02}.jpg" for i in range(30)]


def run_picker(options: dict, script: str):
    """Open the file picker with options and run script with helpers for using it."""

    return page_scripts.run(f"""
        let files = {json.dumps(EXISTING)}
        // What the server replies to each kind of request. The upload reply can be a function of the names uploaded.
        const replies = {{
          upload: (names) => {{
            files = [...new Set([...files, ...names])]
            return {{ body: {{ success: true, skipped: [] }} }}
          }},
          rename: {{ body: {{ success: true }} }},
          delete: {{ body: {{ success: true }} }}
        }}
        let uploading = []
        globalThis.server = (method, url) => {{
          const path = decodeURIComponent(new URL(url).pathname)
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path === '/internal/files/availableContent') {{
            return {{ body: {{ content: files, content_details: files.map((name) => ({{ name }})), static: [], static_details: [] }} }}
          }}
          // The test browser's form data can't read the page's files, so take the names from the test
          if (path === '/internal/files/upload') return replies.upload(uploading)
          if (path.endsWith('/rename')) return replies.rename
          if (path === '/internal/files/delete') return replies.delete
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        const window = await browser.openPage('apps', 'media_player/setup.html')
        await browser.wait(1000)
        const document = window.document
        const scrolledTo = []
        window.Element.prototype.scrollIntoView = function () {{ scrolledTo.push(this.dataset.filename) }}

        const exFileSelect = await import({page_scripts.module_url("apps/js/exhibitera_file_select_modal.js")})
        // What the picker returns when it closes
        const picked = exFileSelect.createFileSelectionModal({json.dumps(options)})
        await browser.wait(300)

        const el = (id) => document.getElementById(id)
        const display = (id) => el(id).style.display
        const entry = (name) => document.querySelector(`.const-file-entry[data-filename="${{name}}"]`)
        const uploadFiles = async (names) => {{
          uploading = names
          const input = el('exFileSelectModalUpload')
          const chosen = names.map((name) => new window.File(['data'], name, {{ type: 'image/jpeg' }}))
          Object.defineProperty(input, 'files', {{ configurable: true, value: chosen }})
          input.dispatchEvent(new window.Event('change'))
          el('exFileSelectModalUploadSubmitButton').click()
          await browser.wait(500)
        }}
        const search = (text) => {{
          el('exFileSelectModalSearchField').value = text
          el('exFileSelectModalSearchField').dispatchEvent(new window.Event('input'))
        }}
        const select = (name) => entry(name).click()
        const preview = (name) => entry(name).dispatchEvent(new window.Event('mouseenter'))
        const selected = () => [...document.querySelectorAll('.const-file-select-box.const-file-selected')].map((b) => b.dataset.filename)
        const shown = () => [...document.querySelectorAll('.const-file-entry')].filter((e) => e.style.display !== 'none').map((e) => e.dataset.filename)
        // The message shown about a failure, if any
        const problem = () => display('exFileSelectModalError') === 'none' ? '' : el('exFileSelectModalError').textContent.trim()
        const uploadControls = () => ({{ upload: display('exFileSelectModalUploadSubmitCol'), progress: display('exFileSelectModalUploadProgressBarContainer') }})
        {script}
    """, browser="page")


def upload(options: dict, filenames: list[str]):
    """Upload filenames and report what's selected and shown."""

    return run_picker(options, f"""
        await uploadFiles({json.dumps(filenames)})
        report({{
          errors: browser.errors,
          selected: selected(),
          scrolledTo,
          multipleButtons: [display('exFileSelectModalDeleteMultipleButtonCol'), display('exFileSelectModalDownloadMultipleButtonCol')]
        }})
    """)


def test_uploaded_files_are_selected_and_shown():
    result = upload({"filetypes": ["image"]}, ["zebra.jpg", "moth.jpg"])

    # The first in the list, rather than the first uploaded
    assert result == {"errors": [], "selected": ["moth.jpg", "zebra.jpg"], "scrolledTo": ["moth.jpg"],
                      "multipleButtons": ["block", "block"]}


def test_one_uploaded_file():
    result = upload({"filetypes": ["image"]}, ["photo15.jpg"])

    # Replacing an existing file selects it too
    assert result == {"errors": [], "selected": ["photo15.jpg"], "scrolledTo": ["photo15.jpg"],
                      "multipleButtons": ["none", "none"]}


@pytest.mark.parametrize("manage", [False, True])
def test_only_the_first_is_selected_when_one_file_can_be_chosen(manage):
    result = upload({"filetypes": ["image"], "multiple": False, "manage": manage}, ["zebra.jpg", "moth.jpg"])

    assert result["errors"] == []
    assert result["selected"] == ["moth.jpg"]
    assert result["scrolledTo"] == ["moth.jpg"]


def test_files_the_list_doesnt_show_are_skipped():
    # Any type of file can be uploaded, but the picker only lists images
    result = upload({"filetypes": ["image"], "upload_any": True}, ["notes.txt", "moth.jpg"])

    assert result["errors"] == []
    assert result["selected"] == ["moth.jpg"]
    assert result["scrolledTo"] == ["moth.jpg"]


# Selections and search

def test_uploading_keeps_the_files_already_selected():
    result = run_picker({"filetypes": ["image"]}, """
        select('photo03.jpg')
        await uploadFiles(['moth.jpg'])
        report({ errors: browser.errors, selected: selected() })
    """)

    assert result == {"errors": [], "selected": ["moth.jpg", "photo03.jpg"]}


def test_uploading_replaces_the_selection_when_one_file_can_be_chosen():
    result = run_picker({"filetypes": ["image"], "multiple": False}, """
        select('photo03.jpg')
        await uploadFiles(['moth.jpg'])
        report({ errors: browser.errors, selected: selected() })
    """)

    assert result == {"errors": [], "selected": ["moth.jpg"]}


def test_uploading_keeps_the_search():
    result = run_picker({"filetypes": ["image"]}, """
        search('photo1')
        await uploadFiles(['photo1x.jpg'])
        report({ errors: browser.errors, search: el('exFileSelectModalSearchField').value, shown: shown(), selected: selected() })
    """)

    assert result == {"errors": [], "search": "photo1", "selected": ["photo1x.jpg"],
                      "shown": [f"photo{i}.jpg" for i in range(10, 20)] + ["photo1x.jpg"]}


def test_search_is_cleared_when_it_would_hide_an_upload():
    result = run_picker({"filetypes": ["image"]}, """
        search('photo1')
        await uploadFiles(['moth.jpg'])
        report({ errors: browser.errors, search: el('exFileSelectModalSearchField').value, shown: shown().length, selected: selected() })
    """)

    assert result == {"errors": [], "search": "", "shown": 31, "selected": ["moth.jpg"]}


# Upload failures

@pytest.mark.parametrize("reply", ["{ body: { success: false, reason: 'invalid_path' } }", "{ status: 500, text: 'Internal Server Error' }",
                                   "'error'"])
def test_failed_upload_says_so_and_can_be_tried_again(reply):
    result = run_picker({"filetypes": ["image"]}, f"""
        replies.upload = () => ({reply})
        await uploadFiles(['moth.jpg'])
        const failed = {{ problem: problem(), controls: uploadControls(), label: el('exFileSelectModalUploadfilename').textContent }}

        // Trying again clears the message
        replies.upload = () => ({{ body: {{ success: true, skipped: [] }} }})
        el('exFileSelectModalUploadSubmitButton').click()
        await browser.wait(500)
        report({{ errors: browser.errors, failed, retried: problem() }})
    """)

    assert result["errors"] == []
    assert result["failed"] == {"problem": "The files couldn't be uploaded. Check the connection to Apps and try again.",
                                "controls": {"upload": "block", "progress": "none"}, "label": "1 file selected"}
    assert result["retried"] == ""


def test_upload_says_which_files_were_skipped():
    result = run_picker({"filetypes": ["image"]}, """
        replies.upload = (names) => {
          files = [...files, 'moth.jpg']
          return { body: { success: true, skipped: ['bad:name.jpg'] } }
        }
        await uploadFiles(['moth.jpg', 'bad:name.jpg'])
        report({ errors: browser.errors, problem: problem(), selected: selected(), controls: uploadControls() })
    """)

    assert result == {"errors": [], "selected": ["moth.jpg"], "controls": {"upload": "none", "progress": "none"},
                      "problem": "This file wasn't uploaded because its name isn't allowed: bad:name.jpg. "
                                 "Rename it and try again."}


# Rename and delete failures

RENAME = """
    preview('photo03.jpg')
    el('exFileSelectModalRenameFileButton').click()
    el('exFileSelectModalFilePreviewEditField').value = 'renamed.jpg'
    el('exFileSelectModalFilePreviewEditSaveButton').click()
    await browser.wait(200)
"""


@pytest.mark.parametrize("reply", ["{ body: { success: false, reason: 'unsafe_filename' } }", "'error'"])
def test_failed_rename_says_so(reply):
    result = run_picker({"manage": True}, f"""
        replies.rename = {reply}
        {RENAME}
        report({{ errors: browser.errors, problem: problem(), stillNamed: entry('photo03.jpg') != null,
                  editing: display('exFileSelectModalFilePreviewEditContainer') }})
    """)

    assert result["errors"] == []
    assert result["stillNamed"] is True
    assert result["editing"] == "flex"  # So the name can be corrected
    if "unsafe" in reply:
        assert result["problem"] == ("This file couldn't be renamed because the new name isn't allowed. "
                                     "Names can't include / \\ : * ? \" < > |.")
    else:
        assert result["problem"] == "This file couldn't be renamed. Check the connection to Apps and try again."


def test_rename_to_an_existing_name_says_so_beside_the_name():
    result = run_picker({"manage": True}, f"""
        replies.rename = {{ body: {{ success: false, error: 'file_exists' }} }}
        {RENAME}
        report({{ errors: browser.errors, problem: problem(), warning: display('exFileSelectModalFilePreviewEditFileExistsWarning') }})
    """)

    assert result == {"errors": [], "problem": "", "warning": "block"}


@pytest.mark.parametrize("reply", ["{ body: { success: false, reason: 'unsafe_filename' } }", "'error'"])
def test_failed_delete_says_so(reply):
    result = run_picker({"manage": True}, f"""
        replies.delete = {reply}
        preview('photo03.jpg')
        const confirm = document.createElement('a')
        confirm.id = 'fileDeletePopover'
        document.body.appendChild(confirm)
        confirm.click()
        await browser.wait(200)
        report({{ errors: browser.errors, problem: problem(), stillListed: entry('photo03.jpg') != null }})
    """)

    assert result == {"errors": [], "stillListed": True,
                      "problem": "The file couldn't be deleted. Check the connection to Apps and try again."}


# Thumbnails

def test_replaced_files_show_their_new_thumbnail():
    result = run_picker({"filetypes": ["image"]}, """
        const thumb = (name) => entry(name).querySelector('img').getAttribute('src')
        const before = thumb('photo15.jpg')
        await uploadFiles(['photo15.jpg'])
        preview('photo15.jpg')
        report({
          errors: browser.errors,
          sameAddress: thumb('photo15.jpg') === before,
          previewMatches: el('exFileSelectModalFilePreviewImage').getAttribute('src').split('?')[1] === thumb('photo15.jpg').split('?')[1],
          otherUnchanged: !thumb('photo16.jpg').includes('?')
        })
    """)

    assert result == {"errors": [], "sameAddress": False, "previewMatches": True, "otherUnchanged": True}


# Download multiple

DOWNLOAD = """
    // The picker downloads with fetch, which the test browser doesn't fake
    globalThis.fetch = async () => {
      if (zipReply === 'error') throw new TypeError('Failed to fetch')
      return new Response(zipReply.body, { status: zipReply.status ?? 200, headers: { 'content-type': zipReply.type } })
    }
    const downloads = []
    window.URL.createObjectURL = () => 'blob:zip'
    window.URL.revokeObjectURL = () => {}
    window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download) }
    select('photo03.jpg')
    select('photo04.jpg')
    el('exFileSelectModalDownloadMultipleFileButton').click()
    await browser.wait(300)
    report({ errors: browser.errors, downloads, problem: problem() })
"""

ZIP = "{ body: 'PK', type: 'application/zip' }"


def test_download_multiple_saves_a_zip():
    result = run_picker({"manage": True}, f"const zipReply = {ZIP}\n" + DOWNLOAD)

    assert result == {"errors": [], "downloads": ["files.zip"], "problem": ""}


@pytest.mark.parametrize("reply, problem", [
    ("{ body: JSON.stringify({ success: false, reason: 'unsafe_filename' }), type: 'application/json' }",
     "These files couldn't be downloaded because some of their names aren't allowed."),
    ("{ status: 500, body: 'Internal Server Error', type: 'text/plain' }",
     "The files couldn't be downloaded. Check the connection to Apps and try again."),
    ("'error'", "The files couldn't be downloaded. Check the connection to Apps and try again.")])
def test_failed_download_says_so_rather_than_saving_the_error(reply, problem):
    result = run_picker({"manage": True}, f"const zipReply = {reply}\n" + DOWNLOAD)

    assert result == {"errors": [], "downloads": [], "problem": problem}


# Choosing

CHOOSE = """
    const chooseButton = el('exFileSelectModalChooseButton')
    const result = async () => ({ errors: browser.errors, picked: await browser.settle(picked, 300) })
    const press = (key, target = el('exFileSelectModal')) => {
      target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    }
"""


@pytest.mark.parametrize("multiple", [True, False])
def test_choose_needs_a_selected_file(multiple):
    result = run_picker({"filetypes": ["image"], "multiple": multiple}, CHOOSE + """
        const disabled = [chooseButton.disabled]
        select('photo03.jpg')
        disabled.push(chooseButton.disabled)
        select('photo03.jpg')
        disabled.push(chooseButton.disabled)
        select('photo04.jpg')
        chooseButton.click()
        report({ disabled, ...(await result()) })
    """)

    assert result == {"errors": [], "disabled": [True, False, True], "picked": {"resolved": ["photo04.jpg"]}}


DOUBLE_CLICK = """
    // As in browsers, a double-click is two clicks, then a dblclick
    const doubleClick = (name) => {
      select(name)
      select(name)
      entry(name).dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }))
    }
"""


def test_double_click_chooses_a_file():
    result = run_picker({"filetypes": ["image"], "multiple": False}, CHOOSE + DOUBLE_CLICK + """
        select('photo03.jpg')
        doubleClick('photo05.jpg')
        report(await result())
    """)

    assert result == {"errors": [], "picked": {"resolved": ["photo05.jpg"]}}


@pytest.mark.parametrize("already_selected", [False, True])
def test_double_click_chooses_when_several_files_can_be_chosen(already_selected):
    # Several files can be chosen, but don't have to be
    result = run_picker({"filetypes": ["image"]}, CHOOSE + DOUBLE_CLICK + f"""
        if ({str(already_selected).lower()}) select('photo05.jpg')
        doubleClick('photo05.jpg')
        report(await result())
    """)

    assert result == {"errors": [], "picked": {"resolved": ["photo05.jpg"]}}


def test_double_click_also_chooses_the_files_already_selected():
    result = run_picker({"filetypes": ["image"]}, CHOOSE + DOUBLE_CLICK + """
        select('photo03.jpg')
        doubleClick('photo05.jpg')
        report(await result())
    """)

    assert result == {"errors": [], "picked": {"resolved": ["photo03.jpg", "photo05.jpg"]}}


def test_double_click_does_nothing_more_when_managing_files():
    # There's nothing to choose
    result = run_picker({"manage": True}, CHOOSE + DOUBLE_CLICK + """
        doubleClick('photo05.jpg')
        report(await result())
    """)

    assert result == {"errors": [], "picked": {"waiting": True}}


def test_enter_chooses_the_selected_files():
    result = run_picker({"filetypes": ["image"]}, CHOOSE + """
        press('Enter')
        const withNothingSelected = await browser.settle(picked, 100)
        select('photo03.jpg')
        select('photo04.jpg')
        press('Enter', entry('photo04.jpg'))
        report({ withNothingSelected, ...(await result()) })
    """)

    assert result == {"errors": [], "withNothingSelected": {"waiting": True},
                      "picked": {"resolved": ["photo03.jpg", "photo04.jpg"]}}


@pytest.mark.parametrize("target", ["exFileSelectModalSearchField", "exFileSelectModalFilePreviewEditField",
                                    "deselectAllButton", "exFileSelectModalRenameFileButton"])
def test_enter_in_a_field_or_on_a_button_is_left_alone(target):
    result = run_picker({"filetypes": ["image"]}, CHOOSE + f"""
        select('photo03.jpg')
        press('Enter', el('{target}'))
        report(await result())
    """)

    assert result == {"errors": [], "picked": {"waiting": True}}


def test_enter_does_nothing_when_managing_files():
    result = run_picker({"manage": True}, CHOOSE + """
        select('photo03.jpg')
        press('Enter')
        report(await result())
    """)

    assert result == {"errors": [], "picked": {"waiting": True}}


# Buttons for several selected files

MULTIPLE_BUTTONS = """
    const multipleButtons = () => [display('exFileSelectModalDeleteMultipleButtonCol'), display('exFileSelectModalDownloadMultipleButtonCol')]
"""
SHOWN = ["block", "block"]
HIDDEN = ["none", "none"]


def test_multiple_buttons_stay_after_downloading():
    result = run_picker({"manage": True}, MULTIPLE_BUTTONS + """
        globalThis.fetch = async () => new Response('PK', { headers: { 'content-type': 'application/zip' } })
        window.URL.createObjectURL = () => 'blob:zip'
        window.URL.revokeObjectURL = () => {}
        window.HTMLAnchorElement.prototype.click = () => {}
        select('photo03.jpg')
        select('photo04.jpg')
        el('exFileSelectModalDownloadMultipleFileButton').click()
        await browser.wait(300)
        report({ errors: browser.errors, buttons: multipleButtons(), selected: selected() })
    """)

    assert result == {"errors": [], "buttons": SHOWN, "selected": ["photo03.jpg", "photo04.jpg"]}


@pytest.mark.parametrize("reply, expected", [("{ body: { success: true } }", HIDDEN),
                                             # The files are still there and selected
                                             ("'error'", SHOWN)])
def test_multiple_buttons_after_deleting(reply, expected):
    result = run_picker({"manage": True}, MULTIPLE_BUTTONS + f"""
        replies.delete = {reply}
        select('photo03.jpg')
        select('photo04.jpg')
        const confirm = document.createElement('a')
        confirm.id = 'fileDeleteMultiplePopover'
        document.body.appendChild(confirm)
        confirm.click()
        await browser.wait(200)
        report({{ errors: browser.errors, buttons: multipleButtons() }})
    """)

    assert result == {"errors": [], "buttons": expected}


def test_multiple_buttons_follow_select_all_and_unselect_all():
    result = run_picker({"manage": True}, MULTIPLE_BUTTONS + """
        // Only one file is listed
        search('photo03')
        el('selectAllButton').click()
        const one = multipleButtons()
        search('')
        el('selectAllButton').click()
        const all = multipleButtons()
        el('deselectAllButton').click()
        report({ errors: browser.errors, one, all, none: multipleButtons() })
    """)

    assert result == {"errors": [], "one": HIDDEN, "all": SHOWN, "none": HIDDEN}
