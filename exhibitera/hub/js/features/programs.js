/* global bootstrap */

import exConfig from '../../../common/config.js'
import * as exUtilities from '../../../common/utilities.js'

import hubConfig from '../../config.js'
import * as hubTools from '../tools.js'
import * as hubSchedule from './schedules.js'

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

  document.getElementById('editProgramPane').style.display = 'flex'
}

export async function updateProgram () {
  // Take the details in the edit program fields and push an update to Hub

  const uuid = document.getElementById('saveProgramButton').dataset.uuid
  if (uuid === '' || uuid == null) return

  const update = {
    uuid,
    name: document.getElementById('editProgramNameField').value,
    description: document.getElementById('editProgramDescriptionField').value,
    location: document.getElementById('editProgramLocationField').value,
    duration: parseFloat(document.getElementById('editProgramDurationField').value),
    capacity: parseInt(document.getElementById('editProgramCapacityField').value) ?? null,
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

  const actionSelector = document.getElementById('programActionSelector')
  const modalTitle = document.getElementById('programActionEditModalTitle')
  modalTitle.innerText = 'Add action'

  actionSelector.value = null

  const targetSelector = document.getElementById('programActionTargetSelector')
  targetSelector.value = null
  targetSelector.style.display = 'none'
  document.getElementById('programActionTargetSelectorLabel').style.display = 'none'

  const valueSelector = document.getElementById('programActionValueSelector')
  valueSelector.value = null
  valueSelector.style.display = 'none'
  document.getElementById('programActionValueSelectorLabel').style.display = 'none'

  const modal = document.getElementById('programActionEditModal')
  modal.dataset.uuid = exUtilities.uuid()
  modal.dataset.isEdit = 'false'

  if (actionDict != null) {
    modal.dataset.uuid = actionDict.uuid
    modal.dataset.isEdit = 'true'
    modalTitle.innerText = 'Edit action'

    actionSelector.value = actionDict.action

    programActionConfigureTargetSelector(actionDict.action)
    setTimeout(() => {
      for (const target of actionDict.target) {
        const targetStr = JSON.stringify(target)
        for (const option of targetSelector.options) {
          if (option.value === targetStr) option.selected = true
        }
      }
    }, 0) // Make sure the DOM is updated

    await programActionConfigureValueSelector(actionDict.action, actionDict.target)
    valueSelector.value = actionDict.value
  }

  exUtilities.showModal('#programActionEditModal')
}

function programActionConfigureTargetSelector (action = null, target = null) {
  // Show/hide the select element for picking the target of a program action when appropriate

  if (action == null) action = document.getElementById('programActionSelector').value

  const targetSelector = document.getElementById('programActionTargetSelector')
  const targetSelectorLabel = document.getElementById('programActionTargetSelectorLabel')
  targetSelector.innerHTML = ''

  if (['power_on', 'power_off'].includes(action)) {
    targetSelector.setAttribute('multiple', true)
    hubSchedule.actionTargetSelectorPopulateOptions(targetSelector, ['All', 'Groups', 'ExhibitComponents', 'Projectors'])
  } else if (['set_dmx_scene'].includes(action)) {
    targetSelector.removeAttribute('multiple')
    hubSchedule.actionTargetSelectorPopulateOptions(targetSelector, ['ExhibitComponents'])
  }
  targetSelector.style.display = 'block'
  targetSelectorLabel.style.display = 'block'

  // For certain actions, we want to then populare the value selector
  if (['set_dmx_scene'].includes(action)) {
    programActionConfigureValueSelector(action, target)
  } else {
    document.getElementById('programActionValueSelector').style.display = 'none'
    document.getElementById('programActionValueSelectorLabel').style.display = 'none'
  }
}

async function programActionConfigureValueSelector (action = null, target = null) {
  // Show/hide the select element for picking the value of an action when appropriate

  if (action == null) action = document.getElementById('programActionSelector').value
  if (target == null) target = JSON.parse(document.getElementById('programActionTargetSelector').value)
  if (Array.isArray(target)) target = target[0]

  const valueSelector = document.getElementById('programActionValueSelector')
  const valueSelectorLabel = document.getElementById('programActionValueSelectorLabel')
  valueSelector.innerHTML = ''

  if (action === 'set_dmx_scene') {
    let component
    try {
      component = hubTools.getExhibitComponent(target.uuid)
    } catch {
      return
    }
    if (component == null) {
      console.log('programActionConfigureValueSelector: component not available: ', target.uuid)
      return
    }

    let response
    try {
      response = await component.makeRequest({
        method: 'GET',
        endpoint: '/DMX/scenes'
      })
    } catch {
      console.log('programActionConfigureValueSelector: invalid helper address')
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
