/* global bootstrap */

import * as exUtilities from '../../../common/utilities.js'
import exConfig from '../../../common/config.js'

import hubConfig from '../../config.js'
import * as hubComponents from './components.js'
import * as hubDMX from './dmx.js'
import * as hubGroups from './groups.js'
import * as hubMaint from './maintenance.js'
import * as hubTools from '../tools.js'
import * as hubUsers from './users.js'

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
    check.dataset.uuid = group.uuid
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
    prefDict[el.dataset.uuid] = el.checked
  }

  hubUsers.updateUserPreferences({
    show_groups: prefDict
  })
    .then(hubComponents.rebuildComponentInterface)

  exUtilities.hideModal('#showHideGroupsModal')
}

function setComponentInfoStatusMessage (msg, delay = false) {
  // Set the given string as the status message and show it.

  if (msg == null || msg.trim() === '') {
    clearComponentInfoStatusMessage()
    return
  }

  const el = document.getElementById('componentInfoStatusMessage')

  el.innerHTML = msg
  if (delay) {
    clearTimeout(exConfig.componentInfoModalStatusMessageTimer)
    exConfig.componentInfoModalStatusMessageTimer = setTimeout(() => {
      el.style.display = 'block'
    }, 500)
  } else el.style.display = 'block'
}

function clearComponentInfoStatusMessage () {
  // Hide the status message

  clearTimeout(exConfig.componentInfoModalStatusMessageTimer)
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

  const obj = hubTools.getExhibitComponent(uuid)
  const componentInfoModal = document.getElementById('componentInfoModal')
  componentInfoModal.dataset.id = obj.id
  componentInfoModal.dataset.uuid = obj.uuid

  document.getElementById('componentInfoModalTitle').innerText = obj.id

  // Set up the upper-right dropdown menu with helpful details
  document.getElementById('exhibiteraComponentIdButton').innerText = exUtilities.appNameToDisplayName(obj.exhibiteraAppID)

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

  if (obj.platform_details) {
    if (obj.platform_details.operating_system) {
      document.getElementById('componentInfoModalOperatingSystem').innerHTML = obj.platform_details.operating_system.replace('OS X', 'macOS')
      document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'block'
    } else {
      document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'none'
    }
    if (obj.platform_details.exhibitera_version) {
      document.getElementById('componentInfoModalExhibtera').innerText = exUtilities.formatSemanticVersion(obj.platform_details.exhibitera_version)
      document.getElementById('componentInfoModalExhibteraGroup').style.display = 'block'
    } else {
      document.getElementById('componentInfoModalExhibteraGroup').style.display = 'none'
    }
    if (obj.platform_details.browser && obj.platform_details.browser !== 'null null') {
      document.getElementById('componentInfoModalBrowser').innerHTML = obj.platform_details.browser
      document.getElementById('componentInfoModalBrowserGroup').style.display = 'block'
    } else {
      document.getElementById('componentInfoModalBrowserGroup').style.display = 'none'
    }
  } else {
    document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'none'
    document.getElementById('componentInfoModalBrowserGroup').style.display = 'none'
    document.getElementById('componentInfoModalExhibteraGroup').style.display = 'none'
  }
  if (obj.protocol) {
    const protocolNames = {
      pjlink: 'PJLink'
    }
    document.getElementById('componentInfoModalProtocol').innerHTML = protocolNames[obj.protocol]
    document.getElementById('componentInfoModalProtocolGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalProtocolGroup').style.display = 'none'
  }
  if (obj.latency) {
    document.getElementById('componentInfoModalLatency').innerHTML = String(obj.latency) + ' ms'
    document.getElementById('componentInfoModalLatencyGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalLatencyGroup').style.display = 'none'
  }
  if (obj.lastContactDateTime) {
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
  document.getElementById('componentInfoModalMaintenanceSystemStatsView').style.display = 'none'

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
  hubGroups.populateGroupsForSelect(groupSelect, obj.groups)

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
    endpoint: '/DMX/scenes'
  })
    .then((result) => {
      document.getElementById('componentInfoModalDMXTabButton').style.display = 'block'
      if (result?.success === true) {
        hubDMX.populateDMXScenesForInfoModal(result.scenes, obj.getHelperURL())
        document.getElementById('componentInfoModalDMXControls').style.display = 'flex'
        document.getElementById('componentInfoModalDMXIntro').style.display = 'none'
      } else {
        document.getElementById('componentInfoModalDMXControls').style.display = 'none'
        document.getElementById('componentInfoModalDMXIntro').style.display = 'block'
      }
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
  if (obj.state?.model) {
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
    const app = el.dataset.app
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

  const uuid = document.getElementById('componentInfoModal').dataset.uuid

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
        hubComponents.rebuildComponentInterface()
      }
    })
}

export function updateStaticComponentFromInfoModal () {
  // Collect details from the component info modal and update the static component

  const uuid = document.getElementById('componentInfoModal').dataset.uuid

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
      if (response?.success) {
        document.getElementById('componentInfoModalStaticSettingsSaveButton').style.display = 'none'
        document.getElementById('componentInfoModalTitle').innerHTML = document.getElementById('componentInfoModalStaticSettingsID').value.trim()
        updateComponentInfoDescription(update.description)
        hubComponents.rebuildComponentInterface()
      } else {
        console.log('Saving failed:', response.reason)
      }
    })
}

export function updateWakeOnLANComponentFromInfoModal () {
  // Collect details from the component info modal and update the Wake on LAN component

  const uuid = document.getElementById('componentInfoModal').dataset.uuid

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
      hubComponents.rebuildComponentInterface()
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

  const uuid = document.getElementById('componentInfoModal').dataset.uuid

  hubTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/component/' + uuid + '/delete'
  })
    .then((response) => {
      if (response.success && response.success === true) {
        hubTools.getExhibitComponent(uuid).remove()
        exUtilities.hideModal('#componentInfoModal')
      }
    })
}

async function populateComponentDefinitionList (definitions, permission) {
  // Take a dictionary of definitions and convert it to GUI elements.

  const uuid = document.getElementById('componentInfoModal').dataset.uuid
  const component = hubTools.getExhibitComponent(uuid)

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
    col.dataset.definition = definition.uuid
    col.dataset.app = definition.app

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

      if (['image_compare', 'infostation', 'media_browser', 'media_player', 'survey_kiosk', 'timelapse_viewer', 'timeline_explorer', 'voting_kiosk', 'word_cloud_input', 'word_cloud_viewer'].includes(definition.app)) {
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

async function showCopyDefinitionModal (componentUUID, definitionUUID, definitionName) {
  // Set up and show the model for copying a definition from one component to another

  const component = hubTools.getExhibitComponent(componentUUID)
  const modal = document.getElementById('copyDefinitionModal')
  modal.dataset.definition = definitionUUID
  modal.dataset.component = componentUUID

  const submitButton = document.getElementById('copyDefinitionModalSubmitButton')
  submitButton.innerHTML = 'Copy'
  submitButton.disabled = false
  submitButton.classList.remove('btn-info')
  submitButton.classList.add('btn-primary')
  submitButton.style.display = 'none'
  document.getElementById('copyProgressContainer').style.display = 'none'

  if (component.getHelperURL() == null) {
    // We don't have enough information to contact the helper
    console.error('Error: No helper address')
  }

  let content = []
  let contentList = { content: [] }

  try {
    contentList = await component.makeRequest({
      method: 'GET',
      endpoint: '/definitions/' + definitionUUID + '/getContentList'
    })
    console.log(contentList)
  } catch (err) {
    console.error('Failed to fetch source content list:', err)
  }

  // Populate source files
  const sourceDiv = document.getElementById('copyDefinitionModalSourceFiles')
  sourceDiv.innerHTML = ''

  sourceDiv.appendChild(copyDefinitionModalCreateSourceHTML(definitionName, '', true))

  if (contentList.content && contentList.content.length > 0) {
    content = contentList.content
    content = contentList.content.sort((a, b) => (b.size || 0) - (a.size || 0))

    modal.setAttribute('data-sourceFiles', JSON.stringify(contentList.content))

    let supportingText = ' supporting file'
    if (contentList.content.length > 1) supportingText = ' supporting files'
    sourceDiv.appendChild(copyDefinitionModalCreateSourceHTML(String(contentList.content.length) + supportingText, contentList?.total_size ?? ''))

    // Create a list for supporting files
    const fileList = document.createElement('ul')
    fileList.classList = 'list-unstyled ms-3 small text-muted'

    for (const file of content) {
      const li = document.createElement('li')
      li.classList.add('mb-1')
      li.innerHTML = `
      <span class="file-status ms-2" data-filename="${file.name}"></span>
    ${file.name} <span class="text-muted small">(${file.size_text})</span>
  `
      fileList.appendChild(li)
    }

    sourceDiv.appendChild(fileList)
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
      if (comp.status === hubConfig.STATUS.STATIC) continue
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
      const col = copyDefinitionModalCreateDestinationHTML(comp, group, definitionUUID, content)
      destDiv.appendChild(col)
    }
  }

  if (totalComps === 0) destDiv.innerHTML = '<i>No available components</i>'

  exUtilities.hideModal('#componentInfoModal')
  exUtilities.showModal('#copyDefinitionModal')
}

function copyDefinitionModalCreateDestinationHTML (component, group, def, content) {
  // Take an exhibit component and build an HTML representation.
  // Check if the given destination contains a definition or content of the
  // same name and warn the user.

  const modal = document.getElementById('copyDefinitionModal')
  const submitButton = document.getElementById('copyDefinitionModalSubmitButton')

  const col = document.createElement('div')

  const checkGroup = document.createElement('div')
  checkGroup.classList = 'form-check'
  col.appendChild(checkGroup)

  const input = document.createElement('input')
  input.classList = 'form-check-input copyDest'
  input.setAttribute('type', 'checkbox')
  input.setAttribute('id', 'copyOption_' + group + '_' + component.uuid)
  input.dataset.uuid = component.uuid
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

  const badgeContainer = document.createElement('span')
  badgeContainer.className = 'badge-container'

  const spinner = document.createElement('span')
  spinner.className = 'spinner-border spinner-border-sm ms-2 text-secondary align-middle'
  spinner.setAttribute('role', 'status')
  badgeContainer.appendChild(spinner)

  badgeContainer.insertAdjacentHTML('beforeend', `<span data-uuid="${component.uuid}" class="ms-2 badge text-bg-success copy-success" style="display:none; font-size: 0.55em">Copied</span>`)
  badgeContainer.insertAdjacentHTML('beforeend', `<span data-uuid="${component.uuid}" class="ms-2 badge text-bg-danger copy-fail" style="display:none;">Error</span>`)

  label.appendChild(badgeContainer)
  checkGroup.appendChild(label)

  // Check if any content already exists on the destination
  checkDestinationStatus(component, badgeContainer, spinner, input, content)

  return col
}

async function checkDestinationStatus (component, badgeContainer, spinner, input, content) {
  // Check if any content is already on the given component.

  try {
    const [contentResponse] = await Promise.all([
      component.makeRequest({ method: 'GET', endpoint: '/files/availableContent' })
    ])

    let tooltipAdded = false

    if (contentResponse.content) {
      for (const file of content) {
        if (contentResponse.content.includes(file.name)) {
          badgeContainer.insertAdjacentHTML('beforeend', `<span class="badge bg-warning ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="${file.name} already exists here and will be overwritten." style="font-size: 0.55em;">!</span>`)
          tooltipAdded = true
        }
      }
    }

    if (tooltipAdded) {
      const tooltips = badgeContainer.querySelectorAll('[data-bs-toggle="tooltip"]'); [...tooltips].map(el => new bootstrap.Tooltip(el))
    }
  } catch (err) {
    // We cannot connect to this component
    console.warn(`Could not reach ${component.id}:`, err)

    input.disabled = true
    input.checked = false // Uncheck if the user managed to click it while loading
    input.closest('.form-check').classList.add('opacity-50')

    // Add an error badge explaining the state
    badgeContainer.insertAdjacentHTML('beforeend', '<span class="badge text-bg-danger ms-1 align-middle" style="font-size: 0.55em;">Connection Error</span>')

    // Trigger a change event to update the "Submit" button visibility if this was the only one checked
    input.dispatchEvent(new Event('change'))
  } finally {
    // Remove the loading spinner whether the check succeeded or timed out
    if (spinner && spinner.parentNode) {
      spinner.remove()
    }
  }
}

function copyDefinitionModalCreateSourceHTML (filename, sizeText, isDefinition = false) {
  // Create an HTML representation of the given file for the definitionCopyModal.

  const col = document.createElement('div')
  col.classList = ''

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
  const progressBar = document.getElementById('copyProgressBar')
  const progressContainer = document.getElementById('copyProgressContainer')

  submitButton.innerHTML = 'Copying...'
  submitButton.classList.replace('btn-primary', 'btn-info')
  submitButton.disabled = true

  progressContainer.style.display = 'flex'
  progressBar.style.width = '0%'
  progressBar.classList.remove('bg-success')
  progressBar.classList.add('progress-bar-animated')

  // Sources
  const definitionUUID = modal.dataset.definition
  let definition
  const sourceUUID = modal.dataset.component
  const sourceComponent = hubTools.getExhibitComponent(sourceUUID)
  const filesToCopy = JSON.parse(modal.getAttribute('data-sourceFiles')) ?? []

  // Load the definition to be copies
  const defResponse = await sourceComponent.makeRequest({
    method: 'GET',
    endpoint: '/definitions/' + definitionUUID + '/load'
  })
  if (defResponse?.success) {
    definition = defResponse.definition
  } else {
    console.error('Could not reach source component:', sourceComponent)
    return
  }

  // Identify unique components to prevent redundant transfers
  const checkedElements = modal.querySelectorAll('input.copyDest:checked')
  const uniqueDestinations = new Map()

  for (const checkbox of checkedElements) {
    const uuid = checkbox.dataset.uuid
    if (uuid && !uniqueDestinations.has(uuid)) {
      const comp = hubTools.getExhibitComponent(uuid)
      if (comp) {
        uniqueDestinations.set(uuid, {
          component: comp,
          // Store all checkboxes associated with this UUID so we can update all badges
          elements: Array.from(modal.querySelectorAll(`input.copyDest[data-uuid="${uuid}"]`))
        })
      }
    }
  }

  const defSizeEstimate = 5000 // ~5 kB for the definition JSON
  const bytesPerDest = filesToCopy.reduce((acc, file) => acc + (file.size || 0), defSizeEstimate)
  const totalBytes = uniqueDestinations.size * bytesPerDest
  let completedBytes = 0

  const updateProgress = (bytes) => {
    completedBytes += bytes
    const percent = Math.min(Math.round((completedBytes / totalBytes) * 100), 100)
    progressBar.style.width = percent + '%'
    progressBar.innerHTML = percent + '%'
  }

  const totalDests = uniqueDestinations.size
  // Tracker: filename -> count of successful transfers
  const fileProgress = {}

  // Set all files to a loading spinner initially
  filesToCopy.forEach(file => {
    fileProgress[file.name] = { success: 0, error: 0 }
    const statusIcon = modal.querySelector(`.file-status[data-filename="${CSS.escape(file.name)}"]`)
    if (statusIcon) {
      statusIcon.innerHTML = '<span class="spinner-border spinner-border-sm text-primary" role="status"></span>'
    }
  })

  // Initiate file transfers in parallel
  const transferPromises = Array.from(uniqueDestinations.values()).map(async (dest) => {
    const destComp = dest.component
    const destUrl = destComp.getHelperURL()
    const relatedCheckboxes = dest.elements

    if (!destUrl) {
      updateProgress(bytesPerDest) // Move the progress bar anyway
      return
    }

    try {
      // Transfer Definition

      // Create a unique UUID
      const thisDef = structuredClone(definition)
      thisDef.uuid = exUtilities.uuid()

      await exUtilities.makeRequest({
        method: 'POST',
        url: destUrl,
        endpoint: '/definitions/write',
        params: { definition: thisDef },
        timeout: 120000
      })
      updateProgress(defSizeEstimate)

      // Transfer Supporting Files concurrently
      const filePromises = filesToCopy.map(async (file) => {
        try {
          await exUtilities.makeRequest({
            method: 'POST',
            url: destUrl,
            endpoint: '/files/retrieve',
            params: {
              file_url: `${sourceComponent.getHelperURL()}/content/${file.name}`,
              path_list: ['content', file.name]
            },
            timeout: 120000
          })
          fileProgress[file.name].success++
        } catch (err) {
          fileProgress[file.name].error++
          throw err
        } finally {
          updateProgress(file.size)
          // Check if this file is finished across all components
          const statusIcon = modal.querySelector(`.file-status[data-filename="${CSS.escape(file.name)}"]`)
          if (statusIcon) {
            const prog = fileProgress[file.name]
            if (prog.success + prog.error === totalDests) {
              statusIcon.innerHTML = prog.error > 0 ? '⚠️' : '✅'
            }
          }
        }
      })

      await Promise.all(filePromises)

      // Success: Show badges for ALL instances of this component in the list
      relatedCheckboxes.forEach(cb => {
        const successBadge = cb.parentElement.querySelector('.copy-success')
        if (successBadge) successBadge.style.display = 'inline'
      })

      return { success: true }
    } catch (e) {
      console.error(`Copy failed for ${destComp.id}:`, e)
      // Failure: Show badges for ALL instances
      relatedCheckboxes.forEach(cb => {
        const failBadge = cb.parentElement.querySelector('.copy-fail')
        if (failBadge) failBadge.style.display = 'inline'
      })
      return { success: false }
    }
  })

  await Promise.allSettled(transferPromises)

  progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped')
  progressBar.classList.add('bg-success')
  progressBar.innerHTML = 'Complete'
  submitButton.style.display = 'none'
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

  const definition = document.querySelector('.definition-selected').dataset.definition
  const componentUUID = document.getElementById('componentInfoModal').dataset.uuid

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/' + componentUUID + '/definition/' + definition
  })
  document.getElementById('componentInfoModalDefinitionSaveButton').style.display = 'none'
}

async function updateComponentInfoModalFromHelper (uuid, permission) {
  // Ask the given helper to send an update and use it to update the interface.

  const obj = hubTools.getExhibitComponent(uuid)

  if (!obj.getHelperURL()) {
    // We don't have enough information to contact the helper
    componentCannotConnect()

    // Make the modal visible
    exUtilities.showModal('#componentInfoModal')
    return
  }

  setComponentInfoStatusMessage('Connecting to component...', true)

  let defResponse
  try {
    defResponse = await obj.makeRequest({
      method: 'GET',
      endpoint: '/definitions',
      timeout: 3000
    })
  } catch {
    componentCannotConnect()
    return
  }

  // Good connection, so show the interface elements
  componentGoodConnection()

  populateComponentDefinitionList(defResponse.definitions, permission)

  let statsResponse
  try {
    statsResponse = await obj.makeRequest({
      method: 'GET',
      endpoint: '/system/stats',
      timeout: 3000
    })
  } catch {
    document.getElementById('componentInfoModalMaintenanceSystemStatsView').style.display = 'none'
    return
  }

  const stats = statsResponse.system_stats
  // Disk
  const spaceUsedBar = document.getElementById('componentInfoModalMaintenanceDiskSpaceUsedBar')
  const spaceFreeBar = document.getElementById('componentInfoModalMaintenanceDiskSpaceFreeBar')
  spaceUsedBar.setAttribute('ariaValueNow', 100 - stats.disk_pct_free)
  spaceUsedBar.style.width = String(100 - stats.disk_pct_free) + '%'
  spaceFreeBar.setAttribute('ariaValueNow', stats.disk_pct_free)
  spaceFreeBar.style.width = String(stats.disk_pct_free) + '%'
  document.getElementById('componentInfoModalMaintenanceDiskSpaceFree').innerHTML = `Disk: ${String(Math.round(stats.disK_free_GB))} GB`

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
  if (obj?.platform_details?.operating_system.toLowerCase().includes('windows')) {
    document.getElementById('componentInfoModalMaintenanceCPUBar').style.display = 'none'
  } else {
    document.getElementById('componentInfoModalMaintenanceCPUBar').style.display = 'block'
  }
  const CPUUsedBar = document.getElementById('componentInfoModalMaintenanceCPUUsedBar')
  const CPUFreeBar = document.getElementById('componentInfoModalMaintenanceCPUFreeBar')
  CPUUsedBar.setAttribute('ariaValueNow', stats.cpu_load_pct)
  CPUUsedBar.style.width = String(stats.cpu_load_pct) + '%'
  document.getElementById('componentInfoModalMaintenanceCPUUsed').innerHTML = `CPU: ${String(Math.round(stats.cpu_load_pct))}%`
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
  const RAMUsedBar = document.getElementById('componentInfoModalMaintenanceRAMUsedBar')
  const RAMFreeBar = document.getElementById('componentInfoModalMaintenanceRAMFreeBar')
  RAMUsedBar.setAttribute('ariaValueNow', stats.ram_used_pct)
  RAMUsedBar.style.width = String(stats.ram_used_pct) + '%'
  document.getElementById('componentInfoModalMaintenanceRAMUsed').innerHTML = `RAM: ${String(Math.round(stats.ram_used_pct))}%`
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

  document.getElementById('componentInfoModalMaintenanceSystemStatsView').style.display = 'flex'
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
    const thisApp = entry.dataset.app
    if ((thisApp === appToShow) || (appToShow === 'all')) {
      entry.style.display = 'block'
    } else {
      entry.style.display = 'none'
    }
  }
}

export function submitComponentBasicSettingsChange () {
  // Update the id, group, and description of an exhibit component

  const uuid = document.getElementById('componentInfoModal').dataset.uuid

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

  const obj = hubTools.getExhibitComponent(document.getElementById('componentInfoModal').dataset.uuid)

  // Check that we actually have something to update
  if (!obj.getHelperURL()) {
    console.log('submitComponentSettingsChange: error: no helperAddress to contact')
    return
  }

  // Update component settings, if allowed
  const settingsAvailable = document.getElementById('componentInfoModalSettingsPermissionsPane').style.display === 'flex'
  if (settingsAvailable === true) {
    const settings = {
      permissions: {
        audio: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAutoplayAudio').value),
        refresh: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAllowRefresh').value),
        restart: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAllowRestart').value),
        shutdown: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAllowShutdown').value),
        sleep: exUtilities.stringToBool(document.getElementById('componentInfoModalSettingsAllowSleep').value)
      }
    }
    obj.makeRequest({
      method: 'POST',
      endpoint: '/system/configuration/update',
      params: { defaults: settings }
    })
      .then((response) => {
        if (response?.success) {
          document.getElementById('componentInfoModalSettingsSaveButton').style.display = 'none'
        }
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
  const component = hubTools.getExhibitComponent(mod.uuid)

  document.getElementById('exhibitModificationsModalSaveButton').style.display = 'none'
  document.getElementById('exhibitModificationsModalCloseButton').innerText = 'Close'

  let exhibDef = {} // The definition from the exhibition
  let modDef = {} // The definition we've modified to
  let badConnection = false
  try {
    const modDefReq = await hubTools.getExhibitComponent(mod.uuid).makeRequest({
      method: 'GET',
      endpoint: '/definitions/' + mod.definition + '/load'
    })

    modDef = modDefReq.definition

    const exhibDefUUID = exhib.components.find(obj => obj.uuid === mod.uuid)?.definition ?? 'error'
    const exhibDefReq = await exUtilities.makeRequest({
      method: 'GET',
      url: hubTools.getExhibitComponent(mod.uuid).getHelperURL(),
      endpoint: '/definitions/' + exhibDefUUID + '/load'
    })
    exhibDef = exhibDefReq.definition
  } catch {
    badConnection = true
  }

  const col = document.createElement('div')
  col.classList = 'col py-1'
  col.innerHTML = `
  <div class='row border rounded gx-2'>
    <div class="col-12 position-relative d-flex justify-content-center align-items-center">
      <span class="text-center fs-4 fw-bold pt-1">${component.id}</span>
      <button class="btn-close position-absolute end-0 me-2"></button>
    </div>
    <div class='col-12 bad-connection-warning'>
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
    <div class="fs-5">${modDef?.name ?? '<i>No definition</i>'}</div>
    </div>
  </div>
  `

  compareRow.appendChild(col)
  if (badConnection) {
    col.querySelector('.bad-connection-warning').innerHTML = '<div class=\'text-center text-warning fst-italic\'>Cannot connect to component</div>'
  }
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

// Event handlers
hubComponents.setComponentClickHandler(showExhibitComponentInfo)
