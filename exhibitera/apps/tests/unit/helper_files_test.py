import exhibitera.common.files as ex_files


def test_path_safe():
    assert ex_files.path_safe(["content", 'sub', 'file.jpg']) is True
    assert ex_files.path_safe(["configuration", 'sub', 'file.jpg']) is False
    assert ex_files.path_safe(["../", 'content', 'file.jpg']) is False
    assert ex_files.path_safe(["..\\", 'content', 'file.jpg']) is False


def test_path_safe_trims_whitespace():
    assert ex_files.path_safe(["content", ' file.jpg ']) is True
    assert ex_files.path_safe(["content", '.. ', 'file.jpg']) is False
    assert ex_files.path_safe(["content", ' . ', 'file.jpg']) is False
    assert ex_files.path_safe(["content", '   ']) is False
