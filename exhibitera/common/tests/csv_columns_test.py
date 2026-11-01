"""Verify the order of the columns in CSV exports of collected data.

Date comes first, when the data have one, so each row starts with when it was recorded. The other
columns are in alphabetical order, so exports of the same data always match.
"""

# Exhibitera modules
import exhibitera.common.files as ex_files


def header(csv_text: str) -> list[str]:
    return csv_text.splitlines()[0].split(",")


def test_date_is_the_first_column():
    records = [{"Visitors": 3, "Age group": ["Child", "Adult"], "Date": "2026-11-01T10:00:00", "Answer": "Yes"}]

    assert header(ex_files.json_list_to_csv(records)) == \
        ["Date", "Age group - Adult", "Age group - Child", "Answer", "Visitors"]


def test_date_is_first_even_if_only_some_records_have_one():
    records = [{"Answer": "Yes"}, {"Answer": "No", "Date": "2026-11-01T10:00:00"}]

    assert header(ex_files.json_list_to_csv(records)) == ["Date", "Answer"]


def test_columns_are_alphabetical_without_a_date():
    assert header(ex_files.json_list_to_csv([{"b": 1, "a": 2, "date": 3}])) == ["a", "b", "date"]


def test_tracker_file_export_puts_date_first(tmp_path):
    data = tmp_path / "tracker.txt"
    data.write_text('{"Visitors": 3, "Date": "2026-11-01T10:00:00"}\n', encoding="UTF-8")

    assert header(ex_files.create_csv(data)) == ["Date", "Visitors"]
