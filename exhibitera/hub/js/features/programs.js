import exConfig from '../../../common/config.js'
import * as exUtilities from '../../../common/utilities.js'

import hubConfig from '../../config.js'
import * as hubTools from '../tools.js'

import { ActionConfigurator } from './action_config.js'
import { ModalController } from './modal_controller.js'

// Modal for creating or editing an action entry
const programActionEditModal = new ModalController({
  id: 'programActionEditModal',
  defaultFields: [
    { id: 'programActionTimeInput', value: 0 },
    { id: 'programActionSelector', value: null },
    { id: 'programActionTargetSelector', value: null },
    { id: 'programActionValueSelector', value: null },
    { id: 'programActionNoteInput', value: '' }
  ],
  warningIDs: ['programActionEditErrorAlert']
})

const programActionConfigurator = new ActionConfigurator({
  actionSelectorId: 'programActionSelector',
  targetSelectorId: 'programActionTargetSelector',
  targetSelectorLabelId: 'programActionTargetSelectorLabel',
  valueSelectorId: 'programActionValueSelector',
  valueSelectorLabelId: 'programActionValueSelectorLabel',
  modalId: 'programActionEditModal',
  errorAlertId: 'programActionEditErrorAlert',
  onError: () => programActionEditModal.showWarning('programActionEditErrorAlert'),
  onErrorClear: () => programActionEditModal.hideWarning('programActionEditErrorAlert'),
  extraElements: {
    note: ['programActionNoteInput']
  }
})

export async function populatePrograms (programs = null) {
  // Retrieve a list of available programs and populate the select

  const programSelect = document.getElementById('programSelect')

  if (!programs) {
    const programsResponse = await hubTools.makeServerRequest({
      method: 'GET',
      endpoint: '/program/'
    })
    if (!programsResponse.success) return
    programs = programsResponse.program_list
  }

  programSelect.textContent = ''

  for (const program of programs) {
    const option = new Option(program.name, program.uuid)
    programSelect.appendChild(option)
  }
}

export async function createProgram (details = {}) {
  // Create a new program with the given details

  const result = await hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/program/create',
    params: { details }
  })

  console.log(result)
}

export async function editProgram (uuid = null) {
  // Show the edit interface for the given program

  if (!uuid) {
    uuid = document.getElementById('programSelect').value
  }

  if (uuid === '' || uuid == null) return

  const programRequest = await hubTools.makeServerRequest({
    method: 'GET',
    endpoint: '/program/' + uuid
  })

  if (!programRequest.success) return

  // Tag the save button with the UUID for when we are ready to save
  document.getElementById('saveProgramButton').dataset.uuid = uuid

  const program = programRequest.program

  populateLocations()

  const thumbnailPreview = document.getElementById('programMediaPreview_thumbnail')
  const trailerPreview = document.getElementById('programMediaPreview_trailer')

  document.getElementById('editProgramNameField').value = program?.name ?? ''
  document.getElementById('editProgramDescriptionField').value = program?.description ?? ''
  document.getElementById('editProgramLocationField').value = program?.location ?? ''
  document.getElementById('editProgramDurationField').value = program?.duration ?? 60
  document.getElementById('editProgramCapacityField').value = program?.capacity ?? ''
  thumbnailPreview.dataset.filename = program?.thumbnail ?? ''
  trailerPreview.dataset.filename = program?.trailer ?? ''

  if (program.thumbnail) {
    thumbnailPreview.src = `/programs/media/${program.thumbnail}?t=${Date.now()}`
    thumbnailPreview.style.display = 'block'
  } else {
    thumbnailPreview.style.display = 'none'
  }
  if (program.trailer) {
    trailerPreview.src = `/programs/media/${program.trailer}?t=${Date.now()}`
    trailerPreview.style.display = 'block'
  } else {
    trailerPreview.style.display = 'none'
  }

  console.log(program)
  if (program.actions) {
    populateActions(program.actions)
  }

  document.getElementById('editProgramPane').style.display = 'flex'
}

export async function updateProgram () {
  // Take the details in the edit program fields and push an update to Hub

  const uuid = document.getElementById('saveProgramButton').dataset.uuid
  if (uuid === '' || uuid == null) return

  const capacityStr = document.getElementById('editProgramCapacityField').value
  const capacity = capacityStr === '' ? null : parseInt(capacityStr)

  const update = {
    uuid,
    name: document.getElementById('editProgramNameField').value,
    description: document.getElementById('editProgramDescriptionField').value,
    location: document.getElementById('editProgramLocationField').value,
    duration: parseFloat(document.getElementById('editProgramDurationField').value),
    capacity,
    thumbnail: document.getElementById('programMediaPreview_thumbnail').dataset.filename,
    trailer: document.getElementById('programMediaPreview_trailer').dataset.filename
  }

  const result = await hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/program/' + uuid + '/update',
    params: { update }
  })

  if (result.success) {
    document.getElementById('editProgramPane').style.display = 'none'
    document.getElementById('saveProgramButton').dataset.uuid = ''

    // Clear the video
    const trailerPreview = document.getElementById('programMediaPreview_trailer')
    try {
      trailerPreview.pause()
      trailerPreview.removeAttribute('src')
      trailerPreview.load()
    } catch {}
  }
}

function populateLocations () {
  // Use the list of groups to populate possible program locations.

  const locationSelect = document.getElementById('editProgramLocationField')

  locationSelect.appendChild(new Option('No location', ''))
  for (const group of hubConfig.groups) {
    const option = new Option(group.name, group.uuid)
    locationSelect.appendChild(option)
  }
}

export function uploadProgramMediaFile (button, purpose) {
  // Send an program media file to Hub for storage

  if (!purpose) {
    console.log('uploadProgramMediaFile: missing field: purpose')
    return
  }

  if (button.files[0] == null) {
    console.log('uploadProgramMediaFile: no file to upload')
    return
  }

  const formData = new FormData()

  formData.append('file', button.files[0])
  formData.append('purpose', purpose)
  formData.append('program_uuid', document.getElementById('saveProgramButton').dataset.uuid)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', hubConfig.serverAddress + exConfig.api + '/program/uploadMedia', true)
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return
    if (this.status === 200) {
      const response = JSON.parse(this.responseText)

      if (response.success) {
        const preview = document.getElementById('programMediaPreview_' + purpose)
        preview.src = `/programs/media/${response.filename}?t=${Date.now()}`
        preview.style.display = 'block'
        preview.dataset.filename = response.filename
      }

      const progressBarContainer = document.getElementById('programUploadProgressBarContainer_' + purpose)

      progressBarContainer.style.display = 'none'
    }
  }

  xhr.upload.addEventListener('progress', function (evt) {
    if (evt.lengthComputable) {
      let percentComplete = evt.loaded / evt.total
      percentComplete = parseInt(percentComplete * 100)
      const progressBar = document.getElementById('programUploadProgressBar_' + purpose)
      const progressBarContainer = document.getElementById('programUploadProgressBarContainer_' + purpose)

      progressBar.style.width = `${percentComplete}%`
      if (percentComplete > 0) {
        progressBarContainer.style.display = 'block'
      } else if (percentComplete === 100) {
        progressBarContainer.style.display = 'none'
      }
    }
  }, false)

  xhr.send(formData)
}

export async function showprogramActionEditModal (actionDict = null) {
  // Configure the modal for editing a program action and show it.

  programActionEditModal.reset()
  programActionEditModal.setTitle('Add action')

  const timeInput = document.getElementById('programActionTimeInput')
  const actionSelector = document.getElementById('programActionSelector')
  const targetSelector = document.getElementById('programActionTargetSelector')
  targetSelector.style.display = 'none'
  document.getElementById('programActionTargetSelectorLabel').style.display = 'none'

  const valueSelector = document.getElementById('programActionValueSelector')
  valueSelector.style.display = 'none'
  document.getElementById('programActionValueSelectorLabel').style.display = 'none'

  const noteInput = document.getElementById('programActionNoteInput')
  noteInput.style.display = 'none'

  programActionEditModal.setData('uuid', exUtilities.uuid())
  programActionEditModal.setData('isEdit', 'false')

  if (actionDict != null) {
    programActionEditModal.setData('uuid', actionDict.uuid)
    programActionEditModal.setData('isEdit', 'true')
    programActionEditModal.setTitle('Edit action')

    timeInput.value = actionDict.time_offset

    actionSelector.value = actionDict.action

    if (actionDict.action === 'note') {
      document.getElementById('programActionNoteInput').value = actionDict.value
      noteInput.style.display = 'block'
    } else {
      programActionConfigurator.configureTargetSelector(actionDict.action, actionDict.target, {
        set_exhibit: ({ targetSelector, targetSelectorLabel }) => {
          targetSelector.multiple = false
          targetSelector.innerText = ''
          const availableExhibits = Array.from(document.querySelectorAll('#exhibitSelect option'))
          for (const item of availableExhibits) {
            targetSelector.appendChild(new Option(hubTools.getExhibitName(item.value), JSON.stringify({
              type: 'value',
              value: item.value
            })))
          }
          targetSelector.style.display = 'block'
          targetSelectorLabel.style.display = 'block'
        }
      })
      setTimeout(() => {
        for (const target of actionDict.target) {
          const targetStr = JSON.stringify(target)
          for (const option of targetSelector.options) {
            if (option.value === targetStr) option.selected = true
          }
        }
      }, 0) // Make sure the DOM is updated
    }

    await programActionConfigurator.configureValueSelector(actionDict.action, actionDict.target)
    valueSelector.value = actionDict.value
  }

  programActionEditModal.show()
}

export function setActionTargetSelector (action = null, target = null) {
  // Helper function to show/hide the select element for picking the target
  // of an action when appropriate

  programActionConfigurator.configureTargetSelector(action, target, {
    set_exhibit: ({ targetSelector, targetSelectorLabel }) => {
      targetSelector.multiple = false
      targetSelector.innerText = ''
      const availableExhibits = Array.from(document.querySelectorAll('#exhibitSelect option'))
      for (const item of availableExhibits) {
        targetSelector.appendChild(new Option(hubTools.getExhibitName(item.value), JSON.stringify({
          type: 'value',
          value: item.value
        })))
      }
      targetSelector.style.display = 'block'
      targetSelectorLabel.style.display = 'block'
    }
  })
}

export async function setActionValueSelector (action = null, target = null) {
  // Helper function to show/hide the select element for picking the value
  // of an action when appropriate

  await programActionConfigurator.configureValueSelector(action, target)
}

export function deleteActionFromModal () {
  // Gather necessary info from the action editing modal and send a
  // message to Hub asking to delete the given action

  const programUUID = document.getElementById('saveProgramButton').dataset.uuid
  const actionUUID = programActionEditModal.getData('uuid')

  if (programUUID == null || programUUID === '') return
  if (actionUUID == null || actionUUID === '') return

  hubTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/program/' + programUUID + '/action/' + actionUUID
  })
    .then((update) => {
      if (update.success) {
        populateActions(update.program.actions)
        programActionEditModal.hide()
      }
    })
}

export function updateActionFromModal () {
  // Use the programActionEditModal to send an action update to Hub.

  const programUUID = document.getElementById('saveProgramButton').dataset.uuid
  const actionUUID = programActionEditModal.getData('uuid')

  const time = parseFloat(document.getElementById('programActionTimeInput').value.trim())
  const action = document.getElementById('programActionSelector').value

  const targetSelector = document.getElementById('programActionTargetSelector')
  let target = Array.from(targetSelector.selectedOptions).map(option => option.value)
  target = target.map(item => JSON.parse(item))

  let value

  if (action === 'note') {
    value = document.getElementById('programActionNoteInput').value
    target = null
  } else {
    value = document.getElementById('programActionValueSelector').value
  }

  const editErrorAlert = document.getElementById('programActionEditErrorAlert')
  if (isNaN(time)) {
    editErrorAlert.innerText = 'You must specifiy a time offset for the action'
    programActionEditModal.showWarning('programActionEditErrorAlert')
    return
  } else if (action === '' || action == null) {
    editErrorAlert.innerText = 'You must specifiy an action'
    programActionEditModal.showWarning('programActionEditErrorAlert')
    return
  } else if (action === 'set_exhibit' && target == null) {
    editErrorAlert.innerText = 'You must specifiy an exhibition to set'
    programActionEditModal.showWarning('programActionEditErrorAlert')
    return
  } else if (['power_on', 'power_off'].includes(action) && target.length === 0) {
    editErrorAlert.innerText = 'You must specifiy a target for this action'
    programActionEditModal.showWarning('programActionEditErrorAlert')
    return
  } else if (['set_definition', 'set_dmx_scene'].includes(action) && value == null) {
    editErrorAlert.innerText = 'You must specifiy a value for this action'
    programActionEditModal.showWarning('programActionEditErrorAlert')
    return
  }

  const requestDict = {
    uuid: actionUUID,
    time_offset: time,
    action,
    target,
    value
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/program/' + programUUID + '/action',
    params: { action: requestDict }
  })
    .then((result) => {
      if (result.success) {
        populateActions(result.program.actions)
        programActionEditModal.hide()
      }
    })
}

function populateActions (actionDict) {
  // Take a dictionary of actions and build the GUI for them

  const actionList = document.getElementById('editProgramActionList')
  actionList.textContent = ''

  const items = Object.values(actionDict)
  items.sort((a, b) => a.time_offset - b.time_offset)

  items.forEach(item => {
    const entry = createActionEntryHTML(item)
    actionList.appendChild(entry)
  })
}

function createActionEntryHTML (item, allowEdit = hubTools.checkPermission('programs', 'edit')) {
  // Take a dictionary of properties and build an HTML representation of the action entry.

  let description = null
  const action = item.action
  let target = item.target

  // Create the plain-language description of the action
  if (['power_off', 'power_on', 'set_definition', 'set_dmx_scene'].includes(action)) {
    description = ActionConfigurator.actionToDescription(item.action) + ' ' + ActionConfigurator.targetToDescription(item.target)
  } else if (action === 'set_exhibit') {
    if (Array.isArray(target) && target.length > 0) {
      target = target[0]
    }
    description = `Set exhibition: ${hubTools.getExhibitName(target.value)}`
  } else if (action === 'note') {
    description = item.value
  }

  const eventRow = document.createElement('div')
  eventRow.classList = 'row mt-2 eventListing'

  let eventDescriptionOuterContainer
  if (action === 'note') {
    const eventDescriptionCol = document.createElement('div')
    if (allowEdit) {
      eventDescriptionCol.classList = 'me-0 pe-0 col-9'
    } else {
      eventDescriptionCol.classList = 'col-12'
    }
    eventRow.appendChild(eventDescriptionCol)

    eventDescriptionOuterContainer = document.createElement('div')
    eventDescriptionOuterContainer.classList = 'text-white bg-success w-100 h-100 justify-content-center d-flex py-1 pe-1 rounded-start'
    eventDescriptionCol.appendChild(eventDescriptionOuterContainer)

    const eventDescriptionInnerContainer = document.createElement('div')
    eventDescriptionInnerContainer.classList = 'align-self-center justify-content-center text-wrap'
    eventDescriptionOuterContainer.appendChild(eventDescriptionInnerContainer)

    const eventDescription = document.createElement('center')
    eventDescription.textContent = description
    eventDescriptionOuterContainer.appendChild(eventDescription)
  } else {
    const eventTimeCol = document.createElement('div')
    eventTimeCol.classList = 'col-4 me-0 pe-0'
    eventRow.appendChild(eventTimeCol)

    const eventTimeContainer = document.createElement('div')
    eventTimeContainer.classList = 'rounded-start text-light bg-secondary w-100 h-100 justify-content-center d-flex py-1 ps-1'
    eventTimeCol.appendChild(eventTimeContainer)

    const eventTime = document.createElement('div')
    eventTime.classList = 'align-self-center justify-content-center'
    eventTime.textContent = formatTimeOffset(item.time_offset_in_seconds)
    eventTimeContainer.appendChild(eventTime)

    const eventDescriptionCol = document.createElement('div')
    if (allowEdit) {
      eventDescriptionCol.classList = 'mx-0 px-0 col-5'
    } else {
      eventDescriptionCol.classList += 'ms-0 ps-0 col-8'
    }
    eventRow.appendChild(eventDescriptionCol)

    eventDescriptionOuterContainer = document.createElement('div')
    eventDescriptionOuterContainer.classList = 'text-light bg-secondary w-100 h-100 justify-content-center d-flex py-1 pe-1'
    eventDescriptionCol.appendChild(eventDescriptionOuterContainer)

    const eventDescriptionInnerContainer = document.createElement('div')
    eventDescriptionInnerContainer.classList = 'align-self-center justify-content-center text-wrap'
    eventDescriptionOuterContainer.appendChild(eventDescriptionInnerContainer)

    const eventDescription = document.createElement('center')
    eventDescription.textContent = description
    eventDescriptionOuterContainer.appendChild(eventDescription)
  }

  if (allowEdit) {
    const eventEditButtonCol = document.createElement('div')
    eventEditButtonCol.classList = 'col-3 ms-0 ps-0'
    eventRow.appendChild(eventEditButtonCol)

    const eventEditButton = document.createElement('button')
    eventEditButton.classList = 'bg-info w-100 h-100 rounded-end text-dark'
    eventEditButton.setAttribute('type', 'button')
    eventEditButton.style.borderStyle = 'solid'
    eventEditButton.style.border = '0px'
    eventEditButton.textContent = 'Edit'
    eventEditButton.addEventListener('click', function () {
      showprogramActionEditModal(item)
    })
    eventEditButtonCol.appendChild(eventEditButton)
  } else {
    eventDescriptionOuterContainer.classList.add('rounded-end')
  }

  return eventRow
}

function formatTimeOffset (timeOffset) {
  // Convert a float offset time to an English description

  if (timeOffset === 0) {
    return 'Start'
  }

  const minutes = Math.abs(timeOffset) / 60

  // Format to remove unnecessary decimal places (e.g. 5 instead of 5.00, 5.5 instead of 5.50)
  const formattedMinutes = parseFloat(minutes.toFixed(2)).toString()

  if (timeOffset > 0) {
    return `${formattedMinutes} min after `
  } else {
    return `${formattedMinutes} min before `
  }
}
