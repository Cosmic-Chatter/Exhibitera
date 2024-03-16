import * as exTracker from './exhibitera_tracker.js'

class TimingObject {
  // This class is to keep track of elapsed time for the timer input type

  constructor (name, exclusive = false) {
    this.displayName = name
    this.name = name.replace(/\s/g, '') // Strip spaces
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
    button.setAttribute('id', 'TimerStartStopButton_' + this.name)
    button.innerHTML = 'Start'
    const thisName = this.name
    $(button).click(function () {
      getTimer(thisName).toggleTimer()
    })
    col1.appendChild(button)

    const col2 = document.createElement('div')
    col2.classList = 'col-12 col-md-6 mt-2 ps-md-1 pe-md-0'
    row.appendChild(col2)

    const span = document.createElement('span')
    span.classList = 'btn btn-secondary disabled w-100'
    span.setAttribute('id', 'TimerCounterView_' + this.name)
    span.innerHTML = '0 sec'
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
    $('#TimerCounterView_' + this.name).html('0 sec')
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

      $('#TimerStartStopButton_' + this.name).html('Stop')
      $('#TimerStartStopButton_' + this.name).addClass('btn-danger').removeClass('btn-primary')
    }
  }

  stopTimer () {
    // Stop the timer from incrementing and add the accumulated time to
    // elapsedTime

    if (this.timerRunning) {
      const d = new Date()
      const nowTime = d.getTime()
      this.elapsedTime += nowTime - this.startTime

      this.startTime = null
      clearInterval(this.timerInterval)
      this.timerInterval = null
      this.timerRunning = false

      $('#TimerStartStopButton_' + this.name).html('Start')
      $('#TimerStartStopButton_' + this.name).addClass('btn-primary').removeClass('btn-danger')
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
    const displayTime = String(Math.round((nowTime - this.startTime + this.elapsedTime) / 1000)) + ' sec'

    $('#TimerCounterView_' + this.name).html(displayTime)
  }
}

function buildLayout (definition) {
  // Take a layout defition in the form of a dictionary of dictionaries and
  // create cards for each element

  // Clear the exisiting layout
  $('#cardRow').empty()

  // Clear existing references to cards
  counterList = []
  dropdownList = []
  numberList = []
  sliderList = []
  textList = []
  timerList = []

  // Loop the dictionaries in the definition and make a card for each
  const keys = Object.keys(definition)

  for (let i = 0; i < keys.length; i++) {
    const item = definition[keys[i]]
    const itemID = keys[i].replace(/\s/g, '') // Replace spacess, but leave commas
    const itemName = keys[i].replace(/,/g, '') // Replace commas, but leave spaces
    if (!('type' in item)) {
      console.log(`buildLayout: Error: item ${keys[i]} does not have a type!`)
      continue
    }
    // Start the card
    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-6 col-md-6 col-lg-4 mt-2'

    const card = document.createElement('div')
    card.classList = 'card h-100'
    card.setAttribute('data-name', keys[i])
    col.appendChild(card)

    const body = document.createElement('div')
    body.classList = 'card-body'
    card.appendChild(body)

    const title = document.createElement('H2')
    title.classList = 'card-title'
    title.innerHTML = keys[i]
    body.appendChild(title)

    if ('label' in item) {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.setAttribute('for', itemID + '_input')
      label.innerHTML = item.label
      body.appendChild(label)
      // html += `<label for="${itemID}_input">${item.label}</label>`
    }

    const inputGroup = document.createElement('div')
    inputGroup.classList = 'input-group mb-3'
    body.appendChild(inputGroup)

    // html += '<div class="input-group mb-3">'

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
          $(decButton).click(function () {
            incrementCounter(itemID, -1)
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
          counterVal.setAttribute('id', itemID + '_counter')
          counterVal.setAttribute('data-name', itemName)
          counterVal.style.fontSize = '50px'
          counterVal.innerHTML = 0
          flexRow.appendChild(counterVal)

          const counterCol3 = document.createElement('div')
          counterCol3.classList = 'col-4 pe-0 ps-1'
          counterRow.appendChild(counterCol3)

          const incButton = document.createElement('button')
          incButton.classList = 'counter-button btn btn-success w-100'
          incButton.innerHTML = '+'
          $(incButton).click(function () {
            incrementCounter(itemID, 1)
          })
          counterCol3.appendChild(incButton)
        }
        break

      case 'dropdown':
        if ('options' in item) {
          let isMultiple = false
          if ('multiple' in item) {
            if (item.multiple.toLowerCase() === 'true') {
              isMultiple = true
            }
          }

          const select = document.createElement('select')
          inputGroup.appendChild(select)
          select.classList = 'form-select w-100'
          select.setAttribute('id', itemID + '_input')
          if (isMultiple) {
            select.setAttribute('multiple', true)
          }
          select.setAttribute('data-name', itemName)

          // If we do not have a multiple selector, add a blank entry first
          // so that it doesn't look like anything has been selected.
          if (isMultiple === false) {
            const nullOption = document.createElement('option')
            nullOption.value = ''
            select.appendChild(nullOption)
          }

          const split = item.options.split(',')
          for (let j = 0; j < split.length; j++) {
            const value = split[j].trim()
            const option = document.createElement('option')
            option.value = value
            option.innerHTML = value
            select.appendChild(option)
          }
        }
        break

      case 'number':
        {
          const input = document.createElement('input')
          input.setAttribute('type', 'number')
          input.setAttribute('id', itemID + '_input')
          input.setAttribute('data-name', itemName)
          input.classList = 'form-control'
          inputGroup.appendChild(input)
        }
        break

      case 'slider':
        {
          let min, max, step, start
          if ('min' in item) {
            min = item.min
          } else {
            min = 0
          }
          if ('max' in item) {
            max = item.max
          } else {
            max = 100
          }
          if ('step' in item) {
            step = item.step
          } else {
            step = 1
          }
          if ('start' in item) {
            start = item.start
          } else {
            start = Math.round((max - min) / 2)
          }
          const sliderRow = document.createElement('div')
          sliderRow.classList = 'row w-100 mx-0'
          inputGroup.appendChild(sliderRow)

          const col9 = document.createElement('div')
          col9.classList = 'col-9 ps-0'
          sliderRow.appendChild(col9)

          const slider = document.createElement('input')
          slider.setAttribute('type', 'range')
          slider.setAttribute('id', itemID + '_input')
          slider.setAttribute('data-name', itemName)
          slider.setAttribute('data-start', start)
          slider.setAttribute('min', min)
          slider.setAttribute('max', max)
          slider.setAttribute('step', step)
          slider.value = start
          slider.classList = 'w-100'
          $(slider).on('input', function () {
            updateValue(itemID + '_input', itemID + '_input_label')
          })
          col9.appendChild(slider)

          const col3 = document.createElement('div')
          col3.classList = 'col-3 pe-0 text-center'
          sliderRow.appendChild(col3)

          const sliderLabel = document.createElement('span')
          sliderLabel.setAttribute('id', itemID + '_input_label')
          sliderLabel.innerHTML = start
          col3.appendChild(sliderLabel)
        }
        break

      case 'text':
      {
        let rows = 5
        if ('lines' in item) {
          rows = Math.round(item.lines)
        }
        const textArea = document.createElement('textarea')
        textArea.classList = 'form-control w-100'
        textArea.setAttribute('id', itemID + '_input')
        textArea.setAttribute('data-name', itemName)
        textArea.setAttribute('rows', rows)
        inputGroup.appendChild(textArea)
        break
      }

      case 'timer':
      {
        let exclusive = false
        if ('exclusive' in item) {
          if (item.exclusive.toLowerCase() === 'true') {
            exclusive = true
          }
        }
        const timer = new TimingObject(itemName, exclusive)

        inputGroup.appendChild(timer.createWidget())

        timerList.push(timer)
        break
      }
    }

    $('#cardRow').append(col)

    // Store a reference to the appropriate object
    switch (item.type) {
      case 'counter':
        counterList.push(document.getElementById(itemID + '_counter'))
        break
      case 'dropdown':
        dropdownList.push(document.getElementById(itemID + '_input'))
        break
      case 'number':
        numberList.push(document.getElementById(itemID + '_input'))
        break
      case 'slider':
        sliderList.push(document.getElementById(itemID + '_input'))
        break
      case 'text':
        textList.push(document.getElementById(itemID + '_input'))
        break
      case 'timer':
        // We already store this reference in timerList as part of object creation
        break
    }
  }
}

function checkConnection () {
  // Send a message to the server checking that the connection is stable.

  function badConnection () {
    $('#connectionWarning').show()
    $('#recordButton').prop('disabled', true)
  }
  const xhr = new XMLHttpRequest()
  xhr.open('GET', serverIP + '/system/checkConnection', true)
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
        $('#connectionWarning').hide()
        $('#recordButton').prop('disabled', false)
      }
    }
  }
  xhr.send()
}

function clearInput () {
  // Reset all cards back to their initial state

  counterList.forEach(item => {
    item.innerHTML = '0'
  })
  dropdownList.forEach(item => {
    item.value = ''
  })

  numberList.forEach(item => {
    item.value = null
  })

  sliderList.forEach(item => {
    item.value = $(item).data('start')
    document.getElementById(item.id + '_label').innerHTML = $(item).data('start')
  })

  textList.forEach(item => {
    item.value = ''
  })

  timerList.forEach(item => {
    item.resetTimer()
  })
}

function incrementCounter (id, valueToAdd) {
  // Function to add the given number to the counter with the specified id

  const curValue = parseInt($('#' + id + '_counter').html())
  $('#' + id + '_counter').html(curValue + valueToAdd)
}

function getTimer (name) {
  // Get a TimingObject by its name

  const result = timerList.find(obj => {
    return obj.name === name
  })

  return result
}

function sendData () {
  // Collect the current value from each card, build a dictionary, and
  // send it to the control server for storage.

  const resultDict = {}

  // Do timers first to make sure they stop as close to immediately as possible
  timerList.forEach(item => {
    item.stopTimer()
    resultDict[item.displayName] = item.elapsedTime / 1000
  })
  counterList.forEach(item => {
    resultDict[$(item).data('name')] = parseInt(item.innerHTML)
  })
  dropdownList.forEach(item => {
    resultDict[$(item).data('name')] = $(item).val() // To support getting multiple values
  })

  numberList.forEach(item => {
    resultDict[$(item).data('name')] = parseFloat(item.value)
  })

  sliderList.forEach(item => {
    resultDict[$(item).data('name')] = parseFloat(item.value)
  })

  textList.forEach(item => {
    resultDict[$(item).data('name')] = item.value
  })

  // Append the date and time of this recording
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  const dateStr = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1)
  resultDict.Date = dateStr

  const requestDict = {
    data: resultDict,
    name: configurationName
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', serverIP + '/tracker/flexible-tracker/submitData', true)
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

function populateLayoutDropdown (definitionList) {
  // Take a list of layouts and fill up the dropdown list
  definitionList.forEach(item => {
    const name = item.split('.').slice(0, -1).join('.')
    const html = `<option value="${name}">${name}</option>`
    $('#definitionListDropdown').append(html)
  })
}

function loadLayout (toLoad = '') {
  if (toLoad === '') {
    const dropdownName = document.getElementById('definitionListDropdown').value
    if (dropdownName === '') {
      return
    } else {
      toLoad = dropdownName
      configurationName = toLoad
    }
  }
  exTracker.loadLayoutDefinition(toLoad, buildLayout)
}

function parseQueryString () {
  // Read the query string to determine what options to set

  const queryString = decodeURIComponent(window.location.search)

  const searchParams = new URLSearchParams(queryString)

  if (searchParams.has('layout')) {
    const layout = searchParams.get('layout')
    loadLayout(layout)
    configurationName = layout
    $('#definitionListDropdown').val(layout)
    // Clear the query string so it reloads clean on refresh
    history.pushState(null, '', location.href.split('?')[0])
  }
}

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

$('#recordButton').click(sendData)
$('#clearButton').click(clearInput)
$('#definitionListDropdown').change(function () { loadLayout() })

let configurationName = 'test'

// initialize arrays to hold references to each of our types of cards
let counterList = []
let dropdownList = []
let numberList = []
let sliderList = []
let textList = []
let timerList = []

const serverIP = window.location.origin
exTracker.getAvailableDefinitions(populateLayoutDropdown)
setTimeout(parseQueryString, 300)
setInterval(checkConnection, 500)
