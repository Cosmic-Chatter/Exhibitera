"""Verify that passwords are hashed with a random salt and settings strong enough to slow guessing.

Older versions hashed every password with the same fixed salt and very light settings. Those hashes
must keep working, and are replaced with a stronger hash the next time the user logs in.
"""

# Standard modules
import json

# Third-party modules
import argon2
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users
from conftest import make_permissions

# How passwords were hashed before this change
legacy_hasher = argon2.PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1, hash_len=24,
                                      type=argon2.Type.ID)


def legacy_hash(password: str) -> str:
    return legacy_hasher.hash(bytes(password, "UTF-8"), salt=bytes("Constellation", "UTF-8"))


def add_user_with_hash(password_hash: str) -> hub_users.User:
    user = hub_users.User("hashed", "Hashed", password_hash, make_permissions())
    hub_config.user_list.append(user)
    hub_users.save_users()
    return user


def stored_hash(user_uuid: str) -> str:
    users = ex_files.load_json(ex_files.get_path(["configuration", "users.json"], user_file=True))
    return [u for u in users if u["uuid"] == user_uuid][0]["password_hash"]


def root_admin_path() -> str:
    return ex_files.get_path(["configuration", "root_admin.txt"], user_file=True)


def log_in(client, username: str, password: str) -> bool:
    response = client().post("/internal/user/login", json={"credentials": [username, password]})
    return response.json()["success"]


def test_the_same_password_gets_a_different_hash_each_time():
    first = hub_users.hash_password("password")
    second = hub_users.hash_password("password")

    assert first != second
    assert hub_users.password_hasher.verify(first, "password")
    assert hub_users.password_hasher.verify(second, "password")


def test_hashes_meet_the_owasp_minimum():
    # OWASP's minimum for Argon2id: 19 MiB of memory, 2 iterations, 1 degree of parallelism
    parameters = argon2.extract_parameters(hub_users.hash_password("password"))

    assert parameters.type is argon2.Type.ID
    assert parameters.memory_cost >= 19 * 1024
    assert parameters.time_cost >= 2
    assert parameters.parallelism >= 1
    assert parameters.salt_len >= 16


def test_legacy_hash_still_logs_in(client):
    add_user_with_hash(legacy_hash("password"))

    assert log_in(client, "hashed", "password") is True


def test_logging_in_replaces_a_legacy_hash(client):
    user = add_user_with_hash(legacy_hash("password"))

    log_in(client, "hashed", "password")

    new_hash = stored_hash(user.uuid)
    assert new_hash != legacy_hash("password")
    assert hub_users.password_hasher.check_needs_rehash(new_hash) is False
    assert hub_users.password_hasher.verify(new_hash, "password")
    assert log_in(client, "hashed", "password") is True


def test_a_wrong_password_does_not_replace_the_hash(client):
    user = add_user_with_hash(legacy_hash("password"))

    assert log_in(client, "hashed", "wrong") is False
    assert stored_hash(user.uuid) == legacy_hash("password")


def test_a_current_hash_is_not_rewritten(client, monkeypatch):
    add_user_with_hash(hub_users.hash_password("password"))
    saves = []
    monkeypatch.setattr(hub_users, "save_users", lambda: saves.append(True))

    assert log_in(client, "hashed", "password") is True
    assert saves == []


def test_logging_in_replaces_a_legacy_admin_hash(client):
    with open(root_admin_path(), "w", encoding="UTF-8") as f:
        f.write(legacy_hash("admin-password"))

    assert log_in(client, "admin", "admin-password") is True

    with open(root_admin_path(), "r", encoding="UTF-8") as f:
        new_hash = f.read()
    assert hub_users.password_hasher.check_needs_rehash(new_hash) is False
    assert log_in(client, "admin", "admin-password") is True


@pytest.mark.parametrize("prefix", ["/internal", "/external/v6.1", "/v6"])
@pytest.mark.parametrize("make_hash", [hub_users.hash_password, legacy_hash])
def test_change_password_checks_the_current_password(client, prefix, make_hash):
    user = add_user_with_hash(make_hash("old-password"))
    headers = {"Authorization": f"Bearer {hub_users.encrypt_token(user.uuid)}"}
    path = f"{prefix}/user/{user.uuid}/changePassword"

    wrong = client().post(path, headers=headers,
                          json={"current_password": "wrong", "new_password": "new-password"})
    assert wrong.json() == {"success": False, "reason": "authentication_failed"}

    right = client().post(path, headers=headers,
                          json={"current_password": "old-password", "new_password": "new-password"})
    assert right.json() == {"success": True}
    assert log_in(client, "hashed", "new-password") is True
    assert log_in(client, "hashed", "old-password") is False


def test_v6_change_password_for_a_missing_user_fails_cleanly(client):
    response = client().post("/v6/user/no-such-user/changePassword",
                             json={"current_password": "old-password", "new_password": "new-password"})

    assert response.json() == {"success": False, "reason": "authentication_failed"}
