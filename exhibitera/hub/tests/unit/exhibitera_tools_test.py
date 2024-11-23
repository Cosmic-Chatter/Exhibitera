import exhibitera_tools as ex_tools


def test_with_extension():
    assert ex_tools.with_extension('test', 'png') == 'test.png'
    assert ex_tools.with_extension('test.jpg', 'png') == 'test.png'
    assert ex_tools.with_extension('path/test.jpg', 'png') == 'path/test.png'
    assert ex_tools.with_extension('test.', 'PNG') == 'test.PNG'
    assert ex_tools.with_extension('', 'TIFF') == '.TIFF'
    assert ex_tools.with_extension('test.TIFF', 'gif') == 'test.gif'
