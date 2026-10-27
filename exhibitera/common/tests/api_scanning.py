"""Find the API requests that Hub and Apps pages make, for the API contract tests.

This reads the JavaScript source rather than running it, so it understands the request styles used in
Exhibitera: an object literal passed to a request function, with an `endpoint` (and optionally `url`,
`method`, and `api`) property.
"""

# Standard modules
import pathlib
import re

EXHIBITERA_DIR = pathlib.Path(__file__).resolve().parents[2]

# Third-party libraries bundled with Exhibitera
VENDORED = ("bootstrap", "opentype", "wordcloud2", "pluralize", "swearWords", "showdown", "js-3d-model-viewer",
            "simple-keyboard", "profanity-cleaner")


def javascript_files(*folders: str) -> list[pathlib.Path]:
    files = []
    for folder in folders:
        for path in sorted((EXHIBITERA_DIR / folder).rglob("*.js")):
            relative = path.relative_to(EXHIBITERA_DIR)
            if path.name.endswith(".min.js") or any(v in str(relative) for v in VENDORED):
                continue
            if relative.parts[:2] == ("apps", "static"):
                continue  # User files
            files.append(path)
    return files


def request_calls(source: str):
    """Yield (function name, object literal source, line number) for each request call."""

    for match in re.finditer(r"([\w.]+)\(\s*\{", source):
        name = match.group(1)
        if not name.split(".")[-1].startswith(("make", "makeRequest")) or "Request" not in name:
            continue
        start = match.end() - 1
        depth = 0
        for end in range(start, len(source)):
            depth += source[end] == "{"
            depth -= source[end] == "}"
            if depth == 0:
                break
        yield name, source[start:end + 1], source[:match.start()].count("\n") + 1


def property_expression(literal: str, key: str) -> str | None:
    match = re.search(rf"\b{key}:\s*(.+?)\s*(?:,\s*\n|\n|\}}\s*$|,\s*\w+:)", literal, re.S)
    return match.group(1).strip() if match else None


def path_template(expression: str) -> str:
    """Turn a JavaScript string expression into a path, with {x} for each computed part.

    '/component/' + config.uuid + '/groups'   ->  /component/{x}/groups
    `/programs/media/${name}`                ->  /programs/media/{x}
    """

    expression = expression.strip()
    if expression.startswith("`"):
        return re.sub(r"\$\{[^}]*\}", "{x}", expression.strip("`"))

    parts = []
    for token in re.split(r"\s*\+\s*", expression):
        if len(token) >= 2 and token[0] == token[-1] and token[0] in "'\"":
            parts.append(token[1:-1])
        else:
            parts.append("{x}")
    return "".join(parts)


def matches_route(template: str, route_path: str) -> bool:
    """Whether a path template from the source could reach the given FastAPI route path."""

    template_parts = template.rstrip("/").split("/")
    route_parts = route_path.rstrip("/").split("/")
    if len(template_parts) != len(route_parts):
        return False
    for template_part, route_part in zip(template_parts, route_parts):
        if route_part.startswith("{") and route_part.endswith("}"):
            if template_part == "":
                return False
        elif template_part != route_part:
            return False
    return True


def requests_in(paths: list[pathlib.Path], accept) -> list[tuple[str, str, str | None, str]]:
    """Return (method, path template, api, location) for each request call that `accept` approves.

    `accept(function_name, url_expression)` decides which calls to include. `api` is the call's API prefix
    if it sets one (such as '/core'), or None for the default.
    """

    found = []
    for path in paths:
        source = path.read_text(encoding="UTF-8")
        for name, literal, line in request_calls(source):
            if not accept(name, property_expression(literal, "url")):
                continue
            endpoint = property_expression(literal, "endpoint")
            if endpoint is None:
                continue
            method = re.search(r"method:\s*['\"](\w+)['\"]", literal)
            api = property_expression(literal, "api")
            found.append((method.group(1) if method else "GET", path_template(endpoint),
                          path_template(api) if api is not None else None,
                          f"{path.relative_to(EXHIBITERA_DIR)}:{line}"))
    return found


def helper_urls_in(paths: list[pathlib.Path]) -> list[tuple[str, str]]:
    """Return (path template, location) for Apps URLs built directly, such as image sources.

    Matches `<component>.getHelperURL() + <component>.getHelperAPI() + <path>`, or an older style
    that uses `<config>.api` in place of getHelperAPI().
    """

    found = []
    pattern = re.compile(r"getHelperURL\(\)\s*\+\s*\w+\.(?:api|getHelperAPI\(\))\s*\+\s*([^\n;]+)")
    for path in paths:
        source = path.read_text(encoding="UTF-8")
        for match in pattern.finditer(source):
            line = source[:match.start()].count("\n") + 1
            found.append((path_template(match.group(1).strip()), f"{path.relative_to(EXHIBITERA_DIR)}:{line}"))
    return found
