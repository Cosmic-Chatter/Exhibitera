"""Verify that Hub's credential files are written safely and recovered when damaged."""

# Standard modules
import os

# Third-party modules
from cryptography.fernet import Fernet
import pytest

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users


@pytest.fixture
def configuration(tmp_path, monkeypatch):
    """Use a temporary configuration folder and forget any loaded encryption key."""

    os.makedirs(tmp_path / "configuration")
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    monkeypatch.setattr(hub_config, "encryption_key", None)
    monkeypatch.setattr(hub_config, "user_list", [])
    return tmp_path / "configuration"


def read(path) -> str:
    with open(path, "r", encoding="UTF-8") as f:
        return f.read()


def write(path, contents: str):
    with open(path, "w", encoding="UTF-8") as f:
        f.write(contents)


def fail_on_replace(monkeypatch):
    def failing_replace(src, dst):
        raise OSError("simulated power loss")
    monkeypatch.setattr(os, "replace", failing_replace)


# Encryption key

def test_missing_key_is_created(configuration):
    key = hub_users.get_encryption_key()

    Fernet(key)  # A valid key
    assert read(configuration / "encryption_key.txt") == key.decode("UTF-8")


def test_existing_key_is_kept(configuration):
    key = Fernet.generate_key()
    write(configuration / "encryption_key.txt", key.decode("UTF-8"))

    assert hub_users.get_encryption_key() == key
    assert read(configuration / "encryption_key.txt") == key.decode("UTF-8")


@pytest.mark.parametrize("contents", ["", "not a key", Fernet.generate_key().decode("UTF-8")[:20]])
def test_damaged_key_is_replaced_and_logged(configuration, caplog, contents):
    write(configuration / "encryption_key.txt", contents)

    key = hub_users.get_encryption_key()

    Fernet(key)
    assert read(configuration / "encryption_key.txt") == key.decode("UTF-8")
    assert any("encryption_key.txt" in r.getMessage() for r in caplog.records if r.levelname == "ERROR")


def test_tokens_work_after_a_damaged_key_is_replaced(configuration):
    write(configuration / "encryption_key.txt", "")
    user = hub_users.User("staff", "Staff", "not-a-real-hash")
    hub_config.user_list.append(user)

    token = hub_users.encrypt_token(user.uuid)

    assert hub_users.authenticate_user(token=token) == (True, user.uuid)


def test_interrupted_key_write_leaves_no_file(configuration, monkeypatch):
    fail_on_replace(monkeypatch)

    with pytest.raises(OSError):
        hub_users.get_encryption_key()

    assert os.listdir(configuration) == []


# Root admin

def test_root_admin_password_works(configuration):
    hub_users.create_root_admin("correct horse")

    assert hub_users.get_admin().authenticate("correct horse") is True
    assert hub_users.get_admin().authenticate("wrong") is False


def test_interrupted_admin_password_change_keeps_old_password(configuration, monkeypatch):
    hub_users.create_root_admin("old password")
    fail_on_replace(monkeypatch)

    with pytest.raises(OSError):
        hub_users.create_root_admin("new password")

    monkeypatch.undo()
    monkeypatch.setattr(ex_config, "application_path", str(configuration.parent))
    assert hub_users.get_admin().authenticate("old password") is True
    assert os.listdir(configuration) == ["root_admin.txt"]


@pytest.mark.parametrize("contents", ["", "garbage", "$argon2id$v=19$m=65536"])
def test_damaged_admin_hash_fails_login_cleanly(configuration, caplog, contents):
    write(configuration / "root_admin.txt", contents)

    assert hub_users.get_admin().authenticate("any password") is False
    assert any("root_admin.txt" in r.getMessage() for r in caplog.records if r.levelname == "ERROR")


@pytest.mark.parametrize("contents", [None, "", "garbage"])
def test_missing_or_damaged_admin_prompts_for_a_password(configuration, monkeypatch, contents):
    if contents is not None:
        write(configuration / "root_admin.txt", contents)
    monkeypatch.setattr(hub_users.getpass, "getpass", lambda prompt="": "new admin password")

    hub_users.check_for_root_admin()

    assert hub_users.get_admin().authenticate("new admin password") is True


def test_valid_admin_does_not_prompt(configuration, monkeypatch):
    hub_users.create_root_admin("existing password")

    def unexpected_prompt(prompt=""):
        raise AssertionError("should not prompt")
    monkeypatch.setattr(hub_users.getpass, "getpass", unexpected_prompt)

    hub_users.check_for_root_admin()

    assert hub_users.get_admin().authenticate("existing password") is True


def test_existing_password_hashes_are_valid():
    # Installs already store hashes made by hash_password(), which must not be mistaken for damage
    assert hub_users.password_hash_valid(hub_users.hash_password("a password")) is True
    assert hub_users.password_hash_valid(hub_users.password_hasher.hash("a password")) is True
