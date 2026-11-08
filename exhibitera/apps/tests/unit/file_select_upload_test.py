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


def run_picker(options: dict, script: str, before_opening: str = "", files: list[str] = EXISTING,
               details: dict | None = None):
    """Open the file picker with options and run script with helpers for using it.

    before_opening runs once the page has loaded, before the picker opens. details gives files' sizes and dates.
    """

    return page_scripts.run(f"""
        let files = {json.dumps(files)}
        const details = {json.dumps(details or {})}
        // What the server replies to each kind of request. The upload reply can be a function of the names uploaded.
        const replies = {{
          upload: (names) => {{
            files = [...new Set([...files, ...names])]
            return {{ body: {{ success: true, skipped: [] }} }}
          }},
          rename: {{ body: {{ success: true }} }},
          delete: {{ body: {{ success: true }} }},
          // Which definitions use each file. By default, none.
          usage: {{ body: {{ success: true, usage: {{}} }} }}
        }}
        let uploading = []
        globalThis.server = (method, url) => {{
          const path = decodeURIComponent(new URL(url).pathname)
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path === '/internal/files/availableContent') {{
            return {{ body: {{ content: files, content_details: files.map((name) => ({{ name, ...details[name] }})), static: [], static_details: [] }} }}
          }}
          // The test browser's form data can't read the page's files, so take the names from the test
          if (path === '/internal/files/upload') return replies.upload(uploading)
          if (path.endsWith('/rename')) return replies.rename
          if (path === '/internal/files/delete') return replies.delete
          if (path === '/internal/files/usage') return replies.usage
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        const window = await browser.openPage('apps', 'media_player/setup.html')
        await browser.wait(1000)
        const document = window.document
        const scrolledTo = []
        window.Element.prototype.scrollIntoView = function () {{ scrolledTo.push(this.dataset.filename) }}

        // jsdom doesn't lay out pages, so it has no IntersectionObserver. This one says what's observed is in view,
        // unless a test sets allInView to false; then scrollTo() brings rows into view. As in browsers, hidden
        // elements are never in view, and are reported once they're shown.
        let allInView = true
        const observers = []
        const displayed = (element) => element == null || element.nodeType !== 1 || (element.style.display !== 'none' && displayed(element.parentElement))
        const recheck = () => {{
          if (!allInView) return
          for (const observer of observers) observer.show([...observer.observed])
        }}
        // Showing something happens in a change handler, so check once the handlers have run
        window.document.addEventListener('change', () => setTimeout(recheck), true)
        globalThis.IntersectionObserver = window.IntersectionObserver = class {{
          constructor (callback, options) {{
            this.callback = callback
            this.options = options
            this.observed = new Set()
            observers.push(this)
          }}

          observe (target) {{
            this.observed.add(target)
            if (allInView) setTimeout(() => this.show([target]))
          }}

          unobserve (target) {{ this.observed.delete(target) }}
          disconnect () {{ this.observed.clear() }}
          show (targets) {{
            const shown = targets.filter((target) => this.observed.has(target) && displayed(target))
            if (shown.length > 0) this.callback(shown.map((target) => ({{ target, isIntersecting: true }})), this)
          }}
        }}
        const scrollTo = (names) => {{
          const rows = names.map((name) => document.querySelector(`.const-file-entry[data-filename="${{name}}"]`))
          for (const observer of observers) observer.show(rows.flatMap((row) => [row, ...row.querySelectorAll('*')]))
        }}
        // The font files fonts are loaded from
        const fontSources = []
        globalThis.FontFace = window.FontFace = class {{
          constructor (family, source) {{
            this.family = family
            fontSources.push(source)
          }}
        }}
        {before_opening}

        const exFileSelect = await import({page_scripts.module_url("apps/js/exhibitera_file_select_modal.js")})
        // What the picker returns when it closes
        const picked = exFileSelect.createFileSelectionModal({json.dumps(options)})
        await browser.wait(300)

        const el = (id) => document.getElementById(id)
        const display = (id) => el(id).style.display
        // Compared directly, since jsdom's selectors don't match some names, such as ones with emoji
        const entry = (name) => [...document.querySelectorAll('.const-file-entry')].find((row) => row.dataset.filename === name)
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
                      "shown": ["photo1x.jpg"] + [f"photo{i}.jpg" for i in range(10, 20)]}


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


# Thumbnails

THUMBNAILS = """
    // The address each listed file's thumbnail loads from, or null if it hasn't loaded. Fonts are shown in the font.
    const thumbnailSources = () => Object.fromEntries([...document.querySelectorAll('.const-file-entry')].map((row) => {
      const name = row.dataset.filename
      const thumb = row.querySelector('.const-file-thumb-container').firstElementChild
      const font = fontSources.find((source) => source.includes('/content/' + name))
      return [name, thumb?.getAttribute('src') ?? font ?? null]
    }))
    const loaded = () => Object.entries(thumbnailSources()).filter(([, src]) => src != null).map(([name]) => name)
    const thumbnailsShown = () => [...document.querySelectorAll('.const-file-thumb-container')].every((c) => c.style.display !== 'none')
"""


def test_thumbnails_load_as_they_scroll_into_view():
    result = run_picker({}, THUMBNAILS + """
        await browser.wait(50)
        const atFirst = loaded()
        scrollTo(['photo00.jpg', 'photo01.jpg', 'intro.mp4', 'Lobby.ttf'])
        await browser.wait(50)
        const sources = thumbnailSources()
        report({ errors: browser.errors, atFirst, loaded: loaded(), video: sources['intro.mp4'], font: sources['Lobby.ttf'],
                 margin: observers[0]?.options?.rootMargin })
    """, before_opening="allInView = false", files=["photo00.jpg", "photo01.jpg", "photo02.jpg", "intro.mp4", "Lobby.ttf"])

    assert result["errors"] == []
    assert result["atFirst"] == []
    assert sorted(result["loaded"]) == ["Lobby.ttf", "intro.mp4", "photo00.jpg", "photo01.jpg"]
    assert result["video"].endswith("/files/intro.mp4/thumbnail/240")
    assert result["font"] == "url(http://apps.test/content/Lobby.ttf)"
    # Thumbnails a little below the list load before they're reached
    assert result["margin"] == "300px"


def test_hidden_thumbnails_dont_load():
    # The Thumbnails checkbox was unticked last time
    result = run_picker({}, THUMBNAILS + """
        await browser.wait(50)
        const hidden = { checked: el('exFileSelectModalThumbnailCheckbox').checked, loaded: loaded() }
        el('exFileSelectModalThumbnailCheckbox').click()
        await browser.wait(50)
        report({ errors: browser.errors, hidden, shown: loaded() })
    """, before_opening="localStorage.setItem('exhibitera.fileSelect.showThumbnails', 'false')")

    assert result == {"errors": [], "hidden": {"checked": False, "loaded": []}, "shown": EXISTING}


def test_the_thumbnails_checkbox_is_remembered():
    result = run_picker({}, THUMBNAILS + """
        const checkbox = () => el('exFileSelectModalThumbnailCheckbox')
        checkbox().click()
        const turnedOff = { checked: checkbox().checked, shown: thumbnailsShown() }
        el('exFileSelectModal').querySelector('[data-bs-dismiss="modal"]').click()
        await browser.settle(picked, 300)
        await browser.wait(50)

        // Open the picker again
        exFileSelect.createFileSelectionModal({})
        await browser.wait(300)
        const reopened = { checked: checkbox().checked, shown: thumbnailsShown(), loaded: loaded().length }
        report({ errors: browser.errors, turnedOff, reopened })
    """)

    assert result == {"errors": [], "turnedOff": {"checked": False, "shown": False},
                      "reopened": {"checked": False, "shown": False, "loaded": 0}}


def test_thumbnails_are_shown_when_the_browser_blocks_storage():
    result = run_picker({}, THUMBNAILS + """
        await browser.wait(50)
        el('exFileSelectModalThumbnailCheckbox').click()
        report({ errors: browser.errors, checked: el('exFileSelectModalThumbnailCheckbox').checked, loaded: loaded().length })
    """, before_opening="""
        Object.defineProperty(window, 'localStorage', { configurable: true, get () { throw new Error('SecurityError') } })
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, get () { throw new Error('SecurityError') } })
    """)

    assert result == {"errors": [], "checked": False, "loaded": 30}


# Long filenames

NAMES = """
    // How each listed file's name is shown: the part that can shrink, and the part that always shows
    const nameParts = (name) => {
      const shown = entry(name).querySelector('.const-file-name')
      const [start, end] = shown.children
      return {
        text: shown.textContent,
        title: shown.title,
        start: start.textContent,
        end: end.textContent,
        startShrinks: start.classList.contains('text-truncate') && !start.classList.contains('flex-shrink-0'),
        endShrinks: !end.classList.contains('flex-shrink-0'),
        keepsSpaces: start.style.whiteSpace === 'pre' && end.style.whiteSpace === 'pre'
      }
    }
"""

LONG = "Fossil Collection Lobby Left Panel 2024.jpg"


@pytest.mark.parametrize("filename, start, end", [
    # The end of the name, where similar files usually differ, always shows
    (LONG, "Fossil Collection Lobby Left Pa", "nel 2024.jpg"),
    ("photo.jpg", "", "photo.jpg"),
    ("README", "", "README"),
    ("archive.tar.gz", "arc", "hive.tar.gz"),
    # Emoji aren't split
    ("Dinosaurs 🦖🦕 and more.png", "Dinosaurs 🦖🦕 ", "and more.png"),
    ("Dinosaurs and more 🦖🦕.png", "Dinosaurs and", " more 🦖🦕.png")])
def test_long_names_keep_their_end_visible(filename, start, end):
    result = run_picker({}, NAMES + f"""
        report({{ errors: browser.errors, ...nameParts({json.dumps(filename)}) }})
    """, files=[filename])

    assert result == {"errors": [], "text": filename, "title": filename, "start": start, "end": end,
                      "startShrinks": True, "endShrinks": False, "keepsSpaces": True}


def test_renaming_updates_the_name_shown():
    result = run_picker({"manage": True}, NAMES + f"""
        preview('photo03.jpg')
        el('exFileSelectModalRenameFileButton').click()
        el('exFileSelectModalFilePreviewEditField').value = {json.dumps(LONG)}
        el('exFileSelectModalFilePreviewEditSaveButton').click()
        await browser.wait(200)
        const {{ text, title, end }} = nameParts({json.dumps(LONG)})
        report({{ errors: browser.errors, text, title, end }})
    """)

    assert result == {"errors": [], "text": LONG, "title": LONG, "end": "nel 2024.jpg"}


# Sorting

SORTING = """
    const sortSelect = el('exFileSelectModalSortSelect')
    const sortBy = (value) => {
      sortSelect.value = value
      sortSelect.dispatchEvent(new window.Event('change'))
    }
    const listed = () => [...document.querySelectorAll('.const-file-entry')].map((row) => row.dataset.filename)
    const sortOptions = () => [...sortSelect.options].map((option) => option.textContent)
"""

# Sizes in bytes and when each last changed, in seconds since 1970. c.mp3 and d.jpg tie on both.
MIXED = {"a.jpg": {"size": 300, "modified": 1_700_000_300},
         "b.mp4": {"size": 100, "modified": 1_700_000_100},
         "c.mp3": {"size": 200, "modified": 1_700_000_200},
         "d.jpg": {"size": 200, "modified": 1_700_000_200}}


def test_names_sort_with_numbers_in_order():
    result = run_picker({}, SORTING + """
        report({ errors: browser.errors, sort: sortSelect.value, listed: listed() })
    """, files=["photo10.jpg", "Photo2.jpg", "photo1.jpg", "photo21.jpg"])

    assert result == {"errors": [], "sort": "name", "listed": ["photo1.jpg", "Photo2.jpg", "photo10.jpg", "photo21.jpg"]}


@pytest.mark.parametrize("sort, expected", [
    ("name", ["a.jpg", "b.mp4", "c.mp3", "d.jpg"]),
    ("name-reverse", ["d.jpg", "c.mp3", "b.mp4", "a.jpg"]),
    # Ties are in order of name
    ("newest", ["a.jpg", "c.mp3", "d.jpg", "b.mp4"]),
    ("oldest", ["b.mp4", "c.mp3", "d.jpg", "a.jpg"]),
    ("largest", ["a.jpg", "c.mp3", "d.jpg", "b.mp4"]),
    ("smallest", ["b.mp4", "c.mp3", "d.jpg", "a.jpg"]),
    # Images, then videos, then audio
    ("type", ["a.jpg", "d.jpg", "b.mp4", "c.mp3"])])
def test_sort_orders(sort, expected):
    result = run_picker({"manage": True}, SORTING + f"""
        sortBy('{sort}')
        report({{ errors: browser.errors, listed: listed() }})
    """, files=list(MIXED), details=MIXED)

    assert result == {"errors": [], "listed": expected}


def test_sorting_keeps_the_selection_search_and_thumbnails():
    result = run_picker({"manage": True}, SORTING + """
        await browser.wait(50)
        select('c.mp3')
        select('d.jpg')
        search('.jpg')
        const row = entry('d.jpg')
        sortBy('largest')
        report({ errors: browser.errors, listed: listed(), shown: shown(), selected: selected(),
                 // The rows are moved rather than rebuilt, so their thumbnails don't load again
                 sameRow: entry('d.jpg') === row })
    """, files=list(MIXED), details=MIXED)

    assert result == {"errors": [], "listed": ["a.jpg", "c.mp3", "d.jpg", "b.mp4"], "shown": ["a.jpg", "d.jpg"],
                      "selected": ["c.mp3", "d.jpg"], "sameRow": True}


def test_type_is_only_offered_for_more_than_one_type():
    result = run_picker({"filetypes": ["image"]}, SORTING + """
        report({ errors: browser.errors, options: sortOptions() })
    """)

    assert result == {"errors": [], "options": ["Name (A–Z)", "Name (Z–A)", "Newest first", "Oldest first",
                                                "Largest first", "Smallest first"]}


def test_the_sort_is_remembered():
    result = run_picker({"manage": True}, SORTING + """
        sortBy('newest')
        el('exFileSelectModal').querySelector('[data-bs-dismiss="modal"]').click()
        await browser.settle(picked, 300)
        await browser.wait(50)

        exFileSelect.createFileSelectionModal({ manage: true })
        await browser.wait(300)
        const reopened = { sort: el('exFileSelectModalSortSelect').value, listed: listed() }
        el('exFileSelectModal').querySelector('[data-bs-dismiss="modal"]').click()
        await browser.settle(picked, 300)
        await browser.wait(50)

        // A picker for one type of file doesn't offer Type, so a remembered Type sort falls back to name
        localStorage.setItem('exhibitera.fileSelect.sort', 'type')
        exFileSelect.createFileSelectionModal({ filetypes: ['image'] })
        await browser.wait(300)
        report({ errors: browser.errors, reopened, imagesOnly: el('exFileSelectModalSortSelect').value })
    """, files=list(MIXED), details=MIXED)

    assert result == {"errors": [], "reopened": {"sort": "newest", "listed": ["a.jpg", "c.mp3", "d.jpg", "b.mp4"]},
                      "imagesOnly": "name"}


def test_the_preview_shows_when_a_file_last_changed():
    result = run_picker({"manage": True}, SORTING + """
        const changed = () => el('exFileSelectModalFilePreviewModified').textContent
        preview('a.jpg')
        const known = changed()
        preview('e.jpg')
        report({ errors: browser.errors, known, unknown: changed() })
    """, files=[*MIXED, "e.jpg"], details={**MIXED, "e.jpg": {"size": 1, "modified": None}})

    assert result["errors"] == []
    assert "2023" in result["known"]  # 14 November 2023
    assert result["unknown"] == ""


# Deleting files that definitions use

DELETING = """
    const confirmDelete = (id) => {
      const confirm = document.createElement('a')
      confirm.id = id
      document.body.appendChild(confirm)
      confirm.click()
      confirm.remove()
    }
    const deleteOne = async (name) => {
      preview(name)
      confirmDelete('fileDeletePopover')
      await browser.wait(200)
    }
    const deleteSelected = async () => {
      confirmDelete('fileDeleteMultiplePopover')
      await browser.wait(200)
    }
    const deleted = () => browser.requests.filter((r) => r.url.endsWith('/files/delete')).map((r) => JSON.parse(r.body).file)
    const warning = () => {
      const panel = el('exFileSelectModalInUseWarning')
      if (panel.style.display === 'none') return null
      return {
        message: el('exFileSelectModalInUseMessage').textContent,
        uses: [...panel.querySelectorAll('li')].map((li) => li.textContent),
        buttons: [...panel.querySelectorAll('button')].filter((b) => b.style.display !== 'none').map((b) => b.textContent)
      }
    }
    const press = (label) => [...el('exFileSelectModalInUseWarning').querySelectorAll('button')].find((b) => b.textContent === label).click()
"""

LOBBY = {"uuid": "d1", "name": "Lobby loop", "app": "media_player"}
GALLERY = {"uuid": "d2", "name": "Gallery", "app": "infostation"}


def test_files_not_in_use_are_deleted_without_asking_again():
    result = run_picker({"manage": True}, DELETING + """
        await deleteOne('photo03.jpg')
        report({ errors: browser.errors, warning: warning(), deleted: deleted(), listed: entry('photo03.jpg') != null })
    """)

    assert result == {"errors": [], "warning": None, "deleted": [["photo03.jpg"]], "listed": False}


def test_deleting_a_file_in_use_asks_first():
    result = run_picker({"manage": True}, DELETING + f"""
        replies.usage = {{ body: {{ success: true, usage: {{ 'photo03.jpg': {json.dumps([GALLERY, LOBBY])} }} }} }}
        await deleteOne('photo03.jpg')
        const asked = {{ warning: warning(), deleted: deleted() }}

        press("Don't delete")
        await browser.wait(200)
        report({{ errors: browser.errors, asked, after: {{ warning: warning(), deleted: deleted(), listed: entry('photo03.jpg') != null }} }})
    """)

    assert result == {"errors": [],
                      "asked": {"warning": {"message": "photo03.jpg is used by these definitions, which will be left without it:",
                                            "uses": ["Gallery (InfoStation)", "Lobby loop (Media Player)"],
                                            "buttons": ["Delete anyway", "Don't delete"]},
                                "deleted": []},
                      "after": {"warning": None, "deleted": [], "listed": True}}


def test_a_file_in_use_can_be_deleted_anyway():
    result = run_picker({"manage": True}, DELETING + f"""
        replies.usage = {{ body: {{ success: true, usage: {{ 'photo03.jpg': {json.dumps([LOBBY])} }} }} }}
        await deleteOne('photo03.jpg')
        press('Delete anyway')
        await browser.wait(200)
        report({{ errors: browser.errors, warning: warning(), deleted: deleted(), listed: entry('photo03.jpg') != null }})
    """)

    assert result == {"errors": [], "warning": None, "deleted": [["photo03.jpg"]], "listed": False}


def test_deleting_several_files_can_keep_the_ones_in_use():
    result = run_picker({"manage": True}, DELETING + f"""
        replies.usage = {{ body: {{ success: true, usage: {{ 'photo04.jpg': {json.dumps([GALLERY, LOBBY])} }} }} }}
        for (const name of ['photo03.jpg', 'photo04.jpg', 'photo05.jpg']) select(name)
        await deleteSelected()
        const asked = warning()
        press('Delete the 2 not in use')
        await browser.wait(200)
        report({{ errors: browser.errors, asked, deleted: deleted(), listed: ['photo03.jpg', 'photo04.jpg', 'photo05.jpg'].filter((n) => entry(n) != null),
                  selected: selected() }})
    """)

    assert result == {"errors": [],
                      "asked": {"message": "Some of these files are used by definitions, which will be left without them:",
                                "uses": ["photo04.jpg: Gallery (InfoStation), Lobby loop (Media Player)"],
                                "buttons": ["Delete anyway", "Delete the 2 not in use", "Don't delete"]},
                      "deleted": [["photo03.jpg", "photo05.jpg"]],
                      "listed": ["photo04.jpg"],
                      "selected": ["photo04.jpg"]}


def test_deleting_several_files_that_are_all_in_use():
    result = run_picker({"manage": True}, DELETING + f"""
        replies.usage = {{ body: {{ success: true, usage: {{ 'photo03.jpg': {json.dumps([LOBBY])}, 'photo04.jpg': {json.dumps([LOBBY])} }} }} }}
        select('photo03.jpg')
        select('photo04.jpg')
        await deleteSelected()
        const asked = warning()
        press('Delete anyway')
        await browser.wait(200)
        report({{ errors: browser.errors, asked, deleted: deleted() }})
    """)

    assert result == {"errors": [],
                      "asked": {"message": "These files are used by definitions, which will be left without them:",
                                "uses": ["photo03.jpg: Lobby loop (Media Player)", "photo04.jpg: Lobby loop (Media Player)"],
                                "buttons": ["Delete anyway", "Don't delete"]},
                      "deleted": [["photo03.jpg", "photo04.jpg"]]}


@pytest.mark.parametrize("reply", ["{ body: { success: false } }", "'error'"])
def test_files_arent_deleted_if_their_use_cant_be_checked(reply):
    result = run_picker({"manage": True}, DELETING + f"""
        replies.usage = {reply}
        await deleteOne('photo03.jpg')
        report({{ errors: browser.errors, problem: problem(), warning: warning(), deleted: deleted() }})
    """)

    assert result == {"errors": [], "warning": None, "deleted": [],
                      "problem": "The file couldn't be deleted. Check the connection to Apps and try again."}


def test_definition_names_are_shown_as_text():
    result = run_picker({"manage": True}, DELETING + """
        replies.usage = { body: { success: true, usage: { 'photo03.jpg': [{ uuid: 'd1', name: '<b>Bold</b>', app: 'mystery' }] } } }
        await deleteOne('photo03.jpg')
        report({ errors: browser.errors, uses: warning().uses, bold: el('exFileSelectModalInUseWarning').querySelector('b') != null })
    """)

    # An app the picker doesn't know is left out
    assert result == {"errors": [], "uses": ["<b>Bold</b>"], "bold": False}


# Renaming files that definitions use

RENAMING = DELETING + """
    const renamed = () => browser.requests.filter((r) => r.url.endsWith('/rename')).map((r) => JSON.parse(r.body).new_name)
    const rename = async (from, to) => {
      preview(from)
      el('exFileSelectModalRenameFileButton').click()
      el('exFileSelectModalFilePreviewEditField').value = to
      el('exFileSelectModalFilePreviewEditSaveButton').click()
      await browser.wait(200)
    }
    const editing = () => display('exFileSelectModalFilePreviewEditContainer') !== 'none'
"""


def test_files_not_in_use_are_renamed_without_asking():
    result = run_picker({"manage": True}, RENAMING + """
        await rename('photo03.jpg', 'fossil.jpg')
        report({ errors: browser.errors, warning: warning(), renamed: renamed(), listed: entry('fossil.jpg') != null })
    """)

    assert result == {"errors": [], "warning": None, "renamed": ["fossil.jpg"], "listed": True}


def test_renaming_a_file_in_use_asks_first():
    result = run_picker({"manage": True}, RENAMING + f"""
        replies.usage = {{ body: {{ success: true, usage: {{ 'photo03.jpg': {json.dumps([LOBBY])} }} }} }}
        await rename('photo03.jpg', 'fossil.jpg')
        const asked = {{ warning: warning(), renamed: renamed(), usageChecked: browser.requests.filter((r) => r.url.endsWith('/files/usage')).map((r) => JSON.parse(r.body).files) }}

        press("Don't rename")
        await browser.wait(200)
        report({{ errors: browser.errors, asked, after: {{ warning: warning(), renamed: renamed(), editing: editing(), listed: entry('photo03.jpg') != null }} }})
    """)

    assert result == {"errors": [],
                      "asked": {"warning": {"message": "photo03.jpg is used by these definitions, which will be left without it:",
                                            "uses": ["Lobby loop (Media Player)"],
                                            "buttons": ["Rename anyway", "Don't rename"]},
                                "renamed": [], "usageChecked": [["photo03.jpg"]]},
                      "after": {"warning": None, "renamed": [], "editing": False, "listed": True}}


def test_a_file_in_use_can_be_renamed_anyway():
    result = run_picker({"manage": True}, RENAMING + f"""
        replies.usage = {{ body: {{ success: true, usage: {{ 'photo03.jpg': {json.dumps([LOBBY])} }} }} }}
        await rename('photo03.jpg', 'fossil.jpg')
        press('Rename anyway')
        await browser.wait(200)
        report({{ errors: browser.errors, warning: warning(), renamed: renamed(), listed: [entry('photo03.jpg') != null, entry('fossil.jpg') != null] }})
    """)

    assert result == {"errors": [], "warning": None, "renamed": ["fossil.jpg"], "listed": [False, True]}


@pytest.mark.parametrize("reply", ["{ body: { success: false } }", "'error'"])
def test_files_arent_renamed_if_their_use_cant_be_checked(reply):
    result = run_picker({"manage": True}, RENAMING + f"""
        replies.usage = {reply}
        await rename('photo03.jpg', 'fossil.jpg')
        report({{ errors: browser.errors, problem: problem(), warning: warning(), renamed: renamed(), editing: editing() }})
    """)

    # The new name is kept, to try again
    assert result == {"errors": [], "warning": None, "renamed": [], "editing": True,
                      "problem": "This file couldn't be renamed. Check the connection to Apps and try again."}


def test_starting_something_else_clears_an_unanswered_question():
    result = run_picker({"manage": True}, RENAMING + f"""
        replies.usage = {{ body: {{ success: true, usage: {{ 'photo03.jpg': {json.dumps([LOBBY])} }} }} }}
        await rename('photo03.jpg', 'fossil.jpg')
        replies.usage = {{ body: {{ success: true, usage: {{}} }} }}
        await deleteOne('photo05.jpg')
        report({{ errors: browser.errors, warning: warning(), renamed: renamed(), deleted: deleted() }})
    """)

    assert result == {"errors": [], "warning": None, "renamed": [], "deleted": [["photo05.jpg"]]}
