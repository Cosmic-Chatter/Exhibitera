"""System Helper functions for managing files"""

# Standard modules
import csv
import glob
import io
import json
import logging
import os
import subprocess
import sys
import threading
from typing import Any, Union

# Non-standard imports
import mimetypes

ffmpeg_path: str
try:
    import pyffmpeg

    ffmpeg_path = pyffmpeg.FFmpeg().get_ffmpeg_bin()
except ModuleNotFoundError:
    ffmpeg_path = 'ffmpeg'

# Exhibitera modules
import config


def get_path(path_list: list[str], user_file: bool = False) -> str:
    """Return a path that takes into account whether the app has been packaged by Pyinstaller"""

    _path = os.path.join(config.application_path, *path_list)
    if getattr(sys, 'frozen', False) and not user_file:
        # Handle the case of a Pyinstaller --onefile binary
        _path = os.path.join(config.exec_path, *path_list)

    return _path


def filename_safe(filename: str) -> bool:
    """Ensure the filename doesn't escape to another directory or is malformed.

    Note that this should not be used on paths, which will obviously include some
    of these cases.
    """

    if not isinstance(filename, str):
        return False
    for char in ['/', '\\', '<', '>', ':', '"', '|', '?', '*']:
        if char in filename:
            return False
    if filename.strip() in ['', '.', '..']:
        return False
    return True


def load_json(path: str):
    """Load the requested JSON file from disk and return it as a dictionary."""

    if not os.path.exists(path):
        if config.debug:
            print(f"load_json: file does not exist: {path}")
        return None

    with config.content_file_lock:
        with open(path, 'r', encoding='UTF-8') as f:
            try:
                result = json.load(f)
            except json.decoder.JSONDecodeError:
                result = None
            return result


def write_json(data: dict, path: str | os.PathLike, append: bool = False, compact: bool = False) -> tuple[bool, str]:
    """Take the given object and try to write it to a JSON file.

    Setting compact=True will print the dictionary on one line.
    """

    success = True
    reason = ""
    """Clear out an extraneous property being set in the frontend. """
    if 's' in data:
        del data['s']

    if append:
        mode = 'a'
    else:
        mode = 'w'

    try:
        with config.content_file_lock:
            with open(path, mode, encoding='UTF-8') as f:
                if compact:
                    json_str = json.dumps(data, sort_keys=True)
                    f.write(json_str + "\n")
                else:
                    json_str = json.dumps(data, indent=2, sort_keys=True)
                    f.write(json_str + "\n")
    except TypeError:
        success = False
        reason = "Data is not JSON serializable"
    except FileNotFoundError:
        success = False
        reason = f"File {path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {path}"

    return success, reason


def write_raw_text(data: str, name: str, mode: str = "a") -> tuple[bool, str]:
    """Write an un-formatted string to file"""

    if not filename_safe(name):
        return False, "Invalid character in filename"

    file_path = get_path(["data", name], user_file=True)
    success = True
    reason = ""

    if mode != "a" and mode != "w":
        return False, "Mode must be either 'a' (append, [default]) or 'w' (overwrite)"

    try:
        with config.content_file_lock:
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

    if not filename_safe(name):
        return "", False, "Invalid character in filename"

    file_path = get_path(["data", name], user_file=True)
    success = True
    reason = ""
    result = ""

    try:
        with config.content_file_lock:
            with open(file_path, "r", encoding='UTF-8') as f:
                result = f.read()
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} not found."
    except PermissionError:
        success = False
        reason = f"You do not have read permission for the file {file_path}"

    return result, success, reason


def create_csv(file_path: str | os.PathLike, filename: str = "") -> str:
    """Load a data file and convert it to a CSV"""

    dict_list = []
    try:
        with open(file_path, 'r', encoding="UTF-8") as f:
            for line in f.readlines():
                dict_list.append(json.loads(line))
    except FileNotFoundError:
        return ""
    return json_list_to_csv(dict_list, filename=filename)


def json_list_to_csv(dict_list: list, filename: str = "") -> str:
    """Convert a list JSON dicts to a comma-separated string"""

    # First, identify any keys that have lists as their value
    all_keys = {}
    keys = get_unique_keys(dict_list)
    for key in keys:
        # This function will return an empty list if the value is not a list,
        # and a list of all unique values if it is.
        unique_keys = get_unique_values(dict_list, key)
        if len(unique_keys) > 0:
            all_keys[key] = unique_keys
        else:
            all_keys[key] = None

    # Next, reformat the dict_list so that keys with a list have those values
    # flattened into the main dict level
    reformed_dict_list = []
    for this_dict in dict_list:
        new_dict = {}
        for key, value in this_dict.items():
            if all_keys[key] is None:  # Simple key
                value_to_write = this_dict[key]
                if isinstance(value_to_write, str):
                    value_to_write = value_to_write.replace("\n", " ")
                new_dict[key] = value_to_write
            else:
                for sub_key in all_keys[key]:
                    new_dict[key + " - " + sub_key] = sub_key in this_dict[key]
        reformed_dict_list.append(new_dict)

    # Build the CSV, optionally write it to disk, and then return it
    try:
        with io.StringIO(newline='') as f:
            csv_writer = csv.DictWriter(f, get_unique_keys(reformed_dict_list))
            csv_writer.writeheader()
            csv_writer.writerows(reformed_dict_list)
            result = f.getvalue()
    except IndexError:
        print("JSON_list_to_CSV: Error: Nothing to write")
        result = ""

    if filename != "":
        with open(filename, 'w', encoding="UTF-8", newline="") as f:
            f.write(result)
    return result


def get_unique_keys(dict_list: list) -> list:
    """Return a set of unique keys from a list of dicts, sorted for consistency."""

    return sorted(list(set().union(*(d.keys() for d in dict_list))))


def get_unique_values(dict_list: list, key: str) -> list:
    """For a given key, search the list of dicts for all unique values, expanding lists."""

    unique_values = set()

    for this_dict in dict_list:
        if key in this_dict and isinstance(this_dict[key], list):
            for value in this_dict[key]:
                unique_values.add(value)

    return list(unique_values)


def get_available_data() -> list[str]:
    """Return a list of files in the /data directory."""

    return os.listdir(get_path(['data'], user_file=True))


def get_available_definitions(app_id: str = "all") -> dict[str, Any]:
    """Return all the *.json definition files that match the given app_id (or all of them)."""

    all_def = glob.glob(get_path(["definitions"], user_file=True) + "/*.json")
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


def with_extension(filename: str, ext: str) -> str:
    """Return the filename with the current extension replaced by the given one"""

    if ext.startswith("."):
        ext = ext[1:]

    return os.path.splitext(filename)[0] + "." + ext


def delete_file(file: str, absolute: bool = False):
    """Delete a file"""

    if absolute:
        file_path = file
    else:
        file_path = get_path(["content", file], user_file=True)

    print("Deleting file:", file_path)
    with config.content_file_lock:
        os.remove(file_path)

    thumb_path, _ = get_thumbnail(file)
    if thumb_path is not None and os.path.exists(thumb_path):
        with config.content_file_lock:
            os.remove(thumb_path)


def rename_file(old_name: str, new_name: str, absolute: bool = False):
    """Rename the given file."""

    if absolute:
        old_path = old_name
        new_path = new_name
    else:
        old_path = get_path(["content", old_name], user_file=True)
        new_path = get_path(["content", new_name], user_file=True)

    # If there is already a file at new_path, fail so that we don't overwrite it.
    if os.path.exists(new_path):
        return {
            "success": False,
            "error": "file_exists",
            "reason": f"File {new_path} already exists."
        }

    thumb_path, _ = get_thumbnail(old_name)

    print(f"Renaming file {old_path} to {new_path}")
    logging.info("Renaming file %s to %s", old_path, new_path)

    try:
        with config.content_file_lock:
            os.rename(old_path, new_path)
            if thumb_path is not None:
                new_thumb = get_thumbnail_name(new_name)
                new_thumb_path = get_path(["thumbnails", new_thumb], user_file=True)
                os.rename(thumb_path, new_thumb_path)
    except FileExistsError:
        return {
            "success": False,
            "error": "file_exists",
            "reason": f"File {new_path} already exists."
        }
    except FileNotFoundError:
        return {
            "success": False,
            "error": "file_not_found",
            "reason": f"File {old_path} does not exist."
        }
    return {"success": True}


def create_thumbnail(filename: str, mimetype: str, block: bool = False, width: int = 400) -> tuple[bool, str]:
    """Create a thumbnail from the given media file and add it to the thumbnails directory.

    If the input is an image, a jpg is created. If the input is a video, a short preview mp4 and a
    jpg are created.

    Set block=True to block the calling thread when creating thumbnails.
    """

    try:
        if mimetype == "image":
            proc = subprocess.Popen([ffmpeg_path, "-y",
                                     "-i", get_path(['content', filename], user_file=True),
                                     "-vf", f"scale={width}:-1",
                                     get_path(['thumbnails', with_extension(filename, 'jpg')], user_file=True)])
            if block:
                try:
                    proc.communicate(timeout=3600)  # 1 hour
                except subprocess.TimeoutExpired:
                    proc.kill()
        elif mimetype == "video":
            # First, find the length of the video
            _, video_details = get_video_file_details(filename)
            duration_sec = round(video_details["duration"])
            file_path = get_path(['content', filename], user_file=True)

            # Then, create the video thumbnail
            proc = subprocess.Popen([ffmpeg_path, "-y", "-i", file_path,
                                     "-filter:v",
                                     f'fps=1,setpts=({min(duration_sec, 10)}/{duration_sec})*PTS,scale={width}:-2',
                                     "-an",
                                     get_path(['thumbnails', with_extension(filename, 'mp4')], user_file=True)])
            if block:
                try:
                    proc.communicate(timeout=3600)  # 1 hour
                except subprocess.TimeoutExpired:
                    proc.kill()
            # Finally, create the image thumbnail from the halfway point
            proc = subprocess.Popen([ffmpeg_path, "-y", '-ss', str(round(duration_sec / 2)), '-i', file_path,
                                     '-vframes', '1', "-vf", f"scale={width}:-1",
                                     get_path(['thumbnails', with_extension(filename, 'jpg')], user_file=True)])
            if block:
                try:
                    proc.communicate(timeout=3600)  # 1 hour
                except subprocess.TimeoutExpired:
                    proc.kill()
    except OSError as e:
        print("create_thumbnail: error:", e)
        return False, 'OSError'
    except ImportError as e:
        print("create_thumbnail: error loading FFmpeg: ", e)
        return False, 'ImportError'

    return True, ""


def is_url(filename: str) -> bool:
    """Identify if the given filename is an url."""

    filename = filename.lower()
    if filename.startswith("http://") or filename.startswith("https://"):
        return True
    return False


def create_thumbnail_video_from_frames(frames: list, filename: str, duration: float = 5) -> bool:
    """Take a list of image filenames and use FFmpeg to turn it into a video thumbnail."""

    output_path = get_path(['thumbnails', with_extension(filename, 'mp4')], user_file=True)
    fps = len(frames) / duration

    # First, render each file in a consistent format
    count = 0
    for i, frame in enumerate(frames):
        if is_url(frame) is False:
            thumb_path, _ = get_thumbnail(frame, force_image=True)
            command = [ffmpeg_path, '-y', '-i', thumb_path, '-vf',
                       'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
                       '-pix_fmt', 'yuv420p',
                       get_path(["thumbnails", '__tempOutput_' + str(i).rjust(4, '0') + '.png'], user_file=True)]
            process = subprocess.Popen(command)
            process.communicate()
            count += 1

    # Then, stitch them together into a slideshow
    if count > 0:
        command = [ffmpeg_path, '-y', '-r', str(fps),
                   '-i', get_path(["thumbnails", '__tempOutput_%04d.png'], user_file=True),
                   '-c:v', 'libx264', '-pix_fmt', 'yuv420p', "-vf", "scale=400:-2", output_path]
        process = subprocess.Popen(command)
        process.communicate()

        # Finally, delete the temp files
        for i in range(len(frames)):
            os.remove(get_path(["thumbnails", '__tempOutput_' + str(i).rjust(4, '0') + '.png'], user_file=True))

    return True


def get_video_file_details(filename: str) -> tuple[bool, dict[str, Any]]:
    """Use FFmpeg to probe the given video file and return useful information."""

    details = {}
    success = True

    try:
        file_path = get_path(['content', filename], user_file=True)
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

    return success, details


def convert_video_to_frames(filename: str, file_type: str = 'jpg'):
    """Use FFmpeg to convert the given video file to a set of frames in the specified image format."""

    success = True

    if file_type not in ['jpg', 'png', 'webp']:
        raise ValueError('file_type must be one of "jpg", "png", "webp"')
    try:
        input_path = get_path(['content', filename], user_file=True)
        output_path = '.'.join(input_path.split('.')[0:-1]).replace(" ", "_") + '_%06d.' + file_type
        if file_type == 'jpg':
            args = [ffmpeg_path, "-i", input_path, "-qscale:v", "4", output_path]
        elif file_type == 'png':
            args = [ffmpeg_path, "-i", input_path, output_path]
        else:
            args = [ffmpeg_path, "-i", input_path, "-quality", "90", output_path]

        process = subprocess.Popen(args, stderr=subprocess.PIPE, encoding="UTF-8")
        th = threading.Thread(target=_create_thumbnails_for_converted_video, args=[process], daemon=True)
        th.start()

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


def _create_thumbnails_for_converted_video(process: subprocess.Popen):
    """Join the given process and create thumbnails when it is complete."""

    try:
        process.communicate(timeout=3600)
    except subprocess.TimeoutExpired as e:
        print("convert_video_to_frame: conversion timed out: ", e)
        pass
    create_missing_thumbnails()


def get_thumbnail_name(filename: str, force_image=False) -> str:
    """Return the filename converted to the appropriate Exhibitera thumbnail format.

    force_image = True returns a jpg thumbnail regardless of if the media is an image or video
    """

    mimetype, _ = mimetypes.guess_type(filename)
    try:
        mimetype = mimetype.split("/")[0]
    except AttributeError:
        if filename[-5:].lower() == '.webp':
            mimetype = 'image'
        else:
            return ""
    if mimetype == "audio":
        return get_path(["_static", "icons", "audio_black.png"])
    elif mimetype == "image" or force_image is True:
        return with_extension(filename, "jpg")
    elif mimetype == "video":
        return with_extension(filename, "mp4")

    return ""


def get_thumbnail(filename: str, force_image=False) -> (Union[str, None], str):
    """Check the thumbnails directory for a file corresponding to the given filename and return its path and mimetype.

    force_image=True returns a jpg thumbnail even for videos.
    """

    thumb_name = get_thumbnail_name(filename)
    mimetype, _ = mimetypes.guess_type(filename)

    try:
        mimetype = mimetype.split("/")[0]
    except AttributeError:
        if filename[-5:].lower() == '.webp':
            mimetype = 'image'
        else:
            print(f"get_thumbnail: bad mimetype {mimetype} for file {filename}")
            return None, ''

    if thumb_name == "":
        print(f"get_thumbnail: thumbnail name is blank.")
        return None, mimetype

    thumb_path = get_path(["thumbnails", thumb_name], user_file=True)

    if not os.path.exists(thumb_path):
        print(f"get_thumbnail: thumbnail does not exist.")
        return None, mimetype

    return thumb_path, mimetype


def create_missing_thumbnails():
    """Check the content directory for files without thumbnails and create them"""

    content = get_all_directory_contents("content")

    for file in content:
        file_path, mimetype = get_thumbnail(file)
        if file_path is None:
            create_thumbnail(file, mimetype)


def get_all_directory_contents(directory: str = "content") -> list:
    """Recursively search for files in the content directory and its subdirectories"""
    content_path = get_path([directory], user_file=True)
    result = [os.path.relpath(os.path.join(dp, f), content_path) for dp, dn, fn in os.walk(content_path) for f in fn]

    return [x for x in result if x.find(".DS_Store") == -1]


def get_directory_contents(directory: str, absolute: bool = False) -> list:
    """Return the contents of a directory."""

    if absolute:
        contents = os.listdir(directory)
    else:
        content_path = get_path([directory], user_file=True)
        contents = os.listdir(content_path)
    return [x for x in contents if x[0] != "."]  # Don't return hidden files


def check_directory_structure():
    """Make sure the appropriate content directories are present and create them if they are not."""

    dir_list = ["configuration", "content", "data", "definitions", "static", "thumbnails"]

    for directory in dir_list:
        content_path = get_path([directory], user_file=True)
        try:
            os.listdir(content_path)
        except FileNotFoundError:
            print(f"Warning: {directory} directory not found. Creating it...")

            try:
                os.mkdir(content_path)
            except PermissionError:
                print("Error: unable to create directory. Do you have write permission?")


# Set up log file
log_path: str = get_path(["apps.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
