import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exMarkdown from '../js/exhibitera_app_markdown.js'

async function buildLayout (index) {
  // Take a layout defition in the form of a dictionary of dictionaries and
  // create cards for each element

  updateProgress(index)
  const uuid = currentDefinition.item_order[index]
  const thisItem = currentDefinition.items[uuid]
  const itemPane = document.getElementById('itemPane')

  // Clear the exisiting layout
  itemPane.style.height = 0
  itemPane.style.marginTop = '30vh'
  itemPane.style.opacity = 0
  itemPane.style.paddingTop = 0
  itemPane.style.paddingBottom = 0
  await sleep(500)
  itemPane.innerText = ''

  if (['single_vote', 'multiple_vote'].includes(thisItem.type)) {
    buildLayoutVote(index)
  } else if (thisItem.type === 'text') {
    buildLayoutText(index)
  }

  itemPane.style.height = '100%'
  itemPane.style.marginTop = 0
  itemPane.style.opacity = 1
  await sleep(500)
}

function buildLayoutVote (index) {
  // Build the layout for a voting question

  const uuid = currentDefinition.item_order[index]
  const thisItem = currentDefinition.items[uuid]
  const options = currentDefinition.items[uuid].option_order
  const itemPane = document.getElementById('itemPane')

  const question = document.createElement('div')
  question.classList = 'text-center question'
  question.innerText = thisItem.question.text
  itemPane.appendChild(question)

  let nCols
  if ('num_columns' in currentDefinition.style.layout) {
    if (currentDefinition.style.layout.num_columns !== 'auto') {
      nCols = parseInt(currentDefinition.style.layout.num_columns)
    } else {
      nCols = calculateButtonRows(options)
    }
  } else {
    nCols = calculateButtonRows(options)
  }

  const nRows = Math.ceil(options.length / nCols)
  const rowClass = 'row-cols-' + String(nCols)

  const cardRow = document.createElement('div')
  cardRow.setAttribute('id', 'cardRow')
  cardRow.classList = 'row w-100 mx-0 align-items-center d-flex justify-content-center ' + rowClass
  itemPane.appendChild(cardRow)

  // Iterate through the buttons and build their HTML
  for (const option of options) {
    const buttonDef = thisItem.options[option]
    // Get a string for the column name, in order of preference
    const value = buttonDef?.value || buttonDef?.text || option

    const div = document.createElement('div')
    div.classList = 'button-col mx-0 px-1 col'
    div.addEventListener('click', function () { buttonTouched(div, value, index) })
    cardRow.appendChild(div)

    const card = document.createElement('div')
    card.classList = 'card card-inactive mb-0 h-100 justify-content-center'
    card.dataset.value = value
    div.appendChild(card)

    if ('icon' in buttonDef && buttonDef.icon.trim() !== '') {
      const img = document.createElement('img')
      if (buttonDef.icon === 'user') {
        img.src = getIcon(buttonDef.icon_user_file)
      } else {
        // The user has selected one of the provided icons
        img.src = getIcon(buttonDef.icon)
      }
      img.classList = 'card-img-top'
      card.appendChild(img)
    }

    if (buttonDef.text && buttonDef.text.trim() !== '') {
      const text = document.createElement('div')
      text.classList = 'd-flex align-items-center justify-content-center'
      card.appendChild(text)

      const title = document.createElement('div')
      title.classList = 'card-title my-0 noselect'

      title.innerHTML = exMarkdown.formatText(buttonDef.text, { removeParagraph: true, string: true })
      text.append(title)
    }
  }

  // Make sure all the buttons are the same height
  const height = Math.floor((100 - nRows) / nRows)
  const buttonCols = document.querySelectorAll('.button-col')
  for (const el of buttonCols) {
    el.style.height = `${height}%`
  }

  if (thisItem.type === 'multiple_vote') {
    const nextButton = document.createElement('button')
    nextButton.innerHTML = thisItem?.next_button?.text ?? 'Next'
    nextButton.classList = 'btn btn-success noselect next-button disabled'
    nextButton.style.opacity = 0
    nextButton.addEventListener('click', () => {
      nextButtonTouched(index)
    })
    itemPane.appendChild(nextButton)
  }
}

function buildLayoutText (index) {
  // Build the GUI for a text panel.

  const uuid = currentDefinition.item_order[index]
  const thisItem = currentDefinition.items[uuid]
  const itemPane = document.getElementById('itemPane')

  const header = document.createElement('div')
  header.classList = 'text-center question'
  header.innerHTML = thisItem?.header?.text ?? ''
  itemPane.appendChild(header)

  const body = document.createElement('div')
  body.classList = 'card-text'
  body.innerHTML = thisItem?.body?.text ?? ''
  body.style.height = '100%'
  itemPane.appendChild(body)

  const nextButton = document.createElement('button')
  nextButton.innerHTML = thisItem?.next_button?.text ?? 'Next'
  nextButton.classList = 'btn btn-success noselect next-button'
  nextButton.addEventListener('click', () => {
    nextButtonTouched(index)
  })
  itemPane.appendChild(nextButton)
}

function updateProgress (index) {
  // Update the progress indicator to show the current progress

  const dots = document.querySelectorAll('.survey-dot')
  for (const dot of dots) dot.classList.remove('active')

  dots[index].classList.add('active')
}

function sleep (ms) {
  // Basic sleep function

  return new Promise(resolve => setTimeout(resolve, ms))
}

function getIcon (name) {
  // If the given name is a shortcut, return the full filepath.
  // Otherwise, assume the file is user-supplied and return the name as passed.

  if (['1-star_black', '2-star_black', '3-star_black', '4-star_black', '5-star_black', '1-star_white', '2-star_white', '3-star_white', '4-star_white', '5-star_white'].includes(name)) {
    return '../_static/icons/' + name + '.png'
  } else if (['thumbs-down_black', 'thumbs-down_red', 'thumbs-down_white', 'thumbs-up_black', 'thumbs-up_green', 'thumbs-up_white'].includes(name)) {
    return '../_static/icons/' + name + '.svg'
  } else {
    return 'content/' + name
  }
}

function calculateButtonRows (buttons) {
  // Choose a sensible number of buttons for the given orientation and button count

  if (window.innerHeight <= window.innerWidth) {
    if (buttons.length <= 6) {
      return buttons.length
    } else {
      return 4
    }
  } else {
    if (buttons.length <= 6) {
      return 1
    } else {
      return 2
    }
  }
}

function buttonTouched (button, name, index) {
  // Respond to the touch of a button by changing color, logging the response,
  // and moving to the next question
  // button is the DOM element of the touched button
  // name is the name of the data column
  // index is the index of the current question
  // lastItem is a boolean value for whether this was the last question

  const uuid = currentDefinition.item_order[index]
  const lastItem = index === currentDefinition.item_order.length - 1
  const thisItem = currentDefinition.items[uuid]
  const itemPane = document.getElementById('itemPane')

  setActive()

  const card = button.querySelector('.card')
  card.classList.toggle('card-inactive')
  card.classList.toggle('card-active')

  if (thisItem.type === 'single_vote') {
    setTimeout(() => {
      card.classList.toggle('card-active')
      card.classList.toggle('card-inactive')
    }, 500)
    response[thisItem.value] = name
    if (lastItem === false) buildLayout(index + 1)
  } else {
    // Enable/disable the next button
    const nextButton = itemPane.querySelector('.next-button')
    if (itemPane.querySelectorAll('.card-active').length > 0) {
      nextButton.classList.remove('disabled')
      nextButton.style.opacity = 1
    } else {
      nextButton.classList.add('disabled')
      nextButton.style.opacity = 0
    }
  }
}

function nextButtonTouched (index) {
  // Handle a next button being touched

  const uuid = currentDefinition.item_order[index]
  const lastItem = index === currentDefinition.item_order.length - 1
  const thisItem = currentDefinition.items[uuid]
  const itemPane = document.getElementById('itemPane')

  if (thisItem.type === 'multiple_vote') {
    const selected = itemPane.querySelectorAll('.card-active')
    const answers = []
    for (const el of selected) answers.push(el.dataset.value)
    response[thisItem.value] = answers
    console.log(response)
  }
  if (lastItem === false) buildLayout(index + 1)
}

function setActive () {
  exCommon.config.currentInteraction = true
  const reset = function () {
    exCommon.config.currentInteraction = false
  }
  setTimeout(reset, 10000)
}

function checkConnection () {
  // Send a message to the server checking that the connection is stable.

  if (exCommon.config.standalone === true) {
    badConnection = false
    return
  }

  const connectionWarning = document.getElementById('connectionWarning')

  exCommon.makeServerRequest(
    {
      method: 'GET',
      endpoint: '/system/checkConnection'
    })
    .then(() => {
      connectionWarning.style.display = 'none'
      badConnection = false
    })
    .catch(() => {
      if (exCommon.config.debug) {
        connectionWarning.style.display = 'flex'
      }
      badConnection = true
    })
}

function updateFunc (update) {
  // Read updates for survey kiosk-specific actions and act on them

  if (update.definition && update.definition !== currentDefintionUUID) {
    currentDefintionUUID = update.definition
    exCommon.loadDefinition(currentDefintionUUID)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (definition) {
  // Clean up the old survey, then create the new one.

  // If there are responses left for the old survey, make sure they are recorded
  sendData()
  currentDefinition = definition
  console.log(currentDefinition)
  configurationName = definition.name

  response = {}

  // Parse the settings and make the appropriate changes

  inactivityTimeout = parseFloat(definition?.behavior?.inactivity_timeout ?? 10) * 1000

  // Text settings
  for (const item of ['success_message']) {
    const text = definition?.text?.[item] ?? ''
    const col = document.getElementById(item + 'Col')
    const el = document.getElementById(item)
    if (text !== '') {
      if (item !== 'success_message') {
        col.style.display = 'block'
        el.innerHTML = exMarkdown.formatText(text, { removeParagraph: true, string: true })
      } else {
        document.getElementById('successMessageBody').innerHTML = exMarkdown.formatText(text, { removeParagraph: true, string: true })
      }
    } else {
      if (item !== 'success_message') {
        col.style.display = 'none'
      }
    }
  }

  // Color settings
  const root = document.querySelector(':root')

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', '#22222E')
  root.style.setProperty('--button-color', '#393A5A')
  root.style.setProperty('--button-touched-color', '#706F8E')
  root.style.setProperty('--success-message-color', '#393A5A')
  root.style.setProperty('--header-color', 'white')
  root.style.setProperty('--footer-color', 'white')
  root.style.setProperty('--button-text-color', 'white')

  // Then, apply the definition settings

  // Color settings
  for (const key of Object.keys(definition.style.color)) {
    const value = definition.style.color[key]
    root.style.setProperty('--' + key, value)
  }

  // Backgorund settings
  if ('background' in definition.style) {
    exCommon.setBackground(definition.style.background, root, '#22222E', true)
  }

  // Font settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--header-font', 'header-default')
  root.style.setProperty('--footer-font', 'footer-default')
  root.style.setProperty('--button-font', 'button-default')

  // Then, apply the definition settings
  for (const key of Object.keys(definition.style.font)) {
    const font = new FontFace(key, 'url(' + encodeURI(definition.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  }

  // Text size settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--header-font-adjust', 0)
  root.style.setProperty('--footer-font-adjust', 0)
  root.style.setProperty('--button-font-adjust', 0)

  // Then, apply the definition settings
  for (const key of Object.keys(definition.style.text_size)) {
    const value = definition.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  }

  // Behavior settings
  const topRow = document.getElementById('topRow')
  const itemDiv = document.getElementById('itemDiv')
  const bottomRow = document.getElementById('bottomRow')

  // topRow.style.height = String(definition?.style?.layout?.top_height ?? 20) + 'vh'
  // topRow.style.paddingTop = String(definition?.style?.layout?.header_padding ?? 5) + 'vh'
  // itemDiv.style.height = String(definition?.style?.layout?.button_height ?? 90) + 'vh'
  // itemDiv.style.paddingTop = String((definition?.style?.layout?.button_padding ?? 5) / 2) + 'vh'
  // itemDiv.style.paddingBottom = String((definition?.style?.layout?.button_padding ?? 5) / 2) + 'vh'
  // bottomRow.style.height = String(definition?.style?.layout?.bottom_height ?? 10) + 'vh'
  // bottomRow.style.paddingBottom = String(definition?.style?.layout?.footer_padding ?? 2) + 'vh'
  root.style.setProperty('--image-height', String(definition?.style?.layout?.image_height ?? 90))

  // Create tne progress indicators
  const progressIndicator = document.getElementById('progressIndicator')
  progressIndicator.innerText = ''
  for (let i = 0; i < definition.item_order.length; i++) {
    const dot = document.createElement('div')
    dot.classList = 'survey-dot'
    progressIndicator.appendChild(dot)
  }

  // Set icon colors based on the background color.
  let backgroundClassification = 'dark'
  try {
    const backgroundColor = exCommon.getColorAsRGBA(document.body, 'background')
    backgroundClassification = exCommon.classifyColor(backgroundColor)
  } catch (e) {

  }

  if (backgroundClassification === 'light') {
    document.getElementById('langSwitchDropdownIcon').src = '/_static/icons/translation-icon_black.svg'
  } else {
    document.getElementById('langSwitchDropdownIcon').src = '/_static/icons/translation-icon_white.svg'
  }

  exCommon.createLanguageSwitcher(definition, localize)

  buildLayout(0)

  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 100)
}

function localize () {

}

function sendData () {
  // Collect the current value from each card, build a dictionary, and
  // send it for storage.

  // If there is nothing to send, bail out
  if (Object.keys(response).length === 0) return

  if (exCommon.config.debug) {
    console.log('Sending data...')
  }
  if (badConnection) {
    if (exCommon.config.debug) {
      console.log('Error: bad connection. Will not attempt to send data.')
    }
    return
  }

  // Append the date and time of this recording
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  const dateStr = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1)
  response.Date = dateStr

  const requestDict = {
    data: response
  }

  // Submit the data to Hub or the helper, depending on if we're standalone
  if (exCommon.config.standalone === true) {
    exCommon.makeHelperRequest(
      {
        method: 'POST',
        endpoint: '/data/' + configurationName + '/append',
        params: requestDict
      })
      .then(() => {
        response = {}
      })
  } else {
    exCommon.makeServerRequest(
      {
        method: 'POST',
        endpoint: '/data/' + configurationName + '/append',
        params: requestDict
      })
      .then(() => {
        response = {}
      })
  }
}

function restartSession () {
  // Discard any response and restart to the beginning of the survey.

  clearTimeout(inactivityTimer)
  clearTimeout(restartTimer)
  response = {}
  exUtilities.hideModal('#inactivityModal')
  buildLayout(0)
}

function showInactivityWarning () {
  // SHow a popup checking if the user is still working

  exUtilities.showModal('#inactivityModal')
  restartTimer = setTimeout(restartSession, restartTimeout)
}

function resetActivityTimer () {
  // Cancel the existing activity timer and set a new one

  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showInactivityWarning, inactivityTimeout)
}

function showSuccessMessage () {
  // Animate the success message to briefly appear

  const successMessage = document.getElementById('successMessage')

  // Show the element and set initial opacity
  successMessage.style.display = 'flex'
  successMessage.style.opacity = 0

  // Fade in
  requestAnimationFrame(() => {
    successMessage.style.transition = 'opacity 100ms'
    successMessage.style.opacity = 1

    // Delay before fade out
    setTimeout(() => {
      successMessage.style.transition = 'opacity 1000ms'
      successMessage.style.opacity = 0

      // After fade out, hide the element
      setTimeout(() => {
        successMessage.style.display = 'none'
      }, 1000) // match fade-out duration
    }, 500) // initial delay after fade-in
  })
}

// Disable pinch-to-zoom for browsers the ignore the viewport setting
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) {
    e.preventDefault()
  }
}, { passive: false })

document.addEventListener('wheel', function (e) {
  if (e.ctrlKey) {
    e.preventDefault()
  }
}, { passive: false })

exCommon.configureApp({
  name: 'survey_kiosk',
  debug: true,
  checkConnection,
  loadDefinition,
  parseUpdate: updateFunc
})

let badConnection = false

// Detect when a user is no longer interacting
let inactivityTimer = null
let inactivityTimeout = 10000 // ms

// How long to prompt an inactive user before restarting the session
let restartTimer = null
const restartTimeout = 5000 // ms

let configurationName = 'default'
let currentDefinition = {}
let currentDefintionUUID = ''
let response = {}

setInterval(exCommon.checkForHelperUpdates, 1000)

// Bind event listeners

document.getElementById('restartButton').addEventListener('click', (ev) => {
  clearTimeout(inactivityTimer)
  ev.stopPropagation() // So we don't trigger the inactivity timer
  restartSession()
})
document.getElementById('inactivityRestartButton').addEventListener('click', (ev) => {
  clearTimeout(inactivityTimer)
  ev.stopPropagation() // So we don't trigger the inactivity timer
  clearTimeout(restartTimer)
  restartSession()
})
document.getElementById('inactivityContinueButton').addEventListener('click', () => {
  clearTimeout(restartTimer)
})
document.getElementById('inactivityModal').addEventListener('hide.bs.modal', () => {
  clearTimeout(restartTimer)
})
document.body.addEventListener('click', resetActivityTimer)
