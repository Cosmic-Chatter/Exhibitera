# Standard modules
from functools import lru_cache
import os
import shutil
from typing import Annotated

# Third-party modules
from fastapi import APIRouter, Body, Depends, File, Form, UploadFile
from starlette.background import BackgroundTasks
from fastapi.responses import FileResponse

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.files as apps_files
import exhibitera.apps.features.utilities as apps_utilities

router = APIRouter()

@lru_cache()
def get_config():
    return apps_config


@router.get('/files/{filename}/videoDetails')
async def get_video_details(filename: str):
    """Return a dictionary of useful information about a video file in the content directory."""

    if not ex_files.filename_safe(filename):
        return {"success": False, "details": "unsafe_filename"}

    success, details = apps_files.get_video_file_details(filename)
    return {"success": success, "details": details}


@router.post('/files/{filename}/convertVideoToFrames')
async def convert_video_to_frames(filename: str,
                                  file_type: str = Body(description='The output filetype to use.', default='jpg', embed=True)):
    """Convert the given file to a set of frames."""

    if not ex_files.filename_safe(filename):
        return {"success": False, "reason": "unsafe_filename"}

    success = apps_files.convert_video_to_frames(filename, file_type)

    return {"success": success}


@router.post('/files/thumbnailVideoFromFrames')
async def create_thumbnail_video_from_frames(
        filename: str = Body(description='The name of the output file, without an extension.'),
        frames: list[str] = Body(description='A list of the files to include'),
        duration: float = Body(description='The length of the output video in seconds.', default=5)):
    """Create a video thumbnail out of the given files."""

    if not ex_files.filename_safe(filename):
        return {"success": False, "reason": "Invalid character in filename"}

    success = apps_files.create_definition_thumbnail_video_from_frames(frames, filename, duration)
    return {"success": success}


@router.get('/files/{filename}/thumbnail')
@router.get('/files/{filename}/thumbnail/{width}')
def get_v2_thumbnail(filename: str, width: str = "400", force_image: bool = False):
    """

    :param force_image: Always return a png thumbnail, even for videos
    :param filename: The name of a file in the content directory
    :param width: The width of the file to be returned
    :return: Image or video data for the requested thumbnail
    """

    thumbnail_path, mimetype = apps_files.get_thumbnail(filename, width=width, force_image=force_image)
    if not os.path.exists(thumbnail_path):
        return FileResponse(ex_files.get_path(["_static", "icons", "document_missing.svg"]))
    return FileResponse(thumbnail_path)


@router.post('/files/uploadThumbnail')
def upload_thumbnail(files: list[UploadFile] = File(),
                     config: apps_config = Depends(get_config)):
    """Save uploaded files as thumbnails, formatting them appropriately."""

    for file in files:
        filename = file.filename

        if not ex_files.filename_safe(filename):
            continue

        temp_path = ex_files.get_path(["content", filename], user_file=True)
        with ex_config.binary_file_lock:
            # First write the file to content
            try:
                with open(temp_path, 'wb') as out_file:
                    shutil.copyfileobj(file.file, out_file)
            finally:
                file.file.close()
            # Next, generate a thumbnail
            apps_files.create_definition_thumbnail(filename)
            # Finally, delete the source file
            os.remove(temp_path)
    return {"success": True}


@router.post('/files/createZip')
def create_zip(background_tasks: BackgroundTasks,
               files: list[str] = Body(
                   description="A list of the files to be zipped. Files must be in the content directory."),
               zip_filename: str = Body(description="The filename of the zip file to be created.")):
    """Create a ZIP file containing the given files."""

    ex_files.create_zip(zip_filename, files)
    zip_path = ex_files.get_path(["temp", zip_filename], user_file=True)
    background_tasks.add_task(os.remove, zip_path)
    return FileResponse(zip_path, filename=zip_filename)


@router.post('/files/retrieve')
async def retrieve_file(file_url: Annotated[str, Body(description="The URL of the file to retrieve")],
                        path_list: Annotated[list[str], Body(description="A series of directories ending with the filename.")],
                        config: apps_config = Depends(get_config)):
    """Download the given file and save it to disk."""

    if not apps_files.path_safe(path_list):
        return {"success": False, "reason": "invalid_path"}
    if not ex_files.is_url(file_url):
        return {"success": False, "reason": "invalid_url"}

    path = ex_files.get_path(path_list, user_file=True)
    success = ex_files.download_file(file_url, path)

    return {"success": success}


@router.post("/files/delete")
async def delete_file(file: str | list[str] = Body(description="The file(s) to delete", embed=True)):
    """Delete the specified file(s) from the content directory"""

    if isinstance(file, list):
        for entry in file:
            apps_files.delete_file(entry)
    else:
        apps_files.delete_file(file)

    return {"success": True}


@router.post("/files/{current_name}/rename")
async def rename_file(current_name: str,
                      new_name: str = Body(description="The new name of the file.", embed=True)):
    """Rename a file in the content directory."""

    if not ex_files.filename_safe(current_name) or not ex_files.filename_safe(new_name):
        return {"success": False, "reason": "unsafe_filename"}

    return apps_files.rename_file(current_name, new_name)



@router.post("/files/upload")
def upload_files(files: list[UploadFile] = File(),
                 path: list[str] = Form(default=['content']),
                 config: apps_config = Depends(get_config)):
    """Receive uploaded files and save them to disk.

    `path` should be a relative path from the Exhibitera Apps directory.
    """

    if not apps_files.path_safe(path):
        print('upload_files: error: bad path', path)

    for file in files:
        filename = file.filename

        if not ex_files.filename_safe(filename):
            print("upload_files: error: invalid filename: ", filename)
            continue

        path_with_filename = path.copy()
        path_with_filename.append(filename)

        file_path = ex_files.get_path(path_with_filename, user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with ex_config.binary_file_lock:
            try:
                with open(file_path, 'wb') as out_file:
                    shutil.copyfileobj(file.file, out_file)
            finally:
                file.file.close()
    return {"success": True}


@router.get("/files/availableContent")
async def get_available_content(config: apps_config = Depends(get_config)):
    """Return a list of all files in the content directory, plus some useful system info."""

    content, content_details = apps_files.get_all_directory_contents()
    response = {"content": content,
                "content_details": content_details}

    return response
