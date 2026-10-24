# Third-party modules
from fastapi import APIRouter

# Exhibitera modules
import exhibitera.hub.features.components as hub_components

router = APIRouter(prefix="/component")

@router.get("/{uuid_str}/groups")
async def get_component_groups(uuid_str: str):
    """Return the list of groups the given component belongs to."""

    # Don't authenticate, as we use this as part of the component auth process

    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "Component does not exist", "groups": []}

    return {"success": True, "groups": component.groups}
