"""Verify that Apps pages keep their Hub login in localStorage rather than a cookie.

Browsers send cookies to the server with every request and don't separate them by port, so when Hub and
Apps run on the same computer, their pages would share them. localStorage stays in the browser and is
kept separately for each port.
"""

# Standard modules
import re

# Exhibitera modules
from exhibitera.common.tests import api_scanning

APPS_JS = api_scanning.javascript_files("apps", "common")


def lines_matching(pattern: str) -> list[str]:
    found = []
    for path in APPS_JS:
        for number, line in enumerate(path.read_text(encoding="UTF-8").split("\n"), start=1):
            if re.search(pattern, line):
                found.append(f"{path.relative_to(api_scanning.EXHIBITERA_DIR)}:{number}")
    return found


def test_apps_pages_do_not_use_cookies():
    assert lines_matching(r"document\.cookie") == []


def test_apps_login_is_saved_read_and_removed_in_local_storage():
    for method in ["setItem", "getItem", "removeItem"]:
        assert lines_matching(rf"localStorage\.{method}\(authStorageKey") != [], method
