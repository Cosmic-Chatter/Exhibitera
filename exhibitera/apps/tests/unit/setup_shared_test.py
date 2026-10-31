"""Verify the parts of the setup pages that every app shares: the setup wizard's common steps, and style editing.

Each app's setup page used to repeat this code. These tests open every app's real setup page, so they
check the shared behavior wherever it's used.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

# Each app's setup page, and the wizard page that follows Welcome
APPS = {
    "image_compare": "Languages",
    "infostation": "Languages",
    "media_browser": "Languages",
    "media_player": "Content",
    "other": "Mode",
    "survey_kiosk": "Languages",
    "timelapse_viewer": "Media",
    "timeline_explorer": "Languages",
    "voting_kiosk": "Question",
    "word_cloud/input": "Question",
    "word_cloud/viewer": "Collection",
}
APP_IDS = {"word_cloud/input": "word_cloud_input", "word_cloud/viewer": "word_cloud_viewer"}

# Apps whose wizard asks for languages after Welcome
LANGUAGE_APPS = [app for app, page in APPS.items() if page == "Languages"]

# Apps whose wizard can finish without choosing files
SIMPLE_WIZARD_APPS = ["voting_kiosk", "word_cloud/input", "word_cloud/viewer"]

# Apps with color, font and text size settings
STYLE_APPS = [app for app in APPS if app != "other"]


def run_setup(app: str, script: str, definition: dict | None = None):
    """Open the app's setup page, optionally with the given definition open, and run script.

    The page talks to a fake Apps server that keeps the definitions written to it.
    """

    app_id = APP_IDS.get(app, app)
    definitions = {definition["uuid"]: {"app": app_id, **definition}} if definition else {}
    search = f"?definition={definition['uuid']}" if definition else ""

    return page_scripts.run(f"""
        const definitions = {json.dumps(definitions)}
        globalThis.server = (method, url, body) => {{
          const path = new URL(url).pathname
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path.startsWith('/internal/definitions/app/')) {{
            // Like Apps, list saved definitions but not the setup page's previews
            const listed = Object.fromEntries(Object.entries(definitions).filter(([uuid]) => !uuid.startsWith('__preview')))
            return {{ body: {{ success: true, definitions: listed }} }}
          }}
          if (path === '/internal/definitions/write') {{
            const written = JSON.parse(body).definition
            definitions[written.uuid] = written
            return {{ body: {{ success: true, uuid: written.uuid }} }}
          }}
          if (path === '/internal/files/availableContent') {{
            return {{ body: {{ content: [], content_details: [], static: [], static_details: [] }} }}
          }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        console.error = () => {{}}
        const window = await browser.openPage('apps', '{app}/setup.html', {{ search: '{search}' }})
        const document = window.document
        const exSetup = await import({page_scripts.module_url("apps/js/exhibitera_setup_common.js")})
        await browser.wait(1500)
        document.querySelectorAll('.modal.show').forEach((m) => bootstrap.Modal.getInstance(m)?.hide())

        const shownPanes = () => [...document.querySelectorAll('.wizard-pane')]
          .filter((pane) => pane.style.display === 'block').map((pane) => pane.id.replace('wizardPane_', ''))
        const forward = (page) => document.querySelector(`.wizard-forward[data-current-page="${{page}}"]`).click()
        const back = (page) => document.querySelector(`.wizard-back[data-current-page="${{page}}"]`).click()
        const display = (id) => document.getElementById(id).style.display
        const openWizard = async () => {{
          document.getElementById('showWizardButton').click()
          await browser.wait(500)
        }}

        {script}
    """, browser="page")


@pytest.mark.parametrize("app", APPS)
def test_wizard_requires_a_definition_name(app):
    result = run_setup(app, """
        await openWizard()
        const start = shownPanes()
        forward('Welcome')
        await browser.wait(200)
        const blank = { panes: shownPanes(), warning: display('wizardDefinitionNameBlankWarning') }
        document.getElementById('wizardDefinitionNameInput').value = 'Lobby'
        forward('Welcome')
        await browser.wait(500)
        const named = { panes: shownPanes(), warning: display('wizardDefinitionNameBlankWarning') }
        back(named.panes[0])
        await browser.wait(200)
        report({ start, blank, named, backAgain: shownPanes(), errors: browser.errors })
    """)

    assert result == {"start": ["Welcome"],
                      "blank": {"panes": ["Welcome"], "warning": "block"},
                      "named": {"panes": [APPS[app]], "warning": "none"},
                      "backAgain": ["Welcome"],
                      "errors": []}


@pytest.mark.parametrize("app", LANGUAGE_APPS)
def test_wizard_requires_a_language(app):
    result = run_setup(app, """
        await openWizard()
        document.getElementById('wizardDefinitionNameInput').value = 'Lobby'
        forward('Welcome')
        await browser.wait(300)
        document.getElementById('wizardLanguages').innerHTML = ''
        forward('Languages')
        await browser.wait(300)
        const none = { panes: shownPanes(), warning: display('wizardLanguagesBlankWarning') }
        document.getElementById('wizardAddLanguageButton').click()
        await browser.wait(300)
        forward('Languages')
        await browser.wait(500)
        const chosen = { leftLanguages: !shownPanes().includes('Languages'), warning: display('wizardLanguagesBlankWarning') }
        report({ none, chosen, errors: browser.errors })
    """)

    assert result == {"none": {"panes": ["Languages"], "warning": "block"},
                      "chosen": {"leftLanguages": True, "warning": "none"},
                      "errors": []}


@pytest.mark.parametrize("app", SIMPLE_WIZARD_APPS)
def test_wizard_saves_and_opens_the_new_definition(app):
    result = run_setup(app, """
        await openWizard()
        document.getElementById('wizardDefinitionNameInput').value = 'From the wizard'
        // Accept each page's defaults until the wizard closes
        for (let step = 0; step < 10 && shownPanes().length === 1; step++) {
          const page = shownPanes()[0]
          for (const field of document.getElementById('wizardPane_' + page).querySelectorAll('input[type=text], textarea')) {
            if (field.value === '') field.value = 'Test'
          }
          forward(page)
          await browser.wait(500)
          if (shownPanes()[0] === page) break // Stuck on a page that needs input
        }
        await browser.wait(1000)
        const saved = Object.values(definitions).filter((d) => d.name === 'From the wizard' && !d.uuid.startsWith('__preview'))
        report({
          saved: saved.length,
          wizardOpen: document.getElementById('setupWizardModal').classList.contains('show'),
          selected: document.getElementById('availableDefinitionSelect').value === saved[0]?.uuid,
          editing: exSetup.config.workingDefinition.uuid === saved[0]?.uuid,
          name: document.getElementById('definitionNameInput').value,
          errors: browser.errors
        })
    """)

    assert result == {"saved": 1, "wizardOpen": False, "selected": True, "editing": True,
                      "name": "From the wizard", "errors": []}


@pytest.mark.parametrize("app", STYLE_APPS)
def test_opening_a_definition_shows_its_style(app):
    result = run_setup(app, """
        const colorInput = document.querySelector('.coloris[id^="colorPicker_"][data-property]')
        const slider = [...document.querySelectorAll('.text-size-slider')].find((el) => el.id.endsWith('TextSizeSlider'))

        // A definition based on the app's blank one, with a color and a text size set
        const definition = structuredClone(exSetup.config.blankDefinition)
        Object.assign(definition, { uuid: 'styled', name: 'Styled', app: exSetup.config.app })
        definition.style ??= {}
        if (colorInput) definition.style.color = { ...definition.style.color, [colorInput.id.replace('colorPicker_', '')]: '#123456' }
        if (slider) definition.style.text_size = { ...definition.style.text_size, [slider.id.replace('TextSizeSlider', '')]: Number(slider.max) }
        definitions.styled = definition
        exSetup.populateAvailableDefinitions({ styled: definition })
        exSetup.config.loadDefinition('styled')
        await browser.wait(1000)

        report({
          color: colorInput?.value ?? null,
          textSize: slider?.value ?? null,
          sliderMax: slider?.max ?? null,
          errors: browser.errors
        })
    """)

    assert result["errors"] == []
    if result["color"] is not None:
        assert result["color"] == "#123456"
    if result["textSize"] is not None:
        assert result["textSize"] == result["sliderMax"]


@pytest.mark.parametrize("app", STYLE_APPS)
def test_editing_style_updates_the_definition(app):
    result = run_setup(app, """
        const colorInput = document.querySelector('.coloris[id^="colorPicker_"][data-property]')
        if (colorInput) {
          colorInput.value = '#abcdef'
          colorInput.dispatchEvent(new Event('change', { bubbles: true }))
        }
        const slider = document.querySelector('.text-size-slider')
        if (slider) {
          slider.value = slider.max
          slider.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const before = browser.requests.length
        document.getElementById('manageFontsButton')?.click()
        await browser.wait(500)
        const style = exSetup.config.workingDefinition.style ?? {}
        report({
          colorProperty: colorInput?.dataset.property ?? null,
          color: colorInput ? style.color?.[colorInput.dataset.property] ?? null : null,
          sliderProperty: slider?.dataset.property ?? null,
          textSize: slider ? String(style.text_size?.[slider.dataset.property]) : null,
          sliderMax: slider?.max ?? null,
          fontManagerOpened: browser.requests.slice(before).some((r) => r.url.includes('/files/availableContent')),
          errors: browser.errors
        })
    """)

    assert result["errors"] == []
    if result["colorProperty"] is not None:
        assert result["color"] == "#abcdef"
    if result["sliderProperty"] is not None:
        assert result["textSize"] == result["sliderMax"]
    assert result["fontManagerOpened"] is True
