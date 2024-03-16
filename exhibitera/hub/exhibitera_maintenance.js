import * as exTools from './exhibitera_tools.js'
import * as exIssues from './exhibitera_issues.js'

export function setComponentInfoModalMaintenanceStatus (id) {
  // Ask the server for the current maintenance status of the given component
  // and then update the componentInfoModal with that info

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/maintenance/getStatus',
    params: { id }
  })
    .then((result) => {
      if ('status' in result && 'notes' in result) {
        $('#componentInfoModalMaintenanceStatusSelector').val(result.status)
        $('#componentInfoModalMaintenanceNote').val(result.notes)
        $('#maintenanceHistoryWorkingBar').attr('ariaValueNow', result.working_pct)
        $('#maintenanceHistoryWorkingBar').width(String(result.working_pct) + '%')
        $('#maintenanceHistoryWorkingBar').attr('title', 'Working: ' + String(result.working_pct) + '%')
        $('#maintenanceHistoryNotWorkingBar').attr('ariaValueNow', result.not_working_pct)
        $('#maintenanceHistoryNotWorkingBar').width(String(result.not_working_pct) + '%')
        $('#maintenanceHistoryNotWorkingBar').attr('title', 'Not working: ' + String(result.not_working_pct) + '%')
        $('#componentInfoModalMaintenanceSaveButton').hide()
      }
    })

  // Clear the related issues list and update with any issues
  const issueList = document.getElementById('componentInfoModalMaintenanceRelatedIssues')
  issueList.innerHTML = ''

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/issue/list/' + id
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

  let id, status, notes
  if (type === 'component') {
    id = $('#componentInfoModalTitle').html()
    status = $('#componentInfoModalMaintenanceStatusSelector').val()
    notes = $('#componentInfoModalMaintenanceNote').val()
  }

  const requestDict = {
    component_id: id,
    status,
    notes
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/maintenance/updateStatus',
    params: requestDict
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        $('#componentInfoModalMaintenanceSaveButton').hide()
      }
    })
}
