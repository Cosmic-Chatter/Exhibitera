/* global bootstrap */

import hubConfig from '../config.js'
import * as exUtilities from '../../common/utilities.js'
import * as exTracker from './features/tracker.js'

class TimingObject {
  // This class is to keep track of elapsed time for the timer input type

  constructor (uuid, name, exclusive = false, recordStartTime = false) {
    this.displayName = name
    this.uuid = uuid
    this.exclusive = exclusive // Exclusive timers will stop all other exclusive timers when started
    this.recordStartTime = recordStartTime // Also record when the timer was first started
    this.firstStartTime = null // When the timer was first started in this record
    this.elapsedTime = 0
    this.timerRunning = false
    this.startTime = null
    this.timerInterval = null // Will hold a reference to a setInterval that updates the interface
  }

  createWidget () {
    // Return an element representing the timer onscreen.

    const row = document.createElement('div')
    row.classList = 'row w-100 mx-0'

    const col1 = document.createElement('div')
    col1.classList = 'col-12 col-md-6 mt-2 ps-md-0 pe-md-1'
    row.appendChild(col1)

    const button = document.createElement('button')
    button.classList = 'btn btn-primary w-100'
    button.setAttribute('id', 'TimerStartStopButton_' + this.uuid)
    button.innerHTML = 'Start'
    const thisUUID = this.uuid
    button.addEventListener('click', () => {
      getTimer(thisUUID).toggleTimer()
    })

    col1.appendChild(button)

    const col2 = document.createElement('div')
    col2.classList = 'col-12 col-md-6 mt-2 ps-md-1 pe-md-0'
    row.appendChild(col2)

    const span = document.createElement('span')
    span.classList = 'btn btn-secondary disabled w-100 timer-view'
    span.setAttribute('id', 'TimerCounterView_' + this.uuid)
    span.innerHTML = '00:00'
    col2.appendChild(span)

    return row
  }

  resetTimer () {
    if (this.timerRunning) {
      this.stopTimer()
    }
    this.elapsedTime = 0
    this.timerRunning = false
    this.startTime = null
    this.firstStartTime = null
    this.timerInterval = null
    document.getElementById('TimerCounterView_' + this.uuid).innerHTML = '0 sec'
  }

  startTimer () {
    if (this.timerRunning === false) {
      if (this.exclusive) {
        timerList.forEach(timer => {
          if (timer.exclusive) {
            timer.stopTimer()
          }
        })
      }
      const d = new Date()
      this.startTime = d.getTime()
      if (this.firstStartTime == null) this.firstStartTime = d // Restarting doesn't change it
      this.timerRunning = true

      const thisObject = this
      this.timerInterval = setInterval(
        function () {
          thisObject.updateInterface()
        }, 1000) // Once per second

      const buttonEl = document.getElementById('TimerStartStopButton_' + this.uuid)
      buttonEl.innerHTML = 'Stop'
      buttonEl.classList.add('btn-danger')
      buttonEl.classList.remove('btn-primary')
    }
  }

  stopTimer () {
    // Stop the timer from incrementing and add the accumulated time to elapsedTime

    if (this.timerRunning) {
      const d = new Date()
      const nowTime = d.getTime()
      this.elapsedTime += nowTime - this.startTime

      this.startTime = null
      clearInterval(this.timerInterval)
      this.timerInterval = null
      this.timerRunning = false

      const buttonEl = document.getElementById('TimerStartStopButton_' + this.uuid)
      buttonEl.innerHTML = 'Start'
      buttonEl.classList.remove('btn-danger')
      buttonEl.classList.add('btn-primary')
    }
  }

  toggleTimer () {
    if (this.timerRunning) {
      this.stopTimer()
    } else {
      this.startTimer()
    }
  }

  updateInterface () {
    // Update the label with the current amount of elapsed time.

    const d = new Date()
    const nowTime = d.getTime()
    const seconds = Math.round((nowTime - this.startTime + this.elapsedTime) / 1000)

    const viewEL = document.getElementById('TimerCounterView_' + this.uuid)
    viewEL.textContent = formatTime(seconds)
  }
}

function localTimestamp (date) {
  // Format the given Date as an ISO 8601 timestamp in local time, without a time zone, as records store times.

  const tzoffset = date.getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, -1)
}

function formatTime (totalSeconds) {
  // Time a number of seconds and format it to be human-readable

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // Pad with leading zeros to ensure two-digit format
  const formattedHours = String(hours).padStart(2, '0')
  const formattedMinutes = String(minutes).padStart(2, '0')
  const formattedSeconds = String(seconds).padStart(2, '0')

  let result = ''
  if (formattedHours !== '00') result += formattedHours + ':'
  result += formattedMinutes + ':' + formattedSeconds
  return result
}

function buildLayout (definition) {
  // Take a layout defition  and create cards for each element

  const cardRow = document.getElementById('cardRow')
  cardRow.innerHTML = ''

  // Clear existing references to cards
  counterList = []
  dropdownList = []
  numberList = []
  sliderList = []
  textList = []
  timerList = []

  // Loop the widgets in the definition and make a card for each

  for (const widgetUUID of definition.widget_order) {
    const item = definition.widgets[widgetUUID]

    // Start the card
    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3 mt-2'

    const card = document.createElement('div')
    card.classList = 'card h-100'
    card.setAttribute('data-uuid', item.uuid)
    col.appendChild(card)

    const body = document.createElement('div')
    body.classList = 'card-body'
    card.appendChild(body)

    const title = document.createElement('H2')
    title.classList = 'card-title'
    title.textContent = item.name
    body.appendChild(title)

    if (item?.label) {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.setAttribute('for', item.uuid + '_input')
      label.textContent = item.label
      body.appendChild(label)
    }

    const inputGroup = document.createElement('div')
    inputGroup.classList = 'input-group mb-3'
    body.appendChild(inputGroup)

    switch (item.type) {
      case 'counter':
        {
          const counterRow = document.createElement('div')
          counterRow.classList = 'row w-100 mx-0'
          inputGroup.appendChild(counterRow)

          const counterCol1 = document.createElement('div')
          counterCol1.classList = 'col-4 ps-0 pe-1'
          counterRow.appendChild(counterCol1)

          const decButton = document.createElement('button')
          decButton.classList = 'counter-button btn btn-danger w-100'
          decButton.setAttribute('id', item.uuid + '_decrement')
          decButton.disabled = true // Counters start at zero
          decButton.innerHTML = '-'
          decButton.addEventListener('click', () => {
            incrementCounter(item.uuid, -1)
          })

          counterCol1.appendChild(decButton)

          const counterCol2 = document.createElement('div')
          counterCol2.classList = 'col-4 px-1'
          counterRow.appendChild(counterCol2)

          const flexRow = document.createElement('div')
          flexRow.classList = 'w-100 h-100 justify-content-center d-flex'
          counterCol2.appendChild(flexRow)

          const counterVal = document.createElement('span')
          counterVal.classList = 'align-self-center justify-content-center'
          counterVal.setAttribute('id', item.uuid + '_counter')
          counterVal.setAttribute('data-name', item.name)
          counterVal.setAttribute('data-count', '0')
          if (item?.max != null) counterVal.setAttribute('data-max', item.max)
          counterVal.style.fontSize = '50px'
          counterVal.textContent = 0
          flexRow.appendChild(counterVal)

          const counterCol3 = document.createElement('div')
          counterCol3.classList = 'col-4 pe-0 ps-1'
          counterRow.appendChild(counterCol3)

          const incButton = document.createElement('button')
          incButton.classList = 'counter-button btn btn-success w-100'
          incButton.setAttribute('id', item.uuid + '_increment')
          incButton.innerHTML = '+'
          incButton.addEventListener('click', () => {
            incrementCounter(item.uuid, 1)
          })

          counterCol3.appendChild(incButton)
        }
        break

      case 'dropdown':
      {
        const isMultiple = item?.multiple ?? false

        const select = document.createElement('select')
        inputGroup.appendChild(select)
        select.classList = 'form-select w-100'
        select.setAttribute('id', item.uuid + '_input')
        select.setAttribute('data-name', item.name)
        select.setAttribute('data-required', item?.required === true)

        if (isMultiple) {
          select.setAttribute('multiple', true)
        } else {
          // Add a blank option
          const nullOption = document.createElement('option')
          nullOption.value = ''
          select.appendChild(nullOption)
        }

        for (const optionText of item?.options ?? []) {
          select.appendChild(new Option(optionText))
        }
        break
      }

      case 'number':
      {
        const input = document.createElement('input')
        input.setAttribute('type', 'number')
        input.setAttribute('id', item.uuid + '_input')
        input.setAttribute('data-name', item.name)
        input.setAttribute('data-required', item?.required === true)
        if (item?.min != null) input.setAttribute('min', item.min)
        if (item?.max != null) input.setAttribute('max', item.max)
        input.classList = 'form-control'
        inputGroup.appendChild(input)
        break
      }

      case 'slider':
      {
        const min = item?.min ?? 1
        const max = item?.max ?? 5
        const step = item?.step ?? 1
        const start = item?.start ?? Math.round((min + max) / 2)

        const sliderRow = document.createElement('div')
        sliderRow.classList = 'row w-100 mx-0'
        inputGroup.appendChild(sliderRow)

        const labelCol = document.createElement('div')
        labelCol.classList = 'col-12 text-center fs-5'
        sliderRow.appendChild(labelCol)

        const sliderLabel = document.createElement('span')
        sliderLabel.setAttribute('id', item.uuid + '_input_label')
        sliderLabel.textContent = start
        labelCol.appendChild(sliderLabel)

        const col12 = document.createElement('div')
        col12.classList = 'col-12'
        sliderRow.appendChild(col12)

        const slider = document.createElement('input')
        slider.setAttribute('type', 'range')
        slider.setAttribute('id', item.uuid + '_input')
        slider.setAttribute('data-name', item.name)
        slider.setAttribute('data-start', start)
        slider.setAttribute('min', min)
        slider.setAttribute('max', max)
        slider.setAttribute('step', step)
        slider.value = start
        slider.classList = 'w-100'
        slider.addEventListener('input', () => {
          updateValue(item.uuid + '_input', item.uuid + '_input_label')
        })
        col12.appendChild(slider)

        if (item?.min_label || item?.max_label) {
          // Text under each end of the slider, such as "Not at all" and "Very much"
          const endLabels = document.createElement('div')
          endLabels.classList = 'd-flex justify-content-between gap-2 small text-body-secondary'
          col12.appendChild(endLabels)
          for (const end of ['min', 'max']) {
            // Long labels wrap, each staying under its end of the slider
            const endLabel = document.createElement('span')
            endLabel.classList = end === 'min' ? 'text-start' : 'text-end'
            endLabel.setAttribute('id', item.uuid + '_' + end + '_label')
            endLabel.textContent = item?.[end + '_label'] ?? ''
            endLabels.appendChild(endLabel)
          }
        }

        break
      }

      case 'text':
      {
        const textArea = document.createElement('textarea')
        textArea.classList = 'form-control w-100'
        textArea.setAttribute('id', item.uuid + '_input')
        textArea.setAttribute('data-name', item.name)
        textArea.setAttribute('data-required', item?.required === true)
        textArea.setAttribute('rows', item?.lines ?? 5)
        inputGroup.appendChild(textArea)
        break
      }

      case 'timer':
      {
        const timer = new TimingObject(item.uuid, item.name, item?.exclusive ?? false, item?.record_start_time ?? false)
        inputGroup.appendChild(timer.createWidget())
        timerList.push(timer)
        break
      }
    }

    if (['dropdown', 'number', 'text'].includes(item.type)) {
      // Says why the widget needs attention when a record can't be saved
      inputGroup.classList.add('has-validation')
      const feedback = document.createElement('div')
      feedback.classList = 'invalid-feedback'
      feedback.setAttribute('id', item.uuid + '_feedback')
      inputGroup.appendChild(feedback)

      // The card isn't in the page yet, so find the input within it
      const input = inputGroup.querySelector('#' + CSS.escape(item.uuid + '_input'))
      for (const event of ['input', 'change']) {
        input.addEventListener(event, () => input.classList.remove('is-invalid'))
      }
    }

    cardRow.appendChild(col)

    // Store a reference to the appropriate object
    switch (item.type) {
      case 'counter':
        counterList.push(document.getElementById(item.uuid + '_counter'))
        break
      case 'dropdown':
        dropdownList.push(document.getElementById(item.uuid + '_input'))
        break
      case 'number':
        numberList.push(document.getElementById(item.uuid + '_input'))
        break
      case 'slider':
        sliderList.push(document.getElementById(item.uuid + '_input'))
        break
      case 'text':
        textList.push(document.getElementById(item.uuid + '_input'))
        break
      case 'timer':
        // We already store this reference in timerList as part of object creation
        break
    }
  }
}

function badConnection () {
  // Show a warning. Records are kept on the device until Hub is back.

  connected = false
  showIndicator('connectionWarning', true)
  updateTemplateChooser()
}

function goodConnection () {
  // Hide the warning and send any records that are waiting

  const reconnected = !connected
  connected = true
  showIndicator('connectionWarning', false)
  updateTemplateChooser()
  if (reconnected || Date.now() >= retryTime) sendWaitingRecords()
}

function checkConnection () {
  // Send a message to the server checking that the connection is stable.

  const xhr = new XMLHttpRequest()
  xhr.open('GET', hubConfig.api + '/system/checkConnection', true)
  xhr.timeout = 1000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.overrideMimeType('text/plain; charset=x-user-defined')
  xhr.ontimeout = badConnection
  xhr.onerror = badConnection
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const response = JSON.parse(this.responseText)
      if (response.success === true) {
        goodConnection()
      }
    }
  }
  xhr.send()
}

function checkWidgets () {
  // Mark the widgets that are required but empty, or numbers outside their limits, and focus the first one.
  // Return whether the record can be saved.

  let firstInvalid = null
  for (const input of [...dropdownList, ...numberList, ...textList]) {
    const problem = widgetProblem(input)
    input.classList.toggle('is-invalid', problem !== '')
    document.getElementById(input.id.replace(/_input$/, '_feedback')).textContent = problem
    if (problem !== '' && firstInvalid == null) firstInvalid = input
  }
  firstInvalid?.focus()
  return firstInvalid == null
}

function widgetProblem (input) {
  // Return why the given input can't be saved, or '' if it can

  const empty = input.tagName === 'SELECT'
    ? ![...input.options].some((opt) => opt.selected && (opt.value || opt.text))
    : input.value.trim() === ''
  if (empty) return input.getAttribute('data-required') === 'true' ? 'Required' : ''

  if (input.type !== 'number') return ''
  const value = parseFloat(input.value)
  const min = input.getAttribute('min')
  const max = input.getAttribute('max')
  if ((min != null && value < parseFloat(min)) || (max != null && value > parseFloat(max))) {
    if (min != null && max != null) return `Enter a number from ${min} to ${max}.`
    if (min != null) return `Enter a number of at least ${min}.`
    return `Enter a number of at most ${max}.`
  }
  return ''
}

function clearInput () {
  // Reset all cards back to their initial state

  for (const input of [...dropdownList, ...numberList, ...textList]) {
    input.classList.remove('is-invalid')
  }

  counterList.forEach(item => {
    setCounter(item, 0)
  })
  dropdownList.forEach(item => {
    item.value = ''
  })

  numberList.forEach(item => {
    item.value = null
  })

  sliderList.forEach(item => {
    const start = item.getAttribute('data-start')
    item.value = start
    document.getElementById(item.id + '_label').textContent = start
  })

  textList.forEach(item => {
    item.value = ''
  })

  timerList.forEach(item => {
    item.resetTimer()
  })
}

function incrementCounter (uuid, valueToAdd) {
  // Function to add the given number to the counter with the specified id

  const counterEl = document.getElementById(uuid + '_counter')
  // A count of something can't be negative, or go above the counter's maximum
  let value = Math.max(0, parseInt(counterEl.getAttribute('data-count')) + valueToAdd)
  const max = counterEl.getAttribute('data-max')
  if (max != null) value = Math.min(parseInt(max), value)

  setCounter(counterEl, value)
}

function setCounter (counterEl, value) {
  // Show the given count, disabling - at zero and + at the counter's maximum, so staff can see they've reached the end

  counterEl.setAttribute('data-count', value)
  counterEl.textContent = value
  const max = counterEl.getAttribute('data-max')
  const uuid = counterEl.id.replace(/_counter$/, '')
  document.getElementById(uuid + '_increment').disabled = max != null && value >= parseInt(max)
  document.getElementById(uuid + '_decrement').disabled = value <= 0
}

function getTimer (uuid) {
  // Get a TimingObject by its uuid

  const result = timerList.find(obj => {
    return obj.uuid === uuid
  })

  return result
}

function sendData () {
  // Collect the current value from each card, build a dictionary, and
  // send it to Hub for storage.

  // Required widgets must be filled in and numbers within their limits. Timers keep running until then.
  if (!checkWidgets()) return

  const resultDict = {}

  // Do timers first to make sure they stop as close to immediately as possible
  timerList.forEach(item => {
    item.stopTimer()
    resultDict[item.displayName] = item.elapsedTime / 1000
    if (item.recordStartTime && item.firstStartTime != null) {
      resultDict[item.displayName + ' (Start time)'] = localTimestamp(item.firstStartTime)
    }
  })
  counterList.forEach(item => {
    const name = item.getAttribute('data-name')
    resultDict[name] = parseInt(item.getAttribute('data-count'))
  })
  dropdownList.forEach(item => {
    const name = item.getAttribute('data-name')
    let result = []

    for (const opt of item.options) {
      if (opt.selected) {
        result.push(opt.value || opt.text)
      }
    }
    if (item.getAttribute('multiple') == null) result = result[0]

    resultDict[name] = result
  })

  numberList.forEach(item => {
    const name = item.getAttribute('data-name')
    resultDict[name] = parseFloat(item.value)
  })

  sliderList.forEach(item => {
    const name = item.getAttribute('data-name')
    resultDict[name] = parseFloat(item.value)
  })

  textList.forEach(item => {
    const name = item.getAttribute('data-name')
    resultDict[name] = item.value
  })

  // Append the date and time of this recording
  resultDict.Date = localTimestamp(new Date())

  if (previewMode) {
    // The template editor's preview shows the record instead of saving it
    showPreviewRecord(resultDict)
    clearInput()
    return
  }

  // Without a template there's nowhere to save the record
  if (templateUUID === '') return

  const record = { id: exUtilities.uuid(), template: templateUUID, data: resultDict }
  if (keepWaitingRecord(record)) {
    clearInput()
    confirmRecordID = record.id
    sendWaitingRecords()
    return
  }

  // Without browser storage, the record can only be kept in the inputs until it's sent
  sendRecord(record).then((result) => {
    document.getElementById('recordErrorNotice').style.display = result === 'failed' ? 'block' : 'none'
    showRecordSaved(result === 'saved')
    if (result !== 'failed') clearInput()
  })
}

function sendRecord (record) {
  // Send the given record to Hub. Resolves to 'saved', 'dropped' if its template no longer exists,
  // or 'failed' if it should be sent again later.

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    // Records are stored by the template's UUID, so renaming the template doesn't split its data
    xhr.open('POST', hubConfig.api + '/datasets/tracker/' + encodeURIComponent(record.template) + '/append', true)
    xhr.timeout = 5000
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.overrideMimeType('text/plain; charset=x-user-defined')
    xhr.ontimeout = () => resolve('failed')
    xhr.onerror = () => resolve('failed')
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      let response = null
      try {
        response = JSON.parse(this.responseText)
      } catch {}
      if (this.status === 200 && response?.success === true) resolve('saved')
      else if (response?.reason === 'unknown_template') resolve('dropped')
      else resolve('failed')
    }
    // The ID lets Hub skip a record that's sent again because its reply was lost
    xhr.send(JSON.stringify({ data: record.data, record_id: record.id }))
  })
}

function loadWaitingRecords () {
  // Return the records kept on this device that haven't reached Hub, oldest first

  try {
    const records = JSON.parse(window.localStorage.getItem(WAITING_RECORDS_KEY))
    return Array.isArray(records) ? records : []
  } catch {
    return []
  }
}

function saveWaitingRecords (records) {
  // Return whether the records could be stored on this device

  try {
    window.localStorage.setItem(WAITING_RECORDS_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

function keepWaitingRecord (record) {
  // Store the record on this device until Hub confirms it. Return false if it can't be stored.

  const kept = saveWaitingRecords([...loadWaitingRecords(), record])
  updateWaitingNotice()
  return kept
}

async function sendWaitingRecords () {
  // Send the records kept on this device one at a time, oldest first, stopping at the first failure

  if (sendingWaitingRecords) return
  sendingWaitingRecords = true
  try {
    let next
    while ((next = loadWaitingRecords()[0]) != null) {
      const result = await sendRecord(next)
      if (result === 'failed') {
        // Try again once the connection is back, or after a few seconds
        retryTime = Date.now() + RETRY_DELAY
        confirmRecordID = null
        break
      }
      // Records whose template no longer exists can't be saved, so they're dropped
      saveWaitingRecords(loadWaitingRecords().filter((record) => record.id !== next.id))
      if (next.id === confirmRecordID) showRecordSaved(result === 'saved')
      updateWaitingNotice()
    }
  } finally {
    sendingWaitingRecords = false
    updateWaitingNotice()
  }
}

function updateWaitingNotice () {
  // Show how many records are kept on this device, waiting to be sent

  const notice = document.getElementById('recordsWaitingNotice')
  const waiting = loadWaitingRecords().length
  const details = waiting === 1
    ? '1 record is saved on this device, waiting to send to Hub.'
    : `${waiting} records are saved on this device, waiting to send to Hub.`
  if (notice.textContent !== String(waiting)) {
    notice.textContent = String(waiting)
    notice.setAttribute('aria-label', details)
    bootstrap.Popover.getInstance(notice)?.setContent({ '.popover-body': details })
  }
  showIndicator('recordsWaitingNotice', waiting > 0)
}

function showIndicator (id, show) {
  // Show or hide a status indicator beside the template select, closing its popover when it's hidden

  const indicator = document.getElementById(id)
  indicator.style.display = show ? 'inline-flex' : 'none'
  if (!show) bootstrap.Popover.getInstance(indicator)?.hide()
}

function showRecordSaved (saved) {
  // Briefly confirm that a record reached Hub, so staff don't record it twice

  const notice = document.getElementById('recordSavedNotice')
  clearTimeout(recordSavedTimeout)
  notice.style.display = saved ? 'block' : 'none'
  if (saved) recordSavedTimeout = setTimeout(() => { notice.style.display = 'none' }, 2000)
}

function updateValue (fromID, toID) {
  // Read the value property from the element with ID fromID and put the
  // value into the div with toID

  const obj = document.getElementById(fromID)

  document.getElementById(toID).textContent = obj.value
}

function populateLayoutDropdown (templateList) {
  // Take a list of layouts and fill up the dropdown list

  const definitionListDropdown = document.getElementById('definitionListDropdown')
  for (const template of templateList) {
    definitionListDropdown.appendChild(new Option(template.name, template.uuid))
  }
}

async function loadLayout (toLoad = '') {
  // Load the template with the specified UUID or get the selected value from the list
  if (toLoad === '') {
    const dropdownName = document.getElementById('definitionListDropdown').value
    if (dropdownName === '') return
    toLoad = dropdownName
  }

  const template = await exTracker.loadTemplate(toLoad)
  templateUUID = template?.uuid ?? toLoad
  buildLayout(template)

  guestFacing = (template?.guest_facing ?? false) === true
  document.getElementById('titleCol').style.display = guestFacing ? 'none' : 'block'
  updateTemplateChooser()
}

function updateTemplateChooser () {
  // Hide the template chooser in preview mode, for guest-facing templates, and while Hub can't be reached,
  // since templates can't be loaded without it. d-none is needed to override the column's d-flex.

  const hide = previewMode || guestFacing || !connected
  document.getElementById('definitionListCol').classList.toggle('d-none', hide)
}

function showPreviewTemplate (template) {
  // Show a template sent by the template editor, including any unsaved changes.

  buildLayout(template)
  const guestFacing = template?.guest_facing ?? false
  document.getElementById('titleCol').style.display = guestFacing ? 'none' : 'block'
}

function showPreviewRecord (record) {
  // Show the record that would have been saved in an overlay, for the template editor's preview.

  const fields = document.getElementById('previewRecordFields')
  fields.innerHTML = ''

  for (const [key, value] of Object.entries(record)) {
    const line = document.createElement('div')
    const name = document.createElement('span')
    name.classList = 'fw-bold'
    name.textContent = key + ': '
    line.appendChild(name)
    line.append(Array.isArray(value) ? value.join(', ') : String(value))
    fields.appendChild(line)
  }
  bootstrap.Modal.getOrCreateInstance(document.getElementById('previewRecordModal')).show()
}

async function parseQueryString () {
  // Read the query string to determine what options to set

  const queryString = decodeURIComponent(window.location.search)

  const searchParams = new URLSearchParams(queryString)

  if (searchParams.has('layout')) {
    const layoutUUID = searchParams.get('layout')
    loadLayout(layoutUUID)
    document.getElementById('definitionListDropdown').value = layoutUUID

    const template = await exTracker.loadTemplate(layoutUUID)

    if ((template?.guest_facing ?? false) === false) {
      // Clear the query string so it reloads clean on refresh
      history.pushState(null, '', location.href.split('?')[0])
    }
  }
}

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

document.querySelectorAll('.status-indicator').forEach((indicator) => {
  // Each indicator's details are its label, so screen readers get them too
  bootstrap.Popover.getOrCreateInstance(indicator, { content: () => indicator.getAttribute('aria-label') })
  // Safari doesn't focus links when they're tapped, and the popover opens on focus
  indicator.addEventListener('click', () => indicator.focus())
})

document.getElementById('recordButton').addEventListener('click', sendData)
document.getElementById('clearButton').addEventListener('click', clearInput)
document.getElementById('definitionListDropdown').addEventListener('change', () => {
  loadLayout()
})

let templateUUID = ''
let recordSavedTimeout = null

// Records are kept on the device until Hub confirms them, so none are lost if Hub can't be reached
const WAITING_RECORDS_KEY = 'exhibitera_tracker_waiting_records'
const RETRY_DELAY = 3000 // ms to wait before sending again after Hub refuses a record
let sendingWaitingRecords = false
let retryTime = 0
let connected = true
let guestFacing = false // Guest-facing templates hide the title and template chooser
let confirmRecordID = null // The record just made, which shows "Record saved" if it reaches Hub right away

// In preview mode, the template editor sends the template to show, and records aren't saved
const previewMode = new URLSearchParams(window.location.search).has('preview')

// initialize arrays to hold references to each of our types of cards
let counterList = []
let dropdownList = []
let numberList = []
let sliderList = []
let textList = []
let timerList = []

if (previewMode) {
  document.getElementById('previewNotice').style.display = 'block'
  updateTemplateChooser()
  window.addEventListener('message', (event) => {
    // Only the template editor, which is served by this Hub, sends templates
    if (event.origin !== window.location.origin) return
    if (event.data?.type !== 'trackerPreview') return
    showPreviewTemplate(event.data.template)
  })
} else {
  populateLayoutDropdown(await exTracker.getAvailableTemplates())
  setTimeout(parseQueryString, 300)
  setInterval(checkConnection, 500)
  updateWaitingNotice()
}
