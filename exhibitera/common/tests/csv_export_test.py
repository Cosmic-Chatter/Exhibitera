"""Verify that CSV exports of visitor data can't run formulas when opened in a spreadsheet app.

Survey, voting and word-cloud answers are typed by visitors. A cell starting with =, +, -, @, a tab or
a carriage return is treated as a formula by Excel, LibreOffice and Google Sheets, so it could pull in
data or open links when staff open the export. Those cells are prefixed with ' so they show as text.
"""

# Standard modules
import csv
import io

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files


def rows(csv_text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(csv_text)))


@pytest.mark.parametrize("answer", ["=HYPERLINK(\"http://evil.example\",\"Click\")", "+1+1", "-1+1",
                                    "@SUM(A1:A2)", "\t=1+1", "\r=1+1"])
def test_formula_answers_are_shown_as_text(answer):
    result = rows(ex_files.json_list_to_csv([{"answer": answer}]))

    assert result[0]["answer"] == "'" + answer


@pytest.mark.parametrize("answer", ["Great exhibit!", "1+1=2", "email@example.com", "", " =1"])
def test_ordinary_answers_are_unchanged(answer):
    result = rows(ex_files.json_list_to_csv([{"answer": answer}]))

    assert result[0]["answer"] == answer


def test_numbers_and_booleans_are_unchanged():
    result = rows(ex_files.json_list_to_csv([{"count": -5, "ratio": -0.5, "done": True}]))

    assert result[0] == {"count": "-5", "ratio": "-0.5", "done": "True"}


def test_formula_column_names_are_shown_as_text():
    result = ex_files.json_list_to_csv([{"=cmd": "a", "choices": ["=evil", "fine"]}])
    header = next(csv.reader(io.StringIO(result)))

    assert "'=cmd" in header
    assert "choices - fine" in header
    # A visitor's choice becomes part of a column name, which starts with the staff-defined key
    assert "choices - =evil" in header


def test_tracker_file_export_escapes_formulas(tmp_path):
    data = tmp_path / "survey.txt"
    data.write_text('{"answer": "=1+1"}\n{"answer": "Lovely"}\n', encoding="UTF-8")

    result = rows(ex_files.create_csv(data))

    assert [r["answer"] for r in result] == ["'=1+1", "Lovely"]
