"""Verify that Hub and Apps write logs to a single, rotating file in the user directory."""

# Standard modules
import logging
import os
import subprocess
import sys
import threading

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.config as ex_config
import exhibitera.common.utilities as ex_utilities

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


@pytest.fixture
def log_dir(tmp_path, monkeypatch):
    """Point user files at a temporary directory and restore the logging setup afterward."""

    monkeypatch.setattr(ex_config, "application_path", str(tmp_path))
    monkeypatch.setattr(sys, "excepthook", sys.excepthook)
    monkeypatch.setattr(threading, "excepthook", threading.excepthook)

    root = logging.getLogger()
    original_handlers = list(root.handlers)
    original_level = root.level

    yield tmp_path

    for handler in list(root.handlers):
        if handler not in original_handlers:
            root.removeHandler(handler)
            handler.close()
    root.setLevel(original_level)


def read_log(path) -> str:
    for handler in logging.getLogger().handlers:
        handler.flush()
    with open(path, "r", encoding="UTF-8") as f:
        return f.read()


@pytest.mark.parametrize("module", ["exhibitera.hub.Hub", "exhibitera.apps.Apps"])
def test_import_creates_no_log_file_in_working_directory(tmp_path, module):
    env = dict(os.environ, PYTHONPATH=REPO_ROOT)
    result = subprocess.run([sys.executable, "-c", f"import {module}"],
                            cwd=tmp_path, env=env, capture_output=True, text=True, timeout=120)

    assert result.returncode == 0, result.stderr
    assert [f for f in os.listdir(tmp_path) if f.endswith(".log")] == []


def test_logs_to_file_in_user_directory(log_dir):
    ex_utilities.configure_logging("test.log")
    logging.info("Server started")

    contents = read_log(log_dir / "test.log")
    assert "INFO, " in contents
    assert contents.strip().endswith("Server started")


def test_debug_messages_only_logged_in_debug_mode(log_dir):
    ex_utilities.configure_logging("test.log")
    logging.debug("hidden detail")
    ex_utilities.set_debug_logging(True)
    logging.debug("visible detail")

    contents = read_log(log_dir / "test.log")
    assert "hidden detail" not in contents
    assert "visible detail" in contents


@pytest.mark.parametrize("logger_name", ["sse_starlette.sse", "urllib3.connectionpool", "pyffmpeg.misc.Paths"])
def test_third_party_chatter_is_not_logged_even_in_debug_mode(log_dir, logger_name):
    ex_utilities.configure_logging("test.log", debug=True)

    # Some libraries (like pyffmpeg) set their own loggers to DEBUG
    library_logger = logging.getLogger(logger_name)
    library_logger.setLevel(logging.DEBUG)
    library_logger.debug("library debug")
    library_logger.info("library info")
    library_logger.warning("library warning")

    contents = read_log(log_dir / "test.log")
    assert "library debug" not in contents
    assert "library info" not in contents
    assert "library warning" in contents


def test_configuring_twice_does_not_duplicate_messages(log_dir):
    ex_utilities.configure_logging("test.log")
    ex_utilities.configure_logging("test.log")
    logging.warning("only once")

    assert read_log(log_dir / "test.log").count("only once") == 1


def test_log_file_rotates_when_full(log_dir):
    ex_utilities.configure_logging("test.log", max_bytes=1000, backup_count=2)
    for i in range(100):
        logging.warning(f"message {i:03d} " + "x" * 50)

    files = sorted(f for f in os.listdir(log_dir) if f.startswith("test.log"))
    assert files == ["test.log", "test.log.1", "test.log.2"]
    assert all(os.path.getsize(log_dir / f) <= 1000 for f in files)
    assert "message 099" in read_log(log_dir / "test.log")


def test_default_rotation_caps_each_app_at_30_megabytes(log_dir):
    ex_utilities.configure_logging("test.log")
    handler = next(h for h in logging.getLogger().handlers if getattr(h, "baseFilename", "").endswith("test.log"))

    assert handler.maxBytes == 5 * 1024 * 1024
    assert handler.backupCount == 5


# Uncaught exceptions

def error_entries(contents: str) -> list[str]:
    return [line for line in contents.splitlines() if line.startswith("ERROR, ")]


def raise_error():
    raise ValueError("something broke")


def test_uncaught_thread_exception_is_logged(log_dir):
    ex_utilities.configure_logging("test.log")
    thread = threading.Thread(target=raise_error, name="TestWorker")
    thread.start()
    thread.join()

    entries = error_entries(read_log(log_dir / "test.log"))
    assert len(entries) == 1
    assert "TestWorker" in entries[0]
    assert "Traceback" in entries[0]
    assert "ValueError: something broke" in entries[0]


def test_uncaught_timer_exception_is_logged(log_dir):
    ex_utilities.configure_logging("test.log")
    timer = threading.Timer(0, raise_error)
    timer.start()
    timer.join()

    assert "ValueError: something broke" in read_log(log_dir / "test.log")


def test_uncaught_main_thread_exception_is_logged(log_dir):
    ex_utilities.configure_logging("test.log")
    try:
        raise_error()
    except ValueError:
        sys.excepthook(*sys.exc_info())

    entries = error_entries(read_log(log_dir / "test.log"))
    assert len(entries) == 1
    assert "ValueError: something broke" in entries[0]


def test_keyboard_interrupt_is_not_logged_as_an_error(log_dir, capsys):
    ex_utilities.configure_logging("test.log")
    try:
        raise KeyboardInterrupt
    except KeyboardInterrupt:
        sys.excepthook(*sys.exc_info())

    assert error_entries(read_log(log_dir / "test.log")) == []
