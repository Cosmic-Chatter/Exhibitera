"""Run page code from Hub and Apps in Node, using a minimal fake browser."""

# Standard modules
import json
import pathlib
import shutil
import subprocess

# Third-party modules
import pytest

EXHIBITERA_DIR = pathlib.Path(__file__).resolve().parents[2]
FAKE_BROWSER = pathlib.Path(__file__).resolve().parent / "fake_browser.mjs"

needs_node = pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is needed to run the page code")


def module_url(relative_path: str) -> str:
    return json.dumps((EXHIBITERA_DIR / relative_path).as_uri())


def run(script: str):
    """Run script as an ES module with the fake browser loaded, and return the JSON it passes to report().

    The script can use `browser` (the fake browser module) and must call report(value) when done.
    """

    code = (f"const browser = await import({json.dumps(FAKE_BROWSER.as_uri())})\n"
            "const report = (value) => { process.stdout.write('\\n' + JSON.stringify(value) + '\\n'); process.exit(0) }\n"
            f"{script}")
    result = subprocess.run(["node", "--no-warnings", "--input-type=module", "-e", code],
                            capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().split("\n")[-1])
