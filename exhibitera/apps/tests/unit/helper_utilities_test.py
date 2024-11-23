import helper_utilities


def test_str_to_bool():
    assert helper_utilities.str_to_bool('true') is True
    assert helper_utilities.str_to_bool(True) is True
    assert helper_utilities.str_to_bool('foo') is False
    assert helper_utilities.str_to_bool('TRU') is False
