"""Verify that Hub's web console never inserts data as HTML.

Names, descriptions and filenames can come from anyone on the network, for example through a ping or a
file on an Apps computer. Inserted as HTML, they could run script in a logged-in staff member's console.
Data must be shown with textContent or set as element properties instead. HTML may only come from
fixed strings in the code.
"""

# Exhibitera modules
from exhibitera.common.tests import api_scanning, html_scanning

HUB_JS = api_scanning.javascript_files("hub/js")

# Places that deliberately insert HTML that isn't a fixed string, with the reason it's safe
ALLOWED = {
    ("hub/js/tools.js", "updateInfoModalChangelogContainer"):
        "The changelog comes from the project's own GitHub repository and is rendered from Markdown",
}


def test_scanner_recognizes_safe_and_unsafe_insertions():
    def check(code):
        return html_scanning.inserts_only_a_fixed_string(code, html_scanning.HTML_SINKS.search(code).end())

    assert check("el.innerHTML = ''")
    assert check("el.innerHTML = '<i class=\"bi bi-x\"></i>'")
    assert check("el.innerHTML = `\n  <div>Fixed</div>\n`")
    assert check("el.insertAdjacentHTML('beforeend', '<hr>')")
    assert not check("el.innerHTML = name")
    assert not check("el.innerHTML = 'Name: ' + name")
    assert not check("el.innerHTML = `<b>${name}</b>`")
    assert not check("el.innerHTML += item.label")
    assert not check("el.insertAdjacentHTML('beforeend', `<span>${x}</span>`)")


def test_scanner_finds_the_console_scripts():
    assert len(HUB_JS) >= 15


def test_console_does_not_insert_data_as_html():
    offenders = html_scanning.html_insertions(HUB_JS, ALLOWED)

    assert offenders == [], "Show data with textContent or element properties:\n" + "\n".join(offenders)


def test_every_allowed_exception_still_exists():
    for (file, marker), _ in ALLOWED.items():
        assert marker in (api_scanning.EXHIBITERA_DIR / file).read_text(encoding="UTF-8"), file
