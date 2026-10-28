"""Verify which other websites can call Apps from a browser.

Hub's console calls Apps directly, from whatever address Hub is reached at, so every website may make
requests. Apps has no login cookie, and no page sends cookies to another origin, so Apps never lets
another website make requests with cookies.
"""

# Third-party modules
from fastapi.testclient import TestClient

# Exhibitera modules
import exhibitera.apps.Apps as apps

HUB_ORIGIN = "http://192.168.1.10:8082"


def test_hub_console_can_call_apps():
    client = TestClient(apps.app)

    allowed = client.options("/core/checkConnection", headers={"Origin": HUB_ORIGIN,
                                                               "Access-Control-Request-Method": "GET"})
    response = client.get("/core/checkConnection", headers={"Origin": HUB_ORIGIN})

    assert allowed.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"


def test_other_websites_cannot_make_requests_with_cookies():
    client = TestClient(apps.app, cookies={"authToken": "anything"})

    response = client.get("/core/checkConnection", headers={"Origin": HUB_ORIGIN})

    # Browsers only show a response to a request with cookies when this header allows it
    assert "access-control-allow-credentials" not in response.headers
