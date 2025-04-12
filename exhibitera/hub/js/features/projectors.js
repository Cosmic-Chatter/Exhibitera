import * as exUtilities from '../../../common/utilities.js'
import * as exGroup from './groups.js'
import * as exTools from '../tools.js'

export function showAddProjectorModal () {
  // Prepare the modal for adding static components and show it.

  const groupsField = document.getElementById('addProjectorModalGroupField')

  // Rebuild the list of groups
  exGroup.populateGroupsForSelect(groupsField)

  // Reset values
  document.getElementById('addProjectorModalIDField').value = ''
  groupsField.value = 'Default'

  // Hide warnings
  document.getElementById('addProjectorModalIDError').style.display = 'none'
  document.getElementById('addProjectorModalIPError').style.display = 'none'

  exUtilities.showModal('#addProjectorModal')
}

export function submitProjectorAdditionFromModal () {
  // Set up a new projector from the components tab modal

  // Check that the fields are properly filled out
  let groups = Array.from(document.getElementById('addProjectorModalGroupField').querySelectorAll('option:checked'), e => e.value)
  const id = document.getElementById('addProjectorModalIDField').value.trim()
  const ipAddress = document.getElementById('addProjectorModalIPField').value.trim()

  if (id === '') {
    document.getElementById('addProjectorModalIDError').style.display = 'block'
    return
  } else {
    document.getElementById('addProjectorModalIDError').style.display = 'none'
  }
  if (groups.length === 0) {
    groups = ['Default']
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
      groups,
      ip_address: ipAddress,
      password: document.getElementById('addProjectorModalPasswordField').value
    }
  })
  exUtilities.hideModal('#addProjectorModal')
}
