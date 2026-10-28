"""Verify which other websites can call Hub from a visitor's or staff member's browser.

Apps pages call Hub from wherever Apps runs, including remote-display devices like iPads, and Hub
can't know those addresses in advance, so every website may make requests without a login. No page
sends Hub's login cookie to another origin, so Hub never lets another website make logged-in
requests with it. Apps setup pages log in with an Authorization header instead, which still works.
"""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.features.users as hub_users

# An Apps page on another computer, and a page on another port of Hub's own computer, which
# browsers count as the same site and so send the SameSite=Lax cookie from
OTHER_ORIGINS = ["http://192.168.1.50:8000", "http://localhost:8000"]


def preflight(client, path: str, origin: str, headers: str = "content-type"):
    return client().options(path, headers={"Origin": origin,
                                           "Access-Control-Request-Method": "POST",
                                           "Access-Control-Request-Headers": headers})


@pytest.mark.parametrize("origin", OTHER_ORIGINS)
def test_other_websites_cannot_read_logged_in_responses(client, add_user, origin):
    token = add_user("staff", users="edit")

    response = client(token).post("/internal/user/login", json={}, headers={"Origin": origin})

    # Browsers only show a response to a request with cookies when this header allows it
    assert "access-control-allow-credentials" not in response.headers


@pytest.mark.parametrize("origin", OTHER_ORIGINS)
def test_other_websites_are_not_allowed_to_send_the_cookie(client, origin):
    response = preflight(client, "/internal/user/login", origin)

    assert response.status_code == 200
    assert "access-control-allow-credentials" not in response.headers


def test_apps_pings_are_allowed_from_any_address(client):
    # A remote-display iPad loads its page from the Apps computer, so the ping comes from that origin
    origin = "http://10.0.0.23:8000"
    assert preflight(client, "/external/v6.1/system/ping", origin).status_code == 200

    response = client().post("/external/v6.1/system/ping", headers={"Origin": origin},
                             json={"uuid": "3f2c1a9e-1d2b-4c5d-8e7f-0a1b2c3d4e5f", "id": "Kiosk"})

    assert response.headers["access-control-allow-origin"] == "*"


def test_apps_setup_pages_can_log_in_with_a_header(client, add_user):
    token = add_user("staff", users="edit")
    apps_token = hub_users.encrypt_token(hub_users.decrypt_token(token)[0], scope="apps")
    origin = "http://192.168.1.50:8000"

    allowed = preflight(client, "/external/v6.1/user/login", origin, headers="authorization,content-type")
    response = client().post("/external/v6.1/user/login", json={"token": apps_token}, headers={"Origin": origin})

    assert "authorization" in allowed.headers["access-control-allow-headers"].lower()
    assert response.headers["access-control-allow-origin"] == "*"
    assert response.json()["success"] is True
