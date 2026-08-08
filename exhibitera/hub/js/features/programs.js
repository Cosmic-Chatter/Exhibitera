/* global bootstrap */

import * as exUtilities from '../../../common/utilities.js'
import exConfig from '../../config.js'
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
  console.log(result)
}

function populateLocations () {
  // Use the list of groups to populate possible program locations.

  const locationSelect = document.getElementById('editProgramLocationField')

  locationSelect.appendChild(new Option('None', ''))
  for (const group of exConfig.groups) {
    const option = new Option(group.name, group.uuid)
    locationSelect.appendChild(option)
  }
}
