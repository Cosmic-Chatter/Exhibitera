"""Verify that Survey Kiosk's Start over button and its "Are you still working?" popup follow the definition.

Their text used to be English whatever the language, and the popup used its own colors. Each language can now set
the text, which is English when it isn't set. The popup takes the survey's colors: the question background and
header color, the Start over button's colors, and the Next button's colors for continuing.
"""

# Standard modules
import json

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom

ENGLISH = {"restart": "Start over", "question": "Are you still working?", "popup_restart": "Start over",
           "keep_working": "Keep working"}


def definition(languages: dict) -> dict:
    return {"uuid": "d1", "app": "survey_kiosk", "name": "Exit survey",
            "style": {"color": {}, "text_size": {}, "font": {}, "item_background": {"mode": "color", "color": "#123456"}},
            "behavior": {}, "text": {},
            "item_order": ["i1"], "items": {"i1": {"uuid": "i1", "type": "text"}},
            "language_order": list(languages), "languages": languages}


def show_kiosk(languages: dict, script: str) -> dict:
    configuration = {"app": {"definition": "d1"}, "system": {"standalone": True, "remote_display": True}}
    return page_scripts.run(f"""
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/system/configuration') return {{ body: {json.dumps(configuration)} }}
          if (pathname === '/internal/definitions/d1/load') return {{ body: {{ success: true, definition: {json.dumps(definition(languages))} }} }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('apps', 'survey_kiosk/index.html')
        const document = window.document
        await browser.wait(500)
        const el = (id) => document.getElementById(id)
        const text = () => ({{
          restart: el('restartButton').textContent.trim(),
          question: el('inactivityHeader').textContent.trim(),
          popup_restart: el('inactivityRestartButton').textContent.trim(),
          keep_working: el('inactivityContinueButton').textContent.trim()
        }})
        {script}
    """, browser="page")


FRENCH = {"restart": "Recommencer", "still_working": "Êtes-vous toujours là ?", "keep_working": "Continuer"}


def test_the_first_language_is_shown_first():
    languages = {"en": {"display_name": "English", "items": {}},
                 "fr": {"display_name": "Français", "items": {}, "interface": FRENCH}}
    result = show_kiosk(languages, """
        report({ errors: browser.errors, first: text() })
    """)

    # English is first, and sets nothing, so it's shown in English
    assert result == {"errors": [], "first": ENGLISH}


def test_text_follows_the_chosen_language():
    languages = {"fr": {"display_name": "Français", "items": {}, "interface": FRENCH},
                 "en": {"display_name": "English", "items": {}}}
    result = show_kiosk(languages, """
        report({ errors: browser.errors, french: text() })
    """)

    assert result == {"errors": [], "french": {"restart": "Recommencer", "question": "Êtes-vous toujours là ?",
                                              "popup_restart": "Recommencer", "keep_working": "Continuer"}}


@pytest.mark.parametrize("interface", [{}, {"restart": "", "still_working": "  ", "keep_working": ""}])
def test_text_that_isnt_set_is_english(interface):
    result = show_kiosk({"fr": {"display_name": "Français", "items": {}, "interface": interface}}, """
        report({ errors: browser.errors, text: text() })
    """)

    assert result == {"errors": [], "text": ENGLISH}


def test_the_popup_uses_the_surveys_colors():
    result = show_kiosk({"en": {"display_name": "English", "items": {}}}, """
        const classes = (id) => [...el(id).classList]
        report({
          errors: browser.errors,
          // Bootstrap's own red and green buttons aren't used
          restartClasses: classes('inactivityRestartButton').filter((c) => c.startsWith('btn-')),
          continueClasses: classes('inactivityContinueButton').filter((c) => c.startsWith('btn-')),
          // The question background is the item background
          panelBackground: document.querySelector('#inactivityModal .modal-content').style.backgroundColor
        })
    """)

    assert result == {"errors": [], "restartClasses": ["btn-lg"], "continueClasses": ["btn-lg"],
                      "panelBackground": "rgb(18, 52, 86)"}


def test_definitions_with_an_old_success_message_still_load():
    # Before end screens, a survey could have a success message. Its element is gone, and setting it stopped the
    # survey from loading.
    old = {"en": {"display_name": "English", "items": {"i1": {"header": {"text": "Welcome"}}}}}
    result = page_scripts.run(f"""
        const definition = {json.dumps({**definition(old), "text": {"success_message": "Thank you!"}})}
        const configuration = {json.dumps({"app": {"definition": "d1"}, "system": {"standalone": True, "remote_display": True}})}
        globalThis.server = (method, url) => {{
          const {{ pathname }} = new URL(url)
          if (pathname === '/internal/system/configuration') return {{ body: configuration }}
          if (pathname === '/internal/definitions/d1/load') return {{ body: {{ success: true, definition }} }}
          return {{ body: {{ success: false }} }}
        }}
        console.log = () => {{}}
        const window = await browser.openPage('apps', 'survey_kiosk/index.html')
        // The first question animates in
        await browser.wait(1500)
        report({{ errors: browser.errors, question: window.document.querySelector('#itemPane .question')?.textContent.trim() ?? null }})
    """, browser="page")

    assert result == {"errors": [], "question": "Welcome"}
