# Standard modules
import glob
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

    path = ex_files.get_path(["definitions", ex_files.with_extension(this_uuid, "json")], user_file=True)

    headers = {'Access-Control-Expose-Headers': 'Content-Disposition'}
    return FileResponse(path, headers=headers)


@router.post("/definitions/write")
async def write_definition(definition: dict[str, Any] = Body(description="The JSON dictionary to write.", embed=True)):
    """Save the given JSON data to a definition file in the content directory."""
    print(definition)
    if "uuid" not in definition or definition["uuid"] == "":
        # Add a unique identifier
        definition["uuid"] = str(uuid.uuid4())
    path = ex_files.get_path(["definitions",
                                ex_files.with_extension(definition["uuid"], ".json")],
                               user_file=True)
    ex_files.write_json(definition, path)
    return {"success": True, "uuid": definition["uuid"]}


@router.get("/definitions/{this_uuid}/delete")
async def delete_definition(this_uuid: str):
    """Delete the given definition."""

    path = ex_files.get_path(["definitions", ex_files.with_extension(this_uuid, "json")], user_file=True)
    apps_files.delete_file(path)

    return {"success": True}


@router.get("/definitions/{this_uuid}/load")
async def load_definition(this_uuid: str):
    """Load the given definition and return the JSON."""

    path = ex_files.get_path(["definitions", ex_files.with_extension(this_uuid, "json")], user_file=True)
    definition = ex_files.load_json(path)
    if definition is None:
        return {"success": False, "reason": f"The definition {this_uuid} does not exist."}
    return {"success": True, "definition": definition}

@router.get("/definitions/{this_uuid}/thumbnail")
@router.head("/definitions/{this_uuid}/thumbnail")
async def load_definition_thumbnail(this_uuid: str):
    """Return a thumbnail for this definition."""

    thumbnail_path, mimetype = apps_files.get_definition_thumbnail(this_uuid)

    headers = {
        'Cache-Control': 'no-store',  # Forces browser to always request the resource
        'Access-Control-Allow-Origin': '*',  # Allow CORS
        'Access-Control-Expose-Headers': 'Content-Disposition'
    }
    return FileResponse(thumbnail_path, headers=headers)


@router.get("/definitions/{this_uuid}/getContentList")
async def get_definition_content_list(this_uuid: str):
    """Return a list of all content used by the given definition."""

    path = ex_files.get_path(["definitions", ex_files.with_extension(this_uuid, "json")], user_file=True)
    definition = ex_files.load_json(path)
    if definition is None:
        return {"success": False, "reason": f"The definition {this_uuid} does not exist."}

    app = definition.get("app")
    if app is None:
        return {"success": False, "reason": f"Missing required 'app' key."}

    content = []

    # First pull out any shared style elements
    field = "style"
    if app.startswith('word_cloud'):
        field = "appearance"

    if (definition.get(field, {}).get("background", {}).get("image", "") != ""
            and definition.get(field, {}).get("background", {}).get("mode") == "image"):
        content.append(definition[field]["background"]["image"])

    for item in definition.get(field, {}).get("font", {}):
        file = definition[field]["font"][item]
        # Check if this file in the content directory vs an Exhibitera source directory like _fonts/
        if os.path.basename(os.path.dirname(file)) == 'content':
            content.append(os.path.basename(file))

    # Then add app-specific content fields
    if app == "image_compare":
        for item_uuid in definition["content"]:
            item = definition["content"][item_uuid]
            content.append(item["image1"])
            content.append(item["image2"])
    elif app == 'media_player':
        if definition.get("watermark", {}).get('file', '') != '':
            content.append(definition["watermark"]["file"])
        for item_uuid in definition.get("content", {}):
            item = definition["content"][item_uuid]
            if item["filename"] not in content and item["type"] == "file":
                content.append(item["filename"])
            if item.get("subtitles", {}).get("filename", "") != '':
                content.append(item["subtitles"]["filename"])
            if "annotations" in item and isinstance(item["annotations"], dict):
                for anno_uuid in item["annotations"]:
                    # Iterate any annotations and copy any needed json files and font files
                    anno = item["annotations"][anno_uuid]
                    if anno.get('type', '') == "file":
                        content.append(anno["file"])
                    if os.path.basename(os.path.dirname(anno["font"])) == 'content':
                        content.append(os.path.basename(anno["font"]))
    elif app == "timelapse_viewer":
        if "font" in definition.get("attractor", {}):
            if os.path.basename(os.path.dirname(definition["attractor"]["font"])) == 'content':
                content.append(os.path.basename(definition["attractor"]["font"]))
        content += glob.glob(definition["files"], root_dir=ex_files.get_path(["content"], user_file=True))
    elif app == "voting_kiosk":
        for item_uuid in definition.get("options", {}):
            item = definition["options"][item_uuid]
            if item.get("icon_user_file", "") != "":
                if item["icon_user_file"] not in content:
                    content.append(item["icon_user_file"])
    elif app == "word_cloud_input":
        pass
    elif app == "word_cloud_viewer":
        pass
    else:
        return {"success": False, "reason": f"This endpoint is not yet implemented for {definition['app']}"}

    content_details = []
    total_size = 0
    for file in content:
        path = ex_files.get_path(["content", file], user_file=True)
        size, size_text = ex_files.get_file_size(path)

        total_size += size
        content_details.append({
            'name': file,
            'size': size,
            'size_text': size_text
        })

    return {"success": True,
            "total_size": ex_files.convert_bytes_to_readable(total_size),
            "content": content_details}
