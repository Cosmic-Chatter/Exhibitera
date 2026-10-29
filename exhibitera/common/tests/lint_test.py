"""Verify that Hub's and Apps' own scripts pass ESLint, using the project's .eslintrc.json.

Third-party libraries bundled with Exhibitera are skipped. Most lint errors found so far were unused
variables, but a few hid real mistakes, such as an assignment written where a comparison was meant.
"""

# Standard modules
import subprocess

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import api_scanning

REPO_DIR = api_scanning.EXHIBITERA_DIR.parent
ESLINT = REPO_DIR / "node_modules" / ".bin" / "eslint"


@pytest.mark.skipif(not ESLINT.exists(), reason="ESLint is installed with npm install")
def test_scripts_pass_eslint():
    files = api_scanning.javascript_files("apps", "hub", "common")
    files += sorted((api_scanning.EXHIBITERA_DIR / "common" / "tests").glob("*.mjs"))

    result = subprocess.run([str(ESLINT), "--format", "unix", *map(str, files)],
                            cwd=REPO_DIR, capture_output=True, text=True, timeout=300)

    assert result.returncode == 0, result.stdout + result.stderr
