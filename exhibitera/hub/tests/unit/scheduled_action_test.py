"""Verify that Hub skips actions saved without a target or a value, instead of failing when they run.

The schedule editor used to save "Set definition" and "Set DMX scene" actions with no target or value when the
component couldn't list its options. Hub may still have actions saved that way.
"""

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.exhibitions as hub_exhibitions


@pytest.fixture
def exhibition(monkeypatch):
    """Record what the actions do, returning the exhibitions loaded."""

    monkeypatch.setattr(hub_config, 'exhibit_configuration', {"components": []})
    monkeypatch.setattr(hub_config, 'exhibit_modifications', {"components": []})
    loaded = []
    monkeypatch.setattr(hub_exhibitions, 'load_exhibition', lambda uuid_str: loaded.append(uuid_str))
    monkeypatch.setattr(hub_exhibitions.hub_components, 'get_exhibit_component', lambda uuid_str: None)
    return loaded


@pytest.mark.parametrize("action, target, value", [
    ("set_definition", [], ""),
    ("set_definition", [], "d1"),
    ("set_definition", [{"type": "component", "uuid": "c1"}], ""),
    ("set_dmx_scene", [], ""),
    ("set_exhibit", [], None),
])
def test_actions_without_a_target_or_value_are_skipped(exhibition, action, target, value):
    hub_exhibitions.execute_action(action, target, value)

    assert hub_config.exhibit_modifications == {"components": []}
    assert exhibition == []


def test_complete_actions_still_run(exhibition):
    hub_exhibitions.execute_action("set_definition", [{"type": "component", "uuid": "c1"}], "d1")
    hub_exhibitions.execute_action("set_exhibit", [{"type": "value", "value": "e1"}], None)

    assert hub_config.exhibit_modifications == {"components": [{"uuid": "c1", "definition": "d1"}]}
    assert exhibition == ["e1"]
