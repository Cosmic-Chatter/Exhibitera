"""Collected data stored by ID: Flexible Tracker records, and Voting Kiosk, Survey Kiosk and Word Cloud data.

See features/datasets.py for how it's stored. Data files stored by name, such as those written through
the Core API, are handled by the data API.
"""

# Standard modules
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Depends

# Exhibitera modules
import exhibitera.hub.features.datasets as hub_datasets
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix='/datasets')


@router.get("/list", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
async def list_datasets():
    """Return the datasets that have data, with their names, and the data files stored by name."""

    return {"success": True, "datasets": hub_datasets.list_datasets(), "files": hub_datasets.list_other_files()}


@router.get("/{kind}/{dataset_id}/csv", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
async def get_dataset_csv(kind: str, dataset_id: str):
    """Return the given dataset as CSV text, with a file name based on its name."""

    result = hub_datasets.dataset_csv(kind, dataset_id)
    if result is None:
        return {"success": False, "reason": "unknown_dataset"}
    csv, filename = result
    return {"success": True, "csv": csv, "filename": filename}


@router.delete("/{kind}/{dataset_id}", dependencies=[Depends(hub_users.require_permission("analytics", "edit"))])
async def delete_dataset(kind: str, dataset_id: str):
    """Delete the given dataset's records."""

    if not hub_datasets.delete_dataset(kind, dataset_id):
        return {"success": False, "reason": "unknown_dataset"}
    return {"success": True}


@router.post("/tracker/{template_uuid}/append")
async def append_tracker_record(template_uuid: str,
                                data: dict[str, Any] = Body(description="The record to save.", embed=True)):
    """Save a Flexible Tracker record for the given template."""

    success, reason = hub_datasets.append_tracker_record(template_uuid, data)
    return {"success": success, "reason": reason}
