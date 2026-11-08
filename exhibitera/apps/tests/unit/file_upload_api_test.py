"""Verify how Apps saves uploaded files.

Files with names that aren't allowed are skipped, and the reply lists them so the file picker can say so; the upload
used to report plain success. Uploading over an existing file removes its thumbnails, which are made again from the
new file; the old thumbnails used to be shown forever.
"""

# Standard modules
import io
import json
import os

# Third-party modules
from fastapi import UploadFile
import pytest

# Exhibitera modules
import exhibitera.apps.api.internal.files.files as files_api
import exhibitera.apps.config as apps_config
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


def upload(*names: str, contents: bytes = b"new"):
    files = [UploadFile(file=io.BytesIO(contents), filename=name) for name in names]
    return files_api.upload_files(files=files, path=["content"], config=None)


def write(path, contents=b"old"):
    with open(path, "wb") as f:
        f.write(contents)


def test_upload_saves_files(apps_dir):
    assert upload("moth.jpg", "zebra.jpg") == {"success": True, "skipped": []}
    assert sorted(os.listdir(apps_dir / "content")) == ["moth.jpg", "zebra.jpg"]


def test_files_with_names_that_arent_allowed_are_listed(apps_dir):
    assert upload("moth.jpg", "../escape.jpg") == {"success": True, "skipped": ["../escape.jpg"]}
    assert os.listdir(apps_dir / "content") == ["moth.jpg"]
    assert not os.path.exists(apps_dir / "escape.jpg")


def test_replacing_a_file_removes_its_old_thumbnails(apps_dir):
    write(apps_dir / "content" / "photo.jpg")
    write(apps_dir / "thumbnails" / "v2" / "photo_400.png")
    write(apps_dir / "thumbnails" / "v2" / "photo_240.png")
    write(apps_dir / "content" / "other.jpg")
    write(apps_dir / "thumbnails" / "v2" / "other_400.png")
    with open(apps_dir / ARCHIVE, "w", encoding="UTF-8") as f:
        json.dump({"photo.jpg": {"400": {"png": "photo_400.png"}, "240": {"png": "photo_240.png"}},
                   "other.jpg": {"400": {"png": "other_400.png"}}}, f)

    assert upload("photo.jpg") == {"success": True, "skipped": []}

    with open(apps_dir / "content" / "photo.jpg", "rb") as f:
        assert f.read() == b"new"
    assert sorted(os.listdir(apps_dir / "thumbnails" / "v2")) == ["other_400.png", "thumbnail_archive.json"]
    with open(apps_dir / ARCHIVE, "r", encoding="UTF-8") as f:
        assert json.load(f) == {"other.jpg": {"400": {"png": "other_400.png"}}}
