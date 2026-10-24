"""Verify the one-time codes that carry a Hub login over to an Apps page on another computer."""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users


@pytest.fixture(autouse=True)
def clean_handoffs(monkeypatch):
    monkeypatch.setattr(hub_config, "login_handoffs", {})


def get_code(client, token) -> str:
    response = client(token).post("/v6.1/user/loginHandoff").json()
    assert response["success"] is True
    return response["code"]


def redeem(client, code):
    # Apps pages are on another origin, so they never have Hub's cookie
    return client().post("/v6.1/user/login", json={"handoff": code}).json()


def test_logged_in_user_gets_a_code(client, add_user):
    code = get_code(client, add_user("staff"))

    assert len(code) >= 40


def test_anonymous_user_cannot_get_a_code(client):
    response = client().post("/v6.1/user/loginHandoff").json()

    assert response == {"success": False, "reason": "authentication_failed"}


def test_code_logs_in_as_the_same_user(client, add_user):
    add_user("other")
    code = get_code(client, add_user("staff"))

    response = redeem(client, code)

    assert response["success"] is True
    assert response["user"]["username"] == "staff"


def test_redeemed_token_works_for_other_requests(client, add_user):
    code = get_code(client, add_user("staff", settings="view"))
    token = redeem(client, code)["authToken"]

    response = client().get("/v6.1/system/configuration/system", headers={"Authorization": f"Bearer {token}"})

    assert response.json()["success"] is True


def test_code_can_only_be_used_once(client, add_user):
    code = get_code(client, add_user("staff"))

    assert redeem(client, code)["success"] is True
    assert redeem(client, code) == {"success": False, "reason": "authentication_failed"}


def test_code_expires(client, add_user, monkeypatch):
    code = get_code(client, add_user("staff"))
    later = hub_users.time.monotonic() + hub_users.LOGIN_HANDOFF_LIFETIME + 1
    monkeypatch.setattr(hub_users.time, "monotonic", lambda: later)

    assert redeem(client, code) == {"success": False, "reason": "authentication_failed"}


def test_unknown_code_is_rejected(client, add_user):
    add_user("staff")

    assert redeem(client, "not-a-real-code") == {"success": False, "reason": "authentication_failed"}


def test_code_for_a_deleted_user_is_rejected(client, add_user):
    code = get_code(client, add_user("staff"))
    hub_config.user_list.clear()

    assert redeem(client, code) == {"success": False, "reason": "authentication_failed"}


def test_code_is_not_itself_a_login_token(client, add_user):
    code = get_code(client, add_user("staff", settings="view"))

    response = client().get("/v6.1/system/configuration/system", headers={"Authorization": f"Bearer {code}"})

    assert response.json() == {"success": False, "reason": "authentication_failed"}


def test_each_request_gets_a_different_code(client, add_user):
    token = add_user("staff")

    assert get_code(client, token) != get_code(client, token)


def test_expired_codes_are_removed(client, add_user, monkeypatch):
    token = add_user("staff")
    get_code(client, token)
    later = hub_users.time.monotonic() + hub_users.LOGIN_HANDOFF_LIFETIME + 1
    monkeypatch.setattr(hub_users.time, "monotonic", lambda: later)

    get_code(client, token)

    assert len(hub_config.login_handoffs) == 1


def test_password_login_still_works(client, add_user):
    add_user("staff")
    user = hub_config.user_list[0]
    user.password_hash = hub_users.hash_password("password")

    response = client().post("/v6.1/user/login", json={"credentials": ["staff", "password"]}).json()

    assert response["success"] is True
    assert "authToken" in response
