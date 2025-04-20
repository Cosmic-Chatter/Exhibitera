# Standard modules
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Request, Response

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.utilities as ex_utilities
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.users as hub_users

router = APIRouter()

@router.post("/user/login")
def log_in(response: Response,
           request: Request,
           credentials: tuple[str, str] = Body(description="A tuple containing the username and password.",
                                               default=("", "")),
           token: str = Body(description="An authentication cookie.", default="")
           ):
    """Authenticate the user and return the permissions and an authentication token."""

    if token == "":
        token = request.cookies.get("authToken", "")

    success, user_uuid = hub_users.authenticate_user(token=token, credentials=credentials)
    if success is False:
        return {"success": False, "reason": "authentication_failed"}

    user = hub_users.get_user(uuid_str=user_uuid)
    response_dict = {"success": True, "user": user.get_dict()}
    if token == "":
        token = hub_users.encrypt_token(user_uuid)
        if ex_config.debug:
            print(token)
        response.set_cookie(key="authToken", value=token, max_age=int(3e7))  # Expire cookie in approx 1 yr
        response_dict['authToken'] = token
    return response_dict


@router.post("/user/create")
def create_user(request: Request,
                username: str = Body(description="The username"),
                password: str = Body(description="The password for the account to create."),
                display_name: str = Body(description="The name of the account holder."),
                permissions: dict | None = Body(description="A dictionary of permissions for the new account.",
                                                default=None)):
    """Create a new user account."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("users", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success, user_dict = hub_users.create_user(username, display_name, password, permissions=permissions)

    response = {"success": success, "user": user_dict}
    if success is False:
        response["reason"] = "username_taken"
    return response


@router.post("/user/{uuid_str}/edit")
def edit_user(request: Request,
              uuid_str: str,
              username: str | None = Body(description="The username", default=None),
              password: str | None = Body(description="A new password.", default=None),
              display_name: str | None = Body(description="The name of the account holder.", default=None),
              permissions: dict | None = Body(description="A dictionary of permissions for the account.",
                                              default=None)):
    """Edit the given user."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("users", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    user = hub_users.get_user(uuid_str=uuid_str)
    if user is None:
        return {"success": False, "reason": "user_does_not_exist"}

    if username is not None and username != user.username:
        if hub_users.check_username_available(username) is True:
            user.username = username
        else:
            return {"success": False, "reason": "username_taken"}

    if display_name is not None:
        user.display_name = display_name
    if password is not None:
        user.password_hash = hub_users.hash_password(password)
    if permissions is not None:
        user.permissions = permissions
    hub_users.save_users()

    return {"success": success, "user": user.get_dict()}


@router.post("/user/{uuid_str}/editPreferences")
def edit_user_preferences(request: Request,
                          uuid_str: str,
                          preferences: dict[str, Any] = Body(description="A dictionary of preferences to update.",
                                                             embed=True)):
    """Update the preferences for the given user."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("users", "none", token=token)
    if success is False:
        # Should fail only if the user does not exist
        return {"success": False, "reason": reason}
    if uuid_str != authorizing_user:
        # Only the user can change their preferences
        return {"success": False, "reason": "invalid_credentials"}

    user = hub_users.get_user(uuid_str=uuid_str)
    if user is None:
        return {"success": False, "reason": "user_does_not_exist"}
    result = ex_utilities.deep_merge(preferences, user.preferences)
    user.preferences = result
    hub_users.save_users()

    return {"success": True, "user": user.get_dict()}


@router.delete("/user/{uuid_str}")
def delete_user(request: Request, uuid_str: str):
    """Delete the given user"""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("users", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    return {"success": hub_users.delete_user(uuid_str)}


@router.post("/users/list")
def list_users(permissions: dict[str, str] = Body(description="A dictionary of permissions to match.",
                                                  default={},
                                                  embed=True)):
    """Return a list of users matching the provided criteria"""

    matched_users = []

    for user in hub_config.user_list:
        error = False
        for key in permissions:

            if user.check_permission(key, permissions[key]) is False:
                error = True
        if not error:
            matched_users.append(user.get_dict())

    return {"success": True, "users": matched_users}


@router.get("/user/{user_uuid}/displayName")
def get_user_display_name(user_uuid: str):
    """Get the display name for a user account."""

    display_name = hub_users.get_user_display_name(user_uuid)
    if display_name is None:
        return {"success": False, "reason": "user_does_not_exist"}
    return {"success": True, "display_name": display_name}


@router.post('/user/{user_uuid}/changePassword')
def change_user_password(user_uuid: str,
                         current_password: str = Body(description="The plaintext of the current password."),
                         new_password: str = Body(description="The plaintext of the password to set.")):
    """Change the password for the given user"""

    user = hub_users.get_user(uuid_str=user_uuid)

    # First, check that the current password is correct
    if hub_users.hash_password(current_password) != user.password_hash:
        return {"success": False, "reason": "authentication_failed"}

    # Then, update the password
    if user.uuid != "admin":
        user.password_hash = hub_users.hash_password(new_password)
        hub_users.save_users()
    else:
        hub_users.create_root_admin(new_password)

    return {"success": True}
