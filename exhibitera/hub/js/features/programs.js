/* global bootstrap */

import exConfig from '../../../common/config.js'
import * as exUtilities from '../../../common/utilities.js'
import hubConfig from '../../config.js'
import * as exTools from '../tools.js'

export async function populatePrograms (programs = null) {
  // Retrieve a list of available programs and populate the select

  const programSelect = document.getElementById('programSelect')

  if (!programs) {
    const programsResponse = await exTools.makeServerRequest({
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

  const result = await exTools.makeServerRequest({
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

  const programRequest = await exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/program/' + uuid
  })

  if (!programRequest.success) return

  // Tag the save button with the UUID for when we are ready to save
  document.getElementById('saveProgramButton').dataset.uuid = uuid

  const program = programRequest.program

  populateLocations()

  document.getElementById('editProgramNameField').value = program?.name ?? ''
  document.getElementById('editProgramDescriptionField').value = program?.description ?? ''
  document.getElementById('editProgramLocationField').value = program?.location ?? ''
  document.getElementById('editProgramDurationField').value = program?.duration ?? 60
  document.getElementById('editProgramCapacityField').value = program?.capacity ?? ''
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
    capacity: parseInt(document.getElementById('editProgramCapacityField').value) ?? null
  }

  const result = await exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/program/' + uuid + '/update',
    params: { update }
  })
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
        preview.src = '/programs/media/' + response.filename
        preview.style.display = 'block'
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
