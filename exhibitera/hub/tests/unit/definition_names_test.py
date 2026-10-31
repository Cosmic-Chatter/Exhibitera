"""Verify how Hub's console names Apps definitions, including ones saved without a name.

Definitions made by hand or by older versions may have no name. The console showed these as "undefined" in
its menus, with a blank label in the component dialog, and as "No definition" in the exhibition editor.
"""

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts

pytestmark = page_scripts.needs_node


@pytest.mark.parametrize("definition, expected", [("{ name: 'Lobby loop' }", "Lobby loop"),
                                                  ("{}", "Unnamed definition"),
                                                  ("{ name: '' }", "Unnamed definition"),
                                                  ("undefined", "Unnamed definition")])
def test_definition_display_name(definition, expected):
    result = page_scripts.run(f"""
        globalThis.server = () => ({{ body: {{}} }})
        const hubTools = await import({page_scripts.module_url("hub/js/tools.js")})
        report(hubTools.getDefinitionDisplayName({definition}))
    """)

    assert result == expected
