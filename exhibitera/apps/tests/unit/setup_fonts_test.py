"""Verify the axis sliders that setup pages show for each font picker.

Variable fonts have adjustable axes, such as weight, and get a slider for each. Static fonts have none.
Opening a definition resets each picker to its default variable font and then sets the definition's font.
Both fonts are checked in the background, and the large default font used to finish last, so a static font
was shown with the default font's sliders.
"""

# Standard modules
import json

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_jsdom


def open_infostation_with_header_font(font_path: str) -> dict:
    """Open an InfoStation definition with the given header font and report the header picker."""

    definition = {"uuid": "def-A", "name": "Fonts", "app": "infostation", "language_order": ["en"],
                  "languages": {"en": {"code": "en", "display_name": "English", "english_name": "English",
                                       "tab_order": [], "tabs": {}}},
                  "style": {"font": {"header": {"path": font_path, "axes": {}}}}}

    return page_scripts.run(f"""
        const {{ readFileSync }} = await import('node:fs')
        const opentype = (await import({page_scripts.module_url("apps/js/opentype@1.3.1.js")})).default

        // A small static font, which has no axes
        const notdef = new opentype.Glyph({{ name: '.notdef', unicode: 0, advanceWidth: 650, path: new opentype.Path() }})
        const staticFont = new opentype.Font({{
          familyName: 'Static Test', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: [notdef]
        }}).toArrayBuffer()

        const definition = {json.dumps(definition)}
        globalThis.server = (method, url) => {{
          const path = decodeURIComponent(new URL(url).pathname)
          if (path === '/internal/system/configuration') return {{ body: {{ app: {{}}, system: {{ standalone: true }} }} }}
          if (path.startsWith('/internal/definitions/app/')) {{
            return {{ body: {{ success: true, definitions: {{ 'def-A': definition }} }} }}
          }}
          if (path === '/internal/files/availableContent') return {{ body: {{ success: true, content: ['Static.ttf'] }} }}
          if (path === '/content/Static.ttf') return {{ bytes: staticFont }}
          // The default fonts are large files, so in a browser they arrive after a small font
          if (path.startsWith('/_fonts/')) {{
            return {{ bytes: readFileSync({json.dumps(str(page_scripts.EXHIBITERA_DIR / "apps"))} + path), delay: 300 }}
          }}
          return {{ body: {{ version: {{}}, success: false }} }}
        }}
        console.log = () => {{}}
        console.warn = () => {{}}
        const window = await browser.openPage('apps', 'infostation/setup.html', {{ search: '?definition=def-A' }})
        await browser.wait(4000)
        const picker = window.document.querySelector('.AFP-select[data-path="style>font>header"]').closest('.advanced-font-picker')
        report({{
          errors: browser.errors,
          font: picker.querySelector('.AFP-btn-text').textContent,
          sliders: [...picker.querySelectorAll('.font-axis-slider')].map((s) => s.dataset.axis)
        }})
    """, browser="page")


def test_static_font_has_no_axis_sliders():
    result = open_infostation_with_header_font("/content/Static.ttf")

    assert result == {"errors": [], "font": "Static Test Regular", "sliders": []}


def test_variable_font_has_axis_sliders():
    result = open_infostation_with_header_font("/_fonts/Noto/NotoSerif-VariableFont_wdth,wght.ttf")

    assert result["errors"] == []
    assert sorted(result["sliders"]) == ["wdth", "wght"]


def test_font_buttons_use_the_themes_text_color():
    # The button showing each picker's font used white text, which can't be read on a light page
    result = page_scripts.run("""
        globalThis.server = (method, url) => {
          const path = decodeURIComponent(new URL(url).pathname)
          if (path === '/internal/system/configuration') return { body: { app: {}, system: { standalone: true } } }
          if (path === '/internal/files/availableContent') return { body: { success: true, content: [] } }
          return { body: { version: {}, success: false } }
        }
        console.log = () => {}
        console.warn = () => {}
        const window = await browser.openPage('apps', 'infostation/setup.html')
        await browser.wait(1000)
        const buttons = [...window.document.querySelectorAll('.AFP-dropdown-toggle')]
        const fixedColors = ['text-light', 'text-white', 'text-dark', 'text-black']
        report({
          buttons: buttons.length > 0,
          fixed: buttons.filter((b) => fixedColors.some((c) => b.classList.contains(c))).length,
          themed: buttons.every((b) => b.classList.contains('text-body'))
        })
    """, browser="page")

    assert result == {"buttons": True, "fixed": 0, "themed": True}


def test_font_previews_use_the_fonts_themselves():
    # The previews loaded each font under its display name without spaces, so Serif and Monospace became the CSS
    # keywords serif and monospace, and showed the browser's own fonts, which the weight and width sliders can't change
    result = page_scripts.run("""
        globalThis.server = (method, url) => {
          const path = decodeURIComponent(new URL(url).pathname)
          if (path === '/internal/system/configuration') return { body: { app: {}, system: { standalone: true } } }
          if (path === '/internal/files/availableContent') return { body: { success: true, content: [] } }
          return { body: { version: {}, success: false } }
        }
        console.log = () => {}
        console.warn = () => {}
        const window = await browser.openPage('apps', 'infostation/setup.html')
        await browser.wait(1000)
        const keywords = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'math', 'emoji',
                          'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'fangsong']
        const unquoted = (family) => family.replace(/^["']|["']$/g, '')
        const picker = window.document.querySelector('.advanced-font-picker')
        const previews = [...picker.querySelectorAll('.AFP-scroll-zone .dropdown-item')].map((item) => ({
          font: item.dataset.value.split('/').pop(),
          family: unquoted(item.querySelector('span:nth-child(2)').style.fontFamily)
        }))
        const selected = picker.querySelector('.dropdown-item.active')
        report({
          errors: browser.errors,
          keywords: previews.filter((p) => keywords.includes(p.family.toLowerCase())).map((p) => p.font),
          distinct: new Set(previews.map((p) => p.family)).size === previews.length,
          button: unquoted(picker.querySelector('.AFP-dropdown-toggle').style.fontFamily) ===
                  unquoted(selected.querySelector('span:nth-child(2)').style.fontFamily)
        })
    """, browser="page")

    assert result == {"errors": [], "keywords": [], "distinct": True, "button": True}
