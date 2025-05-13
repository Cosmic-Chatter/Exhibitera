/* global bootstrap */

import * as exUtilities from '../../../common/utilities.js'
import hubConfig from '../../config.js'
import exConfig from '../../../common/config.js'
import * as hubDMX from './dmx.js'
import * as hubGroups from './groups.js'
import * as hubMaint from './maintenance.js'
import * as hubTools from '../tools.js'
import * as hubUsers from './users.js'

class BaseComponent {
  // A basic Exhibitera component.

  constructor (uuid, id, groups) {
    this.uuid = uuid
    this.id = id
    this.groups = groups
    this.type = 'base_component'

    this.status = hubConfig.STATUS.OFFLINE
    this.maintenanceStatus = hubConfig.MAINTANANCE_STATUS['Off floor, not working']
    this.permissions = {}

    this.ip_address = null
    this.latency = null
    this.lastContactDateTime = null
  }

  buildHTML (group) {
    // Function to build the HTML representation of this component
    // and add it to the row of the parent group

    // First, make sure we have permission to view this group.
    if (hubUsers.checkUserPermission('components', 'view', group) === false) return

    let permission = 'view'
    if (hubUsers.checkUserPermission('components', 'edit', group)) {
      permission = 'edit'
    } else if (hubUsers.checkUserPermission('components', 'edit_content', group)) {
      permission = 'edit_content'
    }

    // If the element is static and we're not showing static elements, bail out
    if (this.status === hubConfig.STATUS.STATIC && hubUsers.checkUserPreference('show_static') === false) {
      return
    }

    const displayName = this.id
    const thisUUID = this.uuid

    const col = document.createElement('div')
    col.classList = 'col mt-1'

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group h-100 w-100'
    col.appendChild(btnGroup)

    const mainButton = document.createElement('button')
    mainButton.classList = 'btn w-100 componentStatusButton ' + this.getStatus().colorClass
    if (hubUsers.checkUserPreference('components_size') === 'small') {
      mainButton.classList.add('btn-sm')
    } else if (hubUsers.checkUserPreference('components_size') === 'large') {
      mainButton.classList.add('btn-lg')
    }

    if (hubUsers.checkUserPreference('components_layout') === 'list') {
      if (hubUsers.checkUserPreference('components_size') === 'small') {
        mainButton.classList.add('py-0')
      } else if (hubUsers.checkUserPreference('components_size') === 'regular') {
        mainButton.classList.add('py-1')
      } else if (hubUsers.checkUserPreference('components_size') === 'regular') {
        mainButton.classList.add('py-2')
      }
    }

    mainButton.setAttribute('type', 'button')
    mainButton.setAttribute('id', this.uuid + '_' + group + '_MainButton')
    mainButton.addEventListener('click', function () {
      showExhibitComponentInfo(thisUUID, group)
    }, false)
    btnGroup.appendChild(mainButton)

    const row = document.createElement('div')
    row.classList = 'row'
    mainButton.appendChild(row)

    const displayNameCol = document.createElement('div')
    if (hubUsers.checkUserPreference('components_layout') === 'grid') {
      displayNameCol.classList = 'col-12 d-flex justify-content-center align-items-center'
    } else {
      if (hubUsers.checkUserPreference('status_mode') === 'realtime') {
        displayNameCol.classList = 'col-8 d-flex justify-content-start align-items-center'
      } else {
        displayNameCol.classList = 'col-5 d-flex justify-content-start align-items-center'
      }
    }
    row.appendChild(displayNameCol)

    const displayNameEl = document.createElement('div')
    displayNameEl.classList = 'fw-medium'
    if (hubUsers.checkUserPreference('components_size') === 'regular') {
      displayNameEl.classList.add('fs-6')
    } else if (hubUsers.checkUserPreference('components_size') === 'large') {
      displayNameEl.classList.add('fs-5')
    }
    displayNameEl.innerHTML = displayName
    displayNameCol.appendChild(displayNameEl)

    const statusFieldCol = document.createElement('div')
    if (hubUsers.checkUserPreference('components_layout') === 'grid') {
      statusFieldCol.classList = 'col-12 d-flex justify-content-center  align-items-center'
    } else {
      if (hubUsers.checkUserPreference('status_mode') === 'realtime') {
        statusFieldCol.classList = 'col-4 d-flex justify-content-end align-items-center'
      } else {
        statusFieldCol.classList = 'col-7 d-flex justify-content-end  align-items-center'
      }
    }
    row.appendChild(statusFieldCol)

    const statusFieldEl = document.createElement('div')
    statusFieldEl.setAttribute('id', this.uuid + '_' + group + '_StatusField')
    statusFieldEl.innerHTML = this.getStatus().name
    if (hubUsers.checkUserPreference('components_size') === 'small') {
      statusFieldEl.classList.add('small')
    } else if (hubUsers.checkUserPreference('components_size') === 'large') {
      statusFieldEl.classList.add('fs-6')
    }
    statusFieldCol.appendChild(statusFieldEl)

    const dropdownButton = document.createElement('button')
    dropdownButton.classList = 'btn dropdown-toggle dropdown-toggle-split ' + this.getStatus().colorClass
    dropdownButton.setAttribute('id', this.uuid + '_' + group + '_DropdownButton')
    dropdownButton.setAttribute('type', 'button')
    dropdownButton.setAttribute('data-bs-toggle', 'dropdown')
    dropdownButton.setAttribute('aria-haspopup', 'true')
    dropdownButton.setAttribute('aria-expanded', 'false')
    if (hubUsers.checkUserPreference('components_layout') === 'list') {
      if (hubUsers.checkUserPreference('components_size') === 'small') {
        dropdownButton.classList.add('py-0')
      } else if (hubUsers.checkUserPreference('components_size') === 'regular') {
        dropdownButton.classList.add('py-0')
      }
    }

    btnGroup.appendChild(dropdownButton)

    const dropdownLabel = document.createElement('span')
    dropdownLabel.classList = 'visually-hidden'
    dropdownLabel.innerHTML = 'Toggle Dropdown'
    dropdownButton.appendChild(dropdownLabel)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'
    dropdownMenu.setAttribute('id', this.uuid + '_' + group + '_DropdownMenu')
    this.populateActionMenu(dropdownMenu, group, permission)
    btnGroup.appendChild(dropdownMenu)
    return col
  }

  getStatus () {
    // Return the current status, based on the selected status mode

    if (('preferences' in hubConfig.user) && ('status_mode' in hubConfig.user.preferences)) {
      if (hubConfig.user.preferences.status_mode === 'realtime' && (this.status != null)) {
        return this.status
      } else if (hubConfig.user.preferences.status_mode === 'maintenance' && (this.maintenanceStatus != null)) {
        return this.maintenanceStatus
      }
    }
    return hubConfig.MAINTANANCE_STATUS['Off floor, not working']
  }

  populateActionMenu (dropdownMenu, groupUUID, permission = 'view') {
    // Build out the dropdown menu options based on the this.permissions.

    dropdownMenu.innerHTML = ''
    const thisId = this.id
    const thisUUID = this.uuid
    let numOptions = 0

    if (permission === 'edit') {
      if ('refresh' in this.permissions && this.permissions.refresh === true) {
        numOptions += 1
        const refreshAction = document.createElement('a')
        refreshAction.classList = 'dropdown-item handCursor'
        refreshAction.innerHTML = 'Refresh component'
        refreshAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'refresh')
        }, false)
        dropdownMenu.appendChild(refreshAction)
      }

      if ('sleep' in this.permissions && this.permissions.sleep === true) {
        numOptions += 2
        const sleepAction = document.createElement('a')
        sleepAction.classList = 'dropdown-item handCursor'
        sleepAction.innerHTML = 'Sleep display'
        sleepAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'sleepDisplay')
        }, false)
        dropdownMenu.appendChild(sleepAction)

        const wakeAction = document.createElement('a')
        wakeAction.classList = 'dropdown-item handCursor'
        wakeAction.innerHTML = 'Wake display'
        wakeAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'wakeDisplay')
        }, false)
        dropdownMenu.appendChild(wakeAction)
      }

      if ('restart' in this.permissions && this.permissions.restart === true) {
        numOptions += 1
        const restartAction = document.createElement('a')
        restartAction.classList = 'dropdown-item handCursor'
        restartAction.innerHTML = 'Restart component'
        restartAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'restart')
        }, false)
        dropdownMenu.appendChild(restartAction)
      }

      if ('shutdown' in this.permissions && this.permissions.shutdown === true) {
        numOptions += 1
        const shutdownAction = document.createElement('a')
        shutdownAction.classList = 'dropdown-item handCursor'
        shutdownAction.innerHTML = 'Power off component'
        shutdownAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'restart')
        }, false)
        dropdownMenu.appendChild(shutdownAction)
      }

      if ('power_on' in this.permissions && this.permissions.power_on === true) {
        numOptions += 1
        const powerOnAction = document.createElement('a')
        powerOnAction.classList = 'dropdown-item handCursor'
        powerOnAction.innerHTML = 'Power on component'
        powerOnAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'power_on')
        }, false)
        dropdownMenu.appendChild(powerOnAction)
      }

      if (numOptions > 0) {
        const divider = document.createElement('hr')
        divider.classList = 'dropdown-divider'
        dropdownMenu.appendChild(divider)
      }
    }

    const detailsAction = document.createElement('a')
    detailsAction.classList = 'dropdown-item handCursor'
    detailsAction.innerHTML = 'View details'
    detailsAction.addEventListener('click', function () {
      showExhibitComponentInfo(thisUUID, groupUUID)
    }, false)
    dropdownMenu.appendChild(detailsAction)
  }

  remove () {
    // Remove the component from its ComponentGroup
    for (const group of this.groups) {
      hubTools.getExhibitComponentGroup(group).removeComponent(this.uuid)
    }
    // Remove the component from the exhibitComponents list
    const thisInstance = this
    hubConfig.exhibitComponents = hubConfig.exhibitComponents.filter(el => el.uuid === thisInstance.uuid)

    // Cancel the pollingFunction
    clearInterval(this.pollingFunction)

    // Rebuild the interface
    rebuildComponentInterface()
  }

  setGroups (groups) {
    // Adjust the component's groups and rebuild the interface if needed.

    if (groups.length === 0) groups = ['Default']

    // First, remove the component from any groups it is no longer in
    for (const group of this.groups) {
      if (groups.includes(group) === false) hubTools.getExhibitComponentGroup(group).removeComponent(this.uuid)
    }

    // Then, add component to any groups it was not in before
    for (const group of groups) {
      if (this.groups.includes(group) === false) {
        let componentGroup = hubTools.getExhibitComponentGroup(group)
        if (componentGroup == null) {
          // If this is the first component in the group, create the group first.
          componentGroup = new ExhibitComponentGroup(group)
          hubConfig.componentGroups.push(componentGroup)
        }
        componentGroup.addComponent(this)
      }
    }
    this.groups = groups
    rebuildComponentInterface()
  }

  setPermissions (permissions) {
    // Set the compnent's permisions and then rebuild the action list

    this.permissions = permissions
  }

  setStatus (status, maintenanceStatus) {
    // Set the component's status and change the GUI to reflect the change.

    const oldStatus = this.status
    this.status = hubConfig.STATUS[status]
    const oldMaintStatus = this.maintenanceStatus
    this.maintenanceStatus = hubConfig.MAINTANANCE_STATUS[maintenanceStatus]

    // If nothing has changed, bail out
    if ((oldStatus === this.status) && (oldMaintStatus === this.maintenanceStatus)) return

    for (const group of this.groups) {
      // Make sure this is a group we can actually see
      if (hubUsers.checkUserPermission('components', 'view', group) === false) return

      // Update the GUI based on which view mode we're in
      const statusFieldEl = document.getElementById(this.uuid + '_' + group + '_StatusField')
      if (statusFieldEl == null) return // This is a hidden static component

      let btnClass
      if (hubUsers.checkUserPreference('status_mode') === 'realtime') {
        statusFieldEl.innerHTML = this.status.name
        btnClass = this.status.colorClass
      } else {
      // Maintenance status mode
        statusFieldEl.innerHTML = this.maintenanceStatus.name
        btnClass = this.maintenanceStatus.colorClass
      }

      // Strip all existing classes, then add the new one
      const mainButton = document.getElementById(this.uuid + '_' + group + '_MainButton')
      mainButton.classList.remove('btn-primary', 'btn-warning', 'btn-danger', 'btn-success', 'btn-info')
      mainButton.classList.add(btnClass)

      const dropdownButton = document.getElementById(this.uuid + '_' + group + '_DropdownButton')
      dropdownButton.classList.remove('btn-primary', 'btn-warning', 'btn-danger', 'btn-success', 'btn-info')
      dropdownButton.classList.add(btnClass)
    }
  }

  updateFromServer (update) {
    // Use a dictionary of values from Hub to update this component.

    this.setStatus(update.status, update.maintenance_status)

    if ('uuid' in update) {
      this.uuid = update.uuid
    }
    if ('groups' in update && exUtilities.arraysEqual(this.groups, update.groups) === false) {
      this.setGroups(update.groups)
    }
    if ('ip_address' in update) {
      this.ip_address = update.ip_address
    }
    if ('permissions' in update) {
      if (JSON.stringify(this.permissions) !== JSON.stringify(update.permissions)) {
        this.setPermissions(update.permissions)
      }
    }
    if ('description' in update) {
      this.description = update.description
    }
    if ('latency' in update) {
      this.latency = update.latency
    }
    if ('lastContactDateTime' in update) {
      this.lastContactDateTime = update.lastContactDateTime
    }
    if ('error' in update) {
      try {
        const newError = JSON.parse(update.error)
        hubConfig.errorDict[this.id] = newError
      } catch (e) {
        console.log("Error parsing 'error' field from ping. It should be a stringified JSON expression. Received:", update.error)
        console.log(e)
      }
      hubTools.rebuildNotificationList()
    }
  }
}

class ExhibitComponent extends BaseComponent {
  // A component representing an device running a Exhibitera App or using the API

  constructor (uuid, id, groups) {
    super(uuid, id, groups)

    this.type = 'exhibit_component'
    this.helperAddress = null
    this.state = {}
    this.exhibiteraAppId = ''
    this.platformDetails = {}
  }

  getHelperURL () {
    // Return the url for the helper of this component.

    return this.helperAddress
  }

  updateFromServer (update) {
    // Extend parent update to include exhibit component-specific items

    super.updateFromServer(update)

    if ('autoplay_audio' in update) {
      this.autoplay_audio = update.autoplay_audio
    }
    if ('definition' in update) {
      this.definition = update.definition
    }
    if ('exhibiteraAppID' in update) {
      this.exhibiteraAppId = update.exhibiteraAppID
    }
    if ('helperAddress' in update) {
      this.helperAddress = update.helperAddress
    }
    if ('platform_details' in update) {
      this.platformDetails = update.platform_details
    }
  }
}

export class WakeOnLANComponent extends BaseComponent {
  // A component representings a Wake on LAN device

  constructor (uuid, id, groups, macAddress) {
    super(uuid, id, groups)

    this.type = 'wol_component'
    this.mac_address = macAddress
    this.exhibiteraAppId = 'wol_only'
  }
}

class Projector extends BaseComponent {
  // A component representing a projector

  constructor (uuid, id, groups) {
    super(uuid, id, groups)

    this.type = 'projector'
    this.exhibiteraAppId = 'projector'
    this.password = ''
    this.protocol = 'pjlink'
    this.state = {}
  }

  updateFromServer (update) {
    // Extend parent method for proejctor-specific items

    super.updateFromServer(update)

    if ('state' in update) {
      const state = update.state
      if ('model' in state) {
        this.state.model = state.model
      }
      if ('power_state' in state) {
        this.state.power_state = state.power_state
      }
      if ('lamp_status' in state) {
        this.state.lamp_status = state.lamp_status
      }
      if ('error_status' in state) {
        this.state.error_status = state.error_status
        const errorList = {}
        for (const item of Object.keys(state.error_status)) {
          if ((state.error_status)[item] !== 'ok') {
            errorList[item] = (state.error_status)[item]
          }
        }
        hubConfig.errorDict[this.id] = errorList
        hubTools.rebuildNotificationList()
      }
    }
    if ('password' in update) this.password = update.password
    if ('protocol' in update) this.protocol = update.protocol
  }
}

class ExhibitComponentGroup {
  constructor (group) {
    this.type = 'component_group'
    this.group = group
    this.components = []
    this.buildHTML()
  }

  addComponent (component) {
    this.components.push(component)
    this.sortComponentList(hubUsers.checkUserPreference('sort_order'))
  }

  sortComponentList (method) {
    // Sort the component list by ID and then rebuild the HTML
    // representation in order

    if (method === 'alphabetical') {
      this.components.sort((a, b) => {
        const aName = a.id.toLowerCase()
        const bName = b.id.toLowerCase()
        return aName.localeCompare(bName)
      })
    } else if (method === 'status') {
      this.components.sort((a, b) => {
        const aName = a.id.toLowerCase()
        const bName = b.id.toLowerCase()
        const aStatus = a.getStatus().value
        const bStatus = b.getStatus().value
        if (aStatus > bStatus) return -1
        if (bStatus > aStatus) return 1

        // Fall back to alphabetical if they are the same
        return aName.localeCompare(bName)
      })
    }
  }

  removeComponent (uuid) {
    // Remove a component based on its id

    this.components = this.components.filter(el => el.uuid !== uuid)
  }

  getStatus () {
    // Return the most problematic status from the components
    let status = hubConfig.STATUS.STATIC
    for (const component of this.components) {
      if (component.status.value > status.value) status = component.status
    }
    return status
  }

  buildHTML () {
    // Function to build the HTML representation of this group
    // and add it to the componentGroupsRow

    // First, make sure we have permission to view this group.
    if (hubUsers.checkUserPermission('components', 'view', this.group) === false) return

    // Then, make sure the user wants to display this group
    const groupPrefs = hubUsers.checkUserPreference('show_groups')
    if ((this.group in groupPrefs) && groupPrefs[this.group] === false) return

    let permission = 'view'
    if (hubUsers.checkUserPermission('components', 'edit', this.group) === true) {
      permission = 'edit'
    } else if (hubUsers.checkUserPermission('components', 'edit_content', this.group) === true) {
      permission = 'edit_content'
    }

    let onCmdName = ''
    let offCmdName = ''
    const thisGroup = this.group
    if (this.group === 'projector') {
      onCmdName = 'power_on'
      offCmdName = 'sleepDisplay'
    } else {
      onCmdName = 'wakeDisplay'
      offCmdName = 'sleepDisplay'
    }
    const displayRefresh = 'block'

    // Cycle through the components and count how many we will actually be displaying
    const showStatic = hubUsers.checkUserPreference('show_static')
    let numToDisplay = 0
    for (const component of this.components) {
      if (showStatic || component.status !== hubConfig.STATUS.STATIC) {
        numToDisplay += 1
      }
    }

    if (numToDisplay === 0) {
      // Nothing to do
      return
    }

    // Allow groups with lots of components to display with double width in grid view
    let classString
    if (hubUsers.checkUserPreference('components_layout') === 'grid') {
      if (numToDisplay > 7) {
        classString = 'col-12 col-lg-8 col-xl-6 mt-4'
      } else {
        classString = 'col-12 col-md-6 col-lg-4 col-xl-3 mt-4'
      }
    } else classString = 'col-12 col-md-6 col-lg-4 col-xl-4 mt-4'

    const col = document.createElement('div')
    col.classList = classString

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group w-100'
    col.appendChild(btnGroup)

    const mainButton = document.createElement('button')
    mainButton.classList = 'btn btn-secondary w-100'
    if (hubUsers.checkUserPreference('components_size') === 'large') {
      mainButton.classList.add('btn-lg')
    }
    mainButton.setAttribute('type', 'button')
    mainButton.innerHTML = hubTools.getGroupName(this.group)
    btnGroup.appendChild(mainButton)

    if (permission === 'edit') {
      const dropdownButton = document.createElement('button')
      dropdownButton.classList = 'btn btn-secondary dropdown-toggle dropdown-toggle-split'
      dropdownButton.setAttribute('type', 'button')
      dropdownButton.setAttribute('data-bs-toggle', 'dropdown')
      dropdownButton.setAttribute('aria-haspopup', 'true')
      dropdownButton.setAttribute('aria-expanded', 'false')
      btnGroup.appendChild(dropdownButton)

      const srHint = document.createElement('span')
      srHint.classList = 'visually-hidden'
      srHint.innerHTML = 'Toggle Dropdown'
      dropdownButton.appendChild(srHint)

      const dropdownMenu = document.createElement('div')
      dropdownMenu.classList = 'dropdown-menu'
      btnGroup.appendChild(dropdownMenu)

      const refreshOption = document.createElement('a')
      refreshOption.classList = 'dropdown-item handCursor'
      refreshOption.style.display = displayRefresh
      refreshOption.innerHTML = 'Refresh all components'
      refreshOption.addEventListener('click', function () {
        sendGroupCommand(thisGroup, 'refresh_page')
      }, false)
      dropdownMenu.appendChild(refreshOption)

      const wakeOption = document.createElement('a')
      wakeOption.classList = 'dropdown-item handCursor'
      wakeOption.innerHTML = 'Wake all components'
      wakeOption.addEventListener('click', function () {
        sendGroupCommand(thisGroup, onCmdName)
      }, false)
      dropdownMenu.appendChild(wakeOption)

      const sleepOption = document.createElement('a')
      sleepOption.classList = 'dropdown-item handCursor'
      sleepOption.innerHTML = 'Sleep all components'
      sleepOption.addEventListener('click', function () {
        sendGroupCommand(thisGroup, offCmdName)
      }, false)
      dropdownMenu.appendChild(sleepOption)
    }

    const componentList = document.createElement('div')
    componentList.classList = 'row'
    componentList.setAttribute('id', this.uuid + 'ComponentList')
    if (hubUsers.checkUserPreference('components_layout') === 'grid') {
      if (numToDisplay > 7) {
        componentList.classList.add('row-cols-2', 'row-cols-sm-3', 'row-cols-md-4')
      } else {
        componentList.classList.add('row-cols-2', 'row-cols-sm-3', 'row-cols-md-2')
      }
    } else {
      componentList.classList.add('row-cols-1')
    }

    col.appendChild(componentList)

    document.getElementById('componentGroupsRow').appendChild(col)
    for (const component of this.components) {
      const componentToAdd = component.buildHTML(this.group)
      if (componentToAdd != null) componentList.appendChild(componentToAdd)
    }
  }
}

export function createComponentFromUpdate (update) {
  // Use an update dictionary to create a new component

  // Make sure this component doesn't already exist
  const obj = getExhibitComponent(update.uuid)
  if (obj != null) return

  // First, make sure the groups exist
  for (const group of update.groups) {
    let matchingGroup = hubTools.getExhibitComponentGroup(group)

    if (matchingGroup == null) {
      matchingGroup = new ExhibitComponentGroup(group)
      hubConfig.componentGroups.push(matchingGroup)
    }
  }

  // Then create a new component
  let newComponent
  if (update.class === 'exhibitComponent') {
    newComponent = new ExhibitComponent(update.uuid, update.id, update.groups)
  } else if (update.class === 'wolComponent') {
    newComponent = new WakeOnLANComponent(update.uuid, update.id, update.groups, update.mac_address)
  } else if (update.class === 'projector') {
    newComponent = new Projector(update.uuid, update.id, update.groups)
  }

  hubConfig.exhibitComponents.push(newComponent)

  // Add the component to the right groups
  for (const group of update.groups) {
    hubTools.getExhibitComponentGroup(group).addComponent(newComponent)
  }

  // Finally, update the new component and rebuild everything
  newComponent.updateFromServer(update)
  rebuildComponentInterface()
}

export function updateComponentFromServer (update) {
  // Read the dictionary of component information from Hub
  // and use it to set up the component

  const obj = getExhibitComponent(update.uuid)

  if (obj != null) {
    // Update the object with the latest info from the server
    obj.updateFromServer(update)
  } else {
    createComponentFromUpdate(update)
  }
}

export function configureVisibleGroups () {
  // Set up the show/hide groups modal and show it.

  const groupListEl = document.getElementById('showHideGroupsList')
  const groupPrefs = hubUsers.checkUserPreference('show_groups')

  groupListEl.innerHTML = ''

  // Sort groups by name field
  const keys = Object.keys(hubConfig.groups).sort((a, b) => {
    const aName = hubConfig.groups[a].name.toLowerCase()
    const bName = hubConfig.groups[b].name.toLowerCase()
    if (aName > bName) {
      return 1
    } else if (bName > aName) {
      return -1
    }
    return 0
  })

  for (const key of keys) {
    const group = hubConfig.groups[key]
    // Make sure user is allowed to see group
    if (hubUsers.checkUserPermission('components', 'view', group.uuid) === false) continue

    const col = document.createElement('div')
    col.classList = 'col'
    groupListEl.appendChild(col)

    const formCheck = document.createElement('div')
    formCheck.classList = 'form-check'
    col.appendChild(formCheck)

    const check = document.createElement('input')
    check.classList = 'form-check-input showHideGroupCheckbox'
    check.setAttribute('type', 'checkbox')
    check.setAttribute('id', 'showHideGroup_' + group.uuid)
    check.setAttribute('data-uuid', group.uuid)
    if (group.uuid in groupPrefs) {
      if (groupPrefs[group.uuid] === true) {
        check.checked = true
      } else check.checked = false
    } else check.checked = true
    formCheck.appendChild(check)

    const checkLabel = document.createElement('label')
    checkLabel.classList = 'form-check-label'
    checkLabel.setAttribute('for', 'showHideGroup_' + group.uuid)
    checkLabel.innerHTML = group.name
    formCheck.appendChild(checkLabel)
  }

  exUtilities.showModal('#showHideGroupsModal')
}

export function updateVisibleGroupsPreference () {
  // Collect the checked/unchecked groups and update the user preference

  const prefDict = {}

  for (const el of Array.from(document.querySelectorAll('.showHideGroupCheckbox'))) {
    prefDict[el.getAttribute('data-uuid')] = el.checked
  }

  hubUsers.updateUserPreferences({
    show_groups: prefDict
  })
    .then(rebuildComponentInterface)

  exUtilities.hideModal('#showHideGroupsModal')
}

export function sendGroupCommand (group, cmd) {
  // Iterate through the components in the given group and queue the command
  // for each

  group = hubTools.getExhibitComponentGroup(group)
  console.log(group, cmd)
  for (let i = 0; i < group.components.length; i++) {
    queueCommand(group.components[i].uuid, cmd)
  }
}

function setComponentInfoStatusMessage (msg) {
  // Set the given string as the status message and show it.

  if (msg.trim() === '') {
    clearComponentInfoStatusMessage()
    return
  }

  const el = document.getElementById('componentInfoStatusMessage')

  el.innerHTML = msg
  el.style.display = 'block'
}

function clearComponentInfoStatusMessage () {
  // Hide the status message

  const el = document.getElementById('componentInfoStatusMessage')

  el.style.display = 'none'
}

function componentCannotConnect (type = 'component') {
  // Configure the componentInfoModal for a failed connection.

  setComponentInfoStatusMessage('Cannot connect to ' + type)

  // Hide things that can't be accessed when offline
  document.getElementById('componentSettings').style.display = 'none'
  document.getElementById('componentInfoModalDefinitionsTabButton').style.display = 'none'
  const tabTriggerEl = document.querySelector('#componentInfoModalMaintenanceTabButton')
  const tab = new bootstrap.Tab(tabTriggerEl)
  tab.show()

  document.getElementById('componentInfoModalViewScreenshot').style.display = 'none'
}

function componentGoodConnection (screenshot = true) {
  // Configure the componentInfoModal for a good connection

  clearComponentInfoStatusMessage()
  // Show the tabs and other elements
  document.getElementById('componentSettings').style.display = 'flex'
  if (screenshot) document.getElementById('componentInfoModalViewScreenshot').style.display = 'block'
}

function showExhibitComponentInfo (uuid, groupUUID) {
  // This sets up the componentInfoModal with the info from the selected
  // component and shows it on the screen.

  // Check permission
  let permission
  if (hubUsers.checkUserPermission('components', 'edit', groupUUID) === true) {
    permission = 'edit'
    document.getElementById('componentInfoModalRemoveComponentButton').style.display = 'block'
    document.getElementById('componentInfoModalSettingsTabButton').style.display = 'block'
  } else if (hubUsers.checkUserPermission('components', 'edit_content', groupUUID) === true) {
    permission = 'edit_content'
    document.getElementById('componentInfoModalRemoveComponentButton').style.display = 'none'
    document.getElementById('componentInfoModalSettingsTabButton').style.display = 'none'
  } else if (hubUsers.checkUserPermission('components', 'view', groupUUID) === true) {
    permission = 'view'
    document.getElementById('componentInfoModalRemoveComponentButton').style.display = 'none'
    document.getElementById('componentInfoModalSettingsTabButton').style.display = 'none'
  } else {
    // No permission to view
    return
  }

  let maintenancePermission
  if (hubUsers.checkUserPermission('maintenance', 'edit', groupUUID) === true) {
    maintenancePermission = 'edit'
    document.getElementById('componentInfoModalMaintenanceTabButton').style.display = 'block'
  } else if (hubUsers.checkUserPermission('maintenance', 'edit_content', groupUUID) === true) {
    maintenancePermission = 'edit_content'
    document.getElementById('componentInfoModalMaintenanceTabButton').style.display = 'block'
  } else if (hubUsers.checkUserPermission('maintenance', 'view', groupUUID) === true) {
    maintenancePermission = 'view'
    document.getElementById('componentInfoModalMaintenanceTabButton').style.display = 'block'
  } else {
    maintenancePermission = 'none'
    document.getElementById('componentInfoModalMaintenanceTabButton').style.display = 'none'
  }

  const obj = getExhibitComponent(uuid)
  const componentInfoModal = document.getElementById('componentInfoModal')
  componentInfoModal.dataset.id = obj.id
  componentInfoModal.dataset.uuid = obj.uuid

  document.getElementById('componentInfoModalTitle').innerText = obj.id

  // Set up the upper-right dropdown menu with helpful details
  document.getElementById('exhibiteraComponentIdButton').innerText = exUtilities.appNameToDisplayName(obj.exhibiteraAppId)

  if (obj.ip_address != null && obj.ip_address !== '') {
    document.getElementById('componentInfoModalIPAddress').innerText = obj.ip_address
    document.getElementById('componentInfoModalIPAddressGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalIPAddressGroup').style.display = 'none'
  }
  if (obj.ip_address != null &&
      hubTools.extractIPAddress(obj.helperAddress) != null &&
      obj.ip_address !== hubTools.extractIPAddress(obj.helperAddress)
  ) {
    document.getElementById('componentInfoModalHelperIPAddress').innerText = hubTools.extractIPAddress(obj.helperAddress)
    document.getElementById('componentInfoModalHelperIPAddressGroup').style.display = 'block'
    // Cannot take screenshots of components with a remote helper
    document.getElementById('componentInfoModalViewScreenshot').style.display = 'none'
  } else {
    document.getElementById('componentInfoModalHelperIPAddressGroup').style.display = 'none'
  }

  if ('platformDetails' in obj) {
    if ('operating_system' in obj.platformDetails) {
      document.getElementById('componentInfoModalOperatingSystem').innerHTML = obj.platformDetails.operating_system.replace('OS X', 'macOS')
      document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'block'
    } else {
      document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'none'
    }
    if ('browser' in obj.platformDetails && obj.platformDetails.browser !== 'null null') {
      document.getElementById('componentInfoModalBrowser').innerHTML = obj.platformDetails.browser
      document.getElementById('componentInfoModalBrowserGroup').style.display = 'block'
    } else {
      document.getElementById('componentInfoModalBrowserGroup').style.display = 'none'
    }
  } else {
    document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'none'
    document.getElementById('componentInfoModalBrowserGroup').style.display = 'none'
  }
  if ('protocol' in obj && obj.protocol != null) {
    const protocolNames = {
      pjlink: 'PJLink'
    }
    document.getElementById('componentInfoModalProtocol').innerHTML = protocolNames[obj.protocol]
    document.getElementById('componentInfoModalProtocolGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalProtocolGroup').style.display = 'none'
  }
  if (obj.latency != null) {
    document.getElementById('componentInfoModalLatency').innerHTML = String(obj.latency) + ' ms'
    document.getElementById('componentInfoModalLatencyGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalLatencyGroup').style.display = 'none'
  }
  if (obj.lastContactDateTime != null) {
    document.getElementById('componentInfoModalLastContact').innerHTML = exUtilities.formatDateTimeDifference(new Date(), new Date(obj.lastContactDateTime))
    document.getElementById('componentInfoModalLastContactGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalLastContactGroup').style.display = 'none'
  }

  // Add any available description
  updateComponentInfoDescription(obj.description)

  // Show/hide warnings and checkboxes as appropriate
  clearComponentInfoStatusMessage()

  document.getElementById('componentInfoModalViewScreenshot').style.display = 'none'
  document.getElementById('componentInfoModalSettingsPermissionsPane').style.display = 'none'
  document.getElementById('componentInfoModalStaticSettings').style.display = 'none'
  document.getElementById('componentInfoModalWakeOnLANSettings').style.display = 'none'

  document.getElementById('componentInfoModaProejctorTabButton').style.display = 'none'
  document.getElementById('componentInfoModalModelGroup').style.display = 'none'

  document.getElementById('componentInfoModalProjectorSettings').style.display = 'none'

  // Populate maintenance details
  hubMaint.setComponentInfoModalMaintenanceStatus(uuid, obj.id)

  // Definition tab
  document.getElementById('definitionTabAppFilterSelect').value = 'all'
  document.getElementById('definitionTabThumbnailsCheckbox').checked = true
  document.getElementById('componentInfoModalDefinitionSaveButton').style.display = 'none'
  if (permission === 'edit' || permission === 'edit_content') {
    document.getElementById('componentInfoModalNewDefinitionButton').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalNewDefinitionButton').style.display = 'none'
  }

  // Settings tab
  document.getElementById('componentInfoModalFullSettingsButton').style.display = 'none'
  document.getElementById('componentInfoModalDefinitionsTabButton').style.display = 'none'

  document.getElementById('componentInfoModalDMXTabButton').style.display = 'none'
  document.getElementById('contentUploadSystemStatsView').style.display = 'none'

  // Based on the component type, configure the various tabs and panes
  if (obj.type === 'exhibit_component') {
    if (obj.status !== hubConfig.STATUS.STATIC) {
      // This is an active component
      configureComponentInfoModalForExhibitComponent(obj, permission)
    } else {
      // This is a static component
      configureComponentInfoModalForStatic(obj, permission, maintenancePermission)
    }
  } else if (obj.type === 'projector') {
    configureComponentInfoModalForProjector(obj, permission, maintenancePermission)

    if (obj.status === hubConfig.STATUS.OFFLINE) {
      componentCannotConnect('projector')
      document.getElementById('componentInfoModaProejctorTabButton').style.display = 'none'
    }
  } else if (obj.type === 'wol_component') {
    configureComponentInfoModalForWakeOnLAN(obj, permission, maintenancePermission)
  }

  // Must be after all the settings are configured
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
  for (const triggerEl of tooltipTriggerList) {
    const tt = new bootstrap.Tooltip(triggerEl)
  }

  document.getElementById('componentInfoModalSettingsSaveButton').style.display = 'none'
  document.getElementById('componentInfoModalBasicSettingsSaveButton').style.display = 'none'

  // Make the modal visible
  exUtilities.showModal('#componentInfoModal')
}

function configureComponentInfoModalForExhibitComponent (obj, permission) {
  // Set up the componentInfoModal to show an exhibit component

  // Configure the settings page with the current settings
  document.getElementById('componentInfoModalBasicSettingsID').value = obj.id

  const groupSelect = document.getElementById('componentInfoModalBasicSettingsGroup')
  groupSelect.innerHTML = ''
  const defaultOption = new Option('Default', 'Default')
  if (obj.groups.includes('Default')) defaultOption.selected = true
  groupSelect.appendChild(defaultOption)
  for (const group of hubConfig.groups) {
    const option = new Option(group.name, group.uuid)
    if (obj.groups.includes(group.uuid)) {
      option.selected = true
    }
    groupSelect.appendChild(option)
  }

  document.getElementById('componentInfoModalFullSettingsButton').setAttribute('href', obj.helperAddress + '?showSettings=true')
  document.getElementById('componentInfoModalSettingsAutoplayAudio').value = String(obj.permissions.audio)
  document.getElementById('componentInfoModalSettingsAllowRefresh').value = String(obj.permissions.refresh)
  document.getElementById('componentInfoModalSettingsAllowRestart').value = String(obj.permissions.restart)
  document.getElementById('componentInfoModalSettingsAllowShutdown').value = String(obj.permissions.shutdown)
  document.getElementById('componentInfoModalSettingsAllowSleep').value = String(obj.permissions.sleep)

  document.getElementById('componentInfoModalSettingsPermissionsPane').style.display = 'flex'
  document.getElementById('componentInfoModalFullSettingsButton').style.display = 'inline-block'
  document.getElementById('componentInfoModalDefinitionsTabButton').style.display = 'block'

  // Description
  document.getElementById('componentInfoModalExhibitDescriptionInput').style.display = 'block'

  // Warnings
  document.getElementById('componentInfoModalBasicSettingsIDWarning').style.display = 'none'
  document.getElementById('componentInfoModalBasicSettingsGroupWarning').style.display = 'none'

  const tabEl = document.querySelector('#componentInfoModalDefinitionsTabButton')
  const tab = new bootstrap.Tab(tabEl)
  tab.show()

  // This component may be accessible over the network.
  updateComponentInfoModalFromHelper(obj.uuid, permission)
  configureNewDefinitionOptions(obj)

  // Fetch any DMX lighting scenes and show the tab if necessary
  exUtilities.makeRequest({
    method: 'GET',
    url: obj.getHelperURL(),
    endpoint: '/DMX/getScenes'
  })
    .then((result) => {
      hubDMX.populateDMXScenesForInfoModal(result.groups, obj.getHelperURL())
      document.getElementById('componentInfoModalDMXTabButton').style.display = 'block'
    })
    .catch((error) => {
      document.getElementById('componentInfoModalDMXTabButton').style.display = 'none'
      console.log(error)
    })

  document.getElementById('componentInfoModalViewScreenshot').style.display = 'block'
}

function configureComponentInfoModalForProjector (obj) {
  // Set up the projector status pane of the componentInfoModal with the info
  // from the selected projector

  const tabButton = document.getElementById('componentInfoModaProejctorTabButton')
  tabButton.style.display = 'block'
  const bsTab = new bootstrap.Tab(tabButton)
  bsTab.show()

  // // Projector status pane
  document.getElementById('componentInfoModalProjectorWarningList').innerHTML = ''

  if (obj?.state?.error_status?.constructor === Object) {
    if ((obj?.state?.error_status?.lamp ?? 'ok') !== 'ok') {
      createProjectorWarningEntry('Lamp', obj.state.error_status.lamp, 'A projector lamp or light engine may have blown.')
    }
    if ((obj?.state?.error_status?.fan ?? 'ok') !== 'ok') {
      createProjectorWarningEntry('Fan', obj.state.error_status.fan, 'Fan warnings or errors are often related to the dust filter.')
    }
    if ((obj?.state?.error_status?.filter ?? 'ok') !== 'ok') {
      createProjectorWarningEntry('Filter', obj.state.error_status.filter, 'Filter warnings or errors usually indicate the dust filter needs to be cleaned.')
    }
    if ((obj?.state?.error_status?.cover ?? 'ok') !== 'ok') {
      createProjectorWarningEntry('Cover', obj.state.error_status.cover)
    }
    if ((obj?.state?.error_status?.temperature ?? 'ok') !== 'ok') {
      createProjectorWarningEntry('Temperature', obj.state.error_status.temperature, 'The projector may be overheating.')
    }
    if ((obj?.state?.error_status?.other ?? 'ok') !== 'ok') {
      createProjectorWarningEntry('Other', obj.state.error_status.other, "An unspecified error. Consult the projector's menu for more information")
    }
  }
  if ('model' in obj.state) {
    document.getElementById('componentInfoModalModel').innerHTML = obj.state.model
    document.getElementById('componentInfoModalModelGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalModelGroup').style.display = 'none'
  }

  if ((obj?.state?.lamp_status ?? '') !== '') {
    const lampList = obj.state.lamp_status

    document.getElementById('componentInfoModalProjectorLampList').innerHTML = ''
    for (let i = 0; i < lampList.length; i++) {
      createProjectorLampStatusEntry(lampList[i], i)
    }
  }

  // Projetor settings
  document.getElementById('componentInfoModalProjectorSettingsID').value = obj.id

  const groupSelect = document.getElementById('componentInfoModalProjectorSettingsGroup')
  groupSelect.innerHTML = ''
  const defaultOption = new Option('Default', 'Default')
  if (obj.groups.includes('Default')) defaultOption.selected = true
  groupSelect.appendChild(defaultOption)
  for (const group of hubConfig.groups) {
    const option = new Option(group.name, group.uuid)
    if (obj.groups.includes(group.uuid)) option.selected = true
    groupSelect.appendChild(option)
  }

  document.getElementById('componentInfoModalProjectorSettingsIPAddress').value = obj.ip_address
  document.getElementById('componentInfoModalProjectorSettingsPassword').value = obj.password
  document.getElementById('componentInfoModalProjectorSettings').style.display = 'block'
  document.getElementById('componentInfoModalProjectorSettingsSaveButton').style.display = 'none'
  document.getElementById('componentInfoModalProjectorSettingsIDWarning').style.display = 'none'
  document.getElementById('componentInfoModalProjectorSettingsGroupWarning').style.display = 'none'
  document.getElementById('componentInfoModalProjectorSettingsIPWarning').style.display = 'none'
}

function configureComponentInfoModalForStatic (obj, componentPermission, maintenancePermission) {
  // Configure componentInfoModal to show a static component

  // Check permissions and show the right tab
  if ((componentPermission !== 'edit') && (maintenancePermission === 'none')) {
    // Nothing to show
    document.getElementById('componentInfoModalTabList').style.display = 'none'
    document.getElementById('componentInfoModalTabContainer').style.display = 'none'
    setComponentInfoStatusMessage('Nothing to show')
  } else {
    // Something to show
    document.getElementById('componentInfoModalTabList').style.display = 'flex'
    document.getElementById('componentInfoModalTabContainer').style.display = 'block'
    clearComponentInfoStatusMessage()

    let tabEl
    if (maintenancePermission !== 'none') {
      tabEl = document.querySelector('#componentInfoModalMaintenanceTabButton')
    } else {
      tabEl = document.querySelector('#componentInfoModalSettingsTabButton')
    }
    const tab = new bootstrap.Tab(tabEl)
    tab.show()
  }

  document.getElementById('componentInfoModalStaticSettings').style.display = 'block'
  document.getElementById('componentInfoModalStaticSettingsSaveButton').style.display = 'none'
  document.getElementById('componentInfoModalStaticSettingsIDWarning').style.display = 'none'
  document.getElementById('componentInfoModalStaticSettingsGroupWarning').style.display = 'none'

  document.getElementById('componentInfoModalStaticSettingsID').value = obj.id

  const groupSelect = document.getElementById('componentInfoModalStaticSettingsGroup')
  groupSelect.innerHTML = ''
  const defaultOption = new Option('Default', 'Default')
  if (obj.groups.includes('Default')) defaultOption.selected = true
  groupSelect.appendChild(defaultOption)
  for (const group of hubConfig.groups) {
    const option = new Option(group.name, group.uuid)
    if (obj.groups.includes(group.uuid)) {
      option.selected = true
    }
    groupSelect.appendChild(option)
  }
}

function configureComponentInfoModalForWakeOnLAN (obj, componentPermission, maintenancePermission) {
  // Configure componentInfoModal to show a Wake on LAN component

  // Check permissions and show the right tab
  if ((componentPermission !== 'edit') && (maintenancePermission === 'none')) {
    // Nothing to show
    document.getElementById('componentInfoModalTabList').style.display = 'none'
    document.getElementById('componentInfoModalTabContainer').style.display = 'none'
    setComponentInfoStatusMessage('Nothing to show')
  } else {
    // Something to show
    document.getElementById('componentInfoModalTabList').style.display = 'flex'
    document.getElementById('componentInfoModalTabContainer').style.display = 'block'
    clearComponentInfoStatusMessage()

    let tabEl
    if (maintenancePermission !== 'none') {
      tabEl = document.querySelector('#componentInfoModalMaintenanceTabButton')
    } else {
      tabEl = document.querySelector('#componentInfoModalSettingsTabButton')
    }
    const tab = new bootstrap.Tab(tabEl)
    tab.show()
  }

  document.getElementById('componentInfoModalWakeOnLANSettings').style.display = 'block'
  document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').style.display = 'none'
  document.getElementById('componentInfoModalWakeOnLANSettingsIDWarning').style.display = 'none'
  document.getElementById('componentInfoModalWakeOnLANSettingsGroupWarning').style.display = 'none'
  document.getElementById('componentInfoModalWakeOnLANSettingsMACWarning').style.display = 'none'

  document.getElementById('componentInfoModalWakeOnLANSettingsID').value = obj.id

  const groupSelect = document.getElementById('componentInfoModalWakeOnLANSettingsGroup')
  groupSelect.innerHTML = ''
  const defaultOption = new Option('Default', 'Default')
  if (obj.groups.includes('Default')) defaultOption.selected = true
  groupSelect.appendChild(defaultOption)
  for (const group of hubConfig.groups) {
    const option = new Option(group.name, group.uuid)
    if (obj.groups.includes(group.uuid)) {
      option.selected = true
    }
    groupSelect.appendChild(option)
  }

  document.getElementById('componentInfoModalWakeOnLANSettingsMAC').value = obj.mac_address
  document.getElementById('componentInfoModalWakeOnLANSettingsIPAddress').value = obj.ip_address
}

function configureNewDefinitionOptions (obj) {
  // Use the given IP address to configure the URLs for creating new definitions.

  for (const el of document.querySelectorAll('.defintion-new-option')) {
    const app = el.getAttribute('data-app')
    if (app === 'word_cloud_input') {
      el.href = obj.getHelperURL() + '/word_cloud/input/setup.html'
    } else if (app === 'word_cloud_viewer') {
      el.href = obj.getHelperURL() + '/word_cloud/viewer/setup.html'
    } else {
      el.href = obj.getHelperURL() + '/' + app + '/setup.html'
    }
  }
}

export function updateProjectorFromInfoModal () {
  // Collect details from the component info modal and update the proejctor

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  const groupSelect = document.getElementById('componentInfoModalProjectorSettingsGroup')
  const selectedGroups = groupSelect.selectedOptions
  const selectedGroupUUIDs = Array.from(selectedGroups).map(({ value }) => value)

  const update = {
    id: document.getElementById('componentInfoModalProjectorSettingsID').value.trim(),
    groups: selectedGroupUUIDs,
    ip_address: document.getElementById('componentInfoModalProjectorSettingsIPAddress').value.trim(),
    password: document.getElementById('componentInfoModalProjectorSettingsPassword').value.trim(),
    description: document.getElementById('componentInfoModalProjectorDescriptionInput').value.trim()
  }

  // Check that fields are properly filled out
  if (update.id === '') {
    document.getElementById('componentInfoModalProjectorSettingsIDWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalProjectorSettingsIDWarning').style.display = 'none'
  }
  if (update.group === '') {
    document.getElementById('componentInfoModalProjectorSettingsGroupWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalProjectorSettingsGroupWarning').style.display = 'none'
  }
  if (update.ip_address === '') {
    document.getElementById('componentInfoModalProjectorSettingsIPWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalProjectorSettingsIPWarning').style.display = 'none'
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/projector/' + uuid + '/edit',
    params: update
  })
    .then((response) => {
      if (response.success === true) {
        document.getElementById('componentInfoModalTitle').innerText = update.id
        document.getElementById('componentInfoModalProjectorSettingsSaveButton').style.display = 'none'
        updateComponentInfoDescription(update.description)
        rebuildComponentInterface()
      }
    })
}

export function updateStaticComponentFromInfoModal () {
  // Collect details from the component info modal and update the static component

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  const groupSelect = document.getElementById('componentInfoModalStaticSettingsGroup')
  const selectedGroups = groupSelect.selectedOptions
  const selectedGroupUUIDs = Array.from(selectedGroups).map(({ value }) => value)

  const update = {
    id: document.getElementById('componentInfoModalStaticSettingsID').value.trim(),
    groups: selectedGroupUUIDs,
    description: document.getElementById('componentInfoModalStaticDescriptionInput').value.trim()
  }

  // Check that fields are properly filled out
  if (update.id === '') {
    document.getElementById('componentInfoModalStaticSettingsIDWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalStaticSettingsIDWarning').style.display = 'none'
  }
  if (update.groups.length === 0) {
    document.getElementById('componentInfoModalStaticSettingsGroupWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalStaticSettingsGroupWarning').style.display = 'none'
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/static/' + uuid + '/edit',
    params: update
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        document.getElementById('componentInfoModalStaticSettingsSaveButton').style.display = 'none'
        document.getElementById('componentInfoModalTitle').innerHTML = document.getElementById('componentInfoModalStaticSettingsID').value.trim()
        updateComponentInfoDescription(update.description)
        rebuildComponentInterface()
      } else {
        console.log('Saving failed:', response.reason)
      }
    })
}

export function updateWakeOnLANComponentFromInfoModal () {
  // Collect details from the component info modal and update the Wake on LAN component

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  const groupSelect = document.getElementById('componentInfoModalWakeOnLANSettingsGroup')
  const selectedGroups = groupSelect.selectedOptions
  const selectedGroupUUIDs = Array.from(selectedGroups).map(({ value }) => value)

  const update = {
    id: document.getElementById('componentInfoModalWakeOnLANSettingsID').value.trim(),
    groups: selectedGroupUUIDs,
    mac_address: document.getElementById('componentInfoModalWakeOnLANSettingsMAC').value.trim(),
    ip_address: document.getElementById('componentInfoModalWakeOnLANSettingsIPAddress').value.trim(),
    description: document.getElementById('componentInfoModalWakeOnLANDescriptionInput').value.trim()
  }

  // Check that fields are properly filled out
  if (update.id === '') {
    document.getElementById('componentInfoModalWakeOnLANSettingsIDWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalWakeOnLANSettingsIDWarning').style.display = 'none'
  }
  if (update.group === '') {
    document.getElementById('componentInfoModalWakeOnLANSettingsGroupWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalWakeOnLANSettingsGroupWarning').style.display = 'none'
  }

  if (update.mac_address.replaceAll(':', '').replaceAll('-', '').length !== 12) {
    document.getElementById('componentInfoModalWakeOnLANSettingsMACWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalWakeOnLANSettingsMACWarning').style.display = 'none'
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/WOL/' + uuid + '/edit',
    params: update
  })
    .then(() => {
      document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').style.display = 'none'
      document.getElementById('componentInfoModalTitle').innerHTML = document.getElementById('componentInfoModalWakeOnLANSettingsID').value.trim()
      updateComponentInfoDescription(update.description)
      rebuildComponentInterface()
    })
}

function updateComponentInfoDescription (value) {
  // Update the GUI to reflect the given description. For simplicity, we change it for
  // all the component types, since only the correct one will be displayed.

  // Description at the top of the modal
  const descriptionEl = document.getElementById('componentInfoModalDescription')
  descriptionEl.innerHTML = value
  if (value !== '') {
    descriptionEl.style.display = 'block'
  } else {
    descriptionEl.style.display = 'none'
  }

  // All the various input fields
  document.getElementById('componentInfoModalExhibitDescriptionInput').value = value
  document.getElementById('componentInfoModalProjectorDescriptionInput').value = value
  document.getElementById('componentInfoModalStaticDescriptionInput').value = value
  document.getElementById('componentInfoModalWakeOnLANDescriptionInput').value = value
}

function createProjectorLampStatusEntry (entry, number) {
  // Take a dictionary and turn it into HTML elements

  const containerCol = document.createElement('div')
  containerCol.classList = 'col-6 col-sm-4 mb-3'
  containerCol.dataset.config = entry
  document.getElementById('componentInfoModalProjectorLampList').appendChild(containerCol)

  const containerRow = document.createElement('div')
  containerRow.classList = 'row px-1'
  containerCol.appendChild(containerRow)

  const topCol = document.createElement('div')
  topCol.classList = 'col-12'
  containerRow.appendChild(topCol)

  const row1 = document.createElement('div')
  row1.classList = 'row'
  topCol.appendChild(row1)

  const titleCol = document.createElement('div')
  titleCol.classList = 'col-8 bg-primary text-white'
  titleCol.style.fontSize = '18px'
  titleCol.style.borderTopLeftRadius = '0.25rem'
  titleCol.innerHTML = 'Lamp ' + String(number + 1)
  row1.appendChild(titleCol)

  const stateCol = document.createElement('div')
  stateCol.classList = 'col-4 text-center py-1'
  stateCol.style.borderTopRightRadius = '0.25rem'
  if (entry[1] === true) {
    // Lamp is on
    stateCol.innerHTML = 'On'
    stateCol.classList += ' bg-success text-white'
  } else {
    stateCol.innerHTML = 'Off'
    stateCol.classList += ' bg-info text-dark'
  }
  row1.appendChild(stateCol)

  const bottomCol = document.createElement('div')
  bottomCol.classList = 'col-12'
  containerRow.appendChild(bottomCol)

  const row2 = document.createElement('div')
  row2.classList = 'row'
  bottomCol.appendChild(row2)

  const hoursCol = document.createElement('div')
  hoursCol.classList = 'col-12 bg-secondary py-1 text-center text-white'
  hoursCol.style.borderBottomLeftRadius = '0.25rem'
  hoursCol.style.borderBottomRightRadius = '0.25rem'
  hoursCol.innerHTML = String(entry[0]) + ' hours'
  row2.appendChild(hoursCol)
}

function createProjectorWarningEntry (entry, error, details = '') {
  // Take a dictionary and turn it into HTML elements representing a projector error

  const containerCol = document.createElement('div')
  containerCol.classList = 'col-6 col-sm-4 mb-3'
  containerCol.dataset.config = entry
  document.getElementById('componentInfoModalProjectorWarningList').appendChild(containerCol)

  const containerRow = document.createElement('div')
  containerRow.classList = 'row px-1'
  containerCol.appendChild(containerRow)

  const topCol = document.createElement('div')
  topCol.classList = 'col-12'
  containerRow.appendChild(topCol)

  const row1 = document.createElement('div')
  row1.classList = 'row'
  topCol.appendChild(row1)

  const titleCol = document.createElement('div')
  titleCol.classList = 'col-8 bg-primary text-white'
  titleCol.style.fontSize = '18px'
  titleCol.style.borderTopLeftRadius = '0.25rem'
  titleCol.innerHTML = entry
  row1.appendChild(titleCol)

  const stateCol = document.createElement('div')
  stateCol.classList = 'col-4 text-center py-1 '
  stateCol.style.borderTopRightRadius = '0.25rem'
  stateCol.innerHTML = error
  if (error === 'ok') {
    stateCol.innerHTML = 'Ok'
    stateCol.classList += ' bg-success text-white'
  } else if (error === 'warning') {
    stateCol.innerHTML = 'Warning'
    stateCol.classList += ' bg-warning text-dark'
  } else if (error === 'error') {
    stateCol.innerHTML = 'Error'
    stateCol.classList += ' bg-danger text-white'
  }
  row1.appendChild(stateCol)

  if (details !== '') {
    const bottomCol = document.createElement('div')
    bottomCol.classList = 'col-12'
    containerRow.appendChild(bottomCol)

    const row2 = document.createElement('div')
    row2.classList = 'row'
    bottomCol.appendChild(row2)

    const detailsCol = document.createElement('div')
    detailsCol.classList = 'col-12 bg-secondary py-1 text-center text-white fst-italic small'
    detailsCol.style.borderBottomLeftRadius = '0.25rem'
    detailsCol.style.borderBottomRightRadius = '0.25rem'
    detailsCol.innerHTML = details
    row2.appendChild(detailsCol)
  } else {
    titleCol.style.borderBottomLeftRadius = '0.25rem'
    stateCol.style.borderBottomRightRadius = '0.25rem'
  }
}

export function removeExhibitComponentFromModal () {
  // Called when the Remove button is clicked in the componentInfoModal.
  // Send a message to the server to remove the component.

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')
  console.log(uuid)
  hubTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/component/' + uuid + '/delete'
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        getExhibitComponent(uuid).remove()
        exUtilities.hideModal('#componentInfoModal')
      }
    })
}

async function populateComponentDefinitionList (definitions, permission) {
  // Take a dictionary of definitions and convert it to GUI elements.

  const uuid = document.getElementById('componentInfoModal').dataset.uuid
  const component = getExhibitComponent(uuid)

  const componentInfoModalDefinitionList = document.getElementById('componentInfoModalDefinitionList')
  componentInfoModalDefinitionList.innerHTML = ''

  const sortedByName = Object.keys(definitions).sort((a, b) => {
    try {
      const aName = definitions[a].name.toLowerCase()
      const bName = definitions[b].name.toLowerCase()
      if (aName > bName) return 1
      if (aName < bName) return -1
    } catch {

    }
    return 0
  })
  for (const uuid of sortedByName) {
    if (uuid.startsWith('__preview') || uuid.trim() === '') continue

    const definition = definitions[uuid]

    const col = document.createElement('div')
    col.setAttribute('id', 'definitionButton_' + uuid)
    col.classList = 'col-6 col-sm-4 mt-2 handCursor definition-entry'
    col.dataset.definition = definition
    col.setAttribute('data-app', definition.app)

    const row = document.createElement('div')
    row.classList = 'row px-2'
    col.appendChild(row)

    const btnGroupCol = document.createElement('div')
    btnGroupCol.classList = 'col-12 px-0 mx-0'
    row.appendChild(btnGroupCol)

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group w-100'
    btnGroupCol.appendChild(btnGroup)

    const name = document.createElement('button')
    name.setAttribute('id', 'definitionButtonName_' + uuid)
    name.classList = 'btn btn-primary definition-name w-75'
    name.style.borderBottomLeftRadius = '0'
    if (component.definition === definition.uuid) {
      name.classList.remove('btn-primary')
      name.classList.add('btn-success')
    }

    if (permission === 'edit' || permission === 'edit_content') {
      name.addEventListener('click', () => {
        handleDefinitionItemSelection(uuid)
      })
    }

    name.style.fontSize = '18px'
    name.innerHTML = definition.name
    btnGroup.appendChild(name)

    const dropdownBtn = document.createElement('button')
    dropdownBtn.classList = 'btn btn-primary dropdown-toggle dropdown-toggle-split definition-dropdown'
    dropdownBtn.setAttribute('id', 'definitionButtonDropdown_' + uuid)
    dropdownBtn.style.borderBottomRightRadius = '0'
    dropdownBtn.setAttribute('data-bs-toggle', 'dropdown')
    dropdownBtn.setAttribute('aria-haspopup', 'true')
    dropdownBtn.setAttribute('aria-expanded', 'false')
    dropdownBtn.innerHTML = '<span class="visually-hidden">Toggle Dropdown</span>'
    if (component.definition === definition.uuid) {
      dropdownBtn.classList.remove('btn-primary')
      dropdownBtn.classList.add('btn-success')
    }
    btnGroup.appendChild(dropdownBtn)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'

    const previewOption = document.createElement('a')
    previewOption.classList = 'dropdown-item'
    previewOption.setAttribute('href', component.getHelperURL() + '/' + definition.app + '.html?standalone=true&definition=' + uuid)
    previewOption.setAttribute('target', '_blank')
    previewOption.innerHTML = 'Preview'
    dropdownMenu.appendChild(previewOption)

    if (permission === 'edit' || permission === 'edit_content') {
      let app = definition.app
      let page = 'setup.html'
      if (app === 'word_cloud_input') {
        app = 'word_cloud'
        page = 'input/setup.html'
      } else if (app === 'word_cloud_viewer') {
        app = 'word_cloud'
        page = 'viewer/setup.html'
      }

      const editOption = document.createElement('a')
      editOption.classList = 'dropdown-item'
      editOption.setAttribute('href', component.getHelperURL() + '/' + app + '/' + page + '?definition=' + uuid)
      editOption.setAttribute('target', '_blank')
      editOption.innerHTML = 'Edit'
      dropdownMenu.appendChild(editOption)

      if (['image_compare', 'media_player', 'timelapse_viewer', 'voting_kiosk', 'word_cloud_input', 'word_cloud_viewer'].includes(definition.app)) {
        const copyOption = document.createElement('a')
        copyOption.classList = 'dropdown-item'
        copyOption.innerHTML = 'Copy to...'
        copyOption.addEventListener('click', () => {
          showCopyDefinitionModal(component.uuid, definition.uuid, definition.name)
        })
        dropdownMenu.appendChild(copyOption)
      }
    }
    btnGroup.appendChild(dropdownMenu)

    const thumbCol = document.createElement('div')
    thumbCol.classList = 'col-12 bg-secondary pt-2 definition-thumbnail'
    if (permission === 'edit' || permission === 'edit_content') {
      thumbCol.addEventListener('click', () => {
        handleDefinitionItemSelection(uuid)
      })
    }
    row.append(thumbCol)

    thumbCol.appendChild(exUtilities.getDefinitionThumbnail(component.getHelperURL(), uuid))

    const app = document.createElement('div')
    app.classList = 'col-12 bg-secondary text-dark rounded-bottom pb-1'
    app.setAttribute('id', 'definitionButtonApp_' + uuid)
    app.innerHTML = exUtilities.appNameToDisplayName(definition.app)
    if (permission === 'edit' || permission === 'edit_content') {
      app.addEventListener('click', () => {
        handleDefinitionItemSelection(uuid)
      })
    }

    row.appendChild(app)

    componentInfoModalDefinitionList.appendChild(col)
  }
}

function showCopyDefinitionModal (componentUUID, definitionUUID, definitionName) {
  // Set up and show the model for copying a definition from one component to another

  const component = getExhibitComponent(componentUUID)
  const modal = document.getElementById('copyDefinitionModal')
  modal.setAttribute('data-definition', definitionUUID)
  modal.setAttribute('data-component', componentUUID)

  const submitButton = document.getElementById('copyDefinitionModalSubmitButton')
  submitButton.innerHTML = 'Copy'
  submitButton.classList.remove('btn-info')
  submitButton.classList.add('btn-primary')
  submitButton.style.display = 'none'

  const url = component.getHelperURL()
  if (url == null) {
    // We don't have enough information to contact the helper
    console.log('Error: No helper address')
  }

  let content = []
  exUtilities.makeRequest({
    method: 'GET',
    url,
    endpoint: '/definitions/' + definitionUUID + '/getContentList'
  }).then((result) => {
    console.log(result)

    // Populate source files
    const sourceDiv = document.getElementById('copyDefinitionModalSourceFiles')
    sourceDiv.innerHTML = ''

    sourceDiv.appendChild(copyDefinitionModalCreateSourceHTML(definitionName, '', true))
    if (result.content && result.content.length > 0) {
      content = result.content
      modal.setAttribute('data-sourceFiles', JSON.stringify(result.content))

      let supportingText = ' supporting file'
      if (result.content.length > 1) supportingText = ' supporting files'
      sourceDiv.appendChild(copyDefinitionModalCreateSourceHTML(String(result.content.length) + supportingText, result?.total_size ?? ''))
    } else {
      modal.setAttribute('data-sourceFiles', JSON.stringify([]))
    }

    // Populate destination options
    const destDiv = document.getElementById('copyDefinitionModalDestinations')
    destDiv.innerHTML = ''

    const compsByGroup = hubTools.sortComponentsByGroup()
    const groups = Object.keys(compsByGroup)
    let totalComps = 0

    for (const group of groups) {
      const comps = compsByGroup[group]

      const compsToShow = []
      for (const comp of comps) {
        if (comp.type !== 'exhibit_component') continue
        if (comp.status !== hubConfig.STATUS.ONLINE && comp.status !== hubConfig.STATUS.ACTIVE) continue
        if (comp.uuid === componentUUID) continue
        totalComps += 1
        compsToShow.push(comp)
      }
      if (compsToShow.length === 0) continue

      const label = document.createElement('label')
      label.innerHTML = hubTools.getGroup(group)?.name ?? group
      label.classList = 'text-secondary'
      destDiv.appendChild(label)

      for (const comp of compsToShow) {
        destDiv.appendChild(copyDefinitionModalCreateDestinationHTML(comp, group, definitionUUID, content))
      }
    }

    if (totalComps === 0) destDiv.innerHTML = '<i>No available components</i>'

    exUtilities.hideModal('#componentInfoModal')
    exUtilities.showModal('#copyDefinitionModal')
  })
}

async function copyDefinitionModalCreateDestinationHTML (component, group, def, content) {
  // Take an exhibit component and build an HTML representation.
  // Check if the given destination contains a definition or content of the
  // same name and warn the user.

  const modal = document.getElementById('copyDefinitionModal')
  const submitButton = document.getElementById('copyDefinitionModalSubmitButton')

  const col = document.createElement('div')
  col.classList = 'col-12'

  const checkGroup = document.createElement('div')
  checkGroup.classList = 'form-check'
  col.appendChild(checkGroup)

  const input = document.createElement('input')
  input.classList = 'form-check-input copyDest'
  input.setAttribute('type', 'checkbox')
  input.setAttribute('id', 'copyOption_' + group + '_' + component.uuid)
  input.setAttribute('data-uuid', component.uuid)
  input.value = ''
  input.addEventListener('change', (ev) => {
    const checked = modal.querySelectorAll('input.copyDest:checked')
    if (checked.length > 0) {
      submitButton.style.display = 'block'
    } else submitButton.style.display = 'none'
  })
  checkGroup.appendChild(input)

  const label = document.createElement('label')
  label.classList = 'form-check-label'
  label.setAttribute('for', 'copyOption_' + group + '_' + component.uuid)
  label.innerText = component.id
  checkGroup.appendChild(label)

  label.innerHTML += `<span data-uuid="${component.uuid}" class="ms-2 badge text-bg-success copy-success" style="display:none;">Copied</span>`
  label.innerHTML += `<span data-uuid="${component.uuid}" class="ms-2 badge text-bg-danger copy-fail" style="display:none;">Error</span>`

  // Check if the given definition already exists on the destination
  const defRequest = await exUtilities.makeRequest({
    method: 'GET',
    url: component.getHelperURL(),
    endpoint: '/definitions'
  })

  if (def in defRequest.definitions) {
    label.innerHTML += '<span class="badge bg-warning ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="This definition already exists here and will be overwritten." style="font-size: 0.55em;">!</span>'
  }

  // Check if any of the content already exists on the destination
  const contentResponse = await exUtilities.makeRequest({
    method: 'GET',
    url: component.getHelperURL(),
    endpoint: '/files/availableContent'
  })

  for (const file of content) {
    if (contentResponse.content.includes(file.name)) {
      label.innerHTML += `<span class="badge bg-warning ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="${file.name} already exists here and will be overwritten." style="font-size: 0.55em;">!</span>`
    }
  }
  // Enable all tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
  const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

  return col
}

function copyDefinitionModalCreateSourceHTML (filename, sizeText, isDefinition = false) {
  // Create an HTML representation of the given file for the definitionCopyModal.

  const col = document.createElement('div')
  col.classList = 'col-12'

  const row = document.createElement('div')
  row.classList = 'row gy-2'
  col.appendChild(row)

  const name = document.createElement('div')
  name.classList = 'col-8'
  if (isDefinition) {
    name.classList.add('fw-bold')
  } else {
    name.classList.add('ps-4')
  }
  name.innerHTML = filename
  row.appendChild(name)

  const size = document.createElement('div')
  size.classList = 'col-4'
  size.innerHTML = sizeText
  row.appendChild(size)

  return col
}

export async function copyDefinitionModalPerformCopy () {
  // Collect information from the modal and trigger the file copy to each destinaition.

  const modal = document.getElementById('copyDefinitionModal')
  const submitButton = document.getElementById('copyDefinitionModalSubmitButton')
  submitButton.innerHTML = 'Copying...'
  submitButton.classList.add('btn-info')
  submitButton.classList.remove('btn-primary')

  // Sources
  const definitionUUID = modal.getAttribute('data-definition')
  const sourceUUID = modal.getAttribute('data-component')
  const sourceComponent = getExhibitComponent(sourceUUID)
  const filesToCopy = JSON.parse(modal.getAttribute('data-sourceFiles')) ?? []

  // Destinations
  const checkedElements = modal.querySelectorAll('input.copyDest:checked')
  const destComponents = []
  for (const el of checkedElements) {
    const destUUID = el.getAttribute('data-uuid')
    if (destUUID != null) {
      const destComp = getExhibitComponent(destUUID)
      if (destComp != null) destComponents.push(destComp)
    }
  }

  // Cycle the destinations and copy the files
  let error = false
  for (const destComp of destComponents) {
    const destUrl = destComp.getHelperURL()
    if (destUrl == null) continue

    try {
      await exUtilities.makeRequest({
        method: 'POST',
        url: destUrl,
        endpoint: '/files/retrieve',
        params: {
          file_url: sourceComponent.getHelperURL() + exConfig.api + '/definitions/' + definitionUUID + '.json',
          path_list: ['definitions', definitionUUID + '.json']
        }
      })

      for (const file of filesToCopy) {
        await exUtilities.makeRequest({
          method: 'POST',
          url: destUrl,
          endpoint: '/files/retrieve',
          params: {
            file_url: sourceComponent.getHelperURL() + '/content/' + file.name,
            path_list: ['content', file.name]
          }
        })
      }
      const successBadge = Array.from(checkedElements).map(node => node.parentElement.querySelector(`span.copy-success[data-uuid="${destComp.uuid}"]`)).find(el => el !== null)
      successBadge.style.display = 'inline'
    } catch (e) {
      // This might happen if the component loses connection
      error = true
      const failBadge = Array.from(checkedElements).map(node => node.parentElement.querySelector(`span.copy-fail[data-uuid="${destComp.uuid}"]`)).find(el => el !== null)
      failBadge.style.display = 'inline'
    }
  }
  if (error === false) {
    hubTools.hideModal(modal)
  } else {
    const button = document.getElementById('copyDefinitionModalSubmitButton')
    button.style.display = 'none'
  }
}

function handleDefinitionItemSelection (uuid) {
  // Called when a user clicks on the definition in the componentInfoModal.

  // Remove classes from all elements with the 'definition-entry' class
  for (const el of document.querySelectorAll('.definition-entry')) {
    el.classList.remove('definition-selected')
  }

  // Remove and add classes to all elements with the 'definition-name' class
  for (const el of document.querySelectorAll('.definition-name')) {
    el.classList.remove('btn-success')
    el.classList.add('btn-primary')
  }

  // Remove and add classes to all elements with the 'definition-dropdown' class
  for (const el of document.querySelectorAll('.definition-dropdown')) {
    el.classList.remove('btn-success')
    el.classList.add('btn-primary')
  }

  // Add the 'definition-selected' class to the specific button
  const definitionButton = document.getElementById('definitionButton_' + uuid)
  if (definitionButton) {
    definitionButton.classList.add('definition-selected')
  }

  // Add the 'btn-success' class to the specific button name
  const definitionButtonName = document.getElementById('definitionButtonName_' + uuid)
  if (definitionButtonName) {
    definitionButtonName.classList.add('btn-success')
  }

  // Add the 'btn-success' class to the specific button dropdown
  const definitionButtonDropdown = document.getElementById('definitionButtonDropdown_' + uuid)
  if (definitionButtonDropdown) {
    definitionButtonDropdown.classList.add('btn-success')
  }

  // Show the save button
  document.getElementById('componentInfoModalDefinitionSaveButton').style.display = 'block'
}

export function submitDefinitionSelectionFromModal () {
  // Called when the "Save changes" button is pressed on the definitions pane of the componentInfoModal.

  const definition = document.querySelector('.definition-selected')?.dataset.definition
  const componentUUID = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/' + componentUUID + '/definition/' + definition.uuid
  })
  document.getElementById('componentInfoModalDefinitionSaveButton').style.display = 'none'
}

async function updateComponentInfoModalFromHelper (uuid, permission) {
  // Ask the given helper to send an update and use it to update the interface.

  const obj = getExhibitComponent(uuid)

  const url = obj.getHelperURL()
  if (url == null) {
    // We don't have enough information to contact the helper
    componentCannotConnect()

    // Make the modal visible
    exUtilities.showModal('#componentInfoModal')
    return
  }

  setComponentInfoStatusMessage('Connecting to component...')

  let defResponse
  try {
    defResponse = await exUtilities.makeRequest({
      method: 'GET',
      url,
      endpoint: '/definitions',
      timeout: 3000
    })
  } catch {
    componentCannotConnect()
  }

  // Good connection, so show the interface elements
  componentGoodConnection()

  populateComponentDefinitionList(defResponse.definitions, permission)

  let statsResponse
  try {
    statsResponse = await exUtilities.makeRequest({
      method: 'GET',
      url,
      endpoint: '/system/stats',
      timeout: 3000
    })
  } catch {
    document.getElementById('contentUploadSystemStatsView').style.display = 'none'
    return
  }

  const stats = statsResponse.system_stats
  // Disk
  const spaceUsedBar = document.getElementById('contentUploadDiskSpaceUsedBar')
  const spaceFreeBar = document.getElementById('contentUploadDiskSpaceFreeBar')
  spaceUsedBar.setAttribute('ariaValueNow', 100 - stats.disk_pct_free)
  spaceUsedBar.style.width = String(100 - stats.disk_pct_free) + '%'
  spaceFreeBar.setAttribute('ariaValueNow', stats.disk_pct_free)
  spaceFreeBar.style.width = String(stats.disk_pct_free) + '%'
  document.getElementById('contentUploadDiskSpaceFree').innerHTML = `Disk: ${String(Math.round(stats.disK_free_GB))} GB`

  if (stats.disk_pct_free > 20) {
    spaceUsedBar.classList.remove('bg-warning', 'bg-danger')
    spaceUsedBar.classList.add('bg-success')
  } else if (stats.disk_pct_free > 10) {
    spaceUsedBar.classList.remove('bg-success', 'bg-danger')
    spaceUsedBar.classList.add('bg-warning')
  } else {
    spaceUsedBar.classList.remove('bg-success', 'bg-warning')
    spaceUsedBar.classList.add('bg-danger')
  }

  // CPU
  const CPUUsedBar = document.getElementById('contentUploadCPUUsedBar')
  const CPUFreeBar = document.getElementById('contentUploadCPUFreeBar')
  CPUUsedBar.setAttribute('ariaValueNow', stats.cpu_load_pct)
  CPUUsedBar.style.width = String(stats.cpu_load_pct) + '%'
  document.getElementById('contentUploadCPUUsed').innerHTML = `CPU: ${String(Math.round(stats.cpu_load_pct))}%`
  CPUFreeBar.setAttribute('ariaValueNow', 100 - stats.cpu_load_pct)
  CPUFreeBar.style.width = String(100 - stats.cpu_load_pct) + '%'

  if (stats.cpu_load_pct < 80) {
    CPUUsedBar.classList.remove('bg-warning', 'bg-danger')
    CPUUsedBar.classList.add('bg-success')
  } else if (stats.cpu_load_pct < 90) {
    CPUUsedBar.classList.remove('bg-success', 'bg-danger')
    CPUUsedBar.classList.add('bg-warning')
  } else {
    CPUUsedBar.classList.remove('bg-success', 'bg-warning')
    CPUUsedBar.classList.add('bg-danger')
  }

  // RAM
  const RAMUsedBar = document.getElementById('contentUploadRAMUsedBar')
  const RAMFreeBar = document.getElementById('contentUploadRAMFreeBar')
  RAMUsedBar.setAttribute('ariaValueNow', stats.ram_used_pct)
  RAMUsedBar.style.width = String(stats.ram_used_pct) + '%'
  document.getElementById('contentUploadRAMUsed').innerHTML = `RAM: ${String(Math.round(stats.ram_used_pct))}%`
  RAMFreeBar.setAttribute('ariaValueNow', 100 - stats.ram_used_pct)
  RAMFreeBar.style.width = String(100 - stats.ram_used_pct) + '%'

  if (stats.ram_used_pct < 80) {
    RAMUsedBar.classList.remove('bg-warning', 'bg-danger')
    RAMUsedBar.classList.add('bg-success')
  } else if (stats.ram_used_pct < 90) {
    RAMUsedBar.classList.remove('bg-success', 'bg-danger')
    RAMUsedBar.classList.add('bg-warning')
  } else {
    RAMUsedBar.classList.remove('bg-success', 'bg-warning')
    RAMUsedBar.classList.add('bg-danger')
  }

  document.getElementById('contentUploadSystemStatsView').style.display = 'flex'
}

export function onDefinitionTabThumbnailsCheckboxChange () {
  // Show/hide the definition thumbnails

  const defList = document.getElementById('componentInfoModalDefinitionList')
  const checkState = document.getElementById('definitionTabThumbnailsCheckbox').checked

  for (const entry of defList.querySelectorAll('.definition-thumbnail')) {
    if (checkState === true) {
      entry.style.display = 'block'
    } else {
      entry.style.display = 'none'
    }
  }
}

export function filterDefinitionListByApp () {
  // Hide the definition widgets for any app not matching the specified one.

  const appToShow = document.getElementById('definitionTabAppFilterSelect').value
  const defList = document.getElementById('componentInfoModalDefinitionList')

  for (const entry of defList.querySelectorAll('.definition-entry')) {
    const thisApp = entry.getAttribute('data-app')
    if ((thisApp === appToShow) || (appToShow === 'all')) {
      entry.style.display = 'block'
    } else {
      entry.style.display = 'none'
    }
  }
}

export function submitComponentBasicSettingsChange () {
  // Update the id, group, and description of an exhibit component

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  const groupSelect = document.getElementById('componentInfoModalBasicSettingsGroup')
  const selectedGroups = groupSelect.selectedOptions
  const selectedGroupUUIDs = Array.from(selectedGroups).map(({ value }) => value)

  const update = {
    id: document.getElementById('componentInfoModalBasicSettingsID').value.trim(),
    groups: selectedGroupUUIDs,
    description: document.getElementById('componentInfoModalExhibitDescriptionInput').value.trim(),
    uuid
  }

  updateComponentInfoDescription(update.description)

  // Check that fields are properly filled out
  if (update.id === '') {
    document.getElementById('componentInfoModalBasicSettingsIDWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalBasicSettingsIDWarning').style.display = 'none'
  }
  if (update.group === '') {
    document.getElementById('componentInfoModalBasicSettingsGroupWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalBasicSettingsGroupWarning').style.display = 'none'
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/' + uuid + '/edit',
    params: update
  })
    .then((response) => {
      if (response.success === true) {
        document.getElementById('componentInfoModalTitle').innerHTML = update.id
        document.getElementById('componentInfoModalBasicSettingsSaveButton').style.display = 'none'
      }
    })
}

export function submitComponentSettingsChange () {
  // Collect the current settings and send them to the component's helper for saving.

  const obj = getExhibitComponent(document.getElementById('componentInfoModal').dataset.uuid)

  // Update component settings, if allowed
  const settingsAvailable = document.getElementById('componentInfoModalSettingsPermissionsPane').style.display === 'flex'
  if (settingsAvailable === true) {
    const settings = {
      permissions: {
        audio: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAutoplayAudio').value),
        refresh: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAllowRefresh').value),
        restart: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAllowRestart').value),
        shutdown: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAllowRestart').value),
        sleep: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAllowRestart').value)
      }
    }
    exUtilities.makeRequest({
      method: 'POST',
      url: obj.getHelperURL(),
      endpoint: '/system/configuration/update',
      params: { defaults: settings }
    })
      .then((response) => {
        if ('success' in response) {
          if (response.success === true) {
            document.getElementById('componentInfoModalSettingsSaveButton').style.display = 'none'
          }
        }
      })
  }
}

export function getExhibitComponent (uuid) {
  // Function to search the exhibitComponents list for a given uuid

  const result = hubConfig.exhibitComponents.find(obj => {
    return obj.uuid === uuid
  })
  return result
}

export function checkForRemovedComponents (update) {
  // Check exConfig.exhibitComponents and remove any components not in `update`

  const updateUUIDs = []
  for (const component of update) {
    updateUUIDs.push(component.uuid)
  }

  for (const component of hubConfig.exhibitComponents) {
    if (updateUUIDs.includes(component.uuid) === false) {
      component.remove(false) // Remove from interface, but not the config
    }
  }
}

export function rebuildComponentInterface () {
  // Clear the componentGroupsRow and rebuild it

  const sortOrder = hubUsers.checkUserPreference('sort_order')
  document.getElementById('componentGroupsRow').innerHTML = ''

  hubTools.sortGroups(sortOrder)

  for (const group of hubConfig.componentGroups) {
    group.sortComponentList(sortOrder)
    group.buildHTML()
  }
}

export function queueCommand (uuid, cmd) {
  // Function to send a command to Hub that will then
  // be sent to the component the next time it pings the server

  const obj = getExhibitComponent(uuid)
  if (['shutdown', 'restart'].includes(cmd) && obj.type === 'exhibit_component') {
    // We send these commands directly to the helper
    exUtilities.makeRequest({
      method: 'GET',
      url: obj.getHelperURL(),
      endpoint: '/' + cmd
    })
  } else {
    // We send these commands to the server to pass to the component itself

    hubTools.makeServerRequest({
      method: 'POST',
      endpoint: '/component/' + uuid + '/queueCommand',
      params: { command: cmd }
    })
  }
}

export function showAddStaticComponentsModal () {
  // Prepare the modal for adding static components and show it.

  const groupsField = document.getElementById('addStaticComponentModalGroupField')

  // Rebuild the list of groups
  hubGroups.populateGroupsForSelect(groupsField)

  // Reset values
  document.getElementById('addStaticComponentModalIDField').value = ''
  groupsField.value = 'Default'

  // Hide warnings
  document.getElementById('addStaticComponentModalIDError').style.display = 'none'

  exUtilities.showModal('#addStaticComponentModal')
}

export function submitStaticComponentAdditionFromModal () {
  // Collect the ID and group from the modal and add it to the static configuration

  // Make sure the fields are properly completed
  let groups = Array.from(document.getElementById('addStaticComponentModalGroupField').querySelectorAll('option:checked'), e => e.value)
  const id = document.getElementById('addStaticComponentModalIDField').value.trim()
  if (id === '') {
    document.getElementById('addStaticComponentModalIDError').style.display = 'block'
    return
  } else {
    document.getElementById('addStaticComponentModalIDError').style.display = 'none'
  }
  if (groups.length === 0) {
    groups = ['Default']
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/static/create',
    params: { id, groups }
  })
    .then((response) => {
      exUtilities.hideModal('#addStaticComponentModal')
    })
}

export function showAddWakeOnLANModal () {
  // Prepare the modal for adding wake on LAN and show it.

  const groupsField = document.getElementById('addWakeOnLANModalGroupField')

  // Rebuild the list of groups
  hubGroups.populateGroupsForSelect(groupsField)

  // Reset values
  document.getElementById('addWakeOnLANModalIDField').value = ''
  groupsField.value = 'Default'
  document.getElementById('addWakeOnLANModalIPField').value = ''
  document.getElementById('addWakeOnLANModalMACField').value = ''

  // Hide warnings
  document.getElementById('addWakeOnLANModalIDError').style.display = 'none'
  document.getElementById('addWakeOnLANModalMACError').style.display = 'none'
  document.getElementById('addWakeOnLANModalBadMACError').style.display = 'none'

  exUtilities.showModal('#addWakeOnLANModal')
}

export function submitWakeOnLANAdditionFromModal () {
  // Collect details from the modal and add it to the Wake on LAN configuration

  // Check that the fields are properly filled out
  let groups = Array.from(document.getElementById('addWakeOnLANModalGroupField').querySelectorAll('option:checked'), e => e.value)
  const id = document.getElementById('addWakeOnLANModalIDField').value.trim()
  const ipAddress = document.getElementById('addWakeOnLANModalIPField').value.trim()
  const macAddress = document.getElementById('addWakeOnLANModalMACField').value.trim()

  if (id === '') {
    document.getElementById('addWakeOnLANModalIDError').style.display = 'block'
    return
  } else {
    document.getElementById('addWakeOnLANModalIDError').style.display = 'none'
  }
  if (groups.length === 0) {
    groups = ['Default']
  }
  if (macAddress === '') {
    document.getElementById('addWakeOnLANModalMACError').style.display = 'block'
    return
  } else {
    document.getElementById('addWakeOnLANModalMACError').style.display = 'none'
  }
  const shortMAC = macAddress.replaceAll(':', '').replaceAll('-', '')
  if (shortMAC.length !== 12) {
    document.getElementById('addWakeOnLANModalBadMACError').style.display = 'block'
    return
  } else {
    document.getElementById('addWakeOnLANModalBadMACError').style.display = 'none'
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/WOL/create',
    params: {
      groups,
      id,
      ip_address: ipAddress,
      mac_address: macAddress
    }
  })
    .then((response) => {
      exUtilities.hideModal('#addWakeOnLANModal')
    })
}

export async function showExhibitionModificationsModal () {
  // Configure and show the modal for adjusting exhibition modifications.

  const modal = document.getElementById('exhibitModificationsModal')
  const compareRow = document.getElementById('exhibitModificationsModalRow')
  modal.dataset.toRemove = JSON.stringify([])
  compareRow.innerHTML = ''

  const modsReq = await hubTools.makeServerRequest({
    method: 'GET',
    endpoint: '/exhibition/modifications'
  })
  const mods = modsReq.modifications

  const exhibReq = await hubTools.makeServerRequest({
    method: 'GET',
    endpoint: '/exhibition/' + hubConfig.currentExhibit + '/details'
  })
  const exhib = exhibReq.exhibit

  modal.querySelector('.modal-title').innerText = 'Modifications to ' + exhib.name

  for (const mod of mods.components) {
    createExhibitionModificationHTML(mod, exhib)
  }

  exUtilities.showModal('#exhibitModificationsModal')
}

async function createExhibitionModificationHTML (mod, exhib) {
  // Create HTML to represent an exhibition modification as shown in the exhibitModificationsModal.
  // mod gives the modified definition, while exhib is the current exhibition

  const modal = document.getElementById('exhibitModificationsModal')
  const compareRow = document.getElementById('exhibitModificationsModalRow')
  const component = getExhibitComponent(mod.uuid)

  document.getElementById('exhibitModificationsModalSaveButton').style.display = 'none'
  document.getElementById('exhibitModificationsModalCloseButton').innerText = 'Close'

  const modDefReq = await exUtilities.makeRequest({
    method: 'GET',
    url: getExhibitComponent(mod.uuid).getHelperURL(),
    endpoint: '/definitions/' + mod.definition + '/load'
  })
  const modDef = modDefReq.definition

  const exhibDefUUID = exhib.components.find(obj => obj.uuid === mod.uuid)?.definition ?? 'error'
  const exhibDefReq = await exUtilities.makeRequest({
    method: 'GET',
    url: getExhibitComponent(mod.uuid).getHelperURL(),
    endpoint: '/definitions/' + exhibDefUUID + '/load'
  })
  const exhibDef = exhibDefReq.definition

  const col = document.createElement('div')
  col.classList = 'col py-1'
  col.innerHTML = `
  <div class='row border rounded gx-2'>
    <div class="col-12 position-relative d-flex justify-content-center align-items-center">
      <span class="text-center fs-4 fw-bold pt-1">${component.id}</span>
      <button class="btn-close position-absolute end-0 me-2"></button>
    </div>
    <div class='col-5 text-center'>
    <span class='fs-6'>Original</span>
    <div class='exhib-div py-1'></div>
    <div class="fs-5">${exhibDef?.name ?? '<i>No definition</i>'}</div>
    </div>
    <div class='col-2 fs-1 d-flex justify-content-center align-items-center'>
    →
    </div>
    <div class='col-5 text-center'>
    <span class='fs-6'>Modified to</span>
    <div class='mod-div py-1'></div>
    <div class="fs-5">${modDef.name}</div>
    </div>
  </div>
  `

  compareRow.appendChild(col)
  col.querySelector('.mod-div').appendChild(exUtilities.getDefinitionThumbnail(component.getHelperURL(), mod.definition))
  col.querySelector('.exhib-div').appendChild(exUtilities.getDefinitionThumbnail(component.getHelperURL(), exhibDef?.uuid ?? 'error'))
  col.querySelector('.btn-close').addEventListener('click', (ev) => {
    const toRemove = JSON.parse(modal.dataset.toRemove)
    toRemove.push(component.uuid)
    modal.dataset.toRemove = JSON.stringify(toRemove)

    // Update the GUI
    col.remove()
    document.getElementById('exhibitModificationsModalSaveButton').style.display = 'block'
    document.getElementById('exhibitModificationsModalCloseButton').innerText = 'Cancel'
  })
}

export function removeExhibitionModifications () {
  // Remove any exhibition modifications chosen by the user from the modal.

  const modal = document.getElementById('exhibitModificationsModal')
  const toRemove = JSON.parse(modal.dataset.toRemove)

  if (toRemove.length === 0) return

  hubTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/exhibition/modifications',
    params: { to_remove: toRemove }
  })
    .then(() => {
      exUtilities.hideModal('#exhibitModificationsModal')
    })
}

export function applyExhibitionModifications () {
  // Tell Hub to convert all current modificaitons to be part of the exhibition.

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibition/applyModifications'
  })
    .then(() => {
      exUtilities.hideModal('#exhibitModificationsModal')
    })
}
