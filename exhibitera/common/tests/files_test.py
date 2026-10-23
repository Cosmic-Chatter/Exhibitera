"""Verify that JSON files are never left empty or partially written."""

# Standard modules
import json
import os
import stat
import sys

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files

ORIGINAL = {"name": "original", "values": [1, 2, 3]}


@pytest.fixture
def existing_file(tmp_path):
    path = tmp_path / "config.json"
    with open(path, "w", encoding="UTF-8") as f:
        json.dump(ORIGINAL, f)
    return path


def read(path):
    with open(path, "r", encoding="UTF-8") as f:
        return json.load(f)


def test_write_replaces_contents(existing_file):
    assert ex_files.write_json({"name": "updated"}, existing_file) == (True, "")
    assert read(existing_file) == {"name": "updated"}


def test_write_creates_new_file(tmp_path):
    path = tmp_path / "new.json"

    assert ex_files.write_json({"name": "new"}, path) == (True, "")
    assert read(path) == {"name": "new"}


def test_unserializable_data_leaves_file_unchanged(existing_file):
    success, reason = ex_files.write_json({"bad": object()}, existing_file)

    assert success is False
    assert reason == "Data is not JSON serializable"
    assert read(existing_file) == ORIGINAL


def test_original_is_intact_until_new_contents_are_complete(existing_file, monkeypatch):
    real_replace = os.replace
    seen_during_write = []

    def checking_replace(src, dst):
        # Just before the swap, the original must be untouched and the new data fully written
        seen_during_write.append((read(dst), read(src)))
        real_replace(src, dst)

    monkeypatch.setattr(os, "replace", checking_replace)
    ex_files.write_json({"name": "updated"}, existing_file)

    assert seen_during_write == [(ORIGINAL, {"name": "updated"})]
    assert read(existing_file) == {"name": "updated"}


def test_failed_write_leaves_original_and_no_temporary_files(existing_file, monkeypatch):
    def failing_replace(src, dst):
        raise OSError("simulated failure")

    monkeypatch.setattr(os, "replace", failing_replace)
    with pytest.raises(OSError):
        ex_files.write_json({"name": "updated"}, existing_file)

    assert read(existing_file) == ORIGINAL
    assert os.listdir(existing_file.parent) == ["config.json"]


def test_successful_write_leaves_no_temporary_files(existing_file):
    ex_files.write_json({"name": "updated"}, existing_file)

    assert os.listdir(existing_file.parent) == ["config.json"]


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX permissions")
def test_write_preserves_file_permissions(existing_file):
    os.chmod(existing_file, 0o640)
    ex_files.write_json({"name": "updated"}, existing_file)

    assert stat.S_IMODE(os.stat(existing_file).st_mode) == 0o640


def test_missing_directory_is_reported(tmp_path):
    path = tmp_path / "missing" / "file.json"

    assert ex_files.write_json({"name": "new"}, path) == (False, f"File {path} does not exist")


def test_append_adds_a_line(tmp_path):
    path = tmp_path / "data.txt"
    ex_files.write_json({"n": 1}, path, append=True, indent=None)
    ex_files.write_json({"n": 2}, path, append=True, indent=None)

    with open(path, "r", encoding="UTF-8") as f:
        assert [json.loads(line) for line in f] == [{"n": 1}, {"n": 2}]


def test_unserializable_append_adds_nothing(tmp_path):
    path = tmp_path / "data.txt"
    ex_files.write_json({"n": 1}, path, append=True, indent=None)
    ex_files.write_json({"bad": object()}, path, append=True, indent=None)

    with open(path, "r", encoding="UTF-8") as f:
        assert f.read() == '{"n": 1}\n'


def test_failures_are_logged(tmp_path, caplog):
    missing = tmp_path / "missing" / "file.json"
    ex_files.write_json({"name": "new"}, missing)
    ex_files.write_json({"bad": object()}, tmp_path / "file.json")

    errors = [r.getMessage() for r in caplog.records if r.levelname == "ERROR"]
    assert errors == [f"write_json: File {missing} does not exist",
                      f"write_json: Data is not JSON serializable ({tmp_path / 'file.json'})"]
