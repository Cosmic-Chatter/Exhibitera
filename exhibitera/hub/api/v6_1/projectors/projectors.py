# Standard modules
import time

# Third-party modules
from fastapi import APIRouter, Body, Depends

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/projector")

@router.post("/create", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def create_projector(
        id: str = Body(description="The ID of the projector to add."),
        groups: list[str] = Body(description="The groups of the projector to add."),
        ip_address: str = Body(description="The IP address for the projector."),
        password: str = Body(description="The PJLink password", default="")
):
    """Create a new projector."""

    proj = hub_components.add_projector(id, groups, ip_address, password=password)

    return {"success": True, "uuid": proj.uuid}


@router.get("/{uuid_str}/password", dependencies=[Depends(hub_users.require_component_permission("edit"))])
async def get_projector_password(uuid_str: str):
    """Return the PJLink password for the given projector, for editing its settings.

    Passwords aren't included in the update stream, which every logged-in user receives.
    """

    proj = hub_components.get_projector(uuid_str)
    if proj is None:
        return {"success": False, "reason": "Projector does not exist"}

    return {"success": True, "password": proj.password or ""}


@router.post("/{uuid_str}/edit", dependencies=[Depends(hub_users.require_component_permission("edit"))])
async def edit_projector(uuid_str: str,
                         id: str | None = Body(description="The ID of the projector to add.", default=None),
                         groups: list[str] | None = Body(description="The groups of the projector to add.",
                                                         default=None),
                         description: str | None = Body(description="A short description of this projector.",
                                                        default=None),
                         ip_address: str | None = Body(description="The IP address for the projector.", default=None),
                         password: str | None = Body(description="The PJLink password", default=None)):
    """Edit the given projector."""

    proj = hub_components.get_projector(uuid_str)
    if proj is None:
        return {"success": False, "reason": "Projector does not exist"}

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
