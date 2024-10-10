# Standard modules
from typing import Any
import uuid

# Third-party modules
from fastapi import APIRouter
from fastapi import  Body

# Exhibitera modules
import helper_files

router = APIRouter()


@router.get("/definitions/{app_id}/getAvailable")
async def get_available_definitions(app_id: str):
    """Return a list of all the definitions for the given app."""

    return {"success": True, "definitions": helper_files.get_available_definitions(app_id)}


@router.post("/definitions/write")
async def write_definition(definition: dict[str, Any] = Body(description="The JSON dictionary to write.", embed=True)):
    """Save the given JSON data to a definition file in the content directory."""
    print(definition)
    if "uuid" not in definition or definition["uuid"] == "":
        # Add a unique identifier
        definition["uuid"] = str(uuid.uuid4())
    path = helper_files.get_path(["definitions",
                                  helper_files.with_extension(definition["uuid"], ".json")],
                                 user_file=True)
    helper_files.write_json(definition, path)
    return {"success": True, "uuid": definition["uuid"]}


@router.get("/definitions/{this_uuid}/delete")
async def delete_definition(this_uuid: str):
    """Delete the given definition."""

    path = helper_files.get_path(["definitions", helper_files.with_extension(this_uuid, "json")], user_file=True)
    helper_files.delete_file(path)

    return {"success": True}


@router.get("/definitions/{this_uuid}/load")
async def load_definition(this_uuid: str):
    """Load the given definition and return the JSON."""

    path = helper_files.get_path(["definitions", helper_files.with_extension(this_uuid, "json")], user_file=True)
    definition = helper_files.load_json(path)
    if definition is None:
        return {"success": False, "reason": f"The definition {this_uuid} does not exist."}
    return {"success": True, "definition": definition}
