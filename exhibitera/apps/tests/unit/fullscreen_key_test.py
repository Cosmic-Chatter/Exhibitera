"""Verify that F11 toggles fullscreen in the Apps window, including in the Other app's iframe.

Without a remote display, the app page listens for F11 and asks Apps to toggle fullscreen. Key presses go to
whichever page has focus, so once a visitor taps the content in the Other app's iframe, the app page also needs
to listen inside the iframe. That's only possible for content from Apps itself, not for another website.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

DEFINITION = {"uuid": "d1", "app": "other", "name": "Fossil game", "mode": "files", "path": "content/game/index.html"}


def run_other_app(script: str, remote_display: bool = False):
    configuration = {"app": {"definition": "d1"}, "system": {"standalone": True, "remote_display": remote_display}}
    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/system/configuration') return {{ body: {json.dumps(configuration)} }}
          if (pathname === '/internal/definitions/d1/load') return {{ body: {{ success: true, definition: {json.dumps(DEFINITION)} }} }}
          return {{ body: {{ success: true }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('apps', 'other/index.html')
        const document = window.document
        let toggles = 0
        window.pywebview = {{ api: {{ toggle_fullscreen: () => {{ toggles += 1 }} }} }}
        await browser.wait(500)

        const iframe = document.getElementById('iframe')
        const press = (target, key = 'F11') => target.dispatchEvent(new target.KeyboardEvent('keydown', {{ key, bubbles: true }}))
        // jsdom doesn't load the iframe's page, so say that it loaded
        const loaded = () => iframe.dispatchEvent(new window.Event('load'))
        {script}
    """, browser="page")


def test_f11_in_the_app_page_toggles_fullscreen():
    result = run_other_app("""
        press(window)
        press(window, 'F10')
        report({ errors: browser.errors, toggles })
    """)

    assert result == {"errors": [], "toggles": 1}


def test_f11_inside_the_other_apps_iframe_toggles_fullscreen():
    result = run_other_app("""
        loaded()
        press(iframe.contentWindow)
        const once = toggles
        // The iframe can load another page, such as when a visitor follows a link
        loaded()
        press(iframe.contentWindow)
        report({ errors: browser.errors, src: iframe.getAttribute('src'), once, twice: toggles })
    """)

    # One toggle per press, however many pages the iframe has loaded
    assert result == {"errors": [], "src": "../content/game/index.html", "once": 1, "twice": 2}


def test_iframe_is_not_watched_with_a_remote_display():
    # With a remote display, fullscreen is up to the browser showing it
    result = run_other_app("""
        loaded()
        press(iframe.contentWindow)
        report({ errors: browser.errors, toggles })
    """, remote_display=True)

    assert result == {"errors": [], "toggles": 0}


def test_websites_in_the_iframe_are_left_alone():
    # Browsers don't let a page listen inside another website's page
    result = run_other_app("""
        Object.defineProperty(iframe, 'contentWindow', {
          get () { return { addEventListener () { throw new window.DOMException('Blocked a frame', 'SecurityError') } } }
        })
        loaded()
        report({ errors: browser.errors, toggles })
    """)

    assert result == {"errors": [], "toggles": 0}
