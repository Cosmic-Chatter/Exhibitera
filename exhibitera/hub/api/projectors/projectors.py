# Standard modules
import time

# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.exhibits as hub_exhibit
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/projector")

@router.post("/create")
async def create_projector(request: Request,
                           id: str = Body(description="The ID of the projector to add."),
                           groups: list[str] = Body(description="The groups of the projector to add."),
                           ip_address: str = Body(description="The IP address for the projector."),
                           password: str = Body(description="The PJLink password", default="")):
    """Create a new projector."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    proj = hub_exhibit.add_projector(id, groups, ip_address, password=password)

    return {"success": True, "uuid": proj.uuid}


@router.post("/{uuid_str}/edit")
async def edit_projector(request: Request,
                         uuid_str: str,
                         id: str | None = Body(description="The ID of the projector to add.", default=None),
                         groups: list[str] | None = Body(description="The groups of the projector to add.",
                                                         default=None),
                         description: str | None = Body(description="A short description of this projector.",
                                                        default=None),
                         ip_address: str | None = Body(description="The IP address for the projector.", default=None),
                         password: str | None = Body(description="The PJLink password", default=None)):
    """Edit the given projector."""

    # Get the projector first, so we can use the groups to authenticate
    proj = hub_exhibit.get_projector(projector_uuid=uuid_str)
    if proj is None:
        return {"success": False, "reason": "Projector does not exist"}

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("components", "edit",
                                                                        groups=proj.groups, token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if id is not None:
        proj.id = id
    if groups is not None:
        proj.groups = groups
    if ip_address is not None:
        proj.ip_address = ip_address
    if password is not None:
        proj.password = password
    if description is not None:
        proj.config["description"] = description
    proj.save()
    hub_config.last_update_time = time.time()
    return {"success": True}
