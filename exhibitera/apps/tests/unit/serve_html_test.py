"""Verify how Apps serves its top-level HTML pages."""

# Standard modules
import os

# Third-party modules
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
import exhibitera.apps.Apps as apps
import exhibitera.common.config as ex_config


@pytest.fixture
def client(monkeypatch):
    # Hub and Apps share these paths, and importing Hub (as other tests do) points them at Hub
    apps_dir = os.path.dirname(os.path.abspath(apps.__file__))
    monkeypatch.setattr(ex_config, "exec_path", apps_dir)
    monkeypatch.setattr(ex_config, "application_path", apps_dir)
    return TestClient(apps.app)


@pytest.mark.parametrize("path", ["/", "/setup.html", "/app.html"])
def test_existing_pages_are_served(client, path):
    response = client.get(path)

    assert response.status_code == 200
    assert "<html" in response.text.lower()


@pytest.mark.parametrize("path", ["/voting_kiosk.html", "/does-not-exist.html", "/...html"])
def test_missing_page_is_not_found(client, path):
    response = client.get(path)

    assert response.status_code == 404
