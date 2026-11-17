"""Verify that the faster CSV builder gives exactly the same CSV as the one it replaced.

Datasets can have a million records or more, and building their CSV took most of a download. The builder now works
out each column once rather than once per record. The reference below is the previous builder, unchanged.
"""

# Standard modules
import csv
import io
import random

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files


def reference_json_list_to_csv(dict_list: list, filename: str = "") -> str:
    """The previous builder, kept to compare against."""

    all_keys = {}
    keys = ex_files.get_unique_keys(dict_list)
    for key in keys:
        unique_keys = ex_files.get_unique_values(dict_list, key)
        if len(unique_keys) > 0:
            all_keys[key] = unique_keys
        else:
            all_keys[key] = None

    reformed_dict_list = []
    for this_dict in dict_list:
        new_dict = {}
        for key, value in this_dict.items():
            if all_keys[key] is None:
                value_to_write = this_dict[key]
                if isinstance(value_to_write, str):
                    value_to_write = value_to_write.replace("\n", " ")
                new_dict[ex_files.escape_csv_cell(key)] = ex_files.escape_csv_cell(value_to_write)
            else:
                for sub_key in all_keys[key]:
                    new_dict[ex_files.escape_csv_cell(key + " - " + sub_key)] = sub_key in this_dict[key]
        reformed_dict_list.append(new_dict)

    try:
        with io.StringIO(newline='') as f:
            columns = ex_files.get_unique_keys(reformed_dict_list)
            if "Date" in columns:
                columns.remove("Date")
                columns.insert(0, "Date")
            csv_writer = csv.DictWriter(f, columns)
            csv_writer.writeheader()
            csv_writer.writerows(reformed_dict_list)
            result = f.getvalue()
    except IndexError:
        result = ""

    result = result.strip()
    if filename != "":
        with open(filename, 'w', encoding="UTF-8", newline="") as f:
            f.write(result)
    return result


CASES = {
    "empty": [],
    "empty records": [{}, {}],
    "votes": [{"Date": "2026-11-13T10:30:00", "Yes": 3, "No": 1}, {"Date": "2026-11-13T10:31:00", "Yes": 0, "No": 2}],
    "missing fields": [{"Date": "2026-11-13", "A": 1}, {"B": "two"}, {"Date": "2026-11-14", "C": None}],
    "types": [{"Int": 1, "Float": 2.5, "True": True, "False": False, "None": None, "Zero": 0, "Empty": ""}],
    "text": [{"Answer": "line one\nline two", "Comma": "a, b", "Quote": 'He said "hi"', "Unicode": "Fossiles 🦖 é"}],
    "formulas": [{"=Total": "=SUM(A1)", "Plus": "+1", "Minus": "-1", "At": "@cmd", "Tab": "\tx", "CR": "\rx"}],
    "lists": [{"Date": "d1", "Interests": ["Art", "Science"]}, {"Date": "d2", "Interests": ["Science", "History"]},
              {"Date": "d3"}],
    "list of formulas": [{"Choices": ["=1+1", "plain"]}],
    "empty lists": [{"Tags": []}, {"Tags": []}],
    "list and text in one field": [{"Mixed": ["ab", "c"]}, {"Mixed": "abc"}],
    "names that collide once escaped": [{"=a": 1, "'=a": 2}, {"'=a": 3}],
    "list item colliding with a field": [{"A": ["b"], "A - b": "text"}],
    "keys in different orders": [{"B": 1, "A": 2, "Date": "x"}, {"Date": "y", "A": 3, "B": 4}],
    "date only in some": [{"A": 1}, {"Date": "d", "A": 2}],
    "spaces at the edges": [{" lead": " x ", "trail ": "y\n"}],
}


@pytest.mark.parametrize("records", CASES.values(), ids=CASES.keys())
def test_same_csv_as_before(records):
    assert ex_files.json_list_to_csv(records) == reference_json_list_to_csv(records)


def test_lists_with_a_number_in_their_field_fail_the_same_way():
    records = [{"Mixed": ["a"]}, {"Mixed": 5}]

    with pytest.raises(TypeError):
        reference_json_list_to_csv(records)
    with pytest.raises(TypeError):
        ex_files.json_list_to_csv(records)


@pytest.mark.parametrize("seed", range(20))
def test_same_csv_as_before_for_varied_records(seed):
    rng = random.Random(seed)
    fields = ["Date", "Yes", "No", "=Formula", "Notes", "Interests", "Program", "Score", "-Minus"]
    values = [0, 1, 2.5, True, False, None, "", "text", "multi\nline", "=bad", "+1", "a, b", 'say "hi"', "é🦖"]
    items = ["Art", "Science", "=Item", "History"]

    records = []
    for _ in range(rng.randint(0, 40)):
        record = {}
        for field in rng.sample(fields, rng.randint(0, len(fields))):
            if field == "Interests":
                record[field] = rng.sample(items, rng.randint(0, len(items)))
            else:
                record[field] = rng.choice(values)
        records.append(record)

    assert ex_files.json_list_to_csv(records) == reference_json_list_to_csv(records)


def test_writing_to_a_file(tmp_path):
    records = CASES["votes"] + CASES["formulas"]

    ex_files.json_list_to_csv(records, filename=str(tmp_path / "new.csv"))
    reference_json_list_to_csv(records, filename=str(tmp_path / "old.csv"))

    assert (tmp_path / "new.csv").read_bytes() == (tmp_path / "old.csv").read_bytes()
