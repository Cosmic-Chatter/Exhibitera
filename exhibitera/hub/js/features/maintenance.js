import * as exTools from '../tools.js'
import * as exIssues from './issues.js'

export function setComponentInfoModalMaintenanceStatus (uuid, id) {
  // Ask the server for the current maintenance status of the given component
  // and then update the componentInfoModal with that info

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/maintenance/' + uuid
  })
    .then((result) => {
      if (result.success && result.success === false) return

      document.getElementById('componentInfoModalMaintenanceStatusSelector').value = result.status.status
      document.getElementById('componentInfoModalMaintenanceNote').value = result.status.notes

      const workingBar = document.getElementById('maintenanceHistoryWorkingBar')
      workingBar.setAttribute('aria-valuenow', result.status.working_pct)
      workingBar.style.width = `${result.status.working_pct}%`
      workingBar.setAttribute('title', `Working: ${result.status.working_pct}%`)

      const notWorkingBar = document.getElementById('maintenanceHistoryNotWorkingBar')
      notWorkingBar.setAttribute('aria-valuenow', result.status.not_working_pct)
      notWorkingBar.style.width = `${result.status.not_working_pct}%`
      notWorkingBar.setAttribute('title', `Not working: ${result.status.not_working_pct}%`)

      document.getElementById('componentInfoModalMaintenanceSaveButton').style.display = 'none'
    })

  // Clear the related issues list and update with any issues
  const issueList = document.getElementById('componentInfoModalMaintenanceRelatedIssues')
  issueList.innerHTML = ''

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/issue/list/' + uuid
  }).then((response) => {
    if (response.success === true) {
      for (const issue of response.issueList) {
        issueList.appendChild(exIssues.createIssueHTML(issue, false))
      }
    }
  })
}

export function submitComponentMaintenanceStatusChange () {
  // Take details from the maintenance tab of the componentInfoModal and send
  // a message to the server updating the given component.

  const uuid = document.getElementById('componentInfoModal').dataset.uuid

  const requestDict = {
    status: document.getElementById('componentInfoModalMaintenanceStatusSelector').value,
    notes: document.getElementById('componentInfoModalMaintenanceNote').value
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/maintenance/' + uuid,
    params: requestDict
  })
    .then((result) => {
      if (result.success && result.success === true) {
        document.getElementById('componentInfoModalMaintenanceSaveButton').style.display = 'none'
      }
    })
}
