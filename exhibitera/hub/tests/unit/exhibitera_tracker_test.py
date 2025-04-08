from features import tracker as ex_tracker


def test_JSON_list_to_CSV():
    assert ex_tracker.JSON_list_to_CSV([{"a": 1, "b": 2}, {"a": 3, "b": 4}]) == 'a,b\r\n1,2\r\n3,4'
    assert ex_tracker.JSON_list_to_CSV([{"a": 1, "b": 2}, {"a": 3}]) == 'a,b\r\n1,2\r\n3,'
    assert ex_tracker.JSON_list_to_CSV([{"a": 1, "b": 2}, {"a": 3}, {"c": 4}]) == 'a,b,c\r\n1,2,\r\n3,,\r\n,,4'
    assert ex_tracker.JSON_list_to_CSV([]) == ""
    assert ex_tracker.JSON_list_to_CSV([{}]) == ""


def test_get_unique_keys():
    assert ex_tracker.get_unique_keys([{"a": 1, "b": 2}, {"a": 3}, {"c": 4}]) == ['a', 'b', 'c']
    assert ex_tracker.get_unique_keys([]) == []
    assert ex_tracker.get_unique_keys([{}]) == []
