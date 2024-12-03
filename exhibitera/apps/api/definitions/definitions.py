# Standard modules
import os.path
from typing import Any
import uuid

# Third-party modules
from fastapi import APIRouter
from fastapi import Body

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


@router.get("/definitions/{this_uuid}/getContentList")
async def get_definition_content_list(this_uuid: str):
    """Return a list of all content used by the given definition."""

    path = helper_files.get_path(["definitions", helper_files.with_extension(this_uuid, "json")], user_file=True)
    definition = helper_files.load_json(path)
    if definition is None:
        return {"success": False, "reason": f"The definition {this_uuid} does not exist."}

    content = []

    if definition["app"] == 'media_player':
        if (definition["style"]["background"].get("image", "") != ""
                and definition["style"]["background"]["mode"] == "image"):
            content.append(definition["style"]["background"]["image"])
        for item_uuid in definition["content"]:
            item = definition["content"][item_uuid]
            if item["filename"] not in content:
                content.append(item["filename"])
    elif definition["app"] == "voting_kiosk":
        if (definition["style"]["background"].get("image", "") != ""
                and definition["style"]["background"]["mode"] == "image"):
            content.append(definition["style"]["background"]["image"])
        for item_uuid in definition["options"]:
            item = definition["options"][item_uuid]
            if item.get("icon_user_file", "") != "":
                if item["icon_user_file"] not in content:
                    content.append(item["icon_user_file"])
    elif definition["app"] == "word_cloud_input":
        if (definition["appearance"]["background"].get("image", "") != ""
                and definition["appearance"]["background"]["mode"] == "image"):
            content.append(definition["appearance"]["background"]["image"])
    elif definition["app"] == "word_cloud_viewer":
        if (definition["appearance"]["background"].get("image", "") != ""
                and definition["appearance"]["background"]["mode"] == "image"):
            content.append(definition["appearance"]["background"]["image"])
    else:
        return {"success": False, "reason": f"This endpoint is not yet implemented for {definition['app']}"}

    content_details = []

    for file in content:
        file_details = {
            'name': file
        }
        path = helper_files.get_path(["content", file], user_file=True)
        file_details['size'] = os.path.getsize(path)  # in bytes
        if file_details['size'] > 1e9:
            file_details['size_text'] = str(round(file_details['size'] / 1e9 * 10) / 100) + ' GB'
        elif file_details['size'] > 1e6:
            file_details['size_text'] = str(round(file_details['size'] / 1e6 * 00) / 100) + ' MB'
        elif file_details['size'] > 1e3:
            file_details['size_text'] = str(round(file_details['size'])) + ' kB'
        else:
            file_details['size_text'] = str(file_details['size']) + ' bytes'

        content_details.append(file_details)

    return {"success": True, "content": content_details}
