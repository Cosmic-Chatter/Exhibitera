# Third-party modules
from fastapi import APIRouter, Body, Request, Response

# Exhibitera modules
import exhibitera.common.config as ex_config
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
        token = hub_users.get_request_token(request)

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
