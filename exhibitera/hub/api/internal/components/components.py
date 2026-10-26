# Standard modules
import time

# Third-party modules
from fastapi import APIRouter, Body, Depends

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.exhibitions as hub_exhibitions
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/component")

@router.post("/{uuid_str}/queueCommand", dependencies=[Depends(hub_users.require_component_permission("edit_content"))])
async def queue_component_command(uuid_str: str,
                                  command: str = Body(description="The command to be sent to the specified component", embed=True)):
    """Queue the specified command for the given exhibit component."""

    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    component.queue_command(command)
    return {"success": True, "reason": ""}


@router.delete("/{uuid_str}/delete", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def remove_component(uuid_str: str):
    """Remove the specified exhibit component"""

    to_remove = hub_components.get_exhibit_component(uuid_str)
    if to_remove is None:
        return {"success": False, "reason": "Component does not exist"}

    to_remove.remove()
    return {"success": True, "reason": ""}


@router.post("/static/create", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def create_static_component(id: str = Body(description="The ID of the projector to add."),
                                  groups: list[str] = Body(description="The groups of the projector to add.")):
    """Create a new static component."""

    component = hub_components.add_exhibit_component(id, groups, 'static')

    return {"success": True, "uuid": component.uuid}


@router.post("/static/{uuid_str}/edit", dependencies=[Depends(hub_users.require_component_permission("edit"))])
async def edit_static_component(uuid_str: str,
                                id: str | None = Body(description="The ID of the static component.", default=None),
                                description: str | None = Body(description="A short description of this component.",
                                                               default=None),
                                groups: list[str] | None = Body(description="The groups of the static component.",
                                                                default=None)):
    """Edit the given static component."""

    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    if id is not None:
        component.id = id
    if groups is not None:
        component.groups = groups
    if description is not None:
        component.config["description"] = description
    component.save()
    hub_config.last_update_time = time.time()
    return {"success": True}


@router.post("/WOL/create", dependencies=[Depends(hub_users.require_permission("settings", "edit"))])
async def create_wake_on_lan_component(id: str = Body(description="The ID of the projector to add."),
                                       groups: list[str] = Body(description="The groups of the projector to add."),
                                       mac_address: str = Body(description="The MAC address of the machine to wake."),
                                       ip_address: str = Body(description="The static IP address of the machine.",
                                                              default="")):
    """Create a new wake on LAN component."""

    component = hub_components.add_wake_on_lan_device(id, groups, mac_address, ip_address=ip_address)

    return {"success": True, "uuid": component.uuid}


@router.post("/WOL/{uuid_str}/edit", dependencies=[Depends(hub_users.require_component_permission("edit"))])
async def edit_wake_on_lan_component(uuid_str: str,
                                     id: str | None = Body(description="The ID of the projector to add.", default=None),
                                     groups: list[str] | None = Body(description="The groups of the projector to add.",
                                                                     default=None),
                                     description: str | None = Body(
                                         description="A short description of this component.", default=None),
                                     mac_address: str = Body(description="The MAC address of the machine to wake."),
                                     ip_address: str = Body(description="The static IP address of the machine.",
                                                            default="")):
    """Edit the given wake on LAN component."""

    component = hub_components.get_wake_on_lan_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

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

@router.post("/{uuid_str}/edit", dependencies=[Depends(hub_users.require_component_permission("edit"))])
async def edit_component(uuid_str: str,
                         id: str | None = Body(description="The ID of the component.", default=None),
                         groups: list[str] | None = Body(description="The groups of the component.", default=None),
                         description: str | None = Body(description="A short description of the component.",
                                                        default=None)):
    """Edit the given component."""

    # Must get the component first, so we can use the groups to check for permissions
    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist"}

    if id is not None:
        component.id = id
    if groups is not None:
        component.groups = groups
    if description is not None:
        component.config["description"] = description
    component.save()
    hub_config.last_update_time = time.time()
    return {"success": True}


@router.post("/{component_uuid}/definition/{definition_uuid}",
             dependencies=[Depends(hub_users.require_component_permission("edit_content", uuid_param="component_uuid"))])
async def set_component_definition(component_uuid: str, definition_uuid: str):
    """Set the definition for the component."""

    hub_exhibitions.add_exhibition_modification(component_uuid, {"definition": definition_uuid})

    return {"success": True}
