"""Verify that Hub serves only its web pages from its own folder, never its source or data."""

# Third-party modules
from fastapi.testclient import TestClient
from starlette.routing import Mount
import pytest

# Exhibitera modules
import exhibitera.common.files as ex_files
import exhibitera.hub.Hub as hub


@pytest.fixture
def client():
    return TestClient(hub.app)


@pytest.mark.parametrize("path, content_type", [
    ("/", "text/html"),
    ("/index.html", "text/html"),
    ("/tracker.html", "text/html"),
    ("/config.js", "text/javascript"),
    ("/manifest.json", "application/json"),
])
def test_web_pages_are_served(client, path, content_type):
    response = client.get(path)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(content_type)


def test_root_serves_the_web_console(client):
    assert client.get("/").content == client.get("/index.html").content


def test_tracker_accepts_a_query_string(client):
    assert client.get("/tracker.html?layout=test").status_code == 200


@pytest.mark.parametrize("path", [
    "/Hub.py",
    "/config.py",
    "/tools.py",
    "/__init__.py",
    "/requirements.txt",
    "/version.txt",
    "/README.md",
    "/features/users.py",
    "/api/internal/users/users.py",
    "/tests/api/conftest.py",
])
def test_source_files_are_not_served(client, path):
    assert client.get(path).status_code == 404


def test_hub_folder_is_not_mounted_at_root():
    root_mounts = [r for r in hub.app.routes if isinstance(r, Mount) and r.path in ("", "/")]

    assert root_mounts == []


def test_api_still_works(client):
    assert client.get("/internal/system/checkConnection").json()["success"] is True


# User data folders: only media is public

def mounts() -> dict[str, str]:
    return {r.path: r.app.directory for r in hub.app.routes if isinstance(r, Mount)}


@pytest.mark.parametrize("folder", ["issues", "programs"])
def test_only_media_is_mounted(folder):
    assert f"/{folder}" not in mounts()
    assert mounts()[f"/{folder}/media"] == ex_files.get_path([folder, "media"], user_file=True)


@pytest.mark.parametrize("path", [
    "/issues/issues.json",
    "/issues/archived.json",
    "/programs/programs.json",
    "/programs/archived.json",
])
def test_data_files_are_not_served(client, path):
    assert client.get(path).status_code == 404
