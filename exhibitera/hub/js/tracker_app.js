import exConfig from '../../common/config.js'
import * as exTracker from './features/tracker.js'

class TimingObject {
  // This class is to keep track of elapsed time for the timer input type

  constructor (uuid, name, exclusive = false) {
    this.displayName = name
    this.uuid = uuid
    this.exclusive = exclusive // Exclusive timers will stop all other exclusive timers when started
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
    viewEL.innerHTML = formatTime(seconds)
  }
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
    title.innerHTML = item.name
    body.appendChild(title)

    if ('label' in item) {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.setAttribute('for', item.uuid + '_input')
      label.innerHTML = item.label
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
          counterVal.style.fontSize = '50px'
          counterVal.innerHTML = 0
          flexRow.appendChild(counterVal)

          const counterCol3 = document.createElement('div')
          counterCol3.classList = 'col-4 pe-0 ps-1'
          counterRow.appendChild(counterCol3)

          const incButton = document.createElement('button')
          incButton.classList = 'counter-button btn btn-success w-100'
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

        const col9 = document.createElement('div')
        col9.classList = 'col-9 ps-0'
        sliderRow.appendChild(col9)

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
        col9.appendChild(slider)

        const col3 = document.createElement('div')
        col3.classList = 'col-3 pe-0 text-center'
        sliderRow.appendChild(col3)

        const sliderLabel = document.createElement('span')
        sliderLabel.setAttribute('id', item.uuid + '_input_label')
        sliderLabel.innerHTML = start
        col3.appendChild(sliderLabel)
        break
      }

      case 'text':
      {
        const textArea = document.createElement('textarea')
        textArea.classList = 'form-control w-100'
        textArea.setAttribute('id', item.uuid + '_input')
        textArea.setAttribute('data-name', item.name)
        textArea.setAttribute('rows', item?.lines ?? 5)
        inputGroup.appendChild(textArea)
        break
      }

      case 'timer':
      {
        const timer = new TimingObject(item.uuid, item.name, item?.exclusive ?? false)
        inputGroup.appendChild(timer.createWidget())
        timerList.push(timer)
        break
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
  // Disable the interface and show a warning

  document.getElementById('connectionWarning').style.display = 'block'
  document.getElementById('recordButton').setAttribute('disabled', true)
}

function goodConnection () {
  // Hide the warning and enable the interface

  document.getElementById('connectionWarning').style.display = 'none'
  document.getElementById('recordButton').removeAttribute('disabled')
}

function checkConnection () {
  // Send a message to the server checking that the connection is stable.

  const xhr = new XMLHttpRequest()
  xhr.open('GET', exConfig.api + '/system/checkConnection', true)
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

function clearInput () {
  // Reset all cards back to their initial state

  counterList.forEach(item => {
    item.innerHTML = '0'
    item.setAttribute('data-count', '0')
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
    document.getElementById(item.id + '_label').innerHTML = start
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
  const value = parseInt(counterEl.getAttribute('data-count')) + valueToAdd

  counterEl.setAttribute('data-count', value)
  counterEl.innerHTML = value
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

  const resultDict = {}

  // Do timers first to make sure they stop as close to immediately as possible
  timerList.forEach(item => {
    item.stopTimer()
    resultDict[item.displayName] = item.elapsedTime / 1000
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
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  const dateStr = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1)
  resultDict.Date = dateStr

  const requestDict = {
    data: resultDict
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', exConfig.api + '/data/' + configurationName + '/append', true)
  xhr.timeout = 5000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.overrideMimeType('text/plain; charset=x-user-defined')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return
    if (this.status === 200) {
      // Clear the inputs so that we can't double-submit data
      clearInput()
    }
  }
  xhr.send(requestString)
}

function updateValue (fromID, toID) {
  // Read the value property from the element with ID fromID and put the
  // value into the div with toID

  const obj = document.getElementById(fromID)

  document.getElementById(toID).innerHTML = obj.value
}

function populateLayoutDropdown (templateList) {
  // Take a list of layouts and fill up the dropdown list

  const definitionListDropdown = document.getElementById('definitionListDropdown')
  for (const template of templates) {
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
  configurationName = template?.name ?? 'Tracker Data'
  buildLayout(template)

  const definitionListCol = document.getElementById('definitionListCol')
  const titleCol = document.getElementById('titleCol')
  if ((template?.guest_facing ?? false) === true) {
    definitionListCol.style.display = 'none'
    titleCol.style.display = 'none'
  } else {
    definitionListCol.style.display = 'block'
    titleCol.style.display = 'block'
  }
}

async function parseQueryString () {
  // Read the query string to determine what options to set

  const queryString = decodeURIComponent(window.location.search)

  const searchParams = new URLSearchParams(queryString)

  if (searchParams.has('layout')) {
    const layoutUUID = searchParams.get('layout')
    loadLayout(layoutUUID)
    configurationName = layoutUUID
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

document.getElementById('recordButton').addEventListener('click', sendData)
document.getElementById('clearButton').addEventListener('click', clearInput)
document.getElementById('definitionListDropdown').addEventListener('change', () => {
  loadLayout()
})

let configurationName = 'test'

// initialize arrays to hold references to each of our types of cards
let counterList = []
let dropdownList = []
let numberList = []
let sliderList = []
let textList = []
let timerList = []

const templates = await exTracker.getAvailableTemplates()
populateLayoutDropdown(templates)
setTimeout(parseQueryString, 300)
setInterval(checkConnection, 500)
