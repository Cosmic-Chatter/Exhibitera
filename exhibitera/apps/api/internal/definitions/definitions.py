# Standard modules
import os.path
from typing import Any
import uuid

# Third-party modules
from fastapi import APIRouter, Body
from fastapi.responses import FileResponse

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.apps.features.files as apps_files

router = APIRouter()


@router.get("/definitions")
@router.get("/definitions/app/{app_id}")
async def get_available_definitions(app_id: str = 'all'):
    """Return a list of all the definitions for the given app."""

    return {"success": True, "definitions": apps_files.get_available_definitions(app_id)}


@router.get("/definitions/{this_uuid}")
async def load_definition_as_binary(this_uuid: str):
    """Return the given definition as a binary file"""

    if not ex_files.filename_safe(this_uuid):
        return {"success": False, "reason": "unsafe_filename"}

    path = ex_files.get_path(["definitions", ex_files.with_extension(this_uuid, "json")], user_file=True)

    headers = {'Access-Control-Expose-Headers': 'Content-Disposition'}
    return FileResponse(path, headers=headers)


@router.post("/definitions/write")
async def write_definition(definition: dict[str, Any] = Body(description="The JSON dictionary to write.", embed=True)):
    """Save the given JSON data to a definition file in the content directory."""

    if "uuid" not in definition or definition["uuid"] == "" or definition["uuid"] is None:
        # Add a unique identifier
        definition["uuid"] = str(uuid.uuid4())
    elif not ex_files.filename_safe(definition["uuid"]):
        return {"success": False, "reason": "unsafe_filename"}
    path = ex_files.get_path(["definitions",
                                ex_files.with_extension(definition["uuid"], ".json")],
                               user_file=True)
    ex_files.write_json(definition, path)
    return {"success": True, "uuid": definition["uuid"]}


@router.delete("/definitions/{this_uuid}")
async def delete_definition(this_uuid: str):
    """Delete the given definition."""

    if not ex_files.filename_safe(this_uuid):
        return {"success": False, "reason": "unsafe_filename"}

    path = ex_files.get_path(["definitions", ex_files.with_extension(this_uuid, "json")], user_file=True)
    apps_files.delete_file(path)

    return {"success": True}


@router.get("/definitions/{this_uuid}/load")
async def load_definition(this_uuid: str):
    """Load the given definition and return the JSON."""

    if not ex_files.filename_safe(this_uuid):
        return {"success": False, "reason": "unsafe_filename"}

    path = ex_files.get_path(["definitions", ex_files.with_extension(this_uuid, "json")], user_file=True)
    definition = ex_files.load_json(path)
    if definition is None:
        return {"success": False, "reason": f"The definition {this_uuid} does not exist."}
    return {"success": True, "definition": definition}

@router.get("/definitions/{this_uuid}/thumbnail")
@router.head("/definitions/{this_uuid}/thumbnail")
async def load_definition_thumbnail(this_uuid: str):
    """Return a thumbnail for this definition."""

    if not ex_files.filename_safe(this_uuid):
        return {"success": False, "reason": "unsafe_filename"}

    thumbnail_path, mimetype = apps_files.get_definition_thumbnail(this_uuid)

    headers = {
        'Cache-Control': 'no-store',  # Forces browser to always request the resource
        'Access-Control-Allow-Origin': '*',  # Allow CORS
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return FileResponse(thumbnail_path, headers=headers)


@router.get("/definitions/{this_uuid}/getContentList")
async def get_definition_content_list(this_uuid: str):
    """Return a list of all content used by the given definition, and the name of its own thumbnail, if any."""

    if not ex_files.filename_safe(this_uuid):
        return {"success": False, "reason": "unsafe_filename"}

    path = ex_files.get_path(["definitions", ex_files.with_extension(this_uuid, "json")], user_file=True)
    definition = ex_files.load_json(path)
    if definition is None:
        return {"success": False, "reason": f"The definition {this_uuid} does not exist."}

    app = definition.get("app")
    if app is None:
        return {"success": False, "reason": f"Missing required 'app' key."}

    # Every file the definition refers to, including attractors and Markdown media, whatever the app
    content = apps_files.get_definition_content(definition)

    content_details = []
    total_size = 0
    for file in content:
        if file == "":
            continue
        path = ex_files.get_path(["content", file], user_file=True)
        if not os.path.exists(path):
            continue
        size, size_text = ex_files.get_file_size(path)

        total_size += size
        content_details.append({
            'name': file,
            'size': size,
            'size_text': size_text
        })

    return {"success": True,
            "total_size": ex_files.convert_bytes_to_readable(total_size),
            "content": content_details,
            "thumbnail": apps_files.find_definition_thumbnail(this_uuid)}  # The definition's own, not its media's
