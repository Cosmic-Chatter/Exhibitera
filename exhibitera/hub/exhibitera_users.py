# Standard modules
import datetime
import os.path
from typing import Any
import uuid

# Non-standard modules
import argon2
from cryptography.fernet import Fernet, InvalidToken

# Exhibitera modules
import config
import exhibitera_tools as c_tools

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
                "schedule": "view",
                "settings": "none",
                "users": "none"
            }
        self.username = username
        self.display_name = display_name
        self.password_hash = password_hash
        self.permissions = permissions_dict
        self.last_activity = datetime.datetime.now().isoformat()

        if uuid_str == "":
            self.uuid = str(uuid.uuid4())
        else:
            self.uuid = uuid_str

    def authenticate(self, password: str) -> bool:
        try:
            result = password_hasher.verify(self.password_hash, password)
            self.update_last_activity()
        except argon2.exceptions.VerificationError:
            result = False
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
            "uuid": self.uuid
        }
        if not omit_password:
            this_dict["password_hash"] = self.password_hash

        return this_dict

    def update_last_activity(self):
        """Set the last activity time ot now."""

        self.last_activity = datetime.datetime.now().isoformat()


def get_encryption_key() -> bytes:
    """Retrieve the encryption key or create it if it doesn't exist."""

    if config.encryption_key is None:
        key_path = c_tools.get_path(["configuration", "encryption_key.txt"], user_file=True)
        if os.path.exists(key_path):
            # Load key from disk
            with open(key_path, 'r', encoding='UTF-8') as f:
                key_str = f.read()
                config.encryption_key = bytes(key_str, 'UTF-8')
        else:
            # Generate new key
            config.encryption_key = Fernet.generate_key()
            with open(key_path, 'w', encoding='UTF-8') as f:
                f.write(str(config.encryption_key, 'UTF-8'))

    return config.encryption_key


def encrypt_token(uuid_str: str) -> str:
    """Encrypt the uuid as a token and return it."""

    f = Fernet(get_encryption_key())
    token = f.encrypt(bytes(uuid_str, 'UTF-8'))
    return str(token, 'UTF-8')


def decrypt_token(token: str) -> str:
    """Decrypt a token and return the uuid."""

    f = Fernet(get_encryption_key())
    uuid_str = f.decrypt(token)
    return str(uuid_str, 'UTF-8')


def create_root_admin(password: str):
    """Create the root admin by saving a hashed password to disk. """

    path = c_tools.get_path(["configuration", "root_admin.txt"], user_file=True)

    password_hash = hash_password(password)

    with config.galleryConfigurationLock:
        with open(path, 'w', encoding='UTF-8') as f:
            f.write(password_hash)


def check_for_root_admin():
    """Check that the file root_admin.txt exists or prompt to create it."""

    path = c_tools.get_path(["configuration", "root_admin.txt"], user_file=True)
    if not os.path.exists(path):
        c_tools.clear_terminal()
        print("##########################################################")
        print("Welcome to Exhibitera Hub!")
        print("")
        print("Access to Exhibitera is controlled by a user account")
        print("system. To begin, you must create a password for the root")
        print("admin account. You will be able to use this password to")
        print("manage other accounts.")
        print("")
        pass1 = ""
        pass2 = ""
        match = False
        while match is False:
            while pass1.strip() == "":
                pass1 = input("Enter password: ").strip()
                if pass1 == "":
                    print("Password cannot be blank!")
            while pass2.strip() == "":
                pass2 = input("Re-enter password to confirm: ").strip()
            if pass1 == pass2:
                match = True
            else:
                print("Passwords do not math. Please try again!")
                pass1 = ""
                pass2 = ""
        create_root_admin(pass1)


def load_users():
    """Read users.json and build a User for each."""

    config.user_list = []  # Clear existing users

    path = c_tools.get_path(["configuration", "users.json"], user_file=True)

    users = c_tools.load_json(path)
    if users is None:
        return

    for user in users:
        config.user_list.append(User(user["username"],
                                     user["display_name"],
                                     user["password_hash"],
                                     permissions_dict=user["permissions"],
                                     uuid_str=user["uuid"])
                                )


def save_users():
    """Write users.json to file."""

    dict_list = []
    for user in config.user_list:
        dict_list.append(user.get_dict(omit_password=False))

    path = c_tools.get_path(["configuration", "users.json"], user_file=True)
    c_tools.write_json(dict_list, path)


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
        filtered = [x for x in config.user_list if x.username == username]
    else:
        filtered = [x for x in config.user_list if x.uuid == uuid_str]

    if len(filtered) > 0:
        return filtered[0]
    return None


def create_user(username: str,
                display_name: str,
                password: str,
                permissions: dict[str, Any] | None = None) -> tuple[bool, dict]:
    """Create a new user."""

    if check_username_available(username) is False:
        if config.debug:
            print(f"create_user: error: username {username} exists")
        return False, {}

    password_hash = hash_password(password)

    new_user = User(username,
                    display_name,
                    password_hash,
                    permissions_dict=permissions)
    config.user_list.append(new_user)
    save_users()
    return True, new_user.get_dict()


def check_username_available(username: str) -> bool:
    """Check if the given username has already been claimed."""

    username = username.lower()  # Usernames are case-insensitive

    if username == 'admin':
        return False

    filtered = [x for x in config.user_list if x.username.lower() == username]
    if len(filtered) > 0:
        return False
    return True


def authenticate_user(token: str = "", credentials: tuple[str, str] = ("", "")) -> tuple[bool, str]:
    """Authenticate the user using either a username/password or a token.

    If the user is authenticated successfully, return the matching uuid.
    """

    if token != "" and credentials != ("", ""):
        # Prefer credentials
        token = ""

    if token == "" and credentials == ("", ""):
        return False, ""

    if token != "":
        try:
            user_uuid = decrypt_token(token)
            user = get_user(uuid_str=user_uuid)
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


def get_admin():
    """Return a dummy user account containing the admin details"""

    path = c_tools.get_path(["configuration", "root_admin.txt"], user_file=True)
    with config.galleryConfigurationLock:
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
        "schedule": "edit",
        "settings": "edit",
        "users": "edit"
    }, uuid_str='admin')


def hash_password(password: str) -> str:
    """Return the argon2 hash of the given password"""

    return password_hasher.hash(bytes(password, 'UTF-8'),
                                salt=bytes("Constellation", "UTF-8"))
