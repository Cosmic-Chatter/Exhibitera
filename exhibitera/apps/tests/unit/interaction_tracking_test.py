"""Verify how apps tell Hub whether a visitor is using them.

Every interactive app uses the same rule: it counts as active until 30 seconds after the last touch, click, key
press, scroll, or typing, and for as long as a video the visitor started keeps playing. Showing the attractor means
the visitor has left, so it ends the activity straight away. Attractor videos and other videos that play by
themselves don't count.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

INTERACTIVE_APPS = ["image_compare/index.html", "infostation/index.html", "media_browser/index.html",
                    "survey_kiosk/index.html", "timelapse_viewer/index.html", "timeline_explorer/index.html",
                    "voting_kiosk/index.html", "word_cloud/input/index.html"]


def run_app(page: str, script: str):
    """Open an app with no definition and a 300 ms activity window, and run script."""

    configuration = {"app": {"definition": ""}, "system": {"standalone": True, "remote_display": True}}
    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/system/configuration') return {{ body: {json.dumps(configuration)} }}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('apps', {json.dumps(page)})
        const document = window.document
        const common = await import({page_scripts.module_url("apps/js/exhibitera_app_common.js")})
        await browser.wait(300)
        common.config.interactionWindow = 300
        const active = () => common.config.currentInteraction
        const touch = () => document.body.dispatchEvent(new window.Event('pointerdown', {{ bubbles: true }}))
        {script}
    """, browser="page")


@pytest.mark.parametrize("page", INTERACTIVE_APPS)
def test_apps_are_active_until_30_seconds_after_the_last_interaction(page):
    result = run_app(page, """
        const atStart = active()
        touch()
        const touched = active()
        await browser.wait(200)
        // Another interaction extends the window
        touch()
        await browser.wait(200)
        const extended = active()
        await browser.wait(200)
        report({ errors: browser.errors, atStart, touched, extended, afterWindow: active() })
    """)

    # Loading the app doesn't count as a visitor using it
    assert result == {"errors": [], "atStart": False, "touched": True, "extended": True, "afterWindow": False}


@pytest.mark.parametrize("event", ["pointerdown", "touchstart", "click", "keydown", "wheel", "input"])
def test_each_kind_of_interaction_counts(event):
    result = run_app("word_cloud/input/index.html", f"""
        document.body.dispatchEvent(new window.Event('{event}', {{ bubbles: true }}))
        report({{ errors: browser.errors, active: active() }})
    """)

    assert result == {"errors": [], "active": True}


def test_videos_the_visitor_started_keep_the_app_active():
    result = run_app("media_browser/index.html", """
        const playing = (video, isPlaying) => Object.defineProperty(video, 'paused', { configurable: true, get: () => !isPlaying })

        // An attractor video plays by itself, so it doesn't count
        playing(document.getElementById('attractorVideo'), true)
        touch()
        await browser.wait(400)
        const withAttractor = active()

        const video = document.getElementById('mediaLightboxVideo')
        playing(video, true)
        touch()
        await browser.wait(700)
        const whilePlaying = active()
        playing(video, false)
        await browser.wait(400)
        report({ errors: browser.errors, withAttractor, whilePlaying, afterVideo: active() })
    """)

    assert result == {"errors": [], "withAttractor": False, "whilePlaying": True, "afterVideo": False}


def test_the_attractor_ends_the_activity():
    result = run_app("timeline_explorer/index.html", """
        common.config.interactionWindow = 30000
        touch()
        const touched = active()
        common.endInteraction()
        report({ errors: browser.errors, touched, ended: active() })
    """)

    assert result == {"errors": [], "touched": True, "ended": False}


def test_apps_that_visitors_dont_use_never_count_as_active():
    result = run_app("media_player/index.html", """
        touch()
        report({ errors: browser.errors, active: active() })
    """)

    assert result == {"errors": [], "active": False}
