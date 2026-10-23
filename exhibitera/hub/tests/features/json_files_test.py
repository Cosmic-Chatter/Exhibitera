"""Verify that Hub reads and writes issues and programs through ex_files.load_json() and write_json()."""

# Standard modules
import json
import os

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.files as ex_files
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.issues as hub_issues
import exhibitera.hub.features.programs as hub_programs


@pytest.fixture
def hub_files(tmp_path, monkeypatch):
    """Point user files at a temporary directory and record every write_json() call."""

    for directory in ["issues", "programs"]:
        os.makedirs(tmp_path / directory)
    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    monkeypatch.setattr(hub_config, "issue_list", [])
    monkeypatch.setattr(hub_config, "program_list", [])

    writes = []
    real_write_json = ex_files.write_json

    def recording_write_json(data, path, *args, **kwargs):
        writes.append(os.path.relpath(path, tmp_path))
        return real_write_json(data, path, *args, **kwargs)

    monkeypatch.setattr(ex_files, "write_json", recording_write_json)
    return tmp_path, writes


@pytest.fixture
def loads(hub_files, monkeypatch):
    """Record every load_json() call."""

    tmp_path, _ = hub_files
    calls = []
    real_load_json = ex_files.load_json

    def recording_load_json(path):
        calls.append(os.path.relpath(path, tmp_path))
        return real_load_json(path)

    monkeypatch.setattr(ex_files, "load_json", recording_load_json)
    return calls


def write_raw(path, contents: str):
    with open(path, "w", encoding="UTF-8") as f:
        f.write(contents)


def read(path):
    with open(path, "r", encoding="UTF-8") as f:
        return json.load(f)


def test_save_issue_list(hub_files):
    tmp_path, writes = hub_files
    issue = hub_issues.create_issue({"issueName": "Broken screen"})

    hub_issues.save_issue_list()

    assert writes == [os.path.join("issues", "issues.json")]
    assert read(tmp_path / "issues" / "issues.json") == [issue.details]


def test_archive_and_restore_issue(hub_files):
    tmp_path, writes = hub_files
    issue = hub_issues.create_issue({"issueName": "Broken screen"})
    issue_id = issue.details["id"]

    hub_issues.archive_issue(issue_id, "tester")

    assert os.path.join("issues", "archived.json") in writes
    archived = read(tmp_path / "issues" / "archived.json")
    assert [x["id"] for x in archived] == [issue_id]
    assert archived[0]["archivedUsername"] == "tester"
    assert read(tmp_path / "issues" / "issues.json") == []

    writes.clear()
    assert hub_issues.restore_issue(issue_id) is True

    assert os.path.join("issues", "archived.json") in writes
    assert read(tmp_path / "issues" / "archived.json") == []
    assert [x["id"] for x in read(tmp_path / "issues" / "issues.json")] == [issue_id]


def test_save_program_list(hub_files):
    tmp_path, writes = hub_files
    program = hub_programs.Program({"name": "Planetarium show"})
    hub_config.program_list.append(program)

    hub_programs.save_program_list()

    assert writes == [os.path.join("programs", "programs.json")]
    assert read(tmp_path / "programs" / "programs.json") == [program.get_dict()]


# Loading

ISSUES = os.path.join("issues", "issues.json")
ARCHIVE = os.path.join("issues", "archived.json")


def test_read_issue_list_loads_saved_issues(hub_files, loads):
    tmp_path, _ = hub_files
    write_raw(tmp_path / ISSUES, json.dumps([{"id": "abc", "issueName": "Broken screen",
                                              "lastUpdateDate": "2026-01-01T00:00:00"}]))

    hub_issues.read_issue_list()

    assert loads == [ISSUES]
    assert [x.details["issueName"] for x in hub_config.issue_list] == ["Broken screen"]


def test_read_issue_list_without_a_file(hub_files, loads, capsys):
    hub_issues.read_issue_list()

    assert hub_config.issue_list == []
    assert "No stored issues to load" in capsys.readouterr().out


@pytest.mark.parametrize("contents", ["", "[{\"id\": "])
def test_read_issue_list_with_a_damaged_file(hub_files, loads, capsys, caplog, contents):
    tmp_path, _ = hub_files
    write_raw(tmp_path / ISSUES, contents)

    hub_issues.read_issue_list()

    assert hub_config.issue_list == []
    assert "issues.json is incorrectly formatted or blank." in capsys.readouterr().out
    assert any(r.levelname == "ERROR" for r in caplog.records)


@pytest.mark.parametrize("contents", [None, ""])
def test_archive_issue_with_missing_or_blank_archive(hub_files, loads, contents):
    tmp_path, _ = hub_files
    if contents is not None:
        write_raw(tmp_path / ARCHIVE, contents)
    issue = hub_issues.create_issue({"issueName": "Broken screen"})

    hub_issues.archive_issue(issue.details["id"], "tester")

    assert ARCHIVE in loads
    assert [x["id"] for x in read(tmp_path / ARCHIVE)] == [issue.details["id"]]


@pytest.mark.parametrize("contents", [None, "", "[{\"id\": "])
def test_restore_issue_with_missing_or_damaged_archive(hub_files, loads, contents):
    tmp_path, _ = hub_files
    if contents is not None:
        write_raw(tmp_path / ARCHIVE, contents)

    assert hub_issues.restore_issue("abc") is False
    assert ARCHIVE in loads


PROGRAMS = os.path.join("programs", "programs.json")
PROGRAM_ARCHIVE = os.path.join("programs", "archived.json")


def test_read_program_list_loads_saved_programs(hub_files, loads):
    tmp_path, _ = hub_files
    write_raw(tmp_path / PROGRAMS, json.dumps([{"uuid": "abc", "name": "Planetarium show",
                                                "last_update_datetime": "2026-01-01T00:00:00"}]))

    hub_programs.read_program_list()

    assert loads == [PROGRAMS]
    assert [x.name for x in hub_config.program_list] == ["Planetarium show"]


def test_read_program_list_without_a_file(hub_files, loads, capsys):
    hub_programs.read_program_list()

    assert hub_config.program_list == []
    assert "No stored programs to load" in capsys.readouterr().out


@pytest.mark.parametrize("contents", ["", "[{\"uuid\": "])
def test_read_program_list_with_a_damaged_file(hub_files, loads, capsys, caplog, contents):
    tmp_path, _ = hub_files
    write_raw(tmp_path / PROGRAMS, contents)

    hub_programs.read_program_list()

    assert hub_config.program_list == []
    assert "programs.json is incorrectly formatted or blank." in capsys.readouterr().out
    assert any(r.levelname == "ERROR" for r in caplog.records)


@pytest.mark.parametrize("contents", [None, "", "[{\"uuid\": "])
def test_archive_program_with_missing_or_damaged_archive(hub_files, loads, contents):
    tmp_path, _ = hub_files
    if contents is not None:
        write_raw(tmp_path / PROGRAM_ARCHIVE, contents)
    program = hub_programs.Program({"name": "Planetarium show"})
    hub_config.program_list.append(program)

    assert hub_programs.archive_program(program.uuid, "tester") is True

    assert PROGRAM_ARCHIVE in loads
    assert [x["uuid"] for x in read(tmp_path / PROGRAM_ARCHIVE)] == [program.uuid]
