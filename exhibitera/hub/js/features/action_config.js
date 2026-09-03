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
    modalId = null, // Used to look up dataset.currentValue when editing
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
        const groupName = hubTools.getGroupName(item.group)
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
      console.log('ActionConfigurator.configureValueSelector: component not available:', target.uuid)
      return
    }

    if ((component?.helperAddress ?? '') === '') {
      if (this.errorAlertId != null) {
        const alertEl = this._el(this.errorAlertId)
        if (alertEl) alertEl.textContent = 'This component is not responding'
      }
      if (this.onError) this.onError('This component is not responding')
      valueSelector.style.display = 'none'
      valueSelectorLabel.style.display = 'none'
      return
    } else if (this.onErrorClear) {
      this.onErrorClear()
    }

    let response
    try {
      if (action === 'set_definition') {
        response = await component.makeRequest({ method: 'GET', endpoint: '/definitions' })
        if (response?.success === true) {
          const appDict = hubTools.sortDefinitionsByApp(response.definitions)
          for (const app of Object.keys(appDict).sort()) {
            const header = new Option(exUtilities.appNameToDisplayName(app))
            header.disabled = true
            valueSelector.appendChild(header)

            for (const def of appDict[app]) {
              valueSelector.appendChild(new Option(def.name, def.uuid))
            }
          }
        }
      } else if (action === 'set_dmx_scene') {
        response = await component.makeRequest({ method: 'GET', endpoint: '/DMX/scenes' })
        if (response?.success === true) {
          for (const scene of response.scenes) {
            valueSelector.appendChild(new Option(scene.name, scene.uuid))
          }
        }
      }
    } catch {
      console.log('ActionConfigurator.configureValueSelector: invalid helper address')
    }

    // In the case of editing an action, preselect any existing value
    if (this.modalId != null) {
      const modal = this._el(this.modalId)
      if (modal?.dataset?.currentValue != null) {
        valueSelector.value = modal.dataset.currentValue
      }
    }

    valueSelector.style.display = 'block'
    valueSelectorLabel.style.display = 'block'
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
    if (target.type === 'group') return 'all ' + hubTools.getGroupName(target.uuid)
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
