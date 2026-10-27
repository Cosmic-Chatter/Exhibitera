"""Find the places in Exhibitera's scripts that insert something other than a fixed string as HTML.

Names, descriptions and filenames can come from anyone on the network. Inserted as HTML, they could run
script in the page. Data must be shown with textContent or set as element properties instead.
"""

# Standard modules
import pathlib
import re

# Exhibitera modules
from exhibitera.common.tests import api_scanning

# Writing HTML into an element, or into a new page
HTML_SINKS = re.compile(r"\.(?:innerHTML|outerHTML)\s*\+?=\s*|\.insertAdjacentHTML\(\s*(['\"`])[^'\"`]*\1\s*,\s*")
OTHER_SINKS = re.compile(r"\bdocument\.write(?:ln)?\(|\.makeHtml\(")


def read_literal(source: str, start: int) -> tuple[str, int] | None:
    """Return the string literal that begins at `start`, and the index after it, or None if there isn't one."""

    quote = source[start] if start < len(source) else ""
    if quote not in "'\"`":
        return None
    i = start + 1
    while i < len(source):
        if source[i] == "\\":
            i += 2
            continue
        if source[i] == quote:
            return source[start + 1:i], i + 1
        if quote != "`" and source[i] == "\n":
            return None
        i += 1
    return None


def inserts_only_a_fixed_string(source: str, start: int) -> bool:
    literal = read_literal(source, start)
    if literal is None:
        return False
    text, end = literal
    if "${" in text:
        return False

    # Nothing may be added to it, as in '<b>' + name
    rest = source[end:end + 200].lstrip(" \t")
    return not rest.startswith("+")


def html_insertions(files: list[pathlib.Path], allowed: dict[tuple[str, str], str],
                    renderers: re.Pattern | None = None) -> list[str]:
    """Return the places in `files` that insert something other than a fixed string as HTML.

    `allowed` maps (file, text on the line) to the reason that place is safe. `renderers` matches the
    start of a call whose output may be inserted as HTML, such as a deliberate Markdown renderer.
    """

    def is_allowed(relative: str, line: str) -> bool:
        return any(relative == file and marker in line for file, marker in allowed)

    found = []
    for path in files:
        source = path.read_text(encoding="UTF-8")
        relative = str(path.relative_to(api_scanning.EXHIBITERA_DIR))
        lines = source.split("\n")
        for match in HTML_SINKS.finditer(source):
            number = source.count("\n", 0, match.start()) + 1
            rest_of_line = source[match.end():source.find("\n", match.end())]
            if inserts_only_a_fixed_string(source, match.end()) or is_allowed(relative, lines[number - 1]):
                continue
            if renderers is not None and renderers.match(rest_of_line) and not re.search(r"\)\s*\+", rest_of_line):
                continue
            found.append(f"{relative}:{number}: {lines[number - 1].strip()}")
        for match in OTHER_SINKS.finditer(source):
            number = source.count("\n", 0, match.start()) + 1
            next_line = lines[number] if number < len(lines) else ""
            if not is_allowed(relative, lines[number - 1]) and not is_allowed(relative, next_line):
                found.append(f"{relative}:{number}: {lines[number - 1].strip()}")
    return found
