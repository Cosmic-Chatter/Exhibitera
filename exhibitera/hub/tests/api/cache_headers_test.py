"""Verify that browsers check for updated pages and scripts instead of using stale copies.

After Hub is upgraded, a browser that keeps running old scripts would call API endpoints that may no
longer exist. With `Cache-Control: no-cache`, the browser asks Hub on every load, and gets a short
"not modified" reply when nothing has changed.
"""

# Third-party modules
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware
import pytest

# Exhibitera modules
from exhibitera.common.caching import RevalidatePagesMiddleware
import exhibitera.hub.Hub as hub

PAGES_AND_SCRIPTS = ["/", "/index.html", "/tracker.html", "/config.js",
                     "/js/webpage.js", "/js/features/issues.js", "/css/webpage.css", "/common/utilities.js"]


@pytest.fixture
def client():
    return TestClient(hub.app)


@pytest.mark.parametrize("path", PAGES_AND_SCRIPTS)
def test_pages_and_scripts_are_revalidated(client, path):
    response = client.get(path)

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("path", PAGES_AND_SCRIPTS)
def test_unchanged_files_get_a_not_modified_reply(client, path):
    etag = client.get(path).headers["etag"]

    response = client.get(path, headers={"If-None-Match": etag})

    assert response.status_code == 304
    assert response.content == b""


@pytest.mark.parametrize("path", ["/index.html", "/js/webpage.js"])
def test_changed_files_are_sent_again(client, path):
    response = client.get(path, headers={"If-None-Match": '"an-old-version"'})

    assert response.status_code == 200
    assert len(response.content) > 0


@pytest.mark.parametrize("path", ["/_static/Hub_logo.svg", "/_static/icon.ico"])
def test_images_keep_normal_caching(client, path):
    response = client.get(path)

    assert response.status_code == 200
    assert "cache-control" not in response.headers


def test_api_responses_are_unchanged(client):
    response = client.get("/internal/system/checkConnection")

    assert response.json()["success"] is True
    assert "cache-control" not in response.headers


def test_middleware_does_not_wrap_streaming_responses():
    # BaseHTTPMiddleware can stop the update stream from noticing when a browser disconnects
    assert not issubclass(RevalidatePagesMiddleware, BaseHTTPMiddleware)
    assert any(m.cls is RevalidatePagesMiddleware for m in hub.app.user_middleware)
