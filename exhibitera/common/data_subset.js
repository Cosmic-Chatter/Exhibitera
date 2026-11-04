// Downloading part of a data file: the records in a time range, with chosen columns.

import * as exUtilities from './utilities.js'

export class DataSubsetModal {
  constructor ({ prefix, modalId, request, save }) {
    // request(endpoint) asks the server that has the data, returning a Promise of its reply.
    // save(result, name) downloads the CSV in a reply from the csv endpoint.

    this.prefix = prefix
    this.modalId = modalId
    this.request = request
    this.save = save

    this.endpoint = null // The data shown, such as '/data/Exit%20survey'
    this.name = ''
    this.range = { start: '', end: '' } // The range the modal opened with, which covers every record
    this.count = null // How many records are in the chosen range, or null if the range isn't valid
    this.countRequest = 0 // Ignores counts that arrive after a newer request
  }

  element (role) {
    return document.getElementById(this.prefix + role)
  }

  bind () {
    // Respond to the modal's controls. Call once, after the page has loaded.

    for (const role of ['Start', 'End']) {
      this.element(role).addEventListener('change', () => this.updateCount())
    }
    this.element('Columns').addEventListener('change', () => this.updateDownloadButton())
    this.element('SelectAll').addEventListener('click', () => this.selectAllColumns(true))
    this.element('SelectNone').addEventListener('click', () => this.selectAllColumns(false))
    this.element('DownloadButton').addEventListener('click', () => this.download())
  }

  async show (endpoint, name) {
    // Show the modal for the data at the given endpoint, filled in from its summary.

    const summary = await this.request(endpoint + '/summary')
    if (summary?.success !== true) return
    this.endpoint = endpoint
    this.name = name

    this.element('Name').textContent = name

    // datetime-local fields work to the minute, as YYYY-MM-DDTHH:MM
    const hasTimes = summary.first != null
    this.range = { start: summary.first?.slice(0, 16) ?? '', end: summary.last?.slice(0, 16) ?? '' }
    this.element('Start').value = this.range.start
    this.element('End').value = this.range.end
    this.element('TimeRange').style.display = hasTimes ? 'block' : 'none'
    this.element('NoTimes').style.display = hasTimes ? 'none' : 'block'

    const columnsDiv = this.element('Columns')
    columnsDiv.innerHTML = ''
    summary.columns.forEach((column, index) => {
      const div = document.createElement('div')
      div.classList = 'form-check'
      columnsDiv.appendChild(div)

      const input = document.createElement('input')
      input.classList = 'form-check-input'
      input.setAttribute('type', 'checkbox')
      input.setAttribute('id', this.prefix + 'Column_' + index)
      input.value = column
      input.checked = true
      div.appendChild(input)

      const label = document.createElement('label')
      label.classList = 'form-check-label'
      label.setAttribute('for', this.prefix + 'Column_' + index)
      label.textContent = column
      div.appendChild(label)
    })

    this.showCount(summary.count)
    exUtilities.showModal('#' + this.modalId)
  }

  params (includeColumns = true) {
    // Return the query for the chosen subset. Each end of the range is only sent once it's been changed, so
    // an unchanged range also includes records without a time.

    const params = new URLSearchParams()
    const start = this.element('Start').value
    const end = this.element('End').value
    if (start !== this.range.start && start !== '') params.append('start', start)
    if (end !== this.range.end && end !== '') params.append('end', end)
    if (includeColumns) {
      for (const column of this.selectedColumns()) params.append('columns', column)
    }
    return params
  }

  selectedColumns () {
    return [...this.element('Columns').querySelectorAll('input:checked')].map((input) => input.value)
  }

  async updateCount () {
    // Count the records in the chosen time range.

    if (this.endpoint == null) return
    const request = ++this.countRequest
    const summary = await this.request(this.endpoint + '/summary' + withQuery(this.params(false)))
    if (request !== this.countRequest) return
    this.showCount(summary?.success === true ? summary.count : null)
  }

  showCount (count) {
    // Show how many records the subset has

    this.count = count
    let text = 'Invalid time range'
    if (count === 0) text = 'No records'
    else if (count === 1) text = '1 record'
    else if (count != null) text = `${count} records`
    this.element('Count').textContent = text
    this.updateDownloadButton()
  }

  updateDownloadButton () {
    // The subset can only be downloaded with records and at least one column

    this.element('DownloadButton').disabled = this.count == null || this.count === 0 || this.selectedColumns().length === 0
  }

  selectAllColumns (checked) {
    for (const input of this.element('Columns').querySelectorAll('input')) input.checked = checked
    this.updateDownloadButton()
  }

  async download () {
    // Download the chosen subset and close the modal.

    if (this.endpoint == null) return
    const result = await this.request(this.endpoint + '/csv' + withQuery(this.params()))
    if (result?.success !== true) return
    this.save(result, this.name)
    exUtilities.hideModal('#' + this.modalId)
  }
}

function withQuery (params) {
  return params.toString() !== '' ? '?' + params.toString() : ''
}
