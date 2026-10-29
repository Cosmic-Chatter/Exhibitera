"""Verify that kiosks with sound start, and follow the audio permission, whatever their saved configuration holds.

First-time setup always saves a permissions section, but a hand-edited config.json may not have one.
Media Player used to stop starting up in that case, leaving the kiosk without its definition, and Media
Browser ignored the permission when audio was turned off.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_node

# The page to run, a minimal definition for it, and the elements that play sound
APPS = {
    "media_player": ("apps/media_player/media_player.js",
                     {"content": {}, "content_order": [], "style": {}},
                     ["fullscreenVideo", "audioPlayer"]),
    "media_browser": ("apps/media_browser/media_browser.js",
                      {"languages": {}, "style": {}},
                      ["mediaLightboxVideo", "mediaLightboxAudio"]),
}


def start_kiosk(app: str, permissions: dict | None) -> dict:
    """Start a standalone kiosk for the given app and report what happened."""

    module, definition, players = APPS[app]
    definition = {"uuid": "def-A", "app": app, **definition}
    configuration = {"app": {"definition": "def-A", "uuid": "kiosk-uuid", "id": "Kiosk"},
                     "system": {"standalone": True, "remote_display": True}}
    if permissions is not None:
        configuration["permissions"] = permissions

    return page_scripts.run(f"""
        const configuration = {json.dumps(configuration)}
        const definition = {json.dumps(definition)}
        globalThis.server = (method, url) => {{
          const path = new URL(url).pathname
          if (path === '/internal/system/configuration') return {{ body: configuration }}
          if (path === '/internal/system/update') return {{ body: {{ app: configuration.app, commands: [] }} }}
          if (path === '/internal/definitions/def-A/load') return {{ body: {{ success: true, definition }} }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        // Kiosk pages load the Markdown library as a global script
        globalThis.showdown = {{ Converter: class {{ makeHtml (text) {{ return text }} setOption () {{}} }} }}
        const errors = []
        process.on('unhandledRejection', (error) => errors.push(String(error)))
        console.log = () => {{}}
        await import({page_scripts.module_url(module)})
        await browser.wait(500)
        report({{
          errors,
          loadedDefinition: browser.requests.some((r) => r.url.endsWith('/definitions/def-A/load')),
          muted: {json.dumps(players)}.map((id) => document.getElementById(id).muted ?? null)
        }})
    """)


@pytest.mark.parametrize("app", APPS)
@pytest.mark.parametrize("permissions", [None, {}])
def test_starts_without_an_audio_permission(app, permissions):
    result = start_kiosk(app, permissions)

    assert result["errors"] == []
    assert result["loadedDefinition"] is True


@pytest.mark.parametrize("app", APPS)
@pytest.mark.parametrize("audio, muted", [(True, False), (False, True)])
def test_follows_the_audio_permission(app, audio, muted):
    result = start_kiosk(app, {"audio": audio})

    assert result["errors"] == []
    assert result["muted"] == [muted, muted]
