import * as exTools from './exhibitera_tools.js'
import * as exIssues from './exhibitera_issues.js'

export function setComponentInfoModalMaintenanceStatus (uuid, id) {
  // Ask the server for the current maintenance status of the given component
  // and then update the componentInfoModal with that info

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/maintenance/' + uuid + '/status'
  })
    .then((result) => {
      if ('success' in result && result.success === false) return

      $('#componentInfoModalMaintenanceStatusSelector').val(result.status.status)
      $('#componentInfoModalMaintenanceNote').val(result.status.notes)
      $('#maintenanceHistoryWorkingBar').attr('ariaValueNow', result.status.working_pct)
      $('#maintenanceHistoryWorkingBar').width(String(result.status.working_pct) + '%')
      $('#maintenanceHistoryWorkingBar').attr('title', 'Working: ' + String(result.status.working_pct) + '%')
      $('#maintenanceHistoryNotWorkingBar').attr('ariaValueNow', result.status.not_working_pct)
      $('#maintenanceHistoryNotWorkingBar').width(String(result.status.not_working_pct) + '%')
      $('#maintenanceHistoryNotWorkingBar').attr('title', 'Not working: ' + String(result.status.not_working_pct) + '%')
      $('#componentInfoModalMaintenanceSaveButton').hide()
    })

  // Clear the related issues list and update with any issues
  const issueList = document.getElementById('componentInfoModalMaintenanceRelatedIssues')
  issueList.innerHTML = ''

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/issue/list/' + uuid
  }).then((response) => {
    if (response.success === true) {
      response.issueList.forEach((issue) => {
        issueList.appendChild(exIssues.createIssueHTML(issue, false))
      })
    }
  })
}

export function submitComponentMaintenanceStatusChange (type = 'component') {
  // Take details from the maintenance tab of the componentInfoModal and send
  // a message to the server updating the given component.

  let uuid, status, notes
  if (type === 'component') {
    uuid = $('#componentInfoModal').data('uuid')
    status = $('#componentInfoModalMaintenanceStatusSelector').val()
    notes = $('#componentInfoModalMaintenanceNote').val()
  }

  const requestDict = {
    status,
    notes
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/maintenance/' + uuid + '/updateStatus',
    params: requestDict
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        $('#componentInfoModalMaintenanceSaveButton').hide()
      }
    })
}
