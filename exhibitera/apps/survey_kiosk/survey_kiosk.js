/* global textFit */

import exConfig from '../../common/config.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exMarkdown from '../js/exhibitera_app_markdown.js'

async function buildLayout (index) {
  // Take a layout definition in the form of a dictionary of dictionaries and
  // create cards for each element

  if (index > currentDefinition.item_order.length - 1) return
  currentIndex = index
  updateProgress(index)
  const uuid = currentDefinition.item_order[index]
  const thisItem = currentDefinition.items[uuid]
  const itemPane = document.getElementById('itemPane')

  // Clear the exisiting layout
  itemPane.style.height = 0
  itemPane.style.marginTop = '45vh'
  itemPane.style.opacity = 0
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
  const thisItem = currentDefinition?.items?.[uuid] ?? {}
  const options = currentDefinition?.items?.[uuid]?.option_order ?? []
  const itemPane = document.getElementById('itemPane')

  if (thisItem?.randomize_options ?? false) {
    // Shuffle the array
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // Swap elements i and j
      [options[i], options[j]] = [options[j], options[i]]
    }
  }

  const questionDiv = document.createElement('div')
  questionDiv.classList = 'text-center question d-flex align-items-center justify-content-center'
  itemPane.appendChild(questionDiv)

  const question = document.createElement('div')
  question.innerHTML = exMarkdown.formatText(currentDefinition.languages?.[currentLang]?.items?.[uuid]?.header?.text ?? '', { string: true, removeParagraph: true })
  questionDiv.appendChild(question)

  let nCols
  if ((thisItem?.num_columns ?? 'auto') !== 'auto') {
    nCols = parseInt(thisItem.num_columns)
  } else {
    nCols = calculateButtonRows(options)
  }

  const nRows = Math.ceil(options.length / nCols)
  const rowClass = 'row-cols-' + String(nCols)

  const cardRow = document.createElement('div')
  cardRow.setAttribute('id', 'cardRow')
  cardRow.classList = 'row w-100 mx-0 align-items-center d-flex justify-content-center ' + rowClass
  itemPane.appendChild(cardRow)

  // The layout of the card will depend on whether any of the options
  // have an image/icon or text. So, first, iterate through and check
  let imagePresent = false
  let textPresent = false

  for (const option of options) {
    const buttonDef = thisItem.options[option]
    const buttonLang = currentDefinition.languages?.[currentLang]?.items?.[uuid]?.options?.[option]
    if ((buttonDef?.icon ?? '') !== '') imagePresent = true
    if ((buttonLang?.text ?? '').trim() !== '') textPresent = true
  }

  // Iterate through the buttons and build their HTML
  for (const option of options) {
    const buttonDef = thisItem.options[option]
    const buttonLang = currentDefinition.languages?.[currentLang]?.items?.[uuid]?.options?.[option]
    const thisTextPresent = (buttonLang?.text ?? '').trim() !== ''

    // Get a string for the column name, in order of preference
    const value = buttonDef?.value || buttonLang?.text || option

    const div = document.createElement('div')
    div.classList = 'button-col mx-0 px-1 col'
    div.addEventListener('click', function () { buttonTouched(div, value, index) })
    cardRow.appendChild(div)

    const card = document.createElement('div')
    card.classList = 'option option-inactive h-100 d-flex flex-column align-items-center'
    if (imagePresent) {
      if (thisTextPresent) {
        card.classList.add('justify-content-end')
      } else card.classList.add('justify-content-center')
    } else card.classList.add('justify-content-center')
    card.dataset.value = value
    if (buttonDef.background) {
      exCommon.setELementBackground(buttonDef.background, card)
    }
    div.appendChild(card)

    if ((buttonDef?.icon ?? '') !== '') {
      const imgDiv = document.createElement('div')
      imgDiv.classList = 'option-image-container'

      const imgDiv2 = document.createElement('div')
      imgDiv2.classList = 'h-100 d-flex justify-content-center'
      imgDiv.appendChild(imgDiv2)

      const img = document.createElement('img')
      img.classList = 'option-image'
      imgDiv2.appendChild(img)
      if (buttonDef.icon === 'user') {
        img.src = getIcon(buttonDef.icon_user_file)
      } else {
        // The user has selected one of the provided icons
        img.src = getIcon(buttonDef.icon)
      }
      if (textPresent) {
        imgDiv.style.height = '60%'
      } else imgDiv.style.height = '80%'
      card.appendChild(imgDiv)
    }

    if (thisTextPresent) {
      const text = document.createElement('div')
      text.classList = 'd-flex align-items-center justify-content-center w-100'
      card.appendChild(text)

      const title = document.createElement('div')
      title.classList = 'option-text noselect'

      if (imagePresent) {
        text.style.height = '20%'
        title.style.height = '8.3vmin'
      } else {
        text.style.height = '100%'
      }

      title.innerHTML = exMarkdown.formatText(buttonLang.text, { removeParagraph: true, string: true })
      text.appendChild(title)
    }
  }

  // Adjust button text font size to avoid overflows
  // Don't allow text to get larger than wha the user has set.
  const optionTexts = document.getElementsByClassName('option-text')
  if (optionTexts.length > 0) {
    const fontSize = parseFloat(window.getComputedStyle(optionTexts[0], null).getPropertyValue('font-size'))
    try {
      textFit(optionTexts, { maxFontSize: fontSize })
      // Sometimes need to run twice on first load
      setTimeout(() => {
        textFit(optionTexts, { maxFontSize: fontSize })
      }, 10)
    } catch {
      console.log('textFit: resize failed')
      // Ignore failed resize
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
    nextButton.innerHTML = currentDefinition.languages?.[currentLang]?.items?.[uuid]?.next_button?.text ?? 'Next'
    nextButton.classList = 'btn noselect next-button disabled'
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
  const item = currentDefinition.items[uuid]
  const itemPane = document.getElementById('itemPane')

  const header = document.createElement('div')
  header.classList = 'text-center question'
  header.innerHTML = exMarkdown.formatText(currentDefinition.languages?.[currentLang]?.items?.[uuid]?.header?.text ?? '', { string: true, removeParagraph: true })
  itemPane.appendChild(header)

  const body = document.createElement('div')
  body.classList = 'card-text text-item'
  const bodyText = exMarkdown.formatText(currentDefinition.languages?.[currentLang]?.items?.[uuid]?.body?.text ?? '')
  exMarkdown.formatMarkdownImages(bodyText)
  body.appendChild(bodyText)

  if ((item?.text_position ?? 'top') === 'top') body.style.height = '100%'
  itemPane.appendChild(body)

  if ((item?.end_screen ?? false) === false) {
    const nextButton = document.createElement('button')
    nextButton.innerHTML = currentDefinition.languages?.[currentLang]?.items?.[uuid]?.next_button?.text || 'Next' // Convert empty string '' to 'Next' too
    nextButton.classList = 'btn noselect next-button'
    nextButton.addEventListener('click', () => {
      nextButtonTouched(index)
    })
    itemPane.appendChild(nextButton)
  } else {
    sendData()
    setTimeout(restartSession, parseFloat(item?.end_screen_duration ?? '3') * 1000)
  }
}

function updateProgress (index) {
  // Update the progress indicator to show the current progress

  const dots = document.querySelectorAll('.survey-dot')
  if (dots.length === 0) return
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
    return '/_static/icons/' + name + '.png'
  } else if (['thumbs-down_black', 'thumbs-down_red', 'thumbs-down_white', 'thumbs-up_black', 'thumbs-up_green', 'thumbs-up_white'].includes(name)) {
    return '/_static/icons/' + name + '.svg'
  } else {
    // Get a thumbnail for performance reasons. Assume the icon will never be
    // more than half the width of the display.
    const width = Math.round(window.innerWidth * window.devicePixelRatio / 2)
    return exConfig.api + '/files/' + name + '/thumbnail/' + String(width)
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
  // Respond to the touch of a button by logging the response
  // and moving to the next question.
  //
  // `button` is the DOM element of the touched button
  // `name` is the name of the data column
  // `index` is the index of the current question

  setActive()

  const uuid = currentDefinition.item_order[index]
  const lastItem = index === currentDefinition.item_order.length - 1
  const thisItem = currentDefinition.items[uuid]
  const itemPane = document.getElementById('itemPane')

  const questionText = currentDefinition.languages[currentDefinition.language_order[0]]?.items[thisItem.uuid]?.header?.text
  const itemValue = thisItem?.value || questionText || thisItem.uuid

  if (thisItem.type === 'single_vote') {
    response[itemValue] = name
    if (lastItem === false) {
      buildLayout(index + 1)
    } else {
      sendData()
      restartSession()
    }
  } else {
    const card = button.querySelector('.option')
    card.classList.toggle('option-inactive')
    card.classList.toggle('option-active')

    // Enable/disable the next button
    const nextButton = itemPane.querySelector('.next-button')
    if (itemPane.querySelectorAll('.option-active').length > 0) {
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

  setActive()

  const uuid = currentDefinition.item_order[index]
  const lastItem = index === currentDefinition.item_order.length - 1
  const thisItem = currentDefinition.items[uuid]
  const itemPane = document.getElementById('itemPane')

  const questionText = currentDefinition.languages[currentDefinition.language_order[0]]?.items[thisItem.uuid]?.header?.text
  const itemValue = thisItem?.value || questionText || thisItem.uuid

  if (thisItem.type === 'multiple_vote') {
    const selected = itemPane.querySelectorAll('.option-active')
    const answers = []
    for (const el of selected) answers.push(el.dataset.value)
    response[itemValue] = answers
  }
  if (lastItem === false) {
    buildLayout(index + 1)
  } else {
    sendData()
    restartSession()
  }
  console.log(response)
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

}

function loadDefinition (definition) {
  // Clean up the old survey, then create the new one.

  currentDefinition = definition
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
  root.style.setProperty('--background-color', '#0f1419')
  root.style.setProperty('--item_background', '#2f3e4f')
  root.style.setProperty('--button-color', '#1a2b3c')
  root.style.setProperty('--next-button-color', '#e06a47')
  root.style.setProperty('--restart-button-color', '#4b5563')
  root.style.setProperty('--body-text-color', '#e6e6e2')
  root.style.setProperty('--button-selected-color', '#e06a47')
  root.style.setProperty('--header-color', '#e6e6e2')
  root.style.setProperty('--button-text-color', '#e6e6e2')
  root.style.setProperty('--next-button-text-color', '#f5f5f0')
  root.style.setProperty('--restart-button-text-color', '#f5f5f0')
  root.style.setProperty('--active-dot-color', '#e06a47')
  root.style.setProperty('--inactive-dot-color', '#4b5563')

  // Then, apply the definition settings

  // Color settings
  for (const key of Object.keys(definition.style.color)) {
    const value = definition.style.color[key]
    root.style.setProperty('--' + key, value)
  }

  // Backgorund settings
  if ('background' in definition.style) {
    exCommon.setBackground(definition.style.background, root, '#0f1419', true)
  }
  if ('item_background' in definition.style) {
    exCommon.setELementBackground(definition.style.item_background, document.getElementById('itemPane'), '#2f3e4f')
  }

  // Font settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--header-font', 'header-default')
  root.style.setProperty('--body-font', 'body-default')
  root.style.setProperty('--button-font', 'button-default')
  root.style.setProperty('--next-font', 'next-default')

  // Then, apply the definition settings
  for (const key of Object.keys(definition.style.font)) {
    const font = new FontFace(key, 'url(' + encodeURI(definition.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  }

  // Text size settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--header-font-adjust', 0)
  root.style.setProperty('--button-font-adjust', 0)

  // Then, apply the definition settings
  for (const key of Object.keys(definition.style.text_size)) {
    const value = definition.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  }

  // Layout settings
  root.style.setProperty('--image-height', String(definition?.style?.layout?.image_height ?? 90))
  root.style.setProperty('--text-margin', String(definition?.style?.layout?.text_margin ?? 10))

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

  localize(definition.language_order[0])

  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 100)
}

function localize (lang) {
  // Update the GUi to reflect the given language

  currentLang = lang
  exCommon.configureLanguage(lang)
  buildLayout(currentIndex)
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
    method: 'POST',
    endpoint: '/data/' + configurationName + '/append',
    params: { data: response }
  }

  // Submit the data to Hub or the helper, depending on if we're standalone
  if (exCommon.config.standalone === true) {
    exCommon.makeHelperRequest(requestDict)
      .then(() => {
        response = {}
      })
  } else {
    exCommon.makeServerRequest(requestDict)
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
  currentLang = currentDefinition.language_order[0]
  currentIndex = 0
  localize(currentLang)
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
let currentLang = ''
let currentIndex = 0
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
