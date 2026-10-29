"""Verify the console header's Modified button, which opens the unsaved changes to the current exhibition.

The console only receives updates once someone is logged in, and seeing the changes needs permission to
view exhibits. The button used to be visible until the first update, so a logged-out console always
showed it.
"""

# Standard modules
from html.parser import HTMLParser

# Exhibitera modules
from exhibitera.common.tests import api_scanning


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
