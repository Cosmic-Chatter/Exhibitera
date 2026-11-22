"""Verify that get_text() refuses paths that climb out of their folder with "..", whichever slash they use.

It used to check only the file's name. On Windows, a backslash in a name made from a request split it into folders, so
"data/..\\configuration\\encryption_key.txt" passed the check and read the configuration folder.
"""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files


@pytest.mark.parametrize("relative", ["data/..\\configuration\\secret.txt", "data/../configuration/secret.txt",
                                      "data\\..\\configuration\\secret.txt"])
def test_paths_with_dot_dot_are_refused(tmp_path, relative):
    # Both folders exist, so the path could be followed
    (tmp_path / "data").mkdir()
    (tmp_path / "configuration").mkdir()
    (tmp_path / "configuration" / "secret.txt").write_text("SECRET", encoding="UTF-8")

    text, success, _ = ex_files.get_text(str(tmp_path) + "/" + relative)

    assert (text, success) == ("", False)


def test_ordinary_paths_are_read(tmp_path):
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "log..old.txt").write_text("12.5", encoding="UTF-8")

    # Two dots inside a name are fine
    assert ex_files.get_text(str(tmp_path / "data" / "log..old.txt")) == ("12.5", True, "")
