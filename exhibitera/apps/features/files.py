"""System Helper functions for managing files"""

# Standard modules
import glob
import json
import logging
import os
import pathlib
import subprocess
from typing import Any
import zipfile

# Non-standard modules
import requests

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.apps.config as apps_config

ffmpeg_path: str
try:
    import pyffmpeg

    ffmpeg_path = pyffmpeg.FFmpeg().get_ffmpeg_bin()
except ModuleNotFoundError:
    ffmpeg_path = 'ffmpeg'


def path_safe(path: list[str]) -> bool:
    """Ensure the given path doesn't escape the Exhibitera Apps directory.

    `path` should be a list of directories, which should not include any path separators.
    """

    if len(path) == 0:
        return False

    if path[0] not in ['content', 'data', 'definitions', 'thumbnails']:
        return False

    for item in path:
        if not isinstance(item, str):
            return False
        for char in ['/', '\\', '<', '>', ':', '"', '|', '?', '*']:
            if char in item:
                return False
        if item in ['.', '..']:
            return False

    return True


def write_raw_text(data: str, name: str, mode: str = "a") -> tuple[bool, str]:
    """Write an un-formatted string to file"""

    if not ex_files.filename_safe(name):
        return False, "Invalid character in filename"

    file_path = ex_files.get_path(["data", name], user_file=True)
    success = True
    reason = ""

    if mode != "a" and mode != "w":
        return False, "Mode must be either 'a' (append, [default]) or 'w' (overwrite)"

    try:
        with apps_config.content_file_lock:
            with open(file_path, mode, encoding="UTF-8") as f:
                f.write(data + "\n")
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {file_path}"

    return success, reason


def get_raw_text(name: str) -> tuple[str, bool, str]:
    """Return the contents of a text file."""

    if not ex_files.filename_safe(name):
        return "", False, "Invalid character in filename"

    file_path = ex_files.get_path(["data", name], user_file=True)
    success = True
    reason = ""
    result = ""

    try:
        with apps_config.content_file_lock:
            with open(file_path, "r", encoding='UTF-8') as f:
                result = f.read()
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} not found."
    except PermissionError:
        success = False
        reason = f"You do not have read permission for the file {file_path}"

    return result, success, reason


def create_zip(zip_filename: str, files_to_zip: [str]) -> bool:
    """Create a zip archive of the given files"""

    zip_filename = ex_files.with_extension(zip_filename, 'zip')

    with zipfile.ZipFile(ex_files.get_path(["temp", zip_filename], user_file=True), 'w') as myzip:
        for file in files_to_zip:
            file_path = ex_files.get_path(["content", file], user_file=True)
            if os.path.exists(file_path):
                myzip.write(file_path, arcname=file)

    return True


def get_available_definitions(app_id: str = "all") -> dict[str, Any]:
    """Return all the *.json definition files that match the given app_id (or all of them)."""

    all_def = glob.glob(ex_files.get_path(["definitions"], user_file=True) + "/*.json")
    to_return = {}
    for path in all_def:
        json_def = load_json(path)
        if json_def is not None:
            try:
                if app_id == "all" or json_def["app"] == app_id:
                    to_return[json_def["uuid"]] = json_def
            except KeyError:
                print("Error: Key not found: 'app'")

    return to_return


def delete_file(file: str, absolute: bool = False):
    """Delete a file"""

    if absolute:
        file_path = file
    else:
        file_path = ex_files.get_path(["content", file], user_file=True)

    print("Deleting file:", file_path)
    with apps_config.content_file_lock:
        os.remove(file_path)

    load_thumbnail_archive()
    if file in apps_config.thumbnail_archive:
        for size_key in apps_config.thumbnail_archive[file]:
            for mimetype_key in apps_config.thumbnail_archive[file][size_key]:
                thumb_path_v2 = ex_files.get_path(["thumbnails", "v2", apps_config.thumbnail_archive[file][size_key][mimetype_key]], user_file=True)
                os.remove(thumb_path_v2)
        del apps_config.thumbnail_archive[file]

        # Write updated archive to disk
        archive_path = ex_files.get_path(["thumbnails", "v2", "thumbnail_archive.json"], user_file=True)
        with apps_config.thumbnail_lock:
            with open(archive_path, 'w', encoding='UTF-8') as f:
                json.dump(apps_config.thumbnail_archive, f, indent=2, sort_keys=True)


def rename_file(old_name: str, new_name: str, absolute: bool = False):
    """Rename the given file."""

    if absolute:
        old_path = old_name
        new_path = new_name
    else:
        old_path = ex_files.get_path(["content", old_name], user_file=True)
        new_path = ex_files.get_path(["content", new_name], user_file=True)

    # If there is already a file at new_path, fail so that we don't overwrite it.
    if os.path.exists(new_path):
        return {
            "success": False,
            "error": "file_exists",
            "reason": f"File {new_path} already exists."
        }

    load_thumbnail_archive()
    if old_name in apps_config.thumbnail_archive:
        apps_config.thumbnail_archive[new_name] = {}
        for size_key in apps_config.thumbnail_archive[old_name]:
            apps_config.thumbnail_archive[new_name][size_key] = {}
            for mimetype_key in apps_config.thumbnail_archive[old_name][size_key]:
                old_thumb_path_v2 = ex_files.get_path(
                    ["thumbnails", "v2", apps_config.thumbnail_archive[old_name][size_key][mimetype_key]], user_file=True)
                new_thumb_name = get_thumbnail_name(ex_files.with_extension(new_name, mimetype_key), width=size_key)
                new_thumb_path_v2 = ex_files.get_path(
                    ["thumbnails", "v2", new_thumb_name], user_file=True)
                try:
                    os.rename(old_thumb_path_v2, new_thumb_path_v2)
                    apps_config.thumbnail_archive[new_name][size_key][mimetype_key] = new_thumb_name
                except FileNotFoundError:
                    # Something went wrong, so we'll just drop this entry
                    pass
        del apps_config.thumbnail_archive[old_name]

        # Write updated archive to disk
        archive_path = ex_files.get_path(["thumbnails", "v2", "thumbnail_archive.json"], user_file=True)
        with apps_config.thumbnail_lock:
            with open(archive_path, 'w', encoding='UTF-8') as f:
                json.dump(apps_config.thumbnail_archive, f, indent=2, sort_keys=True)

    os.rename(old_path, new_path)
    return {"success": True}


def update_thumbnail_archive(filename: str, width: str | int, thumb_name: str, write: bool = True) -> None:
    """ Update the dict listing all filenames

    :param write: Write updated archive to disk.
    :param filename: The original name of the media file
    :param width: The width in pixels of the thumbnail
    :param thumb_name: The filename of the thumbnail (in the thumbnails/v2 directory)
    :return: None
    """

    load_thumbnail_archive()
    width = str(width)

    if filename not in apps_config.thumbnail_archive:
        apps_config.thumbnail_archive[filename] = {}
    if width not in apps_config.thumbnail_archive[filename]:
        apps_config.thumbnail_archive[filename][width] = {}
    if thumb_name.lower().endswith('.png'):
        apps_config.thumbnail_archive[filename][width]['png'] = thumb_name
    elif thumb_name.lower().endswith('.mp4'):
        apps_config.thumbnail_archive[filename][width]['mp4'] = thumb_name

    # Write updated archive to disk
    if write is True:
        archive_path = ex_files.get_path(["thumbnails", "v2", "thumbnail_archive.json"], user_file=True)
        with apps_config.thumbnail_lock:
            with open(archive_path, 'w', encoding='UTF-8') as f:
                json.dump(apps_config.thumbnail_archive, f, indent=2, sort_keys=True)


def load_thumbnail_archive() -> None:
    """
    Load the thumbnail archive, if needed.
    :return: None
    """

    if apps_config.thumbnail_archive is not None:
        return

    archive_path = ex_files.get_path(["thumbnails", "v2", "thumbnail_archive.json"], user_file=True)
    with apps_config.thumbnail_lock:
        if os.path.exists(archive_path):
            with open(archive_path, 'r', encoding='UTF-8') as f:
                apps_config.thumbnail_archive = json.load(f)
        else:
            apps_config.thumbnail_archive = {}


def create_definition_thumbnail(filename: str, width: int = 600) -> tuple[bool, str]:
    """Create a thumbnail for a definition."""

    try:
        file_path = ex_files.get_path(['content', filename], user_file=True)
        if not os.path.exists(file_path):
            return False, "file_does_not_exist"

        thumb_filename = ex_files.with_extension(filename, 'png')
        thumb_path = ex_files.get_path(['thumbnails', 'definitions', thumb_filename], user_file=True)

        proc = subprocess.Popen([ffmpeg_path, "-y", "-i", file_path, "-vf", f"scale={width}:-1", thumb_path])
        try:
            proc.communicate(timeout=3600)  # 1 hour
        except subprocess.TimeoutExpired:
            proc.kill()
    except OSError as e:
        print("create_definition_thumbnail: error:", e)
        return False, 'OSError'
    except ImportError as e:
        print("create_definition_thumbnail: error loading FFmpeg: ", e)
        return False, 'ImportError'

    return True, ""

def create_thumbnail(filename: str,
                     mimetype: str,
                     block: bool = False,
                     width: int = 400) -> tuple[bool, str]:
    """Create a thumbnail from the given media file and add it to the thumbnails directory.

    If the input is an image, a png is created. If the input is a video, a short preview mp4 and a
    png are created.

    Set block=True to block the calling thread when creating thumbnails.
    """

    file_path = ex_files.get_path(['content', filename], user_file=True)
    if not os.path.exists(file_path):
        return False, "file_does_not_exist"

    try:
        if mimetype == "image":
            thumb_filename = get_thumbnail_name(filename, width=width)
            thumb_path = ex_files.get_path(['thumbnails', 'v2', thumb_filename], user_file=True)

            proc = subprocess.Popen([ffmpeg_path, "-y", "-i", file_path, "-vf", f"scale={width}:-1", thumb_path])
            if block:
                try:
                    proc.communicate(timeout=3600)  # 1 hour
                except subprocess.TimeoutExpired:
                    proc.kill()
            update_thumbnail_archive(filename, width, thumb_filename)
        elif mimetype == "video":
            thumb_filename_image = get_thumbnail_name(filename, width=width, force_image=True)
            thumb_filename_video = get_thumbnail_name(filename, width=width)
            thumb_path_image = ex_files.get_path(['thumbnails', 'v2', thumb_filename_image], user_file=True)
            thumb_path_video = ex_files.get_path(['thumbnails', 'v2', thumb_filename_video], user_file=True)

            # First, find the length of the video
            _, video_details = get_video_file_details(filename)
            duration_sec = round(video_details.get('duration', 0))
            if duration_sec == 0:
                return False, "video has no duration"

            # Then, create the video thumbnail
            proc = subprocess.Popen([ffmpeg_path, "-y", "-i", file_path,
                                     "-filter:v",
                                     f'fps=1,setpts=({min(duration_sec, 10)}/{duration_sec})*PTS,scale={width}:-2',
                                     "-an", thumb_path_video])
            if block:
                try:
                    proc.communicate(timeout=3600)  # 1 hour
                except subprocess.TimeoutExpired:
                    proc.kill()
            # Finally, create the image thumbnail from the halfway point
            proc = subprocess.Popen([ffmpeg_path, "-y", '-ss', str(round(duration_sec / 2)), '-i', file_path,
                                     '-vframes', '1', "-vf", f"scale={width}:-1", thumb_path_image])
            if block:
                try:
                    proc.communicate(timeout=3600)  # 1 hour
                except subprocess.TimeoutExpired:
                    proc.kill()
            update_thumbnail_archive(filename, width, thumb_filename_image, False)
            update_thumbnail_archive(filename, width, thumb_filename_video)
    except OSError as e:
        print("create_thumbnail: error:", e)
        return False, 'OSError'
    except ImportError as e:
        print("create_thumbnail: error loading FFmpeg: ", e)
        return False, 'ImportError'

    return True, ""


def create_definition_thumbnail_video_from_frames(frames: list, filename: str, duration: float = 5) -> bool:
    """Take a list of image filenames and use FFmpeg to turn it into a video thumbnail."""

    output_path = ex_files.get_path(['thumbnails', 'definitions', ex_files.with_extension(filename, 'mp4')], user_file=True)
    fps = len(frames) / duration

    # First, render each file in a consistent format
    count = 0
    for i, frame in enumerate(frames):
        if not ex_files.is_url(frame):
            thumb_path, _ = get_thumbnail(frame, force_image=True)
            command = [ffmpeg_path, '-y', '-i', thumb_path, '-vf',
                       'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
                       '-pix_fmt', 'yuv420p',
                       ex_files.get_path(["thumbnails", '__tempOutput_' + str(i).rjust(4, '0') + '.png'], user_file=True)]
            process = subprocess.Popen(command)
            process.communicate()
            count += 1

    # Then, stitch them together into a slideshow
    if count > 0:
        command = [ffmpeg_path, '-y', '-r', str(fps),
                   '-i', ex_files.get_path(["thumbnails", '__tempOutput_%04d.png'], user_file=True),
                   '-c:v', 'libx264', '-pix_fmt', 'yuv420p', "-vf", "scale=400:-2", output_path]
        process = subprocess.Popen(command)
        process.communicate()

        # Finally, delete the temp files
        for i in range(len(frames)):
            os.remove(ex_files.get_path(["thumbnails", '__tempOutput_' + str(i).rjust(4, '0') + '.png'], user_file=True))

    return True


def get_video_file_details(filename: str) -> tuple[bool, dict[str, Any]]:
    """Use FFmpeg to probe the given video file and return useful information."""

    details = {}
    success = True

    try:
        file_path = ex_files.get_path(['content', filename], user_file=True)
        pipe = subprocess.Popen([ffmpeg_path, "-i", file_path], stderr=subprocess.PIPE, encoding="UTF-8")
        ffmpeg_text = pipe.stderr.read()

        # Duration
        duration_index = ffmpeg_text.find("Duration")
        duration_str = ffmpeg_text[duration_index + 10: duration_index + 21]  # Format: HH:MM:SS.SS
        duration_split = duration_str.split(":")
        duration_sec = int(duration_split[0]) * 3600 + int(duration_split[1]) * 60 + float(duration_split[2])
        details['duration'] = duration_sec
        details['duration_str'] = duration_str

        # FPS
        fps_index = ffmpeg_text.find("fps")
        # Search backwards for a string of the form ' NN.NN '
        num_space = 0
        search_index = fps_index - 1
        while num_space < 2:
            if ffmpeg_text[search_index] == ' ':
                num_space += 1
            search_index -= 1

        fps_str = ffmpeg_text[search_index + 1: fps_index].strip()
        details['fps'] = float(fps_str)

    except OSError as e:
        print("get_video_file_details: error:", e)
        success = False
    except ImportError as e:
        print("get_video_file_details: error loading FFmpeg: ", e)
        success = False
    except ValueError as e:
        print("get_video_file_details: value error: ", e)
        success = False

    return success, details


def convert_video_to_frames(filename: str, file_type: str = 'jpg'):
    """Use FFmpeg to convert the given video file to a set of frames in the specified image format."""

    success = True

    if file_type not in ['jpg', 'png', 'webp']:
        raise ValueError('file_type must be one of "jpg", "png", "webp"')
    try:
        input_path = ex_files.get_path(['content', filename], user_file=True)
        output_path = '.'.join(input_path.split('.')[0:-1]).replace(" ", "_") + '_%06d.' + file_type
        if file_type == 'jpg':
            args = [ffmpeg_path, "-i", input_path, "-qscale:v", "4", output_path]
        elif file_type == 'png':
            args = [ffmpeg_path, "-i", input_path, output_path]
        else:
            args = [ffmpeg_path, "-i", input_path, "-quality", "90", output_path]

        process = subprocess.Popen(args, stderr=subprocess.PIPE, encoding="UTF-8")
        process.communicate(timeout=3600) # Make this blocking

    except OSError as e:
        print("convert_video_to_frame: error:", e)
        success = False
    except ImportError as e:
        print("convert_video_to_frame: error loading FFmpeg: ", e)
        success = False
    except subprocess.TimeoutExpired as e:
        print("convert_video_to_frame: conversion timed out: ", e)
        success = False

    return success


def get_thumbnail_name(filename: str, force_image: bool = False, width: str | int = "400") -> str:
    """Return the filename converted to the appropriate Exhibitera thumbnail format.

    force_image = True returns a png thumbnail regardless of if the media is an image or video
    """

    width = str(width)
    mimetype = ex_files.get_mimetype(filename)

    if mimetype == "audio":
        return ex_files.get_path(["_static", "icons", "audio_black.png"])
    elif mimetype == "image" or force_image is True:
        return pathlib.Path(filename).stem + '_' + str(width) + '.png'
    elif mimetype == "model":
        return ex_files.get_path(["_static", "icons", "model_black.svg"])
    elif mimetype == "video":
        return pathlib.Path(filename).stem + '_' + str(width) + '.mp4'

    return ""


def get_thumbnail(filename: str,
                  force_image: bool = False,
                  width: int | str = "400") -> (str | None, str):
    """Check the thumbnails directory for a file corresponding to the given filename and return its path and mimetype.

    force_image=True returns a png thumbnail even for videos.
    """

    thumb_name = get_thumbnail_name(filename, force_image=force_image, width=width)
    mimetype = ex_files.get_mimetype(filename)
    if mimetype == "":
        if ex_config.debug:
            print(f"get_thumbnail: bad mimetype {mimetype} for file {filename}")
        return None, ''

    if thumb_name == "":
        print(f"get_thumbnail: thumbnail name is blank.")
        return None, mimetype

    thumb_path = ex_files.get_path(["thumbnails", "v2", thumb_name], user_file=True)
    if not os.path.exists(thumb_path):
        create_thumbnail(filename, mimetype, block=True, width=width)

    return thumb_path, mimetype


def get_definition_thumbnail(uuid_str: str) -> tuple[str, str]:
    """Retrieve the thumbnail for the given definition or a default one."""

    thumbs = get_directory_contents(['thumbnails', 'definitions'])
    matches = [x for x in thumbs if uuid_str in x]

    if len(matches) > 0:
        thumb_path = ex_files.get_path(['thumbnails', 'definitions', matches[0]], user_file=True)
        return thumb_path, ex_files.get_mimetype(thumb_path)

    # Need to find a default image
    def_path = ex_files.get_path(["definitions", ex_files.with_extension(uuid_str, 'json')], user_file=True)
    definition = load_json(def_path)
    if definition is None:
        app = "document_missing"
    else:
        app = definition.get("app", "document_missing_black")
    if app == 'other':
        app = 'document_missing_black'
    return ex_files.get_path(["_static", "icons", ex_files.with_extension(app, "svg")]), 'image'


def create_missing_thumbnails() -> None:
    """Check the content directory for files without thumbnails and create them."""

    content, content_details = get_all_directory_contents("content")

    for file in content:
        file_path, mimetype = get_thumbnail(file)
        if file_path is None:
            create_thumbnail(file, mimetype)


def get_all_directory_contents(directory: str = "content") -> tuple[list, list[dict[str, Any]]]:
    """Recursively search for files in the content directory and its subdirectories"""

    content_path = ex_files.get_path([directory], user_file=True)
    result = [os.path.relpath(os.path.join(dp, f), content_path) for dp, dn, fn in os.walk(content_path) for f in fn]
    content = [x for x in result if x.find(".DS_Store") == -1]
    content_details = []

    for file in content:
        file_details = {
            'name': file
        }
        path = ex_files.get_path(["content", file], user_file=True)
        file_size, size_text = ex_files.get_file_size(path)
        file_details['size'] = file_size
        file_details['size_text'] = size_text
        content_details.append(file_details)

    return content, content_details


def get_directory_contents(directory: list[str]) -> list:
    """Return the contents of a directory."""

    content_path = ex_files.get_path(directory, user_file=True)
    contents = os.listdir(content_path)
    return [x for x in contents if x[0] != "."]  # Don't return hidden files


def check_directory_structure():
    """Make sure the appropriate content directories are present and create them if they are not."""

    dir_list = ["configuration", "content", "data", "definitions", "static", "temp", "thumbnails"]

    for directory in dir_list:
        content_path = ex_files.get_path([directory], user_file=True)
        try:
            os.listdir(content_path)
        except FileNotFoundError:
            print(f"Warning: {directory} directory not found. Creating it...")

            try:
                os.mkdir(content_path)
            except PermissionError:
                print("Error: unable to create directory. Do you have write permission?")

    sub_dirs = [ex_files.get_path(["thumbnails", "v2"], user_file=True),
                ex_files.get_path(["thumbnails", "definitions"], user_file=True)
                ]
    for sub_dir in sub_dirs:
        try:
            os.listdir(sub_dir)
        except FileNotFoundError:
            os.mkdir(sub_dir)


def download_file(url: str, path_to_save: str) -> bool:
    """Download the file at the given url and save it to disk."""

    with apps_config.content_file_lock:
        try:
            with requests.get(url, stream=True, timeout=2) as r:
                try:
                    # Check that we received a good response
                    r.raise_for_status()
                except requests.HTTPError:
                    return False

                with open(path_to_save, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
        except requests.exceptions.ReadTimeout:
            print("download_file: timeout retrieving ", url)
            return False

    return True


# Set up log file
log_path: str = ex_files.get_path(["apps.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
