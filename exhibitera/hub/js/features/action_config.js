import * as exUtilities from '../../../common/utilities.js'

import hubConfig from '../../config.js'
import * as hubTools from '../tools.js'

export const ACTION_TARGET_OPTIONS = {
  power_on: { multiple: true, options: ['All', 'Groups', 'ExhibitComponents', 'Projectors'] },
  power_off: { multiple: true, options: ['All', 'Groups', 'ExhibitComponents', 'Projectors'] },
  refresh_page: { multiple: true, options: ['All', 'Groups', 'ExhibitComponents'] },
  restart: { multiple: true, options: ['All', 'Groups', 'ExhibitComponents'] },
  set_definition: { multiple: false, options: ['ExhibitComponents'] },
  set_dmx_scene: { multiple: false, options: ['ExhibitComponents'] }
}

// Actions that, once a target is picked, also need a value selector
// populated (e.g. "which definition" or "which DMX scene").
export const ACTIONS_WITH_VALUE_SELECTOR = ['set_definition', 'set_dmx_scene']

export class ActionConfigurator {
  constructor ({
    actionSelectorId,
    targetSelectorId,
    targetSelectorLabelId,
    valueSelectorId,
    valueSelectorLabelId,
    modalId = null,
    errorAlertId = null,
    onError = null,
    onErrorClear = null,
    // Map of action name -> array of extra element IDs to show for that
    // action (all other known extra elements are hidden). Use this for
    // tab-specific actions like 'note' (schedules) that don't fit the
    // generic target/value pattern.
    extraElements = {}
  }) {
    this.actionSelectorId = actionSelectorId
    this.targetSelectorId = targetSelectorId
    this.targetSelectorLabelId = targetSelectorLabelId
    this.valueSelectorId = valueSelectorId
    this.valueSelectorLabelId = valueSelectorLabelId
    this.modalId = modalId
    this.errorAlertId = errorAlertId
    this.onError = onError
    this.onErrorClear = onErrorClear
    this.extraElements = extraElements

    // When editing an action, its target and value, so the value is selected when that target's options are listed
    this.savedValue = null

    // Flat list of every extra element ID across all actions, used to
    // reset/hide everything before showing the ones relevant to the
    // current action.
    this._allExtraElementIds = Array.from(
      new Set(Object.values(extraElements).flat())
    )
  }

  _el (id) {
    return document.getElementById(id)
  }

  _hideExtraElements () {
    for (const id of this._allExtraElementIds) {
      const el = this._el(id)
      if (el) el.style.display = 'none'
    }
  }

  _showExtraElementsFor (action) {
    const ids = this.extraElements[action] ?? []
    for (const id of ids) {
      const el = this._el(id)
      if (el) el.style.display = 'block'
    }
  }

  /**
   * Populate a <select> with grouped options for the given target kinds.
   * kinds may include 'All', 'Groups', 'ExhibitComponents', 'Projectors'.
   * Mirrors the previous per-tab `actionTargetSelectorPopulateOptions`.
   */
  populateTargetOptions (targetSelector, kinds) {
    if (kinds.includes('All')) {
      targetSelector.appendChild(new Option('All', JSON.stringify({ type: 'all' })))
    }

    if (kinds.includes('Groups')) {
      const sep = new Option('Groups', null)
      sep.disabled = true
      targetSelector.appendChild(sep)

      for (const item of hubConfig.componentGroups) {
        const groupName = hubTools.getActiveGroupName(item.group)
        targetSelector.appendChild(new Option(groupName, JSON.stringify({
          type: 'group',
          uuid: item.group
        })))
      }
    }

    if (kinds.includes('ExhibitComponents') || kinds.includes('Projectors')) {
      const sep = new Option('Components', null)
      sep.disabled = true
      targetSelector.appendChild(sep)

      const sortedComponents = hubTools.sortExhibitComponentsByID()

      if (kinds.includes('ExhibitComponents')) {
        for (const item of sortedComponents) {
          if (item.type === 'exhibit_component' && item.status !== hubConfig.STATUS.STATIC) {
            targetSelector.appendChild(new Option(item.id, JSON.stringify({
              type: 'component',
              uuid: item.uuid
            })))
          }
        }
      }
      if (kinds.includes('Projectors')) {
        for (const item of sortedComponents) {
          if (item.type === 'projector') {
            targetSelector.appendChild(new Option(item.id, JSON.stringify({
              type: 'component',
              uuid: item.uuid
            })))
          }
        }
      }
    }
  }

  /**
   * Show/hide + populate the target selector (and cascade into the value
   * selector when appropriate) for the given action.
   */
  configureTargetSelector (action, target, extraHandlers = {}) {
    if (action == null) action = this._el(this.actionSelectorId).value

    const targetSelector = this._el(this.targetSelectorId)
    const targetSelectorLabel = this._el(this.targetSelectorLabelId)
    const valueSelector = this._el(this.valueSelectorId)
    const valueSelectorLabel = this._el(this.valueSelectorLabelId)

    // Reset by default; specific branches below turn things back on.
    targetSelector.innerHTML = ''
    targetSelector.style.display = 'none'
    targetSelectorLabel.style.display = 'none'
    valueSelector.style.display = 'none'
    valueSelectorLabel.style.display = 'none'
    this._hideExtraElements()

    // Allow a tab to handle actions the generic system doesn't know about
    // (e.g. 'set_exhibit', 'note', 'clear_exhibition_mods') via a custom
    // handler, keyed by action name.
    if (action in extraHandlers) {
      extraHandlers[action]({ targetSelector, targetSelectorLabel, valueSelector, valueSelectorLabel })
      this._showExtraElementsFor(action)
      return
    }

    const config = ACTION_TARGET_OPTIONS[action]
    if (config == null) {
      // Unknown/empty action: everything stays hidden.
      this._showExtraElementsFor(action)
      return
    }

    targetSelector.multiple = config.multiple
    if (config.multiple) {
      targetSelector.setAttribute('multiple', true)
    } else {
      targetSelector.removeAttribute('multiple')
    }
    this.populateTargetOptions(targetSelector, config.options)

    targetSelector.style.display = 'block'
    targetSelectorLabel.style.display = 'block'

    if (ACTIONS_WITH_VALUE_SELECTOR.includes(action)) {
      // Caller awaits this separately (configureValueSelector is async);
      // fire and forget here mirrors prior behavior.
      this.configureValueSelector(action, target)
    }

    this._showExtraElementsFor(action)
  }

  /**
   * Populate the value selector for actions that need one
   * (set_definition, set_dmx_scene). Looks up the target's component and
   * queries it directly for the relevant list of options.
   */
  async configureValueSelector (action, target) {
    if (action == null) action = this._el(this.actionSelectorId).value
    if (target == null) {
      try {
        target = JSON.parse(this._el(this.targetSelectorId).value)
      } catch {
        target = null
      }
    }
    if (Array.isArray(target)) target = target[0]

    const valueSelector = this._el(this.valueSelectorId)
    const valueSelectorLabel = this._el(this.valueSelectorLabelId)

    // Why the options couldn't be listed, if they couldn't, for explaining why the action can't be saved
    this.valueProblem = null
    const request = this._valueRequest = (this._valueRequest ?? 0) + 1

    if (!ACTIONS_WITH_VALUE_SELECTOR.includes(action)) {
      valueSelector.style.display = 'none'
      valueSelectorLabel.style.display = 'none'
      return
    }

    valueSelector.innerHTML = ''

    if (target == null) return

    let component
    try {
      component = hubTools.getExhibitComponent(target.uuid)
    } catch {
      return
    }
    if (component == null) {
      this._showValueProblem(action, "This component can't be found")
      return
    }
    if ((component?.helperAddress ?? '') === '') {
      this._showValueProblem(action, 'This component is not responding')
      return
    }

    let response
    try {
      if (action === 'set_definition') {
        response = await component.makeRequest({ method: 'GET', endpoint: '/definitions' })
      } else if (action === 'set_dmx_scene') {
        response = await component.makeRequest({ method: 'GET', endpoint: '/DMX/scenes' })
      }
    } catch {
      response = null
    }
    // Ignore answers to an earlier request, such as for a component chosen before this one
    if (request !== this._valueRequest) return
    if (response == null) {
      this._showValueProblem(action, 'This component is not responding')
      return
    }
    if (response.success !== true) {
      // The component answered, but couldn't list the options, such as lighting scenes without DMX set up
      if (response.reason === 'no_config_file' && action === 'set_dmx_scene') {
        this._showValueProblem(action, "This component doesn't have DMX lighting set up", true)
      } else if (response.reason === 'device_not_found' && action === 'set_dmx_scene') {
        this._showValueProblem(action, "This component can't find its DMX controller")
      } else {
        this._showValueProblem(action, 'This component had a problem')
      }
      return
    }
    if (this.onErrorClear) this.onErrorClear()

    if (action === 'set_definition') {
      const appDict = hubTools.sortDefinitionsByApp(response.definitions)
      for (const app of Object.keys(appDict).sort()) {
        const header = new Option(exUtilities.appNameToDisplayName(app))
        header.disabled = true
        valueSelector.appendChild(header)

        for (const def of appDict[app]) {
          valueSelector.appendChild(new Option(hubTools.getDefinitionDisplayName(def), def.uuid))
        }
      }
    } else if (action === 'set_dmx_scene') {
      for (const scene of response.scenes) {
        valueSelector.appendChild(new Option(scene.name, scene.uuid))
      }
    }

    // When editing an action, select its saved value
    if (this.savedValue != null && this.savedValue.uuid === target.uuid) {
      valueSelector.value = this.savedValue.value
    }

    valueSelector.style.display = 'block'
    valueSelectorLabel.style.display = 'block'
  }

  editing (target = null, value = null) {
    // Call when opening the editor, with the target and value of the action being edited, or none for a new action.

    if (Array.isArray(target)) target = target[0]
    this.savedValue = (target?.uuid != null && value != null) ? { uuid: target.uuid, value } : null
  }

  selectTargets (targets) {
    // Select the given targets. Any that aren't listed, such as components Hub no longer has or that haven't
    // connected yet, are added, so saving keeps them unless they're deselected.

    const targetSelector = this._el(this.targetSelectorId)
    const wanted = (Array.isArray(targets) ? targets : [targets]).filter((target) => target != null)
      .map((target) => JSON.stringify(target))
    for (const option of targetSelector.options) {
      option.selected = wanted.includes(option.value)
    }

    const listed = Array.from(targetSelector.options).map((option) => option.value)
    for (const target of wanted) {
      if (listed.includes(target)) continue
      const details = JSON.parse(target)
      const option = new Option('Not found: ' + (details.uuid ?? details.value ?? ''), target)
      targetSelector.appendChild(option)
      option.selected = true
    }
  }

  problemWith (action, target, value) {
    // Return why an action with the given target and value can't be saved, or null if it can.

    if (ACTION_TARGET_OPTIONS[action] != null && (target == null || target.length === 0)) {
      return 'You must specify a target for this action'
    }
    if (ACTIONS_WITH_VALUE_SELECTOR.includes(action) && (value == null || value === '')) {
      // The options may not have been listed, such as when the component is offline
      return this.valueProblem ?? 'You must specify a value for this action'
    }
    return null
  }

  _showValueProblem (action, problem, complete = false) {
    // Explain why the value selector has no options, and hide it. Unless the problem is complete, it's followed
    // by the options that can't be listed.

    const options = action === 'set_dmx_scene' ? 'lighting scenes' : 'definitions'
    this.valueProblem = complete ? problem : `${problem}, so its ${options} can't be listed`
    if (this.errorAlertId != null) {
      const alertEl = this._el(this.errorAlertId)
      if (alertEl) alertEl.textContent = this.valueProblem
    }
    if (this.onError) this.onError(this.valueProblem)
    this._el(this.valueSelectorId).style.display = 'none'
    this._el(this.valueSelectorLabelId).style.display = 'none'
  }

  /**
   * Convert an action/target pair into a plain-language description,
   * e.g. "Power on" + {type: 'group', uuid} -> "Power on all Lobby".
   * Shared across the schedule list, exhibit action list, and program
   * action list.
   */
  static actionToDescription (action) {
    switch (action) {
      case 'clear_exhibition_mods':
        return 'Clear exhibition modifications'
      case 'power_off':
        return 'Power off'
      case 'power_on':
        return 'Power on'
      case 'refresh_page':
        return 'Refresh'
      case 'restart':
        return 'Restart'
      case 'run_program':
        return '' // Identify program simply by its name.
      case 'set_definition':
        return 'Set defintion for'
      case 'set_dmx_scene':
        return 'Set DMX scene for'
      case 'set_exhibit':
        return 'Set exhibit'
      case '':
        return 'No action'
      default:
        return action
    }
  }

  static targetToDescription (targetList, action = '') {
    if (targetList == null) return 'none'

    let target
    if (Array.isArray(targetList)) {
      let allComponents = true
      let allGroups = true
      for (const t of targetList) {
        if (t.type !== 'component') allComponents = false
        if (t.type !== 'group') allGroups = false
      }

      if (targetList.length > 10) {
        if (allComponents) return String(targetList.length) + ' components'
        if (allGroups) return String(targetList.length) + ' groups'
        return 'multiple components'
      } else if (targetList.length > 1) {
        const numberNames = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' }
        if (allComponents) return numberNames[targetList.length] + ' components'
        if (allGroups) return numberNames[targetList.length] + ' groups'
        return 'multiple components'
      } else if (targetList.length === 1) {
        target = targetList[0]
      } else {
        return 'none'
      }
    } else {
      target = targetList
    }

    if (target.type === 'all') return 'all components'
    if (target.type === 'group') return 'all ' + hubTools.getActiveGroupName(target.uuid)
    if (target.type === 'program') return hubTools.getProgramName(target.uuid)
    if (target.type === 'component') {
      const component = hubTools.getExhibitComponent(target.uuid)
      return component?.id ?? target.uuid
    }
    if (target.type === 'value' && action === 'set_exhibit') {
      return hubTools.getExhibitName(target.value)
    }
    return ''
  }
}
