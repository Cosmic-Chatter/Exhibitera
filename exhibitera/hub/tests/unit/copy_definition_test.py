"""Verify copying a definition from one Apps computer to others through Hub's console.

Each destination downloads the definition's supporting files from the source. The definition's own
thumbnail is copied too, under the copy's new UUID, so it shows in the destination's definition list.
Media files' thumbnails aren't copied, since each computer makes them as needed.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

ADMIN = {"uuid": "u1", "username": "admin", "display_name": "Admin", "preferences": {},
         "permissions": {"analytics": "edit", "components": {"edit": ["__all"], "edit_content": ["__all"], "view": ["__all"]},
                         "exhibits": "edit", "maintenance": "edit", "programs": "edit", "schedule": "edit",
                         "settings": "edit", "users": "edit"}}


def component(uuid: str, name: str) -> dict:
    return {"class": "exhibitComponent", "uuid": uuid, "id": name, "groups": ["Default"],
            "helperAddress": f"http://{uuid}.test", "api_level": 6.1, "ip_address": "10.0.0.5", "latency": 0,
            "platform_details": {}, "maintenance_status": "On floor, working", "status": "ONLINE",
            "content": [], "definition": "", "notifications": {}, "permissions": {}, "description": ""}


def copy_definition(thumbnail: str | None, thumbnail_reply: str = "{ body: { success: true } }") -> dict:
    """Copy the source's "lobby" definition to the destination and report what the destination was asked to do."""

    content_list = {"success": True, "total_size": "1 KB", "thumbnail": thumbnail,
                    "content": [{"name": "fossil.jpg", "size": 1000, "size_text": "1 KB"}]}
    if thumbnail == "not reported":
        del content_list["thumbnail"]  # As from Apps before this change
    definition = {"uuid": "lobby", "name": "Lobby loop", "app": "media_player",
                  "content": {"i1": {"type": "file", "filename": "fossil.jpg"}}}
    gallery = {"current_exhibit": "e1", "available_exhibits": [{"uuid": "e1", "name": "Main gallery"}],
               "exhibit_modified": False, "name": "Test gallery", "notifications": {}}

    return page_scripts.run(f"""
        globalThis.server = (method, url, body) => {{
          const {{ host, pathname }} = new URL(url)
          if (host === 'source.test') {{
            if (pathname.endsWith('/definitions/lobby/getContentList')) return {{ body: {json.dumps(content_list)} }}
            if (pathname.endsWith('/definitions/lobby/load')) return {{ body: {{ success: true, definition: {json.dumps(definition)} }} }}
          }}
          if (host === 'destination.test') {{
            if (pathname.endsWith('/files/availableContent')) {{
              return {{ body: {{ content: [], content_details: [], static: [], static_details: [] }} }}
            }}
            if (pathname.endsWith('/definitions/write')) return {{ body: {{ success: true, uuid: JSON.parse(body).definition.uuid }} }}
            if (pathname.endsWith('/files/retrieve')) {{
              return JSON.parse(body).path_list[0] === 'thumbnails' ? {thumbnail_reply} : {{ body: {{ success: true }} }}
            }}
          }}
          if (pathname === '/internal/user/login') return {{ body: {{ success: true, user: {json.dumps(ADMIN)} }} }}
          if (pathname === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        browser.sendUpdate({{
          gallery: {json.dumps(gallery)},
          components: [{json.dumps(component("source", "Lobby kiosk"))}, {json.dumps(component("destination", "Atrium kiosk"))}]
        }})
        await browser.wait(300)

        const copyModal = await import({page_scripts.module_url("hub/js/features/copy_definition_modal.js")})
        await copyModal.showCopyDefinitionModal('source', 'lobby', 'Lobby loop')
        await browser.wait(500)
        window.document.querySelector('input.copyDest[data-uuid="destination"]').checked = true
        await copyModal.copyDefinitionModalPerformCopy()
        await browser.wait(500)

        const toDestination = browser.requests.filter((r) => new URL(r.url).host === 'destination.test')
        const written = toDestination.find((r) => r.url.endsWith('/definitions/write'))
        report({{
          errors: browser.errors,
          copied: window.document.querySelector('input.copyDest[data-uuid="destination"]').parentElement
            .querySelector('.copy-success').style.display === 'inline',
          newUUID: JSON.parse(written.body).definition.uuid,
          retrieved: toDestination.filter((r) => r.url.endsWith('/files/retrieve')).map((r) => JSON.parse(r.body))
            .sort((a, b) => a.file_url.localeCompare(b.file_url))
        }})
    """, browser="page")


def test_definition_thumbnail_is_copied_under_the_new_uuid():
    result = copy_definition("lobby.png")

    assert result["errors"] == []
    assert result["newUUID"] != "lobby"
    assert result["retrieved"] == [
        {"file_url": "http://source.test/content/fossil.jpg", "path_list": ["content", "fossil.jpg"]},
        {"file_url": "http://source.test/thumbnails/definitions/lobby.png",
         "path_list": ["thumbnails", "definitions", result["newUUID"] + ".png"]},
    ]


@pytest.mark.parametrize("thumbnail", [None, "not reported"])
def test_definition_without_a_thumbnail_copies_only_its_files(thumbnail):
    result = copy_definition(thumbnail)

    assert result["errors"] == []
    assert result["retrieved"] == [{"file_url": "http://source.test/content/fossil.jpg",
                                    "path_list": ["content", "fossil.jpg"]}]


def test_failed_thumbnail_copy_does_not_fail_the_copy():
    # The thumbnail only affects how the definition appears in lists
    result = copy_definition("lobby.png", thumbnail_reply="'error'")

    assert result["errors"] == []
    assert result["copied"] is True
