"""Verify that kiosk pages show the right definition and recover on their own, with or without Hub.

Exhibits run unattended for long periods, so a kiosk must keep retrying until Apps answers, then show its
definition. A standalone kiosk, including one on a remote display, must switch when staff choose a new
definition in setup. While Hub is unreachable, a kiosk keeps showing what it has.
"""

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_node

# A fake Apps server, and Hub when not standalone. `state` lets a test change what they reply.
SERVERS = """
const state = { definition: 'A', standalone: STANDALONE, configFailures: 0, hubUp: true }
const definitionApps = { A: 'media_player', B: 'media_player', C: 'voting_kiosk' }
globalThis.server = (method, url) => {
  const path = new URL(url).pathname
  if (path === '/_static/semantic_version.json') return { body: { version: {} } }
  if (path === '/internal/system/platformDetails') return { body: {} }
  if (path === '/internal/system/configuration') {
    if (state.configFailures > 0) {
      state.configFailures -= 1
      return 'error'
    }
    return {
      body: {
        app: { definition: state.definition, uuid: 'kiosk-uuid', id: 'Kiosk' },
        system: { standalone: state.standalone, remote_display: true },
        control_server: { ip_address: 'hub.test', port: 8082 }
      }
    }
  }
  if (path === '/internal/system/update') return { body: { app: { definition: state.definition }, commands: [] } }
  const load = path.match(/^\\/internal\\/definitions\\/(\\w+)\\/load$/)
  if (load) return { body: { success: true, definition: { uuid: load[1], app: definitionApps[load[1]] } } }
  if (path.endsWith('/system/ping')) return state.hubUp ? { body: {} } : 'error'
  return { status: 404, body: {} }
}
"""


def run_kiosk(standalone: bool, before: str = "", after: str = "await browser.wait(300)") -> dict:
    """Start a Media Player kiosk, run `after`, and report which definitions it showed."""

    return page_scripts.run(SERVERS.replace("STANDALONE", "true" if standalone else "false") + f"""
        {before}
        const exCommon = await import({page_scripts.module_url("apps/js/exhibitera_app_common.js")})
        console.log = () => {{}}
        const shown = []
        exCommon.configureApp({{ name: 'media_player', loadDefinition: (def) => shown.push(def.uuid) }})
        {after}
        report({{ shown, location: String(window.location.href ?? window.location) }})
    """)


def definition_loads() -> str:
    return "browser.requests.filter((r) => r.url.includes('/definitions/')).length"


@pytest.mark.parametrize("standalone", [True, False])
def test_kiosk_shows_its_definition_once_at_startup(standalone):
    assert run_kiosk(standalone)["shown"] == ["A"]


@pytest.mark.parametrize("standalone", [True, False])
def test_kiosk_recovers_when_apps_did_not_answer_at_startup(standalone):
    result = run_kiosk(standalone, before="state.configFailures = 2", after="await browser.wait(2000)")

    assert result["shown"] == ["A"]


def test_standalone_kiosk_switches_to_a_newly_chosen_definition():
    result = run_kiosk(True, after="await browser.wait(300); state.definition = 'B'; await browser.wait(1200)")

    assert result["shown"] == ["A", "B"]


def test_standalone_kiosk_opens_the_app_for_a_new_definition():
    result = run_kiosk(True, after="await browser.wait(300); state.definition = 'C'; await browser.wait(1200)")

    assert result["location"] == "http://apps.test/voting_kiosk"


def test_kiosk_shows_its_last_definition_when_hub_is_offline_at_startup():
    # As when Apps restarts while Hub is down: the definition comes from Apps' own saved configuration
    result = run_kiosk(False, before="state.hubUp = false", after="await browser.wait(500)")

    assert result["shown"] == ["A"]


def test_start_page_opens_the_last_definitions_app_when_hub_is_offline():
    # Apps' window opens app.html first, which sends the kiosk on to the app for its saved definition
    result = page_scripts.run(SERVERS.replace("STANDALONE", "false") + f"""
        state.hubUp = false
        console.log = () => {{}}
        await import({page_scripts.module_url("apps/js/app.js")})
        await browser.wait(500)
        report({{ location: String(window.location.href ?? window.location) }})
    """)

    assert result["location"] == "http://apps.test/media_player"


def test_failed_pings_do_not_reload_the_definition():
    result = page_scripts.run(SERVERS.replace("STANDALONE", "false") + f"""
        const exCommon = await import({page_scripts.module_url("apps/js/exhibitera_app_common.js")})
        console.log = () => {{}}
        const shown = []
        exCommon.configureApp({{ name: 'media_player', loadDefinition: (def) => shown.push(def.uuid) }})
        await browser.wait(300)
        state.hubUp = false
        const before = {definition_loads()}
        for (let i = 0; i < 3; i++) {{
          exCommon.sendPing()
          await browser.wait(100)
        }}
        report({{ shown, extraLoads: {definition_loads()} - before }})
    """)

    assert result == {"shown": ["A"], "extraLoads": 0}
