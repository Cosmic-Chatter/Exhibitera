import * as exUtilities from '../../../common/utilities.js'

import hubConfig from '../../config.js'
import * as hubComponents from './components.js'
import * as hubGroups from './groups.js'
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
