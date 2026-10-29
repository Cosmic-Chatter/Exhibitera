"""Verify that every request from Hub's and Apps' pages finishes, so callers can retry or report failure.

Browsers don't treat a timeout as an error, and error pages aren't always JSON, so without care a request
could wait forever. A kiosk waiting on its settings would then never start.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_node


def request_with_reply(reply: str, **options) -> dict:
    return page_scripts.run(f"""
        globalThis.server = () => ({reply})
        const exUtilities = await import({page_scripts.module_url("common/utilities.js")})
        console.log = () => {{}}
        report(await browser.settle(exUtilities.makeRequest({{
            method: 'GET', url: 'http://apps.test', endpoint: '/system/update', ...{json.dumps(options)}
        }})))
    """)


def test_json_reply_is_returned():
    assert request_with_reply("{ body: { success: true } }") == {"resolved": {"success": True}}


def test_raw_reply_is_returned_as_text():
    assert request_with_reply("{ text: 'Hello' }", rawResponse=True) == {"resolved": "Hello"}


@pytest.mark.parametrize("reply", ["'timeout'", "'error'", "{ status: 500, text: 'Internal Server Error' }",
                                   "{ status: 404, body: { detail: 'Not Found' } }",
                                   "{ status: 200, text: '<html>Captive portal</html>' }"])
def test_failed_requests_are_rejected(reply):
    result = request_with_reply(reply)

    assert "rejected" in result
