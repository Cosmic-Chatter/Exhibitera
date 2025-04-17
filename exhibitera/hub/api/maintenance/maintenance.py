# Standard modules
import datetime
import time

# Third-party modules
from fastapi import APIRouter, Body, Request

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.exhibits as hub_exhibit
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix="/maintenance")


@router.get("/")
async def get_all_maintenance_statuses(request: Request):
    """Send a list of all the maintenance statuses for known components"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    record_list = []
    for component in hub_config.componentList:
        record_list.append(component.get_maintenance_report())
    for projector in hub_config.projectorList:
        record_list.append(projector.get_maintenance_report())
    for wol in hub_config.wakeOnLANList:
        record_list.append(wol.get_maintenance_report())
    return {"success": True, "records": record_list}


@router.get("/{uuid_str}")
async def get_maintenance_status(request: Request, uuid_str: str):
    """Return the maintenance status for the given component."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    component = hub_exhibit.get_exhibit_component(component_uuid=uuid_str)
    if component is None:
        return {"success": False, "reason": "invalid_uuid"}
    return {"success": True, "status": component.get_maintenance_report()}


@router.post("/{uuid_str}")
async def update_maintenance_status(request: Request,
                                    uuid_str: str,
                                    notes: str = Body(description="Text notes about this component."),
                                    status: str = Body(description="The status of the component.")):
    """Update the maintenance status for the given component."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    component = hub_exhibit.get_exhibit_component(component_uuid=uuid_str)
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
async def delete_maintenance_record(request: Request, uuid_str: str):
    """Clear the maintenance log for the given component."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = hub_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    component = hub_exhibit.get_exhibit_component(component_uuid=uuid_str)
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
