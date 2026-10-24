"""Verify that browsers check for updated Apps pages and scripts instead of using stale copies."""

# Standard modules
import os

# Third-party modules
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
from exhibitera.common.caching import RevalidatePagesMiddleware
import exhibitera.common.config as ex_config

PAGES_AND_SCRIPTS = ["/", "/setup.html", "/app.html", "/media_player/", "/media_player/setup.html",
                     "/media_player/media_player.js", "/js/exhibitera_app_common.js",
                     "/css/exhibitera-common.css", "/common/utilities.js"]


@pytest.fixture
def client(monkeypatch):
    # Hub and Apps share these paths, and importing Hub (as other tests do) points them at Hub
    apps_dir = os.path.dirname(os.path.abspath(apps.__file__))
    monkeypatch.setattr(ex_config, "exec_path", apps_dir)
    monkeypatch.setattr(ex_config, "application_path", apps_dir)
    return TestClient(apps.app)


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


@pytest.mark.parametrize("path", ["/setup.html", "/media_player/media_player.js"])
def test_changed_files_are_sent_again(client, path):
    response = client.get(path, headers={"If-None-Match": '"an-old-version"'})

    assert response.status_code == 200
    assert len(response.content) > 0


def test_root_serves_the_setup_page(client):
    assert client.get("/").content == client.get("/setup.html").content


@pytest.mark.parametrize("path", ["/_static/Apps_logo.svg", "/_static/fullscreen_shortcut.jpg"])
def test_images_keep_normal_caching(client, path):
    response = client.get(path)

    assert response.status_code == 200
    assert "cache-control" not in response.headers


def test_api_responses_are_unchanged(client):
    response = client.get("/v6.1/system/checkConnection")

    assert response.json()["success"] is True
    assert "cache-control" not in response.headers


def test_middleware_is_installed():
    assert any(m.cls is RevalidatePagesMiddleware for m in apps.app.user_middleware)
