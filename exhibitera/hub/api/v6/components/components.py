# Standard modules
import time

# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.exhibitions as hub_exhibitions
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/component")

@router.post("/{uuid_str}/queueCommand")
async def queue_component_command(uuid_str: str,
                                  command: str = Body(description="The command to be sent to the specified component", embed=True)):
    """Queue the specified command for the given exhibit component."""

    hub_components.get_exhibit_component(uuid_str).queue_command(command)
    return {"success": True, "reason": ""}


@router.delete("/{uuid_str}/delete")
async def remove_component(uuid_str: str):
    """Remove the specified exhibit component"""

    to_remove = hub_components.get_exhibit_component(uuid_str)
    to_remove.remove()
    return {"success": True, "reason": ""}


@router.post("/static/create")
async def create_static_component(request: Request,
                                  id: str = Body(description="The ID of the projector to add."),
                                  groups: list[str] = Body(description="The groups of the projector to add.")):
    """Create a new static component."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    component = hub_components.add_exhibit_component(id, groups, 'static')

    return {"success": True, "uuid": component.uuid}


@router.post("/static/{uuid_str}/edit")
async def edit_static_component(request: Request,
                                uuid_str: str,
                                id: str | None = Body(description="The ID of the static component.", default=None),
                                description: str | None = Body(description="A short description of this component.",
                                                               default=None),
                                groups: list[str] | None = Body(description="The groups of the static component.",
                                                                default=None)):
    """Edit the given static component."""

    # Load the component first, so we can use the groups to authenticate
    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("components", "edit",
                                                                        groups=component.groups, token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if id is not None:
        component.id = id
    if groups is not None:
        component.groups = groups
    if description is not None:
        component.config["description"] = description
    component.save()
    hub_config.last_update_time = time.time()
    return {"success": True}


@router.post("/WOL/create")
async def create_wake_on_lan_component(request: Request,
                                       id: str = Body(description="The ID of the projector to add."),
                                       groups: list[str] = Body(description="The groups of the projector to add."),
                                       mac_address: str = Body(description="The MAC address of the machine to wake."),
                                       ip_address: str = Body(description="The static IP address of the machine.",
                                                              default="")):
    """Create a new wake on LAN component."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    component = hub_components.add_wake_on_lan_device(id, groups, mac_address, ip_address=ip_address)

    return {"success": True, "uuid": component.uuid}


@router.post("/WOL/{uuid_str}/edit")
async def edit_wake_on_lan_component(request: Request,
                                     uuid_str: str,
                                     id: str | None = Body(description="The ID of the projector to add.", default=None),
                                     groups: list[str] | None = Body(description="The groups of the projector to add.",
                                                                     default=None),
                                     description: str | None = Body(
                                         description="A short description of this component.", default=None),
                                     mac_address: str = Body(description="The MAC address of the machine to wake."),
                                     ip_address: str = Body(description="The static IP address of the machine.",
                                                            default="")):
    """Edit the given wake on LAN component."""

    # Load the component first, so we can use the groups to authenticate
    component = hub_components.get_wake_on_lan_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("components", "edit",
                                                                        groups=component.groups, token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if id is not None:
        component.id = id
    if groups is not None:
        component.groups = groups
    if mac_address is not None:
        component.mac_address = mac_address
    if ip_address is not None:
        component.ip_address = ip_address
    if description is not None:
        component.config["description"] = description
    component.save()
    hub_config.last_update_time = time.time()

    return {"success": True}

@router.get("/{uuid_str}/groups")
async def get_component_groups(uuid_str: str):
    """Return the list of groups the given component belongs to."""

    # Don't authenticate, as we use this as part of the component auth process

    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist", "groups": []}

    return {"success": True, "groups": component.groups}


@router.post("/{uuid_str}/edit")
async def edit_component(request: Request,
                         uuid_str: str,
                         id: str | None = Body(description="The ID of the component.", default=None),
                         groups: list[str] | None = Body(description="The groups of the component.", default=None),
                         description: str | None = Body(description="A short description of the component.",
                                                        default=None)):
    """Edit the given component."""

    # Must get the component first, so we can use the groups to check for permissions
    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("components", "edit",
                                                                        groups=component.groups, token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if id is not None:
        component.id = id
    if groups is not None:
        component.groups = groups
    if description is not None:
        component.config["description"] = description
    component.save()
    hub_config.last_update_time = time.time()
    return {"success": True}


@router.post("/{component_uuid}/definition/{definition_uuid}")
async def set_component_definition(component_uuid: str, definition_uuid: str):
    """Set the definition for the component."""

    hub_exhibitions.update_exhibition(component_uuid, {"definition": definition_uuid})

    return {"success": True}
