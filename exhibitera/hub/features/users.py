# Standard modules
import datetime
import getpass
import json
import logging
import os.path
import secrets
import time
from typing import Any
import uuid

# Non-standard modules
import argon2
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Request

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.common.utilities as ex_utilities
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components

password_hasher = argon2.PasswordHasher(time_cost=1,
                                        memory_cost=1024,
                                        parallelism=1,
                                        hash_len=24,
                                        type=argon2.Type.ID)


class User:
    """An Exhibitera user account."""

    def __init__(self,
                 username: str,
                 display_name: str,
                 password_hash: str,
                 permissions_dict: dict | None = None,
                 preferences_dict: dict | None = None,
                 uuid_str: str = ""):
        """Create a new User"""

        if permissions_dict is None:
            permissions_dict = {
                "analytics": "none",
                "components": {
                    "edit": [],
                    "edit_content": [],
                    "view": []
                },
                "exhibits": "none",
                "maintenance": "none",
                "programs": "none",
                "schedule": "view",
                "settings": "none",
                "users": "none"
            }

        if preferences_dict is None:
            preferences_dict = {
                "show_groups": {},
                "status_mode": "realtime",
                "show_static": True
            }

        self.username = username
        self.display_name = display_name
        self.password_hash = password_hash
        self.permissions = permissions_dict
        self.preferences = preferences_dict
        self.last_activity = datetime.datetime.now().isoformat()

        if uuid_str == "":
            self.uuid = str(uuid.uuid4())
        else:
            self.uuid = uuid_str

    def authenticate(self, password: str) -> bool:
        """Check whether the provided password is correct."""

        try:
            result = password_hasher.verify(self.password_hash, password)
            self.update_last_activity()
        except (argon2.exceptions.VerificationError, argon2.exceptions.InvalidHashError):
            result = False
            if not password_hash_valid(self.password_hash):
                stored_in = "root_admin.txt" if self.uuid == "admin" else "users.json"
                logging.error(f"The stored password for {self.username} in {stored_in} is damaged, so they can't log in.")
        return result

    def check_permission(self, action, needed_level, groups: list[str] | None = None) -> bool:
        """Check if the user has sufficient permission to perform an action"""

        self.update_last_activity()

        if needed_level == "none":
            return True

        if action != "components":
            allowed_level = self.permissions.get(action, "none")
            if needed_level == "edit":
                if allowed_level == "edit":
                    return True
                return False
            if needed_level == "view":
                if allowed_level == "edit" or allowed_level == "view":
                    return True
                return False
        if action == 'components':
            if needed_level == "edit":
                if "__all" in self.permissions["components"].get("edit", []):
                    return True
                if groups is not None:
                    # We match if any of the provided groups matches any of the allowed groups
                    match = False
                    for group in groups:
                        if group in self.permissions["components"].get("edit", []):
                            match = True
                    return match
                return False
            if needed_level == "edit_content":
                if "__all" in self.permissions["components"].get("edit", []) or \
                        "__all" in self.permissions["components"].get("edit_content", []):
                    return True
                if groups is not None:
                    # We match if any of the provided groups matches any of the allowed groups
                    match = False
                    for group in groups:
                        if group in self.permissions["components"].get("edit", []) or \
                                group in self.permissions["components"].get("edit_content", []):
                            match = True
                    return match
                return False
            if needed_level == "view":
                if "__all" in self.permissions["components"].get("edit", []) or \
                        "__all" in self.permissions["components"].get("edit_content", []) or \
                        "__all" in self.permissions["components"].get("view", []):
                    return True
                if groups is not None:
                    # We match if any of the provided groups matches any of the allowed groups
                    match = False
                    for group in groups:
                        if group in self.permissions["components"].get("edit", []) or \
                                group in self.permissions["components"].get("edit_content", []) or \
                                group in self.permissions["components"].get("view", []):
                            match = True
                    return match
                return False
        return False

    def get_dict(self, omit_password: bool = True) -> dict:
        """Return a JSON representation of this user."""

        this_dict = {
            "username": self.username,
            "display_name": self.display_name,
            "last_activity": self.last_activity,
            "permissions": self.permissions,
            "preferences": self.preferences,
            "uuid": self.uuid
        }
        if not omit_password:
            this_dict["password_hash"] = self.password_hash

        return this_dict

    def update_last_activity(self):
        """Set the last activity time to now."""

        self.last_activity = datetime.datetime.now().isoformat()


def get_encryption_key() -> bytes:
    """Retrieve the encryption key or create it if it doesn't exist or is damaged."""

    if hub_config.encryption_key is None:
        key_path = ex_files.get_path(["configuration", "encryption_key.txt"], user_file=True)
        key = None
        if os.path.exists(key_path):
            # Load key from disk
            with open(key_path, 'r', encoding='UTF-8') as f:
                key = bytes(f.read().strip(), 'UTF-8')
            if not encryption_key_valid(key):
                logging.error(f"get_encryption_key: {key_path} is damaged, so a new key has been created. "
                              f"Everyone will need to log in again.")
                key = None
        if key is None:
            # Generate new key
            key = Fernet.generate_key()
            ex_files.replace_file_contents(key_path, str(key, 'UTF-8'))
        hub_config.encryption_key = key

    return hub_config.encryption_key


def encryption_key_valid(key: bytes) -> bool:
    """Return whether the given bytes are a usable encryption key."""

    try:
        Fernet(key)
    except (ValueError, TypeError):
        return False
    return True


# Seconds that a login handoff code remains valid
LOGIN_HANDOFF_LIFETIME = 60


def create_login_handoff(user_uuid: str) -> str:
    """Create a one-time code that lets another page log in as the given user.

    Hub passes this to Apps pages it opens, which are on a different computer and can't use Hub's
    login cookie. The code is exchanged for an Apps login token by /user/login, so the token itself
    never appears in a URL.
    """

    code = secrets.token_urlsafe(32)
    now = time.monotonic()
    with hub_config.loginHandoffLock:
        # Remove expired codes so they don't accumulate
        for expired in [k for k, (_, expiration) in hub_config.login_handoffs.items() if expiration < now]:
            del hub_config.login_handoffs[expired]
        hub_config.login_handoffs[code] = (user_uuid, now + LOGIN_HANDOFF_LIFETIME)
    return code


def redeem_login_handoff(code: str) -> str | None:
    """Return the uuid of the user that the given code was created for, or None if it isn't valid.

    Each code can be redeemed once.
    """

    with hub_config.loginHandoffLock:
        user_uuid, expiration = hub_config.login_handoffs.pop(code, (None, 0))
    if user_uuid is None or expiration < time.monotonic() or get_user(uuid_str=user_uuid) is None:
        return None
    return user_uuid


# Seconds that an Apps login token remains valid
APPS_TOKEN_LIFETIME = 7 * 24 * 60 * 60 # 7 days


def encrypt_token(uuid_str: str, scope: str | None = None) -> str:
    """Encrypt the uuid as a token and return it.

    Pass scope="apps" for the limited token that Apps pages get. Apps can't keep a token as safe as
    Hub's own pages can, so it only works where authenticate_user() is told to accept it, and it expires
    after APPS_TOKEN_LIFETIME.
    """

    if scope is None:
        payload = uuid_str
    else:
        payload = json.dumps({"user": uuid_str, "scope": scope})

    f = Fernet(get_encryption_key())
    token = f.encrypt(bytes(payload, 'UTF-8'))
    return str(token, 'UTF-8')


def decrypt_token(token: str) -> tuple[str, str | None]:
    """Decrypt a token and return the uuid and the token's scope, or None for a full token.

    Raises InvalidToken if the token is damaged or has expired.
    """

    f = Fernet(get_encryption_key())
    payload = str(f.decrypt(token), 'UTF-8')

    # A full token is just the uuid
    try:
        contents = json.loads(payload)
    except json.JSONDecodeError:
        return payload, None
    if not isinstance(contents, dict):
        return payload, None

    if f.extract_timestamp(token) + APPS_TOKEN_LIFETIME < time.time():
        raise InvalidToken
    return contents["user"], contents["scope"]


def create_root_admin(password: str):
    """Create the root admin by saving a hashed password to disk. """

    path = ex_files.get_path(["configuration", "root_admin.txt"], user_file=True)

    password_hash = hash_password(password)

    with hub_config.galleryConfigurationLock:
        # Replace the file in one step, so an interruption can't leave the admin locked out
        ex_files.replace_file_contents(path, password_hash)


def root_admin_valid() -> bool:
    """Return whether root_admin.txt exists and holds a usable password hash."""

    path = ex_files.get_path(["configuration", "root_admin.txt"], user_file=True)
    if not os.path.exists(path):
        return False
    with open(path, 'r', encoding='UTF-8') as f:
        return password_hash_valid(f.read())


def password_hash_valid(password_hash: str) -> bool:
    """Return whether the given string is a complete Argon2 password hash."""

    try:
        argon2.extract_parameters(password_hash)
    except argon2.exceptions.InvalidHashError:
        return False
    return True


def command_line_setup_print_gui():
    ex_utilities.clear_terminal()
    print("############################################################")
    print("Welcome to Exhibitera Hub!")
    print("")
    print("Access to Exhibitera is controlled by a user account system.")


def check_for_first_user():
    """Check that at least one user has been created or prompt to create it."""

    path = ex_files.get_path(["configuration", "users.json"], user_file=True)

    users = ex_files.load_json(path)
    if users is not None and isinstance(users, list) and len(users) > 0:
        # We have at least one user
        return

    command_line_setup_print_gui()
    print("You should generally not use the admin account for daily")
    print("use. Let's create a regular user account. This account will")
    print("have full permissions.")
    display_name = input("Your name (e.g., John Smith): ")
    username = ""
    while username == "" or username == "admin":
        username = input ("Your username (e.g., jsmith): ")
        if username == "admin":
            print("Username cannot be 'admin'!")
    pass1 = ""
    pass2 = ""
    match = False
    while match is False:
        while pass1.strip() == "":
            pass1 = getpass.getpass(prompt="Enter password: ").strip()
            if pass1 == "":
                print("Password cannot be blank!")
        while pass2.strip() == "":
            pass2 = getpass.getpass(prompt="Re-enter password to confirm: ").strip()
        if pass1 == pass2:
            match = True
        else:
            print("Passwords do not math. Please try again!")
            pass1 = ""
            pass2 = ""

    hub_config.user_list = []
    create_user(username, display_name, pass1, {
        "analytics": "edit",
        "components": {
            "edit": ["__all"],
            "edit_content": [],
            "view": []
        },
        "exhibits": "edit",
        "maintenance": "edit",
        "programs": "edit",
        "schedule": "edit",
        "settings": "edit",
        "users": "edit"
    })


def check_for_root_admin():
    """Check that root_admin.txt exists and is valid, or prompt to create it."""

    path = ex_files.get_path(["configuration", "root_admin.txt"], user_file=True)
    if not root_admin_valid():
        if os.path.exists(path):
            logging.error(f"check_for_root_admin: {path} is damaged, so a new admin password is needed.")
            print(f"The admin password file {path} is damaged.")
        command_line_setup_print_gui()
        print("To begin, you must create a password for the root")
        print("admin account. You will be able to use this password to")
        print("manage other accounts. The username for this account is")
        print("'admin'.")
        print("", flush=True)

        pass1 = ""
        pass2 = ""
        match = False
        while match is False:
            while pass1.strip() == "":
                pass1 = getpass.getpass(prompt="Enter password: ").strip()
                if pass1 == "":
                    print("Password cannot be blank!")
            while pass2.strip() == "":
                pass2 = getpass.getpass(prompt="Re-enter password to confirm: ").strip()
            if pass1 == pass2:
                match = True
            else:
                print("Passwords do not math. Please try again!")
                pass1 = ""
                pass2 = ""
        create_root_admin(pass1)


def load_users():
    """Read users.json and build a User for each."""

    hub_config.user_list = []  # Clear existing users

    path = ex_files.get_path(["configuration", "users.json"], user_file=True)

    users = ex_files.load_json(path)
    if users is None:
        return

    for user in users:
        hub_config.user_list.append(User(user["username"],
                                         user["display_name"],
                                         user["password_hash"],
                                         permissions_dict=user["permissions"],
                                         preferences_dict=user.get("preferences", None),
                                         uuid_str=user["uuid"])
                                    )


def save_users():
    """Write users.json to file."""

    dict_list = []
    for user in hub_config.user_list:
        dict_list.append(user.get_dict(omit_password=False))

    path = ex_files.get_path(["configuration", "users.json"], user_file=True)
    ex_files.write_json(dict_list, path)


def get_user(username: str = '', uuid_str: str = '') -> User | None:
    """Return the user matching either the given username or uuid_str."""

    if username == '' and uuid_str == '':
        raise ValueError("Must supply one of 'username' or 'uuid_str'")
    if username != '' and uuid_str != '':
        raise ValueError("Must supply only one of 'username' or 'uuid_str'")

    username = username.lower()

    if username == 'admin' or uuid_str == 'admin':
        filtered = [get_admin()]
    elif username != '':
        filtered = [x for x in hub_config.user_list if x.username == username]
    else:
        filtered = [x for x in hub_config.user_list if x.uuid == uuid_str]

    if len(filtered) > 0:
        return filtered[0]
    return None


def create_user(username: str,
                display_name: str,
                password: str,
                permissions: dict[str, Any] | None = None) -> tuple[bool, dict]:
    """Create a new user."""

    if check_username_available(username) is False:
        if hub_config.debug:
            print(f"create_user: error: username {username} exists")
        return False, {}

    password_hash = hash_password(password)

    new_user = User(username,
                    display_name,
                    password_hash,
                    permissions_dict=permissions)
    hub_config.user_list.append(new_user)
    save_users()
    return True, new_user.get_dict()


def delete_user(uuid_str: str) -> bool:
    """Move a user to the deleted list."""

    path = ex_files.get_path(["configuration", "deleted_users.json"], user_file=True)
    deleted_users = ex_files.load_json(path)
    if deleted_users is None:
        deleted_users = []

    user = get_user(uuid_str=uuid_str)
    if user is None:
        if hub_config.debug is True:
            print("delete_user: error: user does not exist: ", uuid_str)
        return False
    user_dict = user.get_dict()
    user_dict["deleted_datetime"] = str(datetime.datetime.now())
    deleted_users.append(user_dict)
    ex_files.write_json(deleted_users, path)
    hub_config.user_list = [x for x in hub_config.user_list if x.uuid != uuid_str]
    save_users()
    return True


def check_username_available(username: str) -> bool:
    """Check if the given username has already been claimed."""

    username = username.lower()  # Usernames are case-insensitive

    if username == 'admin':
        return False

    filtered = [x for x in hub_config.user_list if x.username.lower() == username]
    if len(filtered) > 0:
        return False
    return True


def authenticate_user(token: str = "",
                      credentials: tuple[str, str] = ("", ""),
                      scope: str | None = None) -> tuple[bool, str]:
    """Authenticate the user using either a username/password or a token.

    Full tokens are always accepted. A limited token, such as an Apps login, is only accepted when
    `scope` matches it.

    If the user is authenticated successfully, return the matching uuid.
    """

    if token != "" and credentials != ("", ""):
        # Prefer credentials
        token = ""

    if token == "" and credentials == ("", ""):
        return False, ""

    if token != "":
        try:
            user_uuid, token_scope = decrypt_token(token)
            user = get_user(uuid_str=user_uuid) if token_scope in (None, scope) else None
        except InvalidToken:
            user = None
        if user is None:
            return False, ""
        user.update_last_activity()
        return True, user_uuid

    username, password = credentials
    user = get_user(username=username)

    if user is None:
        return False, ""
    success = user.authenticate(password)
    if success is True:
        return True, user.uuid
    return False, ""


def check_user_permission(action: str,
                          needed_level: str,
                          groups: list[str] | None = None,
                          token: str = "",
                          credentials: tuple[str, str] = ("", "")) -> tuple[bool, str, str]:
    """Confirm that the given user has the necessary permission to perform the given action.

    Returns a tuple of success, the authorizing user, and a reason for failure
    """

    success, user_uuid = authenticate_user(token=token, credentials=credentials)
    if success is False:
        return False, user_uuid, "authentication_failed"

    if get_user(uuid_str=user_uuid).check_permission(action, needed_level, groups=groups) is False:
        return False, user_uuid, "insufficient_permission"

    return True, user_uuid, ""


class AuthError(Exception):
    """Raised by the authentication dependencies when a request is not allowed.

    Hub converts this into a {"success": False, "reason": reason} response.
    """

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def get_request_token(request: Request) -> str:
    """Return the authentication token sent with the request, or an empty string if there isn't one.

    The token can come from an "Authorization: Bearer" header, which cross-origin clients like Apps
    use, or from the authToken cookie, which the Hub web interface uses.
    """

    scheme, _, credentials = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() == "bearer" and credentials.strip() != "":
        return credentials.strip()

    return request.cookies.get("authToken", "")


def require_user(request: Request) -> str:
    """FastAPI dependency that requires any logged-in user and returns their uuid."""

    success, user_uuid = authenticate_user(token=get_request_token(request))
    if success is False:
        raise AuthError("authentication_failed")
    return user_uuid


# Describes the check, so that tests can verify each route's requirement
require_user.exhibitera_permission = ("user",)


def require_apps_user(request: Request) -> str:
    """FastAPI dependency like require_user(), except that it also accepts an Apps login token.

    Use this only for what Apps pages need.
    """

    success, user_uuid = authenticate_user(token=get_request_token(request), scope="apps")
    if success is False:
        raise AuthError("authentication_failed")
    return user_uuid


require_apps_user.exhibitera_permission = ("user", "apps")


def require_permission(category: str, action: str):
    """Factory for a FastAPI dependency that requires the given permission.

    Raises AuthError if the check fails. Otherwise, returns a dict with the authorizing user.
    """

    def _check(request: Request) -> dict:
        success, authorizing_user, reason = check_user_permission(
            category, action, token=get_request_token(request)
        )
        if success is False:
            raise AuthError(reason)

        return {"success": True, "user": authorizing_user, "reason": ""}

    _check.exhibitera_permission = (category, action)
    return _check


def require_component_permission(action: str, uuid_param: str = "uuid_str"):
    """Factory for a FastAPI dependency that requires a components permission for the
    component whose uuid is in the path parameter `uuid_param`.

    Raises AuthError if the check fails. Otherwise, returns a dict with the authorizing user.
    """

    def _check(request: Request) -> dict:
        component = hub_components.get_exhibit_component(request.path_params.get(uuid_param, ""))
        groups = component.groups if component is not None else None

        success, authorizing_user, reason = check_user_permission(
            "components", action, groups=groups, token=get_request_token(request)
        )
        if success is False:
            raise AuthError(reason)

        return {"success": True, "user": authorizing_user, "reason": ""}

    _check.exhibitera_permission = ("components", action, "group")
    return _check


def get_admin():
    """Return a dummy user account containing the admin details"""

    path = ex_files.get_path(["configuration", "root_admin.txt"], user_file=True)
    with hub_config.galleryConfigurationLock:
        with open(path, 'r', encoding='UTF-8') as f:
            admin_pass = f.read()

    return User("admin", "Admin", admin_pass, {
        "analytics": "edit",
        "components": {
            "edit": ["__all"],
            "edit_content": [],
            "view": []
        },
        "exhibits": "edit",
        "maintenance": "edit",
        "programs": "edit",
        "schedule": "edit",
        "settings": "edit",
        "users": "edit"
    }, uuid_str='admin')


def hash_password(password: str) -> str:
    """Return the argon2 hash of the given password"""

    return password_hasher.hash(bytes(password, 'UTF-8'),
                                salt=bytes("Constellation", "UTF-8"))


def refresh_display_name_cache():
    """Create a cache of display names for all users, current and deleted."""

    cache = {}
    for user in hub_config.user_list:
        cache[user.uuid] = user.display_name

    path = ex_files.get_path(["configuration", "deleted_users.json"], user_file=True)
    deleted_users = ex_files.load_json(path)
    if deleted_users is None:
        deleted_users = []
    for user in deleted_users:
        cache[user["uuid"]] = user["display_name"]
    hub_config.user_display_name_cache = cache


def get_user_display_name(uuid_str: str) -> str | None:
    """Return the display name of the given UUID."""

    if uuid_str in hub_config.user_display_name_cache:
        return hub_config.user_display_name_cache[uuid_str]

    # If it's not there, rebuild the cache and try again
    refresh_display_name_cache()
    if uuid_str in hub_config.user_display_name_cache:
        return hub_config.user_display_name_cache[uuid_str]

    return None
