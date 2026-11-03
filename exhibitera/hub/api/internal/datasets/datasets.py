"""Collected data stored by ID: Flexible Tracker records, and Voting Kiosk, Survey Kiosk and Word Cloud data.

See features/datasets.py for how it's stored. Data files stored by name, such as those written through
the Core API, are handled by the data API.
"""

# Standard modules
from typing import Any

# Third-party modules
from fastapi import APIRouter, Body, Depends, Query

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.features.datasets as hub_datasets
import exhibitera.hub.features.users as hub_users

router = APIRouter(prefix='/datasets')


@router.get("/list", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
async def list_datasets():
    """Return the datasets that have data, with their names, and the data files stored by name."""

    return {"success": True, "datasets": hub_datasets.list_datasets(), "files": hub_datasets.list_other_files()}


@router.get("/{kind}/{dataset_id}/summary", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
async def get_dataset_summary(kind: str, dataset_id: str,
                              start: str | None = Query(None, description="Count records from this time."),
                              end: str | None = Query(None, description="Count records until this time.")):
    """Return the dataset's columns, the times of its first and last records, and how many are in the range."""

    try:
        start_time, end_time = ex_files.parse_time_range(start, end)
    except ValueError:
        return {"success": False, "reason": "invalid_time"}
    records = hub_datasets.dataset_records(kind, dataset_id)
    if records is None:
        return {"success": False, "reason": "unknown_dataset"}
    return {"success": True, **ex_files.summarize_records(records, start_time, end_time)}


@router.get("/{kind}/{dataset_id}/csv", dependencies=[Depends(hub_users.require_permission("analytics", "view"))])
async def get_dataset_csv(kind: str, dataset_id: str,
                          start: str | None = Query(None, description="Include records from this time."),
                          end: str | None = Query(None, description="Include records until this time."),
                          columns: list[str] | None = Query(None, description="Include only these columns.")):
    """Return the given dataset as CSV text, with a file name based on its name.

    The records can be limited to a time range, given to the minute, and to the given columns.
    """

    try:
        start_time, end_time = ex_files.parse_time_range(start, end)
    except ValueError:
        return {"success": False, "reason": "invalid_time"}
    result = hub_datasets.dataset_csv(kind, dataset_id, start_time, end_time, columns)
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
                                data: dict[str, Any] = Body(description="The record to save.", embed=True),
                                record_id: str | None = Body(
                                    None, max_length=64, embed=True,
                                    description="Identifies the record, so it's saved once if it's sent again.")):
    """Save a Flexible Tracker record for the given template."""

    success, reason = hub_datasets.append_tracker_record(template_uuid, data, record_id)
    return {"success": success, "reason": reason}
