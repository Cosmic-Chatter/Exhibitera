import * as exTools from './exhibitera_tools.js'

export async function getAvailableTemplates () {
  // Ask Hub to send a list of availble definition files
  // Pass a function and it will be called with the list as the
  // only parameter

  return await exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/tracker/flexible-tracker/getAvailableTemplates'
  })
}

export function getAvailableTrackerData (complete) {
  // Ask Hub to send a list of availble data files
  // Pass a function and it will be called with the list as the
  // only parameter

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/tracker/flexible-tracker/getAvailableData'
  })
    .then((response) => {
      if ('success' in response && response.success === false) {
        console.log('Error retrieving tracker data list:', response.reason)
        return
      }
      if (typeof complete === 'function') {
        complete(response.data)
      }
    })
}

export async function loadTemplate (uuid) {
  // Ask Hub to send a JSON dict with the template

  const response = await exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/tracker/flexible-tracker/' + uuid
  })
  return response.template
}

export function downloadTrackerData (name) {
  // Ask the server to send the data for the currently selected tracker as a CSV
  // and initiate a download.

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/getDataAsCSV',
    params: { name }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Convert the text to a file and initiate download
        const fileBlob = new Blob([result.csv], {
          type: 'text/plain'
        })
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(fileBlob)
        a.download = name + '.csv'
        a.click()
      }
    })
}
