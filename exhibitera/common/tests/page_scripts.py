"""Run page code from Hub and Apps in Node, in a minimal fake browser or in a real page loaded with jsdom."""

# Standard modules
import json
import pathlib
import shutil
import subprocess

# Third-party modules
import pytest

EXHIBITERA_DIR = pathlib.Path(__file__).resolve().parents[2]
TESTS_DIR = pathlib.Path(__file__).resolve().parent
BROWSERS = {"fake": TESTS_DIR / "fake_browser.mjs", "page": TESTS_DIR / "page_browser.mjs"}

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is needed to run the page code")
needs_jsdom = pytest.mark.skipif(shutil.which("node") is None
                                 or not (EXHIBITERA_DIR.parent / "node_modules" / "jsdom").exists(),
                                 reason="Node.js and jsdom (npm install --save-dev jsdom) are needed to open pages")


def module_url(relative_path: str) -> str:
    return json.dumps((EXHIBITERA_DIR / relative_path).as_uri())


def run(script: str, browser: str = "fake"):
    """Run script as an ES module with a browser loaded, and return the JSON it passes to report().

    browser is "fake" (fake_browser.mjs) for a page module without its page, or "page" (page_browser.mjs)
    to open a real page with openPage(). The script can use `browser` (that module) and must call
    report(value) when done.
    """

    code = (f"const browser = await import({json.dumps(BROWSERS[browser].as_uri())})\n"
            "const report = (value) => { process.stdout.write('\\n' + JSON.stringify(value) + '\\n'); process.exit(0) }\n"
            f"{script}")
    result = subprocess.run(["node", "--no-warnings", "--input-type=module", "-e", code],
                            capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().split("\n")[-1])
