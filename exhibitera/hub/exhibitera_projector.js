import * as exTools from './exhibitera_tools.js'

export function showAddProjectorModal () {
  // Prepare the modal for adding static components and show it.

  // Reset values
  document.getElementById('addProjectorModalIDField').value = ''
  document.getElementById('addProjectorModalGroupField').value = ''

  // Hide warnings
  document.getElementById('addProjectorModalIDError').style.display = 'none'
  document.getElementById('addProjectorModalGroupError').style.display = 'none'
  document.getElementById('addProjectorModalIPError').style.display = 'none'

  $('#addProjectorModal').modal('show')
}

export function submitProjectorAdditionFromModal () {
  // Set up a new projector from the components tab modal

  // Check that the fields are properly filled out
  const group = document.getElementById('addProjectorModalGroupField').value.trim()
  const id = document.getElementById('addProjectorModalIDField').value.trim()
  const ipAddress = document.getElementById('addProjectorModalIPField').value.trim()

  if (id === '') {
    document.getElementById('addProjectorModalIDError').style.display = 'block'
    return
  } else {
    document.getElementById('addProjectorModalIDError').style.display = 'none'
  }
  if (group === '') {
    document.getElementById('addProjectorModalGroupError').style.display = 'block'
    return
  } else {
    document.getElementById('addProjectorModalGroupError').style.display = 'none'
  }
  if (ipAddress === '') {
    document.getElementById('addProjectorModalIPError').style.display = 'block'
    return
  } else {
    document.getElementById('addProjectorModalIPError').style.display = 'none'
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/projector/create',
    params: {
      id,
      group,
      ip_address: ipAddress,
      password: document.getElementById('addProjectorModalPasswordField').value
    }
  })
  $('#addProjectorModal').modal('hide')
}
