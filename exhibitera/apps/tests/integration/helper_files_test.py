import helper_files


def test_filename_safe():
    assert helper_files.filename_safe('test.jpg') is True
    assert helper_files.filename_safe('../test.png') is False
    assert helper_files.filename_safe('Myfile>>') is False


def test_path_safe():
    assert helper_files.path_safe(["content", 'sub', 'file.jpg']) is True
    assert helper_files.path_safe(["static", 'sub', 'file.jpg']) is False
    assert helper_files.path_safe(["../", 'content', 'file.jpg']) is False
    assert helper_files.path_safe(["..\\", 'content', 'file.jpg']) is False


def test_json_list_to_csv():
    assert helper_files.json_list_to_csv([{"a": 1, "b": 2}, {"a": 3, "b": 4}]) == 'a,b\r\n1,2\r\n3,4'
    assert helper_files.json_list_to_csv([{"a": 1, "b": 2}, {"a": 3}]) == 'a,b\r\n1,2\r\n3,'
    assert helper_files.json_list_to_csv([{"a": 1, "b": 2}, {"a": 3}, {"c": 4}]) == 'a,b,c\r\n1,2,\r\n3,,\r\n,,4'
    assert helper_files.json_list_to_csv([]) == ""
    assert helper_files.json_list_to_csv([{}]) == ""


def test_get_unique_keys():
    assert helper_files.get_unique_keys([{"a": 1, "b": 2}, {"a": 3}, {"c": 4}]) == ['a', 'b', 'c']
    assert helper_files.get_unique_keys([]) == []
    assert helper_files.get_unique_keys([{}]) == []


def test_with_extension():
    assert helper_files.with_extension('test', 'png') == 'test.png'
    assert helper_files.with_extension('test.jpg', 'png') == 'test.png'
    assert helper_files.with_extension('path/test.jpg', 'png') == 'path/test.png'
    assert helper_files.with_extension('test.', 'PNG') == 'test.PNG'
    assert helper_files.with_extension('', 'TIFF') == '.TIFF'
    assert helper_files.with_extension('test.TIFF', 'gif') == 'test.gif'


def test_is_url():
    assert helper_files.is_url("http://google.com") is True
    assert helper_files.is_url("http://192.168.1.2:8000") is True
    assert helper_files.is_url("https://google.com") is True
    assert helper_files.is_url("ftp://mozilla.org/firefox") is True
    assert helper_files.is_url("file://test.png") is True
    assert helper_files.is_url("~/test.png") is False
    assert helper_files.is_url("httpHeader.txt") is False


def test_get_mimetype():
    assert helper_files.get_mimetype('test.jpg') == 'image'
    assert helper_files.get_mimetype('test.ogg') == 'audio'
    assert helper_files.get_mimetype('test.mp4') == 'video'
    assert helper_files.get_mimetype('test.obj') == 'model'
    assert helper_files.get_mimetype('test.csv') == 'text'



