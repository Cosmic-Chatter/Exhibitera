"""Verify that Hub's logins expire when unused, renew while in use, and can be revoked.

A full login token works for 30 days. Hub's pages send the login cookie with every request, so Hub
gives them a fresh token once a day and people who use Hub regularly stay logged in. Changing or
resetting a password revokes every token the user already has, including copies on other computers.
"""

# Standard modules
import time

# Third-party modules
from cryptography.fernet import Fernet
import pytest

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users

DAY = 24 * 60 * 60


@pytest.fixture
def staff(add_user):
    add_user("staff", users="edit")
    user = hub_config.user_list[-1]
    user.password_hash = hub_users.hash_password("password")
    hub_users.save_users()
    return user


@pytest.fixture
def clock(monkeypatch):
    """Move Hub's clock forward. Tokens record the time they were made, so this ages them."""

    offset = [0.0]
    real_time = time.time
    monkeypatch.setattr(hub_users.time, "time", lambda: real_time() + offset[0])

    def advance(seconds: float):
        offset[0] += seconds

    return advance


def logged_in(client, token: str) -> bool:
    return client(token).post("/internal/user/login", json={}).json()["success"]


def logged_in_with_bearer(client, token: str) -> bool:
    response = client().post("/internal/user/login", json={}, headers={"Authorization": f"Bearer {token}"})
    return response.json()["success"]


def renewed_cookie(response) -> str | None:
    cookies = [h for h in response.headers.get_list("set-cookie") if h.startswith("authToken=")]
    assert len(cookies) <= 1
    if not cookies:
        return None
    return cookies[0].split(";")[0].removeprefix("authToken=").strip('"')


def legacy_token(user_uuid: str) -> str:
    # Before this change, a full token was just the encrypted uuid
    return str(Fernet(hub_users.get_encryption_key()).encrypt(bytes(user_uuid, "UTF-8")), "UTF-8")


# Expiry

def test_full_token_works_for_30_days(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid)
    clock(30 * DAY - 60)

    assert logged_in(client, token) is True


def test_full_token_expires_after_30_days(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid)
    clock(30 * DAY + 60)

    assert logged_in(client, token) is False


def test_bearer_token_expires_after_30_days(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid)
    clock(30 * DAY - 60)
    assert logged_in_with_bearer(client, token) is True

    clock(120)
    assert logged_in_with_bearer(client, token) is False


def test_token_from_before_this_change_still_works(client, staff):
    assert logged_in(client, legacy_token(staff.uuid)) is True


def test_token_from_before_this_change_expires(client, staff, clock):
    token = legacy_token(staff.uuid)
    clock(30 * DAY + 60)

    assert logged_in(client, token) is False


def test_login_cookie_lasts_30_days(client, staff):
    response = client().post("/internal/user/login", json={"credentials": ["staff", "password"]})
    cookie = [h for h in response.headers.get_list("set-cookie") if h.startswith("authToken=")][0]

    assert f"Max-Age={30 * DAY}" in cookie


def test_new_tokens_are_not_printed_in_debug_mode(client, staff, monkeypatch, capsys):
    monkeypatch.setattr(ex_config, "debug", True)

    response = client().post("/internal/user/login", json={"credentials": ["staff", "password"]})

    assert response.json()["authToken"] not in capsys.readouterr().out


# Renewal

def test_cookie_older_than_a_day_is_renewed(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid)
    clock(2 * DAY)

    new_token = renewed_cookie(client(token).get("/internal/system/checkConnection"))

    assert new_token is not None and new_token != token
    clock(29 * DAY)
    assert logged_in(client, token) is False
    assert logged_in(client, new_token) is True


def test_renewed_cookie_is_protected_like_the_original(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid)
    clock(2 * DAY)

    response = client(token).post("/internal/user/login", json={})
    cookie = [h for h in response.headers.get_list("set-cookie") if h.startswith("authToken=")][0].lower()

    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert f"max-age={30 * DAY}" in cookie


def test_fresh_cookie_is_not_renewed(client, staff):
    token = hub_users.encrypt_token(staff.uuid)

    assert renewed_cookie(client(token).post("/internal/user/login", json={})) is None


def test_expired_cookie_is_not_renewed(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid)
    clock(31 * DAY)

    assert renewed_cookie(client(token).get("/internal/system/checkConnection")) is None


def test_bearer_token_is_not_renewed(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid)
    clock(2 * DAY)

    response = client().post("/internal/user/login", json={}, headers={"Authorization": f"Bearer {token}"})

    assert renewed_cookie(response) is None


def test_apps_token_is_not_renewed_as_a_cookie(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid, scope="apps")
    clock(2 * DAY)

    assert renewed_cookie(client(token).get("/internal/system/checkConnection")) is None


def test_logging_out_is_not_undone_by_renewal(client, staff, clock):
    token = hub_users.encrypt_token(staff.uuid)
    clock(2 * DAY)

    response = client(token).post("/internal/user/logout")
    cookies = [h for h in response.headers.get_list("set-cookie") if h.startswith("authToken=")]

    assert len(cookies) == 1
    assert 'authToken="";' in cookies[0] or "authToken=;" in cookies[0]


# Revocation

def test_changing_password_revokes_existing_tokens(client, staff, add_user):
    full = hub_users.encrypt_token(staff.uuid)
    apps = hub_users.encrypt_token(staff.uuid, scope="apps")
    bystander = add_user("bystander")

    response = client(full).post(f"/internal/user/{staff.uuid}/changePassword",
                                 json={"current_password": "password", "new_password": "new-password"})

    assert response.json() == {"success": True}
    assert logged_in(client, full) is False
    assert client().post("/external/v6.1/user/login", json={"token": apps}).json()["success"] is False
    assert logged_in(client, bystander) is True
    new_login = client().post("/internal/user/login", json={"credentials": ["staff", "new-password"]})
    assert logged_in(client, new_login.json()["authToken"]) is True


def test_failed_password_change_does_not_revoke(client, staff):
    token = hub_users.encrypt_token(staff.uuid)

    client(token).post(f"/internal/user/{staff.uuid}/changePassword",
                       json={"current_password": "wrong", "new_password": "new-password"})

    assert logged_in(client, token) is True


def test_v6_password_change_revokes_existing_tokens(client, staff):
    token = hub_users.encrypt_token(staff.uuid)

    client().post(f"/v6/user/{staff.uuid}/changePassword",
                  json={"current_password": "password", "new_password": "new-password"})

    assert logged_in(client, token) is False


def test_resetting_a_password_revokes_that_users_tokens(client, staff, add_user):
    staff_token = hub_users.encrypt_token(staff.uuid)
    admin_token = add_user("manager", users="edit")

    response = client(admin_token).post(f"/internal/user/{staff.uuid}/edit", json={"password": "reset"})

    assert response.json()["success"] is True
    assert logged_in(client, staff_token) is False
    assert logged_in(client, admin_token) is True


def test_editing_without_a_new_password_does_not_revoke(client, staff, add_user):
    staff_token = hub_users.encrypt_token(staff.uuid)
    admin_token = add_user("manager", users="edit")

    client(admin_token).post(f"/internal/user/{staff.uuid}/edit", json={"display_name": "Renamed"})

    assert logged_in(client, staff_token) is True


def test_revocation_survives_a_restart(client, staff):
    token = hub_users.encrypt_token(staff.uuid)
    client(token).post(f"/internal/user/{staff.uuid}/changePassword",
                       json={"current_password": "password", "new_password": "new-password"})

    hub_users.load_users()

    assert logged_in(client, token) is False


def test_upgrading_an_old_password_hash_does_not_revoke(client, staff):
    staff.password_hash = hub_users.argon2.PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1,
                                                          hash_len=24).hash("password")
    hub_users.save_users()
    token = hub_users.encrypt_token(staff.uuid)

    assert client().post("/internal/user/login", json={"credentials": ["staff", "password"]}).json()["success"]
    assert logged_in(client, token) is True


def test_changing_the_admin_password_revokes_admin_tokens(client):
    hub_users.create_root_admin("admin-password")
    token = hub_users.encrypt_token("admin")
    assert logged_in(client, token) is True

    client(token).post("/internal/user/admin/changePassword",
                       json={"current_password": "admin-password", "new_password": "new-admin-password"})

    assert logged_in(client, token) is False


def test_recreating_the_root_admin_revokes_admin_tokens(client):
    hub_users.create_root_admin("admin-password")
    token = hub_users.encrypt_token("admin")

    # As when the admin password is reset from the command line
    hub_users.create_root_admin("reset-password")

    assert logged_in(client, token) is False
    path = ex_files.get_path(["configuration", "root_admin.txt"], user_file=True)
    assert hub_users.password_hash_valid(open(path, encoding="UTF-8").read())
