"""Verify how Hub's login cookie is protected and removed.

The cookie is HttpOnly, so injected script can't read the token, and SameSite=Lax, so other websites
can't make logged-in requests. Since scripts can't remove an HttpOnly cookie, Hub removes it itself.
"""

# Standard modules
import re

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import api_scanning
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users


@pytest.fixture
def staff(add_user):
    token = add_user("staff", users="edit")
    hub_config.user_list[-1].password_hash = hub_users.hash_password("password")
    return token


def log_in(client):
    return client().post("/internal/user/login", json={"credentials": ["staff", "password"]})


def set_cookie_header(response) -> str:
    headers = [h for h in response.headers.get_list("set-cookie") if h.startswith("authToken=")]
    assert len(headers) == 1
    return headers[0]


def test_login_cookie_is_http_only(client, staff):
    assert "httponly" in set_cookie_header(log_in(client)).lower()


def test_login_cookie_is_same_site_lax(client, staff):
    assert "samesite=lax" in set_cookie_header(log_in(client)).lower()


def test_login_cookie_still_logs_in(client, staff):
    c = client()
    c.post("/internal/user/login", json={"credentials": ["staff", "password"]})

    assert c.post("/internal/users/list", json={}).json()["success"] is True


def test_logout_removes_the_cookie(client, staff):
    c = client()
    c.post("/internal/user/login", json={"credentials": ["staff", "password"]})

    response = c.post("/internal/user/logout")

    assert response.json() == {"success": True}
    assert re.search(r"max-age=0|expires=", set_cookie_header(response), re.I)
    assert c.post("/internal/users/list", json={}).json() == {"success": False, "reason": "authentication_failed"}


def test_logout_works_when_not_logged_in(client):
    assert client().post("/internal/user/logout").json() == {"success": True}


def test_rejected_cookie_is_removed(client, staff):
    response = client("not-a-valid-token").post("/internal/user/login", json={})

    assert response.json() == {"success": False, "reason": "authentication_failed"}
    assert re.search(r"max-age=0|expires=", set_cookie_header(response), re.I)


def test_hub_pages_do_not_touch_the_login_cookie():
    # Scripts can't read or remove an HttpOnly cookie, so code that tries would silently do nothing
    offenders = []
    for path in api_scanning.javascript_files("hub/js"):
        for number, line in enumerate(path.read_text(encoding="UTF-8").split("\n"), start=1):
            if "document.cookie" in line:
                offenders.append(f"{path.relative_to(api_scanning.EXHIBITERA_DIR)}:{number}")

    assert offenders == []
