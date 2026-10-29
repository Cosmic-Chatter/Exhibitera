"""Verify that the uuid() helper shared by Hub's and Apps' pages makes real version 4 UUIDs.

Pages are often served over plain HTTP on a local network, where browsers don't offer
crypto.randomUUID(), so the helper builds the UUID itself from crypto.getRandomValues().
"""

# Standard modules
import json
import pathlib
import re
import shutil
import subprocess

# Third-party modules
import pytest

UTILITIES = pathlib.Path(__file__).resolve().parents[1] / "utilities.js"
UUID_V4 = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="Node.js is needed to run the page code")


def generate(count: int, script: str = "") -> list[str]:
    """Run uuid() in Node count times, after running script, and return the results."""

    code = (f"{script}\nconst {{ uuid }} = await import({json.dumps(UTILITIES.as_uri())})\n"
            f"console.log(JSON.stringify(Array.from({{ length: {count} }}, () => uuid())))")
    result = subprocess.run(["node", "--no-warnings", "--input-type=module", "-e", code],
                            capture_output=True, text=True, timeout=60, check=True)
    return json.loads(result.stdout)


def test_uuids_are_valid_version_4():
    offenders = [u for u in generate(2000) if not UUID_V4.match(u)]

    assert offenders == []


def test_uuids_are_unique():
    uuids = generate(2000)

    assert len(set(uuids)) == len(uuids)


def test_uuids_use_the_secure_random_generator():
    # Math.random() is predictable, so it must not be the source
    uuids = generate(5, script="Math.random = () => 0")

    assert len(set(uuids)) == 5
