import * as exUtilities from '../../../common/utilities.js'

import hubConfig from '../../config.js'
import * as hubComponents from './components.js'
import * as hubGroups from './groups.js'
import * as hubSchedule from './schedules.js'
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
    checkLabel.textContent = group.name
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

export function createExhibit (name, cloneFrom) {
  // Ask Hub to create a new exhibit with the given name.
  // set cloneFrom = null if we are making a new exhibit from scratch.
  // set cloneFrom to the name of an existing exhibit to copy that exhibit

  const requestDict = { name }

  if (cloneFrom != null && cloneFrom !== '') {
    requestDict.clone_from = cloneFrom
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibition/create',
    params: requestDict
  })
    .then((result) => {
      if (result?.success) {
        editExhibitPopulateExhibitContent(result.uuid)
      }
    })
}

function deleteExhibit (uuid) {
  // Ask Hub to delete the exhibit with the given name.

  hubTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/exhibition/' + uuid
  })
}

export function updateExhibitButtons (uuid = '') {
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

export function showExhibitDeleteModal () {
  exUtilities.showModal('#deleteExhibitModal')
}

export function deleteExhibitFromModal () {
  // Take the info from the selector and delete the correct exhibit

  const UUIDToDelete = document.getElementById('exhibitSelect').value

  // Check if we're currently editing this exhibit and clear
  const exhibitNameField = document.getElementById('editExhibitName')
  const editedUUID = exhibitNameField.dataset.uuid
  if (UUIDToDelete === editedUUID) hideEditExhibitGUI()

  deleteExhibit(UUIDToDelete)
  exUtilities.hideModal('#deleteExhibitModal')
}

async function editExhibitCreateComponentHTML (component) {
  // Create the HTML representation of a component exhibit entry.

  const contentList = document.getElementById('editExhibitExhibitContentList')
  const componentObj = hubTools.getExhibitComponent(component.uuid)

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
  nameDiv.innerHTML = componentObj.id
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
    definitionPreviewVideo.src = componentObj.getHelperURL() + hubConfig.api + '/definitions/' + value + '/thumbnail'
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
    await componentObj.makeRequest({
      method: 'GET',
      endpoint: '/system/checkConnection'
    })
  } catch {
    badComponent()
    return
  }

  const response = await componentObj.makeRequest({
    method: 'GET',
    endpoint: '/definitions'
  })

  // Build an option for each definition
  const appDict = hubTools.sortDefinitionsByApp(response.definitions)
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

    definitionPreviewImage.src = componentObj.getHelperURL() + hubConfig.api + '/definitions/' + definitionSelect.value + '/thumbnail'
    definitionPreviewVideo.style.display = 'none'
    definitionPreviewImage.style.display = 'block'
  }

  definitionSelect.addEventListener('change', changeThumb)
  definitionSelect.value = component.definition
  changeThumb()
}

export async function editExhibitPopulateExhibitContent (exhibit) {
  // Create a GUI representation of the given exhibit that shows the defintion for each component.

  const contentList = document.getElementById('editExhibitExhibitContentList')
  const exhibitNameField = document.getElementById('editExhibitName')

  contentList.innerHTML = ''
  exhibitNameField.dataset.uuid = exhibit

  const result = await hubTools.makeServerRequest({
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

  document.getElementById('editExhibitPane').style.display = 'flex'
}

function createExhibitActionEntryHTML (item, allowEdit = hubTools.checkPermission('exhibits', 'edit')) {
  // Take a dictionary of properties and build an HTML representation of the schedule entry.

  const description = hubSchedule.populateScheduleDescriptionHelper([item], false)

  if (description == null) return

  const eventRow = document.createElement('div')
  eventRow.classList = 'row mt-2 actionListing'
  eventRow.setAttribute('id', 'actionListing_' + item.uuid)
  eventRow.dataset.action = JSON.stringify(item)
  eventRow.dataset.uuid = item.uuid

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
      const currentActionDict = JSON.parse(eventRow.dataset.action)
      showEditExhibitActionModal(currentActionDict)
    })
    eventEditButtonCol.appendChild(eventEditButton)
  } else {
    eventDescriptionOuterContainer.classList.add('rounded-end')
  }

  return eventRow
}

export function onManageExhibitModalThumbnailCheckboxChange () {
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

export function editExhibitAddComponentPopulateList () {
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

export function editExhibitSubmitUpdate () {
  // Build an exhibit from the selected options and submit it to Hub for saving.

  const selects = Array.from(document.querySelectorAll('.manageExhibit-definition-select'))
  const exhibitNameField = document.getElementById('editExhibitName')
  const uuid = exhibitNameField.dataset.uuid

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
    const command = JSON.parse(el.dataset.action)
    commands.push(command)
  }

  const exhibit = {
    components: definitions,
    name: exhibitNameField.value,
    uuid: exhibitNameField.dataset.uuid,
    commands
  }
  hubTools.makeServerRequest({
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
  const modalTitle = document.getElementById('editExhibitActionModalTitle')
  modalTitle.innerText = 'Add action'

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
  modal.dataset.uuid = exUtilities.uuid()
  modal.dataset.isEdit = 'false'

  if (actionDict != null) {
    modal.dataset.uuid = actionDict.uuid
    modal.dataset.isEdit = 'true'
    modalTitle.innerText = 'Edit action'

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
    hubSchedule.actionTargetSelectorPopulateOptions(targetSelector, ['All', 'Groups', 'ExhibitComponents', 'Projectors'])
  } else if (['restart'].includes(action)) {
    targetSelector.setAttribute('multiple', true)
    hubSchedule.actionTargetSelectorPopulateOptions(targetSelector, ['All', 'Groups', 'ExhibitComponents'])
  } else if (['set_dmx_scene'].includes(action)) {
    targetSelector.removeAttribute('multiple')
    hubSchedule.actionTargetSelectorPopulateOptions(targetSelector, ['ExhibitComponents'])
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
  if (Array.isArray(target)) target = target[0]

  const valueSelector = document.getElementById('editExhibitActionValueSelector')
  const valueSelectorLabel = document.getElementById('editExhibitActionValueSelectorLabel')
  valueSelector.innerHTML = ''

  if (action === 'set_dmx_scene') {
    let component
    try {
      component = hubTools.getExhibitComponent(target.uuid)
    } catch {
      return
    }
    if (component == null) {
      console.log('editExhibitActionConfigureValueSelector: component not available: ', target.uuid)
      return
    }

    let response
    try {
      response = await component.makeRequest({
        method: 'GET',
        endpoint: '/DMX/scenes'
      })
    } catch {
      console.log('editExhibitActionConfigureValueSelector: invalid helper address')
    //   return
    }

    if (response?.success === true) {
      for (const scene of response.scenes) {
        valueSelector.appendChild(new Option(scene.name, scene.uuid))
      }
    }
    valueSelector.style.display = 'block'
    valueSelectorLabel.style.display = 'block'
  } else {
    valueSelector.style.display = 'none'
    valueSelectorLabel.style.display = 'none'
  }
}

export function editExhibitActionDeleteAction (uuid) {
  // Remove the entry for the given action

  document.getElementById('actionListing_' + uuid).remove()
  exUtilities.hideModal('#editExhibitActionModal')
}

export function editExhibitActionSubmit () {
  // Collect info from the edit exhibit action modal and create/update the action.

  const modal = document.getElementById('editExhibitActionModal')
  const isEdit = modal.dataset.isEdit === 'true'
  const uuid = modal.dataset.uuid

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

export function updateAvailableExhibits (exhibitList) {
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

export async function changeExhibit (warningShown) {
  // Send a command to Hub to change the current exhibit

  if (warningShown === false) {
    exUtilities.showModal('#changeExhibitModal')
  } else {
    exUtilities.hideModal('#changeExhibitModal')
    const uuid = document.getElementById('exhibitSelect').value

    const response = await hubTools.makeServerRequest({
      method: 'POST',
      endpoint: '/exhibition/' + uuid + '/set'
    })
    if ((response?.success ?? false) === true) {
      updateExhibitButtons(uuid)
    }
  }
}
