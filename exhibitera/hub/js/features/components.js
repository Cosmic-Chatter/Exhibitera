import * as exUtilities from '../../../common/utilities.js'
import exConfig from '../../../common/config.js'

import hubConfig from '../../config.js'
import * as hubComponentInfo from './component_info_modal.js'
import * as hubNotifications from './notifications.js'
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
    this.maintenanceStatus = hubConfig.MAINTENANCE_STATUS['Off floor, not working']
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
      hubComponentInfo.showExhibitComponentInfo(thisUUID, group)
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

    if (hubConfig?.user?.preferences?.status_mode) {
      if (hubConfig.user.preferences.status_mode === 'realtime' && (this.status != null)) {
        return this.status
      } else if (hubConfig.user.preferences.status_mode === 'maintenance' && (this.maintenanceStatus != null)) {
        return this.maintenanceStatus
      }
    }
    return hubConfig.MAINTENANCE_STATUS['Off floor, not working']
  }

  populateActionMenu (dropdownMenu, groupUUID, permission = 'view') {
    // Build out the dropdown menu options based on the this.permissions.

    dropdownMenu.innerHTML = ''
    const thisUUID = this.uuid
    let numOptions = 0

    if (permission === 'edit') {
      if (this?.permissions?.refresh === true) {
        numOptions += 1
        const refreshAction = document.createElement('a')
        refreshAction.classList = 'dropdown-item handCursor'
        refreshAction.innerHTML = 'Refresh component'
        refreshAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'refresh_page')
        }, false)
        dropdownMenu.appendChild(refreshAction)
      }

      if (this?.permissions?.sleep === true) {
        numOptions += 2
        const sleepAction = document.createElement('a')
        sleepAction.classList = 'dropdown-item handCursor'
        sleepAction.innerHTML = 'Sleep display'
        sleepAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'sleep_display')
        }, false)
        dropdownMenu.appendChild(sleepAction)

        const wakeAction = document.createElement('a')
        wakeAction.classList = 'dropdown-item handCursor'
        wakeAction.innerHTML = 'Wake display'
        wakeAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'wake_display')
        }, false)
        dropdownMenu.appendChild(wakeAction)
      }

      if (this?.permissions?.restart === true) {
        numOptions += 1
        const restartAction = document.createElement('a')
        restartAction.classList = 'dropdown-item handCursor'
        restartAction.innerHTML = 'Restart component'
        restartAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'restart')
        }, false)
        dropdownMenu.appendChild(restartAction)
      }

      if (this?.permissions?.shutdown === true) {
        numOptions += 1
        const shutdownAction = document.createElement('a')
        shutdownAction.classList = 'dropdown-item handCursor'
        shutdownAction.innerHTML = 'Power off component'
        shutdownAction.addEventListener('click', function () {
          queueCommand(thisUUID, 'restart')
        }, false)
        dropdownMenu.appendChild(shutdownAction)
      }

      if (this?.permissions?.power_on === true) {
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
      hubComponentInfo.showExhibitComponentInfo(thisUUID, groupUUID)
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
    hubConfig.exhibitComponents = hubConfig.exhibitComponents.filter(el => el.uuid !== thisInstance.uuid)

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
    this.maintenanceStatus = hubConfig.MAINTENANCE_STATUS[maintenanceStatus]

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

    // Update basic keys
    const fields = ['uuid', 'ip_address', 'description', 'latency', 'lastContactDateTime']
    for (const key of fields) {
      if (key in update) {
        this[key] = update[key]
      }
    }

    // Handle special cases
    if ('groups' in update && exUtilities.arraysEqual(this.groups, update.groups) === false) {
      this.setGroups(update.groups)
    }
    if (update?.permissions) {
      if (JSON.stringify(this.permissions) !== JSON.stringify(update.permissions)) {
        this.setPermissions(update.permissions)
      }
    }
    if (update?.notifications) {
      hubConfig.notifications[this.uuid] = update.notifications
      hubNotifications.rebuildNotificationList()
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
    this.exhibiteraAppID = ''
    this.platform_details = {}
  }

  getHelperURL () {
    // Return the url for the helper of this component.

    return this.helperAddress
  }

  getScreenshot () {
    // Return a url pointing to a screenshot of the current display

    let url = this.getHelperURL() + exConfig.api + '/system/screenshot'
    if (this.exhibiteraAppID === 'external') {
      url = this.getHelperURL() + '/core/screenshot'
    }
    return url
  }

  updateFromServer (update) {
    // Extend parent update to include exhibit component-specific items

    super.updateFromServer(update)

    const fields = [
      'definition',
      'exhibiteraAppID',
      'helperAddress',
      'platform_details'
    ]

    for (const key of fields) {
      if (key in update) {
        this[key] = update[key]
      }
    }
  }

  makeRequest (opt) {
    // Make a request to the helper for this component

    opt.url = this.getHelperURL()

    if (opt.url == null) {
      return Promise.reject(new Error('helperAddress not found'))
    }

    // If this is a request that can be fulfilled by the Core API, do it.
    const coreEndpoints = {
      '/restart': '/core/system/restart',
      '/shutdown': '/core/system/shutdown'
    }

    if (opt.endpoint in coreEndpoints) {
      opt.endpoint = opt.endpoint.replace(opt.endpoint, coreEndpoints[opt.endpoint])
      opt.api = ''
    }

    return exUtilities.makeRequest(opt)
  }
}

export class WakeOnLANComponent extends BaseComponent {
  // A component representings a Wake on LAN device

  constructor (uuid, id, groups, macAddress) {
    super(uuid, id, groups)

    this.type = 'wol_component'
    this.mac_address = macAddress
    this.exhibiteraAppID = 'wol_only'
  }
}

class Projector extends BaseComponent {
  // A component representing a projector

  constructor (uuid, id, groups) {
    super(uuid, id, groups)

    this.type = 'projector'
    this.exhibiteraAppID = 'projector'
    this.password = ''
    this.protocol = 'pjlink'
    this.state = {}
  }

  updateFromServer (update) {
    // Extend parent method for proejctor-specific items

    super.updateFromServer(update)

    if (update.state) {
      const state = update.state
      const stateFields = ['model', 'power_state', 'lamp_status', 'error_status']

      for (const key of stateFields) {
        if (state?.[key]) {
          this.state[key] = state[key]
        }
      }

      if (state.error_status) {
        const errors = {}
        for (const item of Object.keys(state.error_status)) {
          if ((state.error_status)[item] !== 'ok') {
            errors[item] = {
              message: (state.error_status)[item],
              type: 'warning',
              uuid: item
            }
          }
        }
        hubConfig.notifications[this.uuid] = errors
        hubNotifications.rebuildNotificationList()
      }
    }
    if (update?.password) this.password = update.password
    if (update?.protocol) this.protocol = update.protocol
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
    // Sort the component list and rebuild the HTML representation

    if (method === 'alphabetical') {
      this.components = exUtilities.sortAlphabetically(this.components, 'id')
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
    // Build the HTML representation of this group and add it to the componentGroupsRow

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
      offCmdName = 'sleep_display'
    } else {
      onCmdName = 'wake_display'
      offCmdName = 'sleep_display'
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

function createComponentFromUpdate (update) {
  // Use an update dictionary to create a new component

  // Make sure this component doesn't already exist
  const obj = hubTools.getExhibitComponent(update.uuid)
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

  const obj = hubTools.getExhibitComponent(update.uuid)

  if (obj != null) {
    // Update the object with the latest info from the server
    obj.updateFromServer(update)
  } else {
    createComponentFromUpdate(update)
  }
}

function queueCommand (uuid, cmd) {
  // Function to send a command to Hub that will then
  // be sent to the component the next time it pings the server

  const obj = hubTools.getExhibitComponent(uuid)
  if (['shutdown', 'restart'].includes(cmd) && obj.type === 'exhibit_component') {
    // We send these commands directly to the helper
    obj.makeRequest({
      method: 'GET',
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

function sendGroupCommand (group, cmd) {
  // Iterate through the components in the given group and queue the command
  // for each

  group = hubTools.getExhibitComponentGroup(group)
  console.log(group, cmd)
  for (let i = 0; i < group.components.length; i++) {
    queueCommand(group.components[i].uuid, cmd)
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

export function checkForRemovedComponents (update) {
  // Check hubConfig.exhibitComponents and remove any components not in `update`

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
