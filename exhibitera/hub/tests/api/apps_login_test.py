"""Verify that logins from Apps pages get a limited token, while Hub's own pages keep a full one.

Apps pages log in through the protocol, and Hub's pages through the internal API. Apps can't keep a
token as safe as Hub's own pages can, so a full token should never end up on an Apps computer.
"""

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.protocol_router import url_prefixes
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users

PROTOCOL_PREFIXES = [prefix for version in ["6", "6.1"] for prefix in url_prefixes(version)]


@pytest.fixture
def staff(add_user):
    """A user who may do anything with users, with a password, and their full token."""

    token = add_user("staff", users="edit")
    hub_config.user_list[-1].password_hash = hub_users.hash_password("password")
    return token


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def is_full_token(client, token: str) -> bool:
    return client().post("/internal/users/list", headers=bearer(token), json={}).json()["success"] is True


@pytest.mark.parametrize("prefix", PROTOCOL_PREFIXES)
def test_apps_password_login_gets_a_limited_token(client, staff, prefix):
    response = client().post(f"{prefix}/user/login", json={"credentials": ["staff", "password"]})

    token = response.json()["authToken"]
    assert response.json()["user"]["username"] == "staff"
    assert is_full_token(client, token) is False
    assert client().post(f"{prefix}/user/login", json={"token": token}).json()["success"] is True


@pytest.mark.parametrize("prefix", PROTOCOL_PREFIXES)
def test_apps_password_login_does_not_set_hubs_cookie(client, staff, prefix):
    response = client().post(f"{prefix}/user/login", json={"credentials": ["staff", "password"]})

    assert "authToken" not in response.cookies


def test_hub_password_login_keeps_a_full_token(client, staff):
    response = client().post("/internal/user/login", json={"credentials": ["staff", "password"]})

    assert is_full_token(client, response.json()["authToken"]) is True
    assert "authToken" in response.cookies


@pytest.mark.parametrize("prefix", PROTOCOL_PREFIXES)
def test_full_token_from_an_apps_page_is_refused(client, staff, prefix):
    # Apps pages that logged in before limited tokens existed must log in again
    response = client().post(f"{prefix}/user/login", json={"token": staff}).json()

    assert response == {"success": False, "reason": "authentication_failed"}


@pytest.mark.parametrize("prefix", PROTOCOL_PREFIXES)
def test_limited_token_is_not_replaced(client, staff, prefix):
    # Otherwise, an Apps page that is used regularly would never have to log in again
    token = client().post(f"{prefix}/user/login", json={"credentials": ["staff", "password"]}).json()["authToken"]

    response = client().post(f"{prefix}/user/login", json={"token": token}).json()

    assert response["success"] is True
    assert "authToken" not in response


def test_hub_does_not_accept_a_limited_token_for_its_own_login(client, staff):
    token = hub_users.encrypt_token(hub_config.user_list[-1].uuid, scope="apps")

    response = client().post("/internal/user/login", json={"token": token}).json()

    assert response == {"success": False, "reason": "authentication_failed"}


@pytest.mark.parametrize("prefix", PROTOCOL_PREFIXES)
def test_apps_password_login_ignores_a_stale_token(client, staff, prefix):
    response = client().post(f"{prefix}/user/login", headers=bearer("expired-or-damaged"),
                             json={"credentials": ["staff", "password"]})

    assert response.status_code == 200
    assert is_full_token(client, response.json()["authToken"]) is False
