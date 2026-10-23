"""Verify that Apps saves the thumbnail archive through ex_files.write_json(), which writes atomically."""

# Standard modules
import json
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.files as apps_files
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files

ARCHIVE = os.path.join("thumbnails", "v2", "thumbnail_archive.json")


@pytest.fixture
def apps_dir(tmp_path, monkeypatch):
    """Point user files at a temporary directory and record every write_json() call."""

    os.makedirs(tmp_path / "content")
    os.makedirs(tmp_path / "thumbnails" / "v2")
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    monkeypatch.setattr(apps_config, "thumbnail_archive", None)

    writes = []
    real_write_json = ex_files.write_json

    def recording_write_json(data, path, *args, **kwargs):
        writes.append(os.path.relpath(path, tmp_path))
        return real_write_json(data, path, *args, **kwargs)

    monkeypatch.setattr(ex_files, "write_json", recording_write_json)
    return tmp_path, writes


def read_archive(tmp_path):
    with open(tmp_path / ARCHIVE, "r", encoding="UTF-8") as f:
        return json.load(f)


def create(path, contents=b"test"):
    with open(path, "wb") as f:
        f.write(contents)


def test_update_thumbnail_archive(apps_dir):
    tmp_path, writes = apps_dir

    apps_files.update_thumbnail_archive("photo.jpg", 400, "photo_400.png")

    assert writes == [ARCHIVE]
    assert read_archive(tmp_path) == {"photo.jpg": {"400": {"png": "photo_400.png"}}}


def test_delete_file_updates_archive(apps_dir):
    tmp_path, writes = apps_dir
    create(tmp_path / "content" / "photo.jpg")
    create(tmp_path / "thumbnails" / "v2" / "photo_400.png")
    apps_files.update_thumbnail_archive("photo.jpg", 400, "photo_400.png")
    writes.clear()

    apps_files.delete_file("photo.jpg")

    assert writes == [ARCHIVE]
    assert read_archive(tmp_path) == {}
    assert not os.path.exists(tmp_path / "thumbnails" / "v2" / "photo_400.png")


def test_rename_file_updates_archive(apps_dir):
    tmp_path, writes = apps_dir
    create(tmp_path / "content" / "photo.jpg")
    create(tmp_path / "thumbnails" / "v2" / "photo_400.png")
    apps_files.update_thumbnail_archive("photo.jpg", 400, "photo_400.png")
    writes.clear()

    assert apps_files.rename_file("photo.jpg", "landscape.jpg") == {"success": True}

    assert writes == [ARCHIVE]
    assert read_archive(tmp_path) == {"landscape.jpg": {"400": {"png": "landscape_400.png"}}}
    assert os.path.exists(tmp_path / "thumbnails" / "v2" / "landscape_400.png")


# Loading

def test_load_thumbnail_archive_reads_saved_archive(apps_dir, monkeypatch):
    tmp_path, _ = apps_dir
    with open(tmp_path / ARCHIVE, "w", encoding="UTF-8") as f:
        json.dump({"photo.jpg": {"400": {"png": "photo_400.png"}}}, f)
    loads = []
    real_load_json = ex_files.load_json
    monkeypatch.setattr(ex_files, "load_json", lambda path: loads.append(path) or real_load_json(path))

    apps_files.load_thumbnail_archive()

    assert len(loads) == 1
    assert apps_config.thumbnail_archive == {"photo.jpg": {"400": {"png": "photo_400.png"}}}


@pytest.mark.parametrize("contents", [None, "", '{"photo.jpg": '])
def test_missing_or_damaged_archive_starts_empty(apps_dir, contents):
    tmp_path, _ = apps_dir
    if contents is not None:
        with open(tmp_path / ARCHIVE, "w", encoding="UTF-8") as f:
            f.write(contents)

    apps_files.load_thumbnail_archive()

    assert apps_config.thumbnail_archive == {}


def test_damaged_archive_does_not_break_file_operations(apps_dir):
    tmp_path, _ = apps_dir
    with open(tmp_path / ARCHIVE, "w", encoding="UTF-8") as f:
        f.write('{"photo.jpg": ')
    create(tmp_path / "content" / "photo.jpg")

    assert apps_files.rename_file("photo.jpg", "landscape.jpg") == {"success": True}
    assert os.path.exists(tmp_path / "content" / "landscape.jpg")
