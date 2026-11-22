"""Verify that a setup page whose saved Hub login is refused shows that it is logged out.

Hub refuses a saved login once it expires, or if it is a full login saved before Apps logins were limited. The page
used to only handle a login that worked, so it kept its defaults: the login button and the setup tools both showed, as
if it were logged in and logged out at once.
"""

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom


@pytest.mark.parametrize("accepted", [False, True])
def test_a_saved_login_shows_one_state(accepted):
    result = page_scripts.run(f"""
        const accepted = {'true' if accepted else 'false'}
        globalThis.server = (method, url, body) => {{
          const {{ host, pathname }} = new URL(url)
          if (host === 'hub.test:8082') {{
            if (pathname.endsWith('/user/login')) {{
              if (accepted) return {{ body: {{ success: true, user: {{ uuid: 'u1', display_name: 'Guide', permissions: {{ components: {{ edit: ['__all'], edit_content: [], view: [] }} }} }} }} }}
              return {{ body: {{ success: false, reason: 'authentication_failed' }} }}
            }}
            return {{ body: {{ success: false }} }}
          }}
          if (pathname === '/internal/system/configuration') {{
            return {{ body: {{ app: {{}}, system: {{ standalone: false }}, control_server: {{ ip_address: 'hub.test', port: 8082 }} }} }}
          }}
          if (pathname === '/internal/files/availableContent') return {{ body: {{ success: true, content: [] }} }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('apps', 'media_player/setup.html')
        await browser.wait(800)
        const setupCommon = await import({page_scripts.module_url("apps/js/exhibitera_setup_common.js")})
        const el = (id) => window.document.getElementById(id)

        // As the page starts, with a login saved earlier
        for (const id of ['loginMenu', 'userMenu', 'setupTools']) el(id).style.display = ''
        el('userMenu').style.display = 'none'
        window.localStorage.setItem('hubAuthToken', 'saved-login')

        await setupCommon.authenticateUser()
        await browser.wait(100)
        report({{
          errors: browser.errors,
          loginButton: el('loginMenu').style.display !== 'none',
          userMenu: el('userMenu').style.display !== 'none',
          setupTools: el('setupTools').style.display !== 'none',
          savedLogin: window.localStorage.getItem('hubAuthToken')
        }})
    """, browser="page")

    if accepted:
        assert result == {"errors": [], "loginButton": False, "userMenu": True, "setupTools": True,
                          "savedLogin": "saved-login"}
    else:
        assert result == {"errors": [], "loginButton": True, "userMenu": False, "setupTools": False,
                          "savedLogin": None}


@pytest.mark.parametrize("handoff_accepted", [True, False])
def test_a_login_from_hub_comes_before_the_saved_login(handoff_accepted):
    # Hub passes its login in the link that opens the page. That should log in even when the saved login is refused.
    result = page_scripts.run(f"""
        const handoffAccepted = {'true' if handoff_accepted else 'false'}
        const user = {{ uuid: 'u1', display_name: 'Guide', permissions: {{ components: {{ edit: ['__all'], edit_content: [], view: [] }} }} }}
        globalThis.server = (method, url, body) => {{
          const {{ host, pathname }} = new URL(url)
          if (host === 'hub.test:8082') {{
            if (pathname.endsWith('/user/login')) {{
              const params = JSON.parse(body ?? '{{}}')
              if (params.handoff === 'one-time-code' && handoffAccepted) return {{ body: {{ success: true, user, authToken: 'new-login' }} }}
              return {{ body: {{ success: false, reason: 'authentication_failed' }} }}
            }}
            return {{ body: {{ success: false }} }}
          }}
          if (pathname === '/internal/system/configuration') {{
            return {{ body: {{ app: {{}}, system: {{ standalone: false }}, control_server: {{ ip_address: 'hub.test', port: 8082 }} }} }}
          }}
          if (pathname === '/internal/files/availableContent') return {{ body: {{ success: true, content: [] }} }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('apps', 'media_player/setup.html')
        await browser.wait(800)
        const setupCommon = await import({page_scripts.module_url("apps/js/exhibitera_setup_common.js")})
        const el = (id) => window.document.getElementById(id)

        // As the page starts when Hub opens it, with an expired login saved earlier
        for (const id of ['loginMenu', 'setupTools']) el(id).style.display = ''
        el('userMenu').style.display = 'none'
        window.localStorage.setItem('hubAuthToken', 'expired-login')
        window.history.replaceState(null, '', window.location.pathname + '#exHandoff=one-time-code')

        await setupCommon.authenticateUser()
        await browser.wait(100)
        report({{
          errors: browser.errors,
          loginButton: el('loginMenu').style.display !== 'none',
          setupTools: el('setupTools').style.display !== 'none',
          savedLogin: window.localStorage.getItem('hubAuthToken'),
          codeLeftInAddress: window.location.hash.includes('exHandoff')
        }})
    """, browser="page")

    if handoff_accepted:
        assert result == {"errors": [], "loginButton": False, "setupTools": True, "savedLogin": "new-login",
                          "codeLeftInAddress": False}
    else:
        assert result == {"errors": [], "loginButton": True, "setupTools": False, "savedLogin": None,
                          "codeLeftInAddress": False}
