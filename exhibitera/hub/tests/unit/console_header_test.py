"""Verify the console header's Modified button, which opens the unsaved changes to the current exhibition.

The console only receives updates once someone is logged in, and seeing the changes needs permission to
view exhibits. The button used to be visible until the first update, so a logged-out console always
showed it.
"""

# Standard modules
from html.parser import HTMLParser
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import api_scanning, page_scripts


class ButtonFinder(HTMLParser):
    def __init__(self, element_id: str):
        super().__init__()
        self.element_id = element_id
        self.attributes = None

    def handle_starttag(self, tag, attrs):
        if dict(attrs).get("id") == self.element_id:
            self.attributes = dict(attrs)


def test_modified_button_starts_hidden():
    finder = ButtonFinder("exhibitModifiedButton")
    finder.feed((api_scanning.EXHIBITERA_DIR / "hub" / "index.html").read_text(encoding="UTF-8"))

    assert finder.attributes is not None
    style = finder.attributes.get("style", "").replace(" ", "")
    assert "display:none" in style


def permissions(exhibits: str) -> dict:
    return {"analytics": "none", "components": {"edit": [], "edit_content": [], "view": ["__all"]},
            "exhibits": exhibits, "maintenance": "none", "programs": "none", "schedule": "none",
            "settings": "none", "users": "none"}


USERS = {
    "admin": {"uuid": "u1", "username": "admin", "display_name": "Admin", "preferences": {},
              "permissions": permissions("edit")},
    "viewer": {"uuid": "u2", "username": "viewer", "display_name": "Component Viewer", "preferences": {},
               "permissions": permissions("none")},
}


def open_console(user: str | None, gallery: dict) -> dict:
    """Open Hub's console as the given user (None for logged out), send it an update, and report the header."""

    login = {"success": True, "user": USERS[user]} if user else {"success": False}
    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const path = new URL(url).pathname
          if (path === '/internal/user/login') return {{ body: {json.dumps(login)} }}
          if (path === '/internal/tracker/templates/list') return {{ body: [] }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('hub', 'index.html')
        await browser.wait(1000)
        browser.sendUpdate({{ gallery: {json.dumps(gallery)} }})
        await browser.wait(300)
        const button = window.document.getElementById('exhibitModifiedButton')
        report({{
          errors: browser.errors,
          exhibitName: window.document.getElementById('exhibitNameField').textContent,
          modifiedButtonShown: button.style.display !== 'none'
        }})
    """, browser="page")


def gallery(modified: bool, current: str = "e1") -> dict:
    return {"current_exhibit": current, "available_exhibits": [{"uuid": "e1", "name": "Main gallery"}],
            "exhibit_modified": modified, "name": "Test gallery", "notifications": {}}


@page_scripts.needs_jsdom
@pytest.mark.parametrize("user, modified, shown", [(None, True, False),  # No updates without a login
                                                    ("viewer", True, False),
                                                    ("admin", True, True),
                                                    ("admin", False, False)])
def test_modified_button_is_shown_to_people_who_can_view_the_changes(user, modified, shown):
    result = open_console(user, gallery(modified))

    assert result["errors"] == []
    assert result["modifiedButtonShown"] is shown


@page_scripts.needs_jsdom
def test_console_keeps_working_if_the_current_exhibition_is_not_listed():
    result = open_console("admin", gallery(True, current="missing-exhibition"))

    assert result == {"errors": [], "exhibitName": "Unknown exhibition", "modifiedButtonShown": True}
