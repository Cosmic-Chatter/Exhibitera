"""Verify that Timeline Explorer stops counting as active once its inactivity timeout passes.

When the timeout passes, the app shows its attractor, resets the timeline, and tells Hub it's no longer active.
A problem resetting the timeline used to stop it before it told Hub, so it showed as active indefinitely. Two such
problems: fitting the header text fails when the window has no size, such as when it's minimized, and the
timeline's order can list an item that's no longer in its content.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

DEFINITION = {"uuid": "d1", "app": "timeline_explorer", "name": "Our history", "inactivity_timeout": "1",
              "attractor": "intro.mp4", "style": {},
              "language_order": ["en-us"],
              "languages": {"en-us": {"display_name": "English", "header_text": "Our history",
                                      "content": {"i1": {"time": "1900", "title": "Founded", "description": "Opened"},
                                                  "i2": {"time": "1950", "title": "New wing", "description": "Built"}}}},
              # i3 is listed, but no longer in the content
              "content_order": ["i1", "i3", "i2"],
              "content": {"i1": {"Level": "2"}, "i2": {"Level": "3"}}}


def test_timeline_stops_counting_as_active():
    configuration = {"app": {"definition": "d1"}, "system": {"standalone": True, "remote_display": True}}
    result = page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/system/configuration') return {{ body: {json.dumps(configuration)} }}
          if (pathname === '/internal/definitions/d1/load') return {{ body: {{ success: true, definition: {json.dumps(DEFINITION)} }} }}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('apps', 'timeline_explorer/index.html')
        const document = window.document
        const common = await import({page_scripts.module_url("apps/js/exhibitera_app_common.js")})
        await browser.wait(400)
        const loaded = {{ active: common.config.currentInteraction, entries: document.querySelectorAll('#timelineContainer li').length }}

        // A visitor taps the attractor, then leaves
        document.getElementById('attractorOverlay').click()
        const tapped = common.config.currentInteraction
        await browser.wait(1300)
        report({{
          errors: browser.errors,
          loaded,
          tapped,
          afterTimeout: {{ active: common.config.currentInteraction, attractor: document.getElementById('attractorOverlay').style.display }}
        }})
    """, browser="page")

    assert result["errors"] == []
    # The missing item is skipped, rather than stopping the rest of the timeline from being shown
    assert result["loaded"] == {"active": True, "entries": 2}
    assert result["tapped"] is True
    assert result["afterTimeout"] == {"active": False, "attractor": "block"}
