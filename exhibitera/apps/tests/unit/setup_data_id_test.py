"""Verify that Voting and Survey Kiosk definitions get the data ID that Hub stores their data by.

A new definition gets a data ID, and so does a clone, since it collects its own data. Copying a
definition to another Apps server keeps its ID, so both copies add to the same data. Definitions made
before data IDs existed aren't given one when saved, so they keep adding to the data with their name.
"""

# Third-party modules
import pytest

# Exhibitera modules
from exhibitera.common.tests import page_scripts
from exhibitera.apps.tests.unit.setup_shared_test import run_setup

pytestmark = page_scripts.needs_jsdom

KIOSK_APPS = ["voting_kiosk", "survey_kiosk"]


# Add a definition based on the app's blank one, and open it
OPEN_DEFINITION = """
    const openDefinition = async (details) => {
      const definition = structuredClone(exSetup.config.blankDefinition)
      delete definition.data_id
      Object.assign(definition, { uuid: 'd1', name: 'Lobby', app: exSetup.config.app }, details)
      definitions.d1 = definition
      exSetup.populateAvailableDefinitions({ d1: definition })
      document.getElementById('availableDefinitionSelect').value = 'd1'
      exSetup.config.loadDefinition('d1')
      await browser.wait(800)
    }
"""


@pytest.mark.parametrize("app", KIOSK_APPS)
def test_new_and_cloned_definitions_get_their_own_data_id(app):
    result = run_setup(app, OPEN_DEFINITION + """
        const newID = exSetup.config.workingDefinition.data_id
        exSetup.initializeDefinition()
        const anotherNewID = exSetup.config.workingDefinition.data_id
        await openDefinition({ data_id: 'original-id' })
        document.getElementById('cloneDefinitionButton').click()
        await browser.wait(800)
        const clone = Object.values(definitions).find((d) => d.name === 'Lobby 2')
        report({ newID, anotherNewID, cloneID: clone?.data_id, errors: browser.errors })
    """)

    assert result["errors"] == []
    ids = [result.get("newID"), result.get("anotherNewID"), result.get("cloneID")]
    assert all(isinstance(i, str) and len(i) > 8 for i in ids)
    assert len(set(ids + ["original-id"])) == 4


@pytest.mark.parametrize("app", KIOSK_APPS)
def test_older_definitions_are_not_given_a_data_id(app):
    result = run_setup(app, OPEN_DEFINITION + """
        await openDefinition({})
        const nameInput = document.getElementById('definitionNameInput')
        nameInput.value = 'Lobby (renamed)'
        nameInput.dispatchEvent(new Event('change', { bubbles: true }))
        document.getElementById('definitionSaveButton').click()
        await browser.wait(800)
        report({ saved: definitions.d1, errors: browser.errors })
    """)

    assert result["errors"] == []
    assert result["saved"]["name"] == "Lobby (renamed)"
    assert "data_id" not in result["saved"]
