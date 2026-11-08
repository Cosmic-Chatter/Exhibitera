"""Verify that every content file gets thumbnails of its own.

Thumbnails used to be named after the file without its extension, so photo.jpg and photo.png, or intro.mp4 and
intro.jpg, shared one thumbnail: whichever was viewed first supplied it for both, and deleting either deleted it.
Thumbnail names now include a hash of the full filename. Existing thumbnails are renamed at startup; one shared by
several files is deleted, since there's no telling whose it is, and each file's own is made when next needed.
"""

# Standard modules
import json
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.files as apps_files
import exhibitera.apps.features.legacy as apps_legacy
import exhibitera.common.config as ex_config

ARCHIVE = os.path.join("thumbnails", "v2", "thumbnail_archive.json")


@pytest.fixture
def apps_dir(tmp_path, monkeypatch):
    """Point user files at a temporary directory."""

    os.makedirs(tmp_path / "content")
    os.makedirs(tmp_path / "thumbnails" / "v2")
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    monkeypatch.setattr(apps_config, "thumbnail_archive", None)
    return tmp_path


def write(path, contents=b"thumb"):
    with open(path, "wb") as f:
        f.write(contents)


def read(path):
    with open(path, "rb") as f:
        return f.read()


def thumbs(tmp_path):
    return sorted(x for x in os.listdir(tmp_path / "thumbnails" / "v2") if x != "thumbnail_archive.json")


def write_archive(tmp_path, archive):
    with open(tmp_path / ARCHIVE, "w", encoding="UTF-8") as f:
        json.dump(archive, f)


def read_archive(tmp_path):
    with open(tmp_path / ARCHIVE, "r", encoding="UTF-8") as f:
        return json.load(f)


def name(filename, width=400, force_image=False):
    return apps_files.get_thumbnail_name(filename, force_image=force_image, width=width)


# Names

@pytest.mark.parametrize("first, second", [("photo.jpg", "photo.png"),
                                           # A video's still frame and an image
                                           ("intro.mp4", "intro.jpg"),
                                           ("Photo.jpg", "photo.jpg"),
                                           ("a_b.jpg", "a.b.jpg")])
def test_similar_files_get_their_own_thumbnails(first, second):
    assert name(first, force_image=True) != name(second, force_image=True)


def test_names_are_readable_and_say_the_size_and_kind():
    image = name("Lobby photo.jpg")
    video = name("intro.mp4")
    still = name("intro.mp4", force_image=True)

    assert image.startswith("Lobby photo_") and image.endswith("_400.png")
    assert video.startswith("intro_") and video.endswith("_400.mp4")
    assert still == video[:-4] + ".png"
    assert name("photo.jpg", width=240) == name("photo.jpg")[:-len("_400.png")] + "_240.png"


def test_long_filenames_give_names_the_filesystem_allows():
    assert len(name("x" * 250 + ".jpg", width=1920)) <= 255


def test_audio_and_models_still_use_the_standard_icons():
    assert name("song.mp3").endswith("audio_black.png")
    assert name("statue.glb").endswith("model_black.svg")


# File operations

def test_rename_moves_thumbnails_to_the_new_name(apps_dir):
    write(apps_dir / "content" / "intro.mp4")
    write(apps_dir / "thumbnails" / "v2" / name("intro.mp4"), b"preview")
    write(apps_dir / "thumbnails" / "v2" / name("intro.mp4", force_image=True), b"still")
    apps_files.update_thumbnail_archive("intro.mp4", 400, name("intro.mp4", force_image=True), False)
    apps_files.update_thumbnail_archive("intro.mp4", 400, name("intro.mp4"))

    assert apps_files.rename_file("intro.mp4", "welcome.mp4") == {"success": True}

    assert read_archive(apps_dir) == {"welcome.mp4": {"400": {"png": name("welcome.mp4", force_image=True),
                                                              "mp4": name("welcome.mp4")}}}
    assert read(apps_dir / "thumbnails" / "v2" / name("welcome.mp4")) == b"preview"
    assert read(apps_dir / "thumbnails" / "v2" / name("welcome.mp4", force_image=True)) == b"still"


def test_deleting_a_file_keeps_the_thumbnail_of_a_similar_one(apps_dir):
    for filename in ["photo.jpg", "photo.png"]:
        write(apps_dir / "content" / filename)
        write(apps_dir / "thumbnails" / "v2" / name(filename))
        apps_files.update_thumbnail_archive(filename, 400, name(filename))

    apps_files.delete_file("photo.png")

    assert thumbs(apps_dir) == [name("photo.jpg")]


# Migrating existing thumbnails

def test_existing_thumbnails_are_renamed(apps_dir):
    write(apps_dir / "thumbnails" / "v2" / "photo_400.png", b"photo")
    write(apps_dir / "thumbnails" / "v2" / "photo_240.png", b"small photo")
    write(apps_dir / "thumbnails" / "v2" / "intro_400.png", b"still")
    write(apps_dir / "thumbnails" / "v2" / "intro_400.mp4", b"preview")
    write_archive(apps_dir, {"photo.jpg": {"400": {"png": "photo_400.png"}, "240": {"png": "photo_240.png"}},
                             "intro.mp4": {"400": {"png": "intro_400.png", "mp4": "intro_400.mp4"}}})

    apps_legacy.migrate_thumbnail_names()

    assert read_archive(apps_dir) == {
        "photo.jpg": {"400": {"png": name("photo.jpg")}, "240": {"png": name("photo.jpg", width=240)}},
        "intro.mp4": {"400": {"png": name("intro.mp4", force_image=True), "mp4": name("intro.mp4")}}}
    assert read(apps_dir / "thumbnails" / "v2" / name("photo.jpg")) == b"photo"
    assert read(apps_dir / "thumbnails" / "v2" / name("photo.jpg", width=240)) == b"small photo"
    assert read(apps_dir / "thumbnails" / "v2" / name("intro.mp4", force_image=True)) == b"still"
    assert read(apps_dir / "thumbnails" / "v2" / name("intro.mp4")) == b"preview"
    assert len(thumbs(apps_dir)) == 4


def test_shared_thumbnails_are_deleted(apps_dir):
    write(apps_dir / "thumbnails" / "v2" / "photo_400.png")
    write(apps_dir / "thumbnails" / "v2" / "intro_400.png")
    write(apps_dir / "thumbnails" / "v2" / "intro_400.mp4", b"preview")
    write_archive(apps_dir, {"photo.jpg": {"400": {"png": "photo_400.png"}},
                             "photo.png": {"400": {"png": "photo_400.png"}},
                             "intro.mp4": {"400": {"png": "intro_400.png", "mp4": "intro_400.mp4"}},
                             "intro.jpg": {"400": {"png": "intro_400.png"}}})

    apps_legacy.migrate_thumbnail_names()

    # The video's preview was its own, so it's kept. The rest are made again when needed.
    assert read_archive(apps_dir) == {"intro.mp4": {"400": {"mp4": name("intro.mp4")}}}
    assert thumbs(apps_dir) == [name("intro.mp4")]


def test_migrating_again_changes_nothing(apps_dir):
    write(apps_dir / "thumbnails" / "v2" / "photo_400.png", b"photo")
    write_archive(apps_dir, {"photo.jpg": {"400": {"png": "photo_400.png"}}})

    apps_legacy.migrate_thumbnail_names()
    apps_config.thumbnail_archive = None  # As at the next startup
    apps_legacy.migrate_thumbnail_names()

    assert read_archive(apps_dir) == {"photo.jpg": {"400": {"png": name("photo.jpg")}}}
    assert read(apps_dir / "thumbnails" / "v2" / name("photo.jpg")) == b"photo"


def test_migration_finishes_after_being_interrupted(apps_dir):
    # The thumbnail was renamed, but the archive wasn't saved
    write(apps_dir / "thumbnails" / "v2" / name("photo.jpg"), b"photo")
    write_archive(apps_dir, {"photo.jpg": {"400": {"png": "photo_400.png"}},
                             "gone.jpg": {"400": {"png": "gone_400.png"}}})

    apps_legacy.migrate_thumbnail_names()

    # A thumbnail that's missing is dropped, and made again when needed
    assert read_archive(apps_dir) == {"photo.jpg": {"400": {"png": name("photo.jpg")}}}
    assert thumbs(apps_dir) == [name("photo.jpg")]


@pytest.mark.parametrize("contents", [None, '{"photo.jpg": '])
def test_migration_without_an_archive_does_nothing(apps_dir, contents):
    write(apps_dir / "thumbnails" / "v2" / "photo_400.png")
    if contents is not None:
        with open(apps_dir / ARCHIVE, "w", encoding="UTF-8") as f:
            f.write(contents)

    apps_legacy.migrate_thumbnail_names()

    assert thumbs(apps_dir) == ["photo_400.png"]
