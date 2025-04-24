/* global bootstrap, showdown */

import exConfig from '../../common/config.js'
import * as exUtilities from '../../common/utilities.js'
import hubConfig from '../config.js'
import * as exExhibit from './features/exhibits.js'
import * as exGroup from './features/groups.js'
import * as exIssues from './features/issues.js'
import * as exMaintenance from './features/maintenance.js'
import * as exProjector from './features/projectors.js'
import * as exSchedule from './features/schedules.js'
import * as exTools from './tools.js'
import * as exTracker from './features/tracker.js'
import * as exUsers from './features/users.js'

async function editExhibitCreateComponentHTML (component) {
  // Create the HTML representation of a component exhibit entry.

  const contentList = document.getElementById('editExhibitExhibitContentList')

  const col = document.createElement('div')
  col.classList = 'col manageExhibit-component-col'
  col.setAttribute('data-component-uuid', component.uuid)
  contentList.appendChild(col)

  const row = document.createElement('div')
  row.classList = 'row mx-0'
  col.appendChild(row)

  const header = document.createElement('div')
  header.classList = 'col-12 d-flex justify-content-between align-items-center bg-primary rounded-top text-light py-1'
  row.appendChild(header)

  const nameDiv = document.createElement('div')
  nameDiv.classList = 'fs-5'
  nameDiv.innerHTML = component.id
  header.appendChild(nameDiv)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm py-0'
  deleteButton.innerHTML = '✕'
  deleteButton.addEventListener('click', () => {
    deleteButton.closest('.manageExhibit-component-col').remove()
  })
  header.appendChild(deleteButton)

  const body = document.createElement('div')
  body.classList = 'col-12 bg-secondary rounded-bottom py-2'
  row.appendChild(body)

  const bodyRow = document.createElement('div')
  bodyRow.classList = 'row gy-2'
  body.appendChild(bodyRow)

  const componentObj = exExhibit.getExhibitComponent(component.uuid)

  const definitionPreviewCol = document.createElement('div')
  definitionPreviewCol.classList = 'col-12 exhibit-thumbnail'
  if (document.getElementById('editExhibitThumbnailCheckbox').checked === false) definitionPreviewCol.style.display = 'none'
  bodyRow.appendChild(definitionPreviewCol)

  const definitionPreviewImage = document.createElement('img')
  definitionPreviewImage.style.width = '100%'
  definitionPreviewImage.style.height = '100px'
  definitionPreviewImage.style.objectFit = 'contain'
  definitionPreviewCol.appendChild(definitionPreviewImage)

  const definitionPreviewVideo = document.createElement('video')
  definitionPreviewVideo.setAttribute('autoplay', true)
  definitionPreviewVideo.muted = 'true'
  definitionPreviewVideo.setAttribute('loop', 'true')
  definitionPreviewVideo.setAttribute('playsinline', 'true')
  definitionPreviewVideo.setAttribute('webkit-playsinline', 'true')
  definitionPreviewVideo.setAttribute('disablePictureInPicture', 'true')
  definitionPreviewVideo.style.width = '100%'
  definitionPreviewVideo.style.height = '100px'
  definitionPreviewVideo.style.objectFit = 'contain'
  definitionPreviewCol.appendChild(definitionPreviewVideo)

  definitionPreviewImage.addEventListener('error', () => {
    // Handle the case where we try to load a video into the img tag

    const value = definitionPreviewImage.dataset.selectedDefinition
    definitionPreviewVideo.src = componentObj.getHelperURL() + exConfig.api + '/definitions/' + value + '/thumbnail'
    definitionPreviewVideo.play()
    definitionPreviewImage.style.display = 'none'
    definitionPreviewVideo.style.display = 'block'
  })

  const definitionSelectCol = document.createElement('div')
  definitionSelectCol.classList = 'col-12'
  bodyRow.appendChild(definitionSelectCol)

  const definitionSelect = document.createElement('select')
  definitionSelect.classList = 'form-select manageExhibit-definition-select'
  definitionSelect.setAttribute('data-component-uuid', component.uuid)
  definitionSelect.setAttribute('data-component-id', component.id)
  definitionSelect.setAttribute('data-initial-definition', component.definition)
  definitionSelectCol.appendChild(definitionSelect)

  const badComponent = function () {
    // This component is offline
    const badComponentCol = Object.assign(document.createElement('div'), {
      className: 'col-12',
      innerHTML: '<div class="alert alert-danger fst-italic text-center py-2 mb-0">Component offline</div>'
    })
    bodyRow.appendChild(badComponentCol)

    // Hide the thumbnail and select
    definitionPreviewCol.style.display = definitionSelectCol.style.display = 'none'
  }

  if (componentObj == null) {
    badComponent()
    return
  }

  try {
    await exUtilities.makeRequest({
      method: 'GET',
      url: componentObj.getHelperURL(),
      endpoint: '/system/checkConnection'
    })
  } catch {
    badComponent()
    return
  }

  const response = await exUtilities.makeRequest({
    method: 'GET',
    url: componentObj.getHelperURL(),
    endpoint: '/definitions'
  })

  // Build an option for each definition
  const appDict = exTools.sortDefinitionsByApp(response.definitions)
  for (const app of Object.keys(appDict).sort()) {
    const header = new Option(exUtilities.appNameToDisplayName(app))
    header.setAttribute('disabled', true)
    definitionSelect.appendChild(header)

    for (const def of appDict[app]) {
      const option = new Option(def.name, def.uuid)
      definitionSelect.appendChild(option)
    }
  }

  const changeThumb = function () {
    definitionPreviewImage.dataset.selectedDefinition = definitionSelect.value

    definitionPreviewImage.src = componentObj.getHelperURL() + exConfig.api + '/definitions/' + definitionSelect.value + '/thumbnail'
    definitionPreviewVideo.style.display = 'none'
    definitionPreviewImage.style.display = 'block'
  }

  definitionSelect.addEventListener('change', changeThumb)
  definitionSelect.value = component.definition
  changeThumb()
}

async function editExhibitPopulateExhibitContent (exhibit) {
  // Create a GUI representation of the given exhibit that shows the defintion for each component.

  const contentList = document.getElementById('editExhibitExhibitContentList')
  const exhibitNameField = document.getElementById('editExhibitName')

  contentList.innerHTML = ''
  exhibitNameField.setAttribute('data-uuid', exhibit)

  const result = await exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/exhibition/' + exhibit + '/details'
  })
  exhibitNameField.value = result.exhibit.name

  for (const component of result.exhibit.components) {
    editExhibitCreateComponentHTML(component)
  }

  const actionsList = document.getElementById('editExhibitActionsList')
  actionsList.innerHTML = ''

  for (const command of result.exhibit.commands) {
    actionsList.append(createExhibitActionEntryHTML(command))
  }
  showEditExhibitGUI()
}

export function createExhibitActionEntryHTML (item, allowEdit = exTools.checkPermission('exhibits', 'edit')) {
  // Take a dictionary of properties and build an HTML representation of the schedule entry.

  const description = exSchedule.populateScheduleDescriptionHelper([item], false)

  if (description == null) return

  const eventRow = document.createElement('div')
  eventRow.classList = 'row mt-2 actionListing'
  eventRow.setAttribute('id', 'actionListing_' + item.uuid)
  eventRow.setAttribute('data-action', JSON.stringify(item))
  eventRow.setAttribute('data-uuid', item.uuid)

  const eventDescriptionCol = document.createElement('div')
  if (allowEdit) {
    eventDescriptionCol.classList = 'me-0 pe-0 col-9'
  } else {
    eventDescriptionCol.classList = 'col-12'
  }
  eventRow.appendChild(eventDescriptionCol)

  const eventDescriptionOuterContainer = document.createElement('div')
  eventDescriptionOuterContainer.classList = 'text-white bg-secondary w-100 h-100 justify-content-center d-flex py-1 pe-1 rounded-start'
  eventDescriptionCol.appendChild(eventDescriptionOuterContainer)

  const eventDescriptionInnerContainer = document.createElement('div')
  eventDescriptionInnerContainer.classList = 'align-self-center justify-content-center text-wrap'
  eventDescriptionOuterContainer.appendChild(eventDescriptionInnerContainer)

  const eventDescription = document.createElement('div')
  eventDescription.classList = 'text-center'
  eventDescription.innerHTML = description
  eventDescriptionOuterContainer.appendChild(eventDescription)

  if (allowEdit) {
    const eventEditButtonCol = document.createElement('div')
    eventEditButtonCol.classList = 'col-3 ms-0 ps-0'
    eventRow.appendChild(eventEditButtonCol)

    const eventEditButton = document.createElement('button')
    eventEditButton.classList = 'bg-info w-100 h-100 rounded-end text-dark'
    eventEditButton.setAttribute('type', 'button')
    eventEditButton.style.borderStyle = 'solid'
    eventEditButton.style.border = '0px'
    eventEditButton.innerHTML = 'Edit'
    eventEditButton.addEventListener('click', function () {
      const currentActionDict = JSON.parse(eventRow.getAttribute('data-action'))
      showEditExhibitActionModal(currentActionDict)
    })
    eventEditButtonCol.appendChild(eventEditButton)
  } else {
    eventDescriptionOuterContainer.classList.add('rounded-end')
  }

  return eventRow
}

function onManageExhibitModalThumbnailCheckboxChange () {
  // Get the value of the checkbox and show/hide the definition
  // tbumbnails as appropriate.

  const checked = document.getElementById('editExhibitThumbnailCheckbox').checked
  for (const el of document.querySelectorAll('.exhibit-thumbnail')) {
    if (checked) {
      el.style.display = 'block'
    } else {
      el.style.display = 'none'
    }
  }
}

function editExhibitAddComponentPopulateList () {
  // Called when a user clicks the 'Add component' button to populate
  // the list of available, un-added components.

  const componentList = document.getElementById('editExhibitAddComponentList')
  componentList.innerHTML = ''

  const existingComponents = []
  for (const component of Array.from(document.querySelectorAll('.manageExhibit-component-col'))) {
    existingComponents.push(component.getAttribute('data-component-uuid'))
  }

  for (const component of hubConfig.exhibitComponents) {
    // Filter out components that shouldn't be added (projectors, static, offline, existing)
    if (component.type !== 'exhibit_component') continue
    if ((component.status !== hubConfig.STATUS.ONLINE) && (component.status !== hubConfig.STATUS.ACTIVE) && (component.status !== hubConfig.STATUS.WAITING)) continue
    if (existingComponents.includes(component.uuid)) continue

    const li = document.createElement('li')
    const button = document.createElement('button')
    button.classList = 'dropdown-item text-wrap'
    button.innerHTML = component.id
    button.addEventListener('click', () => {
      editExhibitAddComponent(component)
    })
    li.appendChild(button)
    componentList.appendChild(li)
  }

  if (componentList.children.length === 0) {
    const li = document.createElement('li')
    const button = document.createElement('button')
    button.classList = 'dropdown-item fst-italic disabled text-wrap text-center'
    button.innerHTML = 'Nothing to add'
    li.appendChild(button)
    componentList.appendChild(li)
  }
}

function editExhibitAddComponent (component) {
  // Add a component with the given uuid to the exhibit.

  editExhibitCreateComponentHTML(component)
}

function editExhibitSubmitUpdate () {
  // Build an exhibit from the selected options and submit it to Hub for saving.

  const selects = Array.from(document.querySelectorAll('.manageExhibit-definition-select'))
  const exhibitNameField = document.getElementById('editExhibitName')
  const uuid = exhibitNameField.getAttribute('data-uuid')

  const definitions = []
  for (const select of selects) {
    const entry = {
      uuid: select.getAttribute('data-component-uuid'),
      id: select.getAttribute('data-component-id')
    }
    if ((select.value !== '') && (select.value != null)) {
      entry.definition = select.value
    } else entry.definition = select.getAttribute('data-initial-definition')
    definitions.push(entry)
  }

  const commands = []
  for (const el of Array.from(document.querySelectorAll('.actionListing'))) {
    const command = JSON.parse(el.getAttribute('data-action'))
    commands.push(command)
  }

  const exhibit = {
    components: definitions,
    name: exhibitNameField.value,
    uuid: exhibitNameField.getAttribute('data-uuid'),
    commands
  }
  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibition/' + uuid + '/edit',
    params: { details: exhibit }
  })
    .then((result) => {
      if (result.success === true) hideEditExhibitGUI()
    })
}

async function showEditExhibitActionModal (actionDict = null) {
  // Configure the modal for editing an action and show it.

  const actionSelector = document.getElementById('editExhibitActionSelector')
  actionSelector.value = null

  const targetSelector = document.getElementById('editExhibitActionTargetSelector')
  targetSelector.value = null
  targetSelector.style.display = 'none'
  document.getElementById('editExhibitActionTargetSelectorLabel').style.display = 'none'

  const valueSelector = document.getElementById('editExhibitActionValueSelector')
  valueSelector.value = null
  valueSelector.style.display = 'none'
  document.getElementById('editExhibitActionValueSelectorLabel').style.display = 'none'

  const modal = document.getElementById('editExhibitActionModal')
  modal.setAttribute('data-uuid', exUtilities.uuid())
  modal.setAttribute('data-isEdit', 'false')

  if (actionDict != null) {
    modal.setAttribute('data-uuid', actionDict.uuid)
    modal.setAttribute('data-isEdit', 'true')

    actionSelector.value = actionDict.action

    editExhibitActionConfigureTargetSelector(actionDict.action)
    setTimeout(() => {
      for (const target of actionDict.target) {
        const targetStr = JSON.stringify(target)
        for (const option of targetSelector.options) {
          if (option.value === targetStr) option.selected = true
        }
      }
    }, 0) // Make sure the DOM is updated

    await editExhibitActionConfigureValueSelector(actionDict.action, actionDict.target)
    valueSelector.value = actionDict.value
  }

  exUtilities.showModal('#editExhibitActionModal')
}

function editExhibitActionConfigureTargetSelector (action = null, target = null) {
  // Show/hide the select element for picking the target of an action when appropriate

  if (action == null) action = document.getElementById('editExhibitActionSelector').value

  const targetSelector = document.getElementById('editExhibitActionTargetSelector')
  const targetSelectorLabel = document.getElementById('editExhibitActionTargetSelectorLabel')
  targetSelector.innerHTML = ''

  if (['power_on', 'power_off'].includes(action)) {
    targetSelector.setAttribute('multiple', true)
    exSchedule.actionTargetSelectorPopulateOptions(targetSelector, ['All', 'Groups', 'ExhibitComponents', 'Projectors'])
  } else if (['restart'].includes(action)) {
    targetSelector.setAttribute('multiple', true)
    exSchedule.actionTargetSelectorPopulateOptions(targetSelector, ['All', 'Groups', 'ExhibitComponents'])
  } else if (['set_dmx_scene'].includes(action)) {
    targetSelector.removeAttribute('multiple')
    exSchedule.actionTargetSelectorPopulateOptions(targetSelector, ['ExhibitComponents'])
  }
  targetSelector.style.display = 'block'
  targetSelectorLabel.style.display = 'block'

  // For certain actions, we want to then populare the value selector
  if (['set_dmx_scene'].includes(action)) {
    editExhibitActionConfigureValueSelector(action, target)
  } else {
    document.getElementById('editExhibitActionValueSelector').style.display = 'none'
    document.getElementById('editExhibitActionValueSelectorLabel').style.display = 'none'
  }
}

async function editExhibitActionConfigureValueSelector (action = null, target = null) {
  // Show/hide the select element for picking the value of an action when appropriate

  if (action == null) action = document.getElementById('editExhibitActionSelector').value
  if (target == null) target = JSON.parse(document.getElementById('editExhibitActionTargetSelector').value)

  const valueSelector = document.getElementById('editExhibitActionValueSelector')
  const valueSelectorLabel = document.getElementById('editExhibitActionValueSelectorLabel')
  valueSelector.innerHTML = ''

  if (action === 'set_dmx_scene') {
    let component
    try {
      component = exExhibit.getExhibitComponent(target[0].uuid)
    } catch {
      return
    }
    if (component == null) {
      console.log('editExhibitActionConfigureValueSelector: component not available: ', target.uuid)
      return
    }
    if (component.helperAddress == null || component.helperAddress === '') {
      console.log('editExhibitActionConfigureValueSelector: invalid helper address')
      return
    }

    const response = await exUtilities.makeRequest({
      method: 'GET',
      url: component.helperAddress,
      endpoint: '/DMX/getScenes'
    })

    if (response?.success ?? false) {
      for (const group of response.groups) {
        const groupName = new Option(group.name)
        groupName.setAttribute('disabled', true)
        valueSelector.appendChild(groupName)

        for (const scene of group.scenes) {
          valueSelector.appendChild(new Option(scene.name, scene.uuid))
        }
      }
    }
    valueSelector.style.display = 'block'
    valueSelectorLabel.style.display = 'block'
  } else {
    valueSelector.style.display = 'none'
    valueSelectorLabel.style.display = 'none'
  }
}

function editExhibitActionDeleteAction (uuid) {
  // Remove the entry for the given action

  document.getElementById('actionListing_' + uuid).remove()
  exUtilities.hideModal('#editExhibitActionModal')
}

function showEditExhibitGUI () {
  document.getElementById('editExhibitPane').style.display = 'flex'
}

function editExhibitActionSubmit () {
  // Collect info from the edit exhibit action modal and create/update the action.

  const modal = document.getElementById('editExhibitActionModal')
  const isEdit = modal.getAttribute('data-isEdit') === 'true'
  const uuid = modal.getAttribute('data-uuid')

  let action, value
  const targets = []
  try {
    action = document.getElementById('editExhibitActionSelector').value
    value = document.getElementById('editExhibitActionValueSelector').value

    const targetSelector = document.getElementById('editExhibitActionTargetSelector')
    const targetStrings = Array.from(targetSelector.selectedOptions).map(option => option.value)
    for (const target of targetStrings) {
      targets.push(JSON.parse(target))
    }
  } catch {
    console.log('editExhibitActionSubmit: JSON parse error')
    return
  }

  if (action === '') return
  if (action === 'set_dmx_scene' && (value === '' || value == null)) return

  const actionsList = document.getElementById('editExhibitActionsList')
  const actionHTML = createExhibitActionEntryHTML({ action, target: targets, uuid, value })
  if (isEdit === false) {
    actionsList.appendChild(actionHTML)
  } else {
    document.getElementById('actionListing_' + uuid).replaceWith(actionHTML)
  }
  exUtilities.hideModal('#editExhibitActionModal')
}

function hideEditExhibitGUI () {
  document.getElementById('editExhibitPane').style.display = 'none'
}

function updateAvailableExhibits (exhibitList) {
  // Rebuild the list of available exhibits

  const exhibitSelect = document.getElementById('exhibitSelect')

  const sortedExhibitList = exhibitList.sort((a, b) => {
    const aVal = a.name.toLowerCase()
    const bVal = b.name.toLowerCase()
    if (aVal > bVal) return 1
    if (aVal < bVal) return -1
    return 0
  })

  const arr1UUIDs = []
  const arr2UUIDs = []
  for (const exhib of sortedExhibitList) arr1UUIDs.push(exhib.uuid)
  for (const exhib of hubConfig.availableExhibits) arr2UUIDs.push(exhib.uuid)

  if (exUtilities.arraysEqual(arr1UUIDs, arr2UUIDs) === true) {
    return
  }

  hubConfig.availableExhibits = sortedExhibitList
  exhibitSelect.innerHTML = ''

  for (const exhibit of sortedExhibitList) {
    exhibitSelect.appendChild(new Option(exhibit.name, exhibit.uuid))
  }

  exhibitSelect.value = hubConfig.currentExhibit
  updateExhibitButtons()
}

async function changeExhibit (warningShown) {
  // Send a command to Hub to change the current exhibit

  if (warningShown === false) {
    exUtilities.showModal('#changeExhibitModal')
  } else {
    exUtilities.hideModal('#changeExhibitModal')
    const uuid = document.getElementById('exhibitSelect').value

    const response = await exTools.makeServerRequest({
      method: 'POST',
      endpoint: '/exhibition/' + uuid + '/set'
    })
    if ((response?.success ?? false) === true) {
      updateExhibitButtons(uuid)
    }
  }
}

function parseUpdate (update) {
  // Take a dictionary of updates from Hub and act on them.

  if ('gallery' in update) {
    hubConfig.currentExhibit = update.gallery.current_exhibit
    updateAvailableExhibits(update.gallery.availableExhibits)
    document.getElementById('exhibitNameField').innerHTML = exTools.getExhibit(update.gallery.current_exhibit).name

    if ('galleryName' in update.gallery) {
      document.getElementById('galleryNameField').innerHTML = update.gallery.galleryName
      document.title = update.gallery.galleryName
    }

    if ('updateAvailable' in update.gallery) {
      if (update.gallery.updateAvailable === 'true') {
        const notification = {
          update_available: true,
          current_version: update.gallery.softwareVersion,
          available_version: update.gallery.softwareVersionAvailable
        }
        hubConfig.errorDict.__control_server = {
          software_update: notification
        }
        exTools.rebuildNotificationList()
      }
    }
    if (update.gallery?.outdated_os ?? false) {
      hubConfig.errorDict.__control_server = {
        outdated_os: true
      }
      exTools.rebuildNotificationList()
    }
    if (update.gallery?.exhibit_modified ?? false) {
      document.getElementById('exhibitModifiedButton').style.display = 'block'
    } else {
      document.getElementById('exhibitModifiedButton').style.display = 'none'
    }
  }

  if ('groups' in update) {
    // Check if the list of groups has changed.

    const updateDate = new Date(update.groups.last_update_date)
    const currentGroupsDate = new Date(hubConfig.groupLastUpdateDate)

    if (updateDate > currentGroupsDate) {
      hubConfig.groupLastUpdateDate = update.groups.last_update_date
      hubConfig.groups = update.groups.group_list
      exGroup.populateGroupsRow()
    }
  }

  if ('components' in update) {
    let numComps = 0
    let numOnline = 0
    let numStatic = 0

    exExhibit.checkForRemovedComponents(update.components)
    for (const component of update.components) {
      numComps += 1
      if ((component.status === hubConfig.STATUS.ONLINE.name) || (component.status === hubConfig.STATUS.STANDBY.name) || (component.status === hubConfig.STATUS['SYSTEM ON'].name) || (component.status === hubConfig.STATUS.STATIC.name)) {
        numOnline += 1
      }
      if (component.status === hubConfig.STATUS.STATIC.name) {
        numStatic += 1
      }
      exExhibit.updateComponentFromServer(component)
    }

    // Set the favicon to reflect the aggregate status
    if (numOnline === numComps) {
      $("link[rel='icon']").attr('href', '_static/icons/green.ico')
    } else if (numOnline === 0) {
      $("link[rel='icon']").attr('href', '_static/icons/red.ico')
    } else {
      $("link[rel='icon']").attr('href', '_static/icons/yellow.ico')
    }
    // If there are no static components, hide the "SHow STATIC" button
    if (numStatic === 0) {
      $('#componentsTabSettingsShowStatic').parent().parent().hide()
      document.getElementById('componentsTabSettingsShowStaticDivider').parentElement.style.display = 'none'
    } else {
      $('#componentsTabSettingsShowStatic').parent().parent().show()
      document.getElementById('componentsTabSettingsShowStaticDivider').parentElement.style.display = 'block'
    }
  }

  if ('issues' in update) {
    // Check for the time of the most recent update. If it is more
    // recent than our existing date, rebuild the issue list

    const currentLastDate = Math.max.apply(Math, hubConfig.issueList.map(function (o) { return new Date(o.lastUpdateDate) }))
    const updatedDate = new Date(update.issues.lastUpdateDate)

    if (updatedDate > currentLastDate) {
      hubConfig.issueList = update.issues.issueList
      // exIssues.rebuildIssueList()
      exIssues.upateIssueList()
      exIssues.rebuildIssueFilters()
    }
  }

  // Schedule should be after components
  if ('schedule' in update) {
    if (hubConfig.scheduleUpdateTime !== update.schedule.updateTime) {
      exSchedule.populateSchedule(update.schedule)
    }
  }
}

function populateHelpTab () {
  // Ask the server to send the latest README, convert the Markdown to
  // HTML, and add it to the Help tab.

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/getHelpText'
  })
    .then((result) => {
      if (result.success === true) {
        const markdownConverter = new showdown.Converter()
        markdownConverter.setFlavor('github')

        const formattedText = markdownConverter.makeHtml(result.text)
        $('#helpTextDiv').html(formattedText)
      } else {
        $('#helpTextDiv').html('Help text not available.')
      }
    })
}

function createExhibit (name, cloneFrom) {
  // Ask Hub to create a new exhibit with the given name.
  // set cloneFrom = null if we are making a new exhibit from scratch.
  // set cloneFrom to the name of an existing exhibit to copy that exhibit

  const requestDict = { name }

  if (cloneFrom != null && cloneFrom !== '') {
    requestDict.clone_from = cloneFrom
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibition/create',
    params: requestDict
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        editExhibitPopulateExhibitContent(result.uuid)
      }
    })
}

function deleteExhibit (uuid) {
  // Ask Hub to delete the exhibit with the given name.

  exTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/exhibition/' + uuid
  })
}

function updateExhibitButtons (uuid = '') {
  // Adjust the exhibit buttons based on the value currently selected.

  if (uuid === '') uuid = hubConfig.currentExhibit

  const exhibitSelect = document.getElementById('exhibitSelect')
  const deleteButton = document.getElementById('exhibitDeleteSelectorButton')
  const setExhibitButton = document.getElementById('setExhibitButton')

  if (exhibitSelect.value === uuid) {
    deleteButton.setAttribute('disabled', true)
    setExhibitButton.innerHTML = 'Reload'
  } else {
    deleteButton.removeAttribute('disabled')
    setExhibitButton.innerHTML = 'Set'
  }
}

function showExhibitDeleteModal () {
  exUtilities.showModal('#deleteExhibitModal')
}

function deleteExhibitFromModal () {
  // Take the info from the selector and delete the correct exhibit

  const UUIDToDelete = document.getElementById('exhibitSelect').value

  // Check if we're currently editing this exhibit and clear
  const exhibitNameField = document.getElementById('editExhibitName')
  const editedUUID = exhibitNameField.getAttribute('data-uuid')
  if (UUIDToDelete === editedUUID) hideEditExhibitGUI()

  deleteExhibit(UUIDToDelete)
  exUtilities.hideModal('#deleteExhibitModal')
}

function populateControlServerSettings () {
  // Get the latest system settings from Hub and build out the interface for changing them.

  // Hide warnings and buttons
  document.getElementById('controlServerSettingsIPWarning').style.display = 'none'
  document.getElementById('controlServerSettingsPortWarning').style.display = 'none'
  document.getElementById('controlServerSettingsSaveButton').style.display = 'none'

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/configuration/system'
  })
    .then((result) => {
      const config = result.configuration

      document.getElementById('controlServerSettingsIPAddress').value = config.ip_address
      document.getElementById('controlServerSettingsPort').value = config.port
      document.getElementById('controlServerSettingsGalleryName').value = config.gallery_name
      document.getElementById('controlServerSettingsDebugMode').value = config.debug
    })
}

function updateSystemConfiguration () {
  // Update the system configuration

  const update = {
    ip_address: document.getElementById('controlServerSettingsIPAddress').value.trim(),
    port: parseInt(document.getElementById('controlServerSettingsPort').value),
    gallery_name: document.getElementById('controlServerSettingsGalleryName').value.trim(),
    debug: exUtilities.stringToBool(document.getElementById('controlServerSettingsDebugMode').value)
  }

  // Check that fields are properly filled out
  if (update.ip_address === '') {
    document.getElementById('controlServerSettingsIPWarning').style.display = 'block'
    return
  } else {
    document.getElementById('controlServerSettingsIPWarning').style.display = 'none'
  }
  if (isNaN(update.port)) {
    document.getElementById('controlServerSettingsPortWarning').style.display = 'block'
    return
  } else {
    document.getElementById('controlServerSettingsPortWarning').style.display = 'none'
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/system/configuration/system/update',
    params: {
      configuration: update
    }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        document.getElementById('controlServerSettingsSaveButton').style.display = 'none'
      }
    })
}

function loadVersion () {
  // Load version and update the GUI with the current version

  exTools.makeServerRequest({
    api: '',
    method: 'GET',
    endpoint: '/_static/semantic_version.json'
  })
    .then((response) => {
      document.getElementById('versionSpan').textContent = exUtilities.formatSemanticVersion(response.version)
    })
}

// Bind event listeners

// Login
document.getElementById('formTest').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault() // Prevents form from reloading the page
    document.getElementById('loginSubmitButton').click() // Trigger form submission programmatically
  }
})
document.getElementById('formTest').addEventListener('submit', exUsers.loginFromDropdown)
document.getElementById('logoutButton').addEventListener('click', exUsers.logoutUser)
document.getElementById('viewUserPreferencesModalButton').addEventListener('click', exUsers.showUserPreferenceModal)
document.getElementById('userPreferencesModalSaveButton').addEventListener('click', exUsers.submitUserPreferencesFromModal)
document.getElementById('changePasswordButton').addEventListener('click', exUsers.showPasswordChangeModal)
document.getElementById('passwordChangeModalSubmitButton').addEventListener('click', exUsers.submitUserPasswordChange)

// Components tab
// =========================
document.getElementById('componentsTabSettingsSortSelect').addEventListener('change', () => {
  // Update user preference
  exUsers.updateUserPreferences({ sort_order: document.getElementById('componentsTabSettingsSortSelect').value })
    .then(() => {
      // Rebuild the interface with the new option
      exExhibit.rebuildComponentInterface()
    })
})
document.getElementById('componentsTabSettingsLayoutSelect').addEventListener('change', () => {
  // Update user preference
  exUsers.updateUserPreferences({ components_layout: document.getElementById('componentsTabSettingsLayoutSelect').value })
    .then(() => {
      // Rebuild the interface with the new option
      exExhibit.rebuildComponentInterface()
    })
})
document.getElementById('componentsTabSettingsSizeSelect').addEventListener('change', () => {
  // Update user preference
  exUsers.updateUserPreferences({ components_size: document.getElementById('componentsTabSettingsSizeSelect').value })
    .then(() => {
      // Rebuild the interface with the new option
      exExhibit.rebuildComponentInterface()
    })
})
document.getElementById('componentsTabSettingsShowStatic').addEventListener('change', () => {
  // Update user preference
  exUsers.updateUserPreferences({ show_static: document.getElementById('componentsTabSettingsShowStatic').checked })
    .then(() => {
      // Rebuild the interface with the new option
      exExhibit.rebuildComponentInterface()
    })
})

for (const el of document.querySelectorAll('.view-mode-radio')) {
  el.addEventListener('change', () => {
    let mode = 'maintenance'
    if (document.getElementById('componentStatusModeRealtimeCheckbox').checked) {
      mode = 'realtime'
    }
    exUsers.updateUserPreferences({ status_mode: mode })
      .then(exExhibit.rebuildComponentInterface)
  })
}

document.getElementById('showHideGroupsModalShowButton').addEventListener('click', exExhibit.configureVisibleGroups)
document.getElementById('showHideGroupsModalSaveButton').addEventListener('click', exExhibit.updateVisibleGroupsPreference)

document.getElementById('showAddStaticComponentModalButton').addEventListener('click', exExhibit.showAddStaticComponentsModal)
document.getElementById('addStaticComponentModalAddButton').addEventListener('click', exExhibit.submitStaticComponentAdditionFromModal)
document.getElementById('showAddProjetorModalButton').addEventListener('click', exProjector.showAddProjectorModal)
document.getElementById('addProjectorModalAddButton').addEventListener('click', exProjector.submitProjectorAdditionFromModal)
document.getElementById('showAddWakeOnLANModalButton').addEventListener('click', exExhibit.showAddWakeOnLANModal)
document.getElementById('addWakeOnLANModalAddButton').addEventListener('click', exExhibit.submitWakeOnLANAdditionFromModal)

// Component info modal
$('#componentInfoModalRemoveComponentButton').click(exExhibit.removeExhibitComponentFromModal)
$('#componentInfoModalMaintenanceSaveButton').click(function () {
  exMaintenance.submitComponentMaintenanceStatusChange('component')
})
$('#componentInfoModalMaintenanceStatusSelector').change(function () {
  $('#componentInfoModalMaintenanceSaveButton').show()
})
document.getElementById('componentInfoModalBasicSettingsSaveButton').addEventListener('click', exExhibit.submitComponentBasicSettingsChange)
for (const el of document.querySelectorAll('.componentInfoBasicSetting')) {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalBasicSettingsSaveButton').style.display = 'block'
  })
}
$('.componentInfoSetting').change(function () {
  $('#componentInfoModalSettingsSaveButton').show()
})
$('#componentInfoModalSettingsSaveButton').click(exExhibit.submitComponentSettingsChange)
document.getElementById('definitionTabAppFilterSelect').addEventListener('change', (event) => {
  exExhibit.filterDefinitionListByApp()
})
document.getElementById('definitionTabThumbnailsCheckbox').addEventListener('change', (event) => {
  exExhibit.onDefinitionTabThumbnailsCheckboxChange()
})
document.getElementById('componentInfoModalDefinitionSaveButton').addEventListener('click', exExhibit.submitDefinitionSelectionFromModal)

document.getElementById('componentInfoModalViewScreenshot').addEventListener('click', () => {
  const component = exExhibit.getExhibitComponent(document.getElementById('componentInfoModal').dataset.uuid)
  exTools.openMediaInNewTab([component.getHelperURL() + '/system/getScreenshot'], ['image'])
})
document.getElementById('componentInfoModalEditDMXButton').addEventListener('click', (event) => {
  const component = exExhibit.getExhibitComponent(document.getElementById('componentInfoModal').dataset.uuid)
  window.open(component.getHelperURL() + '/dmx_control.html?standalone=true', '_blank').focus()
})
for (const el of document.querySelectorAll('.componentInfoProjectorSetting')) {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalProjectorSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('componentInfoModalProjectorSettingsSaveButton').addEventListener('click', exExhibit.updateProjectorFromInfoModal)
for (const el of document.querySelectorAll('.componentInfoStaticSetting')) {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalStaticSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('componentInfoModalStaticSettingsSaveButton').addEventListener('click', exExhibit.updateStaticComponentFromInfoModal)
for (const el of document.querySelectorAll('.componentInfoWakeOnLANSetting')) {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').addEventListener('click', exExhibit.updateWakeOnLANComponentFromInfoModal)

// Copy definition modal
document.getElementById('copyDefinitionModalSubmitButton').addEventListener('click', exExhibit.copyDefinitionModalPerformCopy)

// Schedule tab
// =========================
document.getElementById('manageFutureDateButton').addEventListener('click', exSchedule.showManageFutureDateModal)
document.getElementById('manageFutureDateCalendarInput').addEventListener('change', exSchedule.populateFutureDateCalendarInput)
document.getElementById('manageFutureDateAddActionButton').addEventListener('click', (event) => {
  const scheduleName = document.getElementById('manageFutureDateCalendarInput').value
  exSchedule.scheduleConfigureEditModal(scheduleName, 'date-specific')
})
document.getElementById('manageFutureDateCreateScheduleButton').addEventListener('click', exSchedule.convertFutureScheduleFromModal)
document.getElementById('manageFutureDateDeleteScheduleButton').addEventListener('click', (event) => {
  event.target.focus()
})
// Create schedule from file modal
document.getElementById('showScheduleFromFileModalButton').addEventListener('click', exSchedule.showScheduleFromFileModal)
document.getElementById('scheduleFromFileModalFileInput').addEventListener('change', exSchedule.onScheduleFromFileModalFileInputChange)
document.getElementById('scheduleFromFileModalUploadButton').addEventListener('click', exSchedule.previewScheduleFromFile)
document.getElementById('scheduleFromFileKindSelect').addEventListener('change', exSchedule.onCreateScheduleFromFileTypeSelect)
document.getElementById('scheduleFromFileDateSelect').addEventListener('change', exSchedule.onscheduleFromFileDateSelectChange)
document.getElementById('scheduleFromFileModalSubmitButton').addEventListener('click', exSchedule.createScheduleFromFile)

$('#scheduleEditDeleteActionButton').click(exSchedule.scheduleDeleteActionFromModal)
$('#scheduleEditSubmitButton').click(exSchedule.sendScheduleUpdateFromModal)
$('#scheduleActionSelector').change(() => {
  exSchedule.setScheduleActionTargetSelector()
}
)
$('#scheduleTargetSelector').change(() => {
  exSchedule.setScheduleActionValueSelector()
})
// This event detects when the delete button has been clicked inside a popover to delete a date-specific schedule.
document.addEventListener('click', (event) => {
  if (event.target.classList.contains('schedule-delete') === false) return
  if ($('#manageFutureDateModal').hasClass('show')) {
    // This popover is from the future dates edit modal
    exSchedule.deleteSchedule(document.getElementById('manageFutureDateCalendarInput').value)
  } else {
    // This popover is from the main schedule page
    exSchedule.deleteSchedule(event.target.getAttribute('id').slice(7))
  }
})

// Exhibits tab
// =========================
// document.getElementById('manageExhibitsModalSaveButton').addEventListener('click', manageExhibitModalSubmitUpdate)
document.getElementById('exhibitModifiedButton').addEventListener('click', exExhibit.showExhibitionModificationsModal)
document.getElementById('exhibitSelect').addEventListener('change', () => {
  updateExhibitButtons()
})
document.getElementById('setExhibitButton').addEventListener('click', () => {
  changeExhibit(false)
})
document.getElementById('editExhibitButton').addEventListener('click', () => {
  editExhibitPopulateExhibitContent(document.getElementById('exhibitSelect').value)
})
document.getElementById('editExhibitAddComponentButton').addEventListener('click', editExhibitAddComponentPopulateList)
document.getElementById('createExhibitButton').addEventListener('click', () => {
  createExhibit('New exhibit', null)
})
document.getElementById('cloneExhibitButton').addEventListener('click', () => {
  createExhibit('New exhibit', document.getElementById('exhibitSelect').value)
})
document.getElementById('exhibitChangeConfirmationButton').addEventListener('click', () => {
  changeExhibit(true)
})
document.getElementById('deleteExhibitButton').addEventListener('click', deleteExhibitFromModal)
document.getElementById('exhibitDeleteSelectorButton').addEventListener('click', showExhibitDeleteModal)
document.getElementById('editExhibitThumbnailCheckbox').addEventListener('change', onManageExhibitModalThumbnailCheckboxChange)
document.getElementById('editExhibitSaveButton').addEventListener('click', editExhibitSubmitUpdate)
document.getElementById('editExhibitShowActionModalButton').addEventListener('click', () => {
  showEditExhibitActionModal()
})
document.getElementById('editExhibitActionSelector').addEventListener('change', () => { editExhibitActionConfigureTargetSelector() })
document.getElementById('editExhibitActionTargetSelector').addEventListener('change', () => { editExhibitActionConfigureValueSelector() })
document.getElementById('editExhibitActionEditDeleteActionButton').addEventListener('click', () => {
  const uuid = document.getElementById('editExhibitActionModal').getAttribute('data-uuid')
  editExhibitActionDeleteAction(uuid)
})
document.getElementById('editExhibitActionEditSubmitButton').addEventListener('click', editExhibitActionSubmit)

// Maintenance tab
// =========================
// This event detects when the delete button has been clicked inside a popover
document.addEventListener('click', (event) => {
  const id = event.target.getAttribute('id')
  if (id === 'issueMediaDeleteButtonConfirmation') {
    const file = document.getElementById('issueMediaViewFromModalSelect').value
    exIssues.issueMediaDelete([file])
  } else if (id === 'editUserDeleteButtonConfirmation') {
    const user = document.getElementById('editUserModal').getAttribute('data-uuid')
    exUsers.deleteUser(user)
  }
})
document.getElementById('issueModifyModalDeleteButton').addEventListener('click', () => {
  const id = document.getElementById('issueModifyModal').getAttribute('data-id')
  exIssues.modifyIssue(id, 'delete')
  exUtilities.hideModal('#issueModifyModal')
})
document.getElementById('issueModifyModalArchiveButton').addEventListener('click', () => {
  const id = document.getElementById('issueModifyModal').getAttribute('data-id')
  exIssues.modifyIssue(id, 'archive')
  exUtilities.hideModal('#issueModifyModal')
})
$('#issueMediaViewFromModal').click(function () {
  const file = document.getElementById('issueMediaViewFromModalSelect').value
  exTools.openMediaInNewTab(['issues/media/' + file])
})
$('#issueMediaUploadSubmitButton').click(exIssues.uploadIssueMediaFile)
$('#issueMediaUpload').change(exIssues.onIssueMediaUploadChange)
$('#issueEditSubmitButton').click(exIssues.submitIssueFromModal)
$('#createIssueButton').click(function () {
  exIssues.showIssueEditModal('new')
})
document.getElementById('viewIssueArchiveButton').addEventListener('click', () => {
  exIssues.showArchivedIssuesModal()
})
$('#issueListFilterPrioritySelect').change(function () {
  exIssues.rebuildIssueList()
})
$('#issueListFilterAssignedToSelect').change(function () {
  exIssues.rebuildIssueList()
})
$('#componentInfoModalMaintenanceNote').on('input', function () {
  $('#componentInfoModalMaintenanceSaveButton').show()
})

// Analytics tab
// =========================
document.getElementById('createTrackerTemplateButton').addEventListener('click', () => {
  exTracker.createTrackerTemplate()
})
document.getElementById('launchTrackerButton').addEventListener('click', exTracker.launchTracker)
document.getElementById('showEditTrackerTemplateButton').addEventListener('click', () => {
  exTracker.showEditTrackerTemplateModal()
})
document.getElementById('deleteTrackerTemplateButton').addEventListener('click', () => {
  const trackerTemplateSelect = document.getElementById('trackerTemplateSelect')
  const name = trackerTemplateSelect.options[trackerTemplateSelect.selectedIndex].text
  document.getElementById('deleteTrackerTemplateModalTemplateName').innerHTML = name
  exUtilities.showModal('#deleteTrackerTemplateModal')
})
document.getElementById('deleteTrackerTemplateFromModalButton')
  .addEventListener('click', () => exTracker.deleteTrackerTemplate())
document.getElementById('getAvailableTrackerDataButton')
  .addEventListener('click', () => exTracker.getAvailableTrackerData(exTracker.populateTrackerDataSelect))
document.getElementById('downloadTrackerDataButton')
  .addEventListener('click', () => exTracker.downloadTrackerData(document.getElementById('trackerDataSelect').value))
document.getElementById('showDeleteTrackerDataModalButton')
  .addEventListener('click', () => exTracker.showDeleteTrackerDataModal())
document.getElementById('deleteTrackerDataFromModalButton')
  .addEventListener('click', () => exTracker.deleteTrackerDataFromModal())
document.getElementById('editTrackerTemplateModalAddCounterButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Counter', 'counter'))
document.getElementById('editTrackerTemplateModalAddDropdownButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Dropdown', 'dropdown'))
document.getElementById('editTrackerTemplateModalAddNumberButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Number', 'number'))
document.getElementById('editTrackerTemplateModalAddSliderButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Slider', 'slider'))
document.getElementById('editTrackerTemplateModalAddTextButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Text', 'text'))
document.getElementById('editTrackerTemplateModalAddTimerButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Timer', 'timer'))
document.getElementById('editTrackerTemplateModalSubmitChangesButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalSubmitChanges())
document.getElementById('editTrackerTemplateGuestFacingCheckbox').addEventListener('change', exTracker.makeGuestFacing)

// Users tab
// =========================
document.getElementById('showEditUserModalButton').addEventListener('click', () => {
  exUsers.showEditUserModal()
})
for (const el of document.querySelectorAll('.editUserField')) {
  el.addEventListener('change', () => {
    document.getElementById('editUserSubmitButton').style.display = 'block'
  })
}
document.getElementById('editUserPermissionGroups').addEventListener('change', (event) => {
  if (event.target.value === 'custom') {
    document.getElementById('editUserGroupsRow').style.display = 'flex'
  } else {
    document.getElementById('editUserGroupsRow').style.display = 'none'
  }
})
document.getElementById('editUserSubmitButton').addEventListener('click', exUsers.submitChangeFromEditUserModal)

// Settings tab
// =========================

// Groups
document.getElementById('settingsAddGroupButton').addEventListener('click', () => {
  exGroup.showEditGroupModal()
})
document.getElementById('editGroupModalSubmitButton').addEventListener('click', exGroup.submitChangeFromGroupEditModal)
document.getElementById('deleteGroupConfirmationButton').addEventListener('click', exGroup.deleteGroupFromModal)

// Server settings
for (const el of document.querySelectorAll('.controlServerSettingsInputField')) {
  el.addEventListener('change', () => {
    document.getElementById('controlServerSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('controlServerSettingsSaveButton').addEventListener('click', updateSystemConfiguration)

// Activate all popovers
$(function () {
  $('[data-bs-toggle="popover"]').popover()
})

// Enable all tooltips
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

hubConfig.serverAddress = location.origin

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Fix bootstrap modal accessibility issue
document.addEventListener('hidden.bs.modal', function (event) {
  if (document.activeElement) document.activeElement.blur()
})

loadVersion()
populateHelpTab()
exUsers.populateUsers()
populateControlServerSettings()
const trackerTemplates = await exTracker.getAvailableTemplates()
exTracker.populateTrackerTemplateSelect(trackerTemplates)

exUsers.authenticateUser()
  .then(() => {
    // Subscribe to updates from Hub once we're logged in (or not)
    const eventSource = new EventSource(hubConfig.serverAddress + exConfig.api + '/system/updateStream')
    eventSource.addEventListener('update', function (event) {
      const update = JSON.parse(event.data)
      parseUpdate(update)
    })
    eventSource.addEventListener('end', function (event) {
      console.log('Handling end....')
      eventSource.close()
    })
  })
