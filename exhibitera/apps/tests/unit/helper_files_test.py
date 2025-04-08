from features import helper_files


def test_path_safe():
    assert helper_files.path_safe(["content", 'sub', 'file.jpg']) is True
    assert helper_files.path_safe(["static", 'sub', 'file.jpg']) is False
    assert helper_files.path_safe(["../", 'content', 'file.jpg']) is False
    assert helper_files.path_safe(["..\\", 'content', 'file.jpg']) is False

