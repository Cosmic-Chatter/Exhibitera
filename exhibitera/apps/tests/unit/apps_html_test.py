"""Verify that Apps pages never insert data as HTML.

Filenames, addresses and names can come from anyone on the network. Inserted as HTML, they could run
script in a kiosk or in a setup page that holds a Hub login. Data must be shown with textContent or set
as element properties instead. HTML may only come from fixed strings in the code, or from rendering
Markdown that staff write in a definition.
"""

# Standard modules
import re

# Exhibitera modules
from exhibitera.common.tests import api_scanning, html_scanning

APPS_JS = api_scanning.javascript_files("apps", "common")

# Staff format the text in a definition with Markdown, so its rendered output is shown as HTML
MARKDOWN_RENDERERS = re.compile(r"\w+\.formatText\(")

# Places that deliberately insert HTML that isn't a fixed string, with the reason it's safe
ALLOWED = {
    ("apps/js/exhibitera_app_markdown.js", "markdownConverter.makeHtml(inputStr)"):
        "The Markdown renderer used by the apps",
    ("apps/js/exhibitera_app_markdown.js", "el.innerHTML = outputStr"):
        "The Markdown renderer used by the apps",
    ("apps/js/exhibitera_setup_markdown.js", "markdownConverter.makeHtml(inputStr)"):
        "The Markdown renderer used by the setup pages",
    ("apps/js/exhibitera_setup_markdown.js", "el.innerHTML = outputStr"):
        "The Markdown renderer used by the setup pages",
    ("apps/js/setup.js", "updateInfoModalChangelogContainer"):
        "The changelog comes from the project's own GitHub repository and is rendered from Markdown",
    ("apps/js/setup.js", "mainHelpTextDiv"):
        "The help text is the README that ships with Apps",
    ("apps/js/exhibitera_setup_common.js", "helpTextDiv.innerHTML"):
        "The help text is the README that ships with each app",
}


def test_scanner_finds_the_apps_scripts():
    assert len(APPS_JS) >= 30


def test_scanner_accepts_only_rendered_markdown():
    def offenders(code):
        path = api_scanning.EXHIBITERA_DIR / "apps" / "_scanner_check.js"
        path.write_text(code, encoding="UTF-8")
        try:
            return html_scanning.html_insertions([path], {}, MARKDOWN_RENDERERS)
        finally:
            path.unlink()

    assert offenders("el.innerHTML = exMarkdown.formatText(text, { string: true })") == []
    assert offenders("el.innerHTML = name") != []
    assert offenders("el.innerHTML = '<b>Title: </b>' + exMarkdown.formatText(text)") != []
    assert offenders("el.innerHTML = exMarkdown.formatText(text) + name") != []


def test_apps_pages_do_not_insert_data_as_html():
    offenders = html_scanning.html_insertions(APPS_JS, ALLOWED, MARKDOWN_RENDERERS)

    assert offenders == [], "Show data with textContent or element properties:\n" + "\n".join(offenders)


def test_every_allowed_exception_still_exists():
    for (file, marker), _ in ALLOWED.items():
        assert marker in (api_scanning.EXHIBITERA_DIR / file).read_text(encoding="UTF-8"), file
