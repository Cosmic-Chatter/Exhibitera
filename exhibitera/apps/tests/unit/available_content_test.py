"""Verify the details Apps lists for each content file, which the file picker sorts and shows."""

# Standard modules
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.apps.features.files as apps_files
import exhibitera.common.config as ex_config


@pytest.fixture
def apps_dir(tmp_path, monkeypatch):
    """Point user files at a temporary directory."""

    os.makedirs(tmp_path / "content")
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    return tmp_path


def test_files_list_when_they_last_changed(apps_dir):
    for name, contents, modified in [("old.jpg", b"12345", 1_700_000_000), ("new.jpg", b"1", 1_800_000_000)]:
        with open(apps_dir / "content" / name, "wb") as f:
            f.write(contents)
        os.utime(apps_dir / "content" / name, (modified, modified))

    _, details = apps_files.get_all_directory_contents("content")

    by_name = {entry["name"]: entry for entry in details}
    assert by_name["old.jpg"]["modified"] == 1_700_000_000
    assert by_name["new.jpg"]["modified"] == 1_800_000_000
    assert by_name["old.jpg"]["size"] == 5
