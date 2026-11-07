"""Verify that the file picker shows and selects the files that were just uploaded.

After an upload, the list of files is rebuilt, so the new files could be anywhere in a long list and nothing was
selected. The list should scroll to the first new file and select the new files, or only the first one when just
one file can be chosen.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

EXISTING = [f"photo{i:02}.jpg" for i in range(30)]


def upload(options: dict, filenames: list[str]):
    """Open the file picker with options, upload filenames, and report what's selected and shown."""

    return page_scripts.run(f"""
        const uploading = {json.dumps(filenames)}
        let files = {json.dumps(EXISTING)}
        globalThis.server = (method, url) => {{
          const path = new URL(url).pathname
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path === '/internal/files/availableContent') {{
            return {{ body: {{ content: files, content_details: files.map((name) => ({{ name }})), static: [], static_details: [] }} }}
          }}
          if (path === '/internal/files/upload') {{
            // The test browser's form data can't read the page's files, so take the names from the test
            files = [...new Set([...files, ...uploading])]
            return {{ body: {{ success: true }} }}
          }}
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
        exFileSelect.createFileSelectionModal({json.dumps(options)})
        await browser.wait(300)

        // Choose files to upload, in the order given
        const input = document.getElementById('exFileSelectModalUpload')
        const chosen = uploading.map((name) => new window.File(['data'], name, {{ type: 'image/jpeg' }}))
        Object.defineProperty(input, 'files', {{ configurable: true, value: chosen }})
        input.dispatchEvent(new window.Event('change'))
        document.getElementById('exFileSelectModalUploadSubmitButton').click()
        await browser.wait(500)

        const display = (id) => document.getElementById(id).style.display
        report({{
          errors: browser.errors,
          selected: [...document.querySelectorAll('.const-file-select-box.const-file-selected')].map((b) => b.dataset.filename),
          scrolledTo,
          multipleButtons: [display('exFileSelectModalDeleteMultipleButtonCol'), display('exFileSelectModalDownloadMultipleButtonCol')]
        }})
    """, browser="page")


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
