# Standard modules
import datetime
import time

# Third-party modules
from fastapi import APIRouter, Body, Depends

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/maintenance")


@router.get("/")
async def get_all_maintenance_statuses(
        permission: dict = Depends(hub_users.require_permission("maintenance", "view"))
):
    """Send a list of all the maintenance statuses for known components"""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    record_list = []
    for component in hub_config.componentList:
        record_list.append(component.get_maintenance_report())
    for projector in hub_config.projectorList:
        record_list.append(projector.get_maintenance_report())
    for wol in hub_config.wakeOnLANList:
        record_list.append(wol.get_maintenance_report())
    return {"success": True, "records": record_list}


@router.get("/{uuid_str}")
async def get_maintenance_status(
        uuid_str: str,
        permission: dict = Depends(hub_users.require_permission("maintenance", "view"))
):
    """Return the maintenance status for the given component."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "invalid_uuid"}
    return {"success": True, "status": component.get_maintenance_report()}


@router.post("/{uuid_str}")
async def update_maintenance_status(
        uuid_str: str,
        notes: str = Body(description="Text notes about this component."),
        status: str = Body(description="The status of the component."),
        permission: dict = Depends(hub_users.require_permission("maintenance", "edit"))
):
    """Update the maintenance status for the given component."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "invalid_uuid"}

    record = {"id": component.id,
              "date": datetime.datetime.now().isoformat(),
              "status": status,
              "notes": notes}
    component.maintenance_log["current"] = record
    component.maintenance_log["history"].append(record)
    component.config["maintenance_status"] = status
    component.save()

    return {"success": True}

@router.delete("/{uuid_str}")
async def delete_maintenance_record(
        uuid_str: str,
        permission: dict = Depends(hub_users.require_permission("maintenance", "edit"))
):
    """Clear the maintenance log for the given component."""

    if not permission["success"]:
        return {"success": False, "reason": permission["reason"]}

    component = hub_components.get_exhibit_component(uuid_str)
    if component is None:
        return {"success": False, "reason": "invalid_uuid"}

    component.maintenance_log = {
        "current": {
            "date": str(datetime.datetime.now()),
            "status": "On floor, not working",
            "notes": ""
        },
        "history": []
    }
    component.save()
    hub_config.last_update_time = time.time()

    return {"success": True}
