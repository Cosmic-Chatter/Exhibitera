/* global swearList */

import * as exCommon from '../../js/exhibitera_app_common.js'
import * as exMarkdown from '../../js/exhibitera_app_markdown.js'

let maxCharacterCount = -1
const Keyboard = window.SimpleKeyboard.default
let keyboard = ''
function AddKeyboardListeners (maxLength) {
  window.addEventListener('keydown', (event) => {
    const input = document.querySelector('#inputField')
    const value = input.value
    if (maxCharacterCount > 0) {
      if (value.length >= maxLength && event.key !== 'Backspace') {
        return
      }
    }
    let newVal = value
    switch (event.key) {
      case 'Backspace':
        newVal = value.slice(0, value.length - 1)
        break
      case 'Meta':
      case 'Control':
      case 'CapsLock':
      case 'Esc':
      case 'Shift':
      case 'Enter':
        break
      case 'Space':
        newVal = value + ' '
        break
      default:
        newVal = value + event.key
    }
    input.value = newVal
    setLengthHint(newVal.length)
  })
}
function setLengthHint (length) {
  if (maxCharacterCount > 0) {
    if (length > 0) {
      document.getElementById('characterCount').innerText = `${length}/${maxCharacterCount}`
    } else {
      document.getElementById('characterCount').innerText = ''
    }
  }
}
function clear () {
  // Clear any text entry

  document.getElementById('inputField').value = ''
  if (keyboard) {
    keyboard.input.default = ''
    keyboard.input.inputField = ''
  }
}

function getCleanText () {
  // Run the profanity checker on the input field

  const profanityCheckingDiv = document.getElementById('profanityCheckingDiv')
  const input = document.getElementById('inputField').value

  $(profanityCheckingDiv).html(input).profanityFilter({ customSwears: swearList, replaceWith: '#' })
  $(profanityCheckingDiv).html($(profanityCheckingDiv).html().replace(/#/g, ''))

  return profanityCheckingDiv.innerHTML.trim()
}

function sendTextToServer () {
  // Send the server the text that the user has inputted
  const text = getCleanText()

  if (exCommon.config.standalone === false) {
    exCommon.makeServerRequest(
      {
        method: 'POST',
        endpoint: '/data/Word_Cloud_' + collectionName + '/rawText',
        params: { text }
      })
      .then((result) => {
        if (result?.success === true) {
          clear()
        }
      })
  } else {
    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/data/Word_Cloud_' + collectionName + '/rawText',
      params: { text }
    })
      .then((result) => {
        if (result?.success === true) {
          clear()
        }
      })
  }
}

function updateFunc (update) {
  // Read updates for word cloud-specific actions and act on them

  // This should be last to make sure the path has been updated
  if (update?.definition !== currentDefintion) {
    currentDefintion = update.definition
    exCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (definition) {
  // Set up a new interface to collect input

  // Parse the settings and make the appropriate changes
  document.getElementById('promptText').innerHTML = exMarkdown.formatText(definition?.content?.prompt ?? '', { removeParagraph: true, string: true })
  collectionName = definition?.behavior?.collection_name ?? 'default'
  maxCharacterCount = definition?.behavior?.max_character_count ?? -1
  let showKeyboard = true

  if (definition?.behavior?.enable_keyboard_input === true) {
    AddKeyboardListeners(maxCharacterCount)
    showKeyboard = false
  }
  if (showKeyboard || exCommon.config.hideKeyboard) {
    // Enable keyboard
    keyboard = new Keyboard({
      onChange: input => onChange(input),
      onKeyPress: button => onKeyPress(button),
      layout: {
        default: [
          'Q W E R T Y U I O P',
          'A S D F G H J K L',
          'Z X C V B N M {bksp}',
          '{space}'
        ]
      },
      maxLength: maxCharacterCount > 0
        ? {
            default: maxCharacterCount
          }
        : {}
    })

    // Localization options
    if (definition?.content?.localization?.placeholder && definition.content.localization.placeholder.trim() !== '') {
      document.getElementById('inputField').placeholder = definition.content.localization.placeholder
    } else {
      document.getElementById('inputField').placeholder = 'Type to enter response'
    }
    if (definition?.content?.localization?.clear && definition.content.localization.clear.trim() !== '') {
      document.getElementById('clearButton').innerHTML = definition.content.localization.clear
    } else {
      document.getElementById('clearButton').innerHTML = 'Clear'
    }
    if (definition?.content?.localization?.submit && definition.content.localization.submit.trim() !== '') {
      document.getElementById('submitButton').innerHTML = definition.content.localization.submit
    } else {
      document.getElementById('submitButton').innerHTML = 'Submit'
    }
    if (definition?.content?.localization?.backspace && definition.content.localization.backspace.trim() !== '') {
      document.querySelector('.hg-button-bksp').querySelector('span').innerHTML = definition.content.localization.backspace
    } else {
      document.querySelector('.hg-button-bksp').querySelector('span').innerHTML = 'backspace'
    }
  }
  const root = document.querySelector(':root')

  // Color settings
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', '#ffffff')
  root.style.setProperty('--prompt-color', '#000')
  root.style.setProperty('--input-color', '#000')
  root.style.setProperty('--input-background-color', '#e9ecef')
  root.style.setProperty('--submit-background-color', '#6c757d')
  root.style.setProperty('--submit-color', '#ffffff')
  root.style.setProperty('--clear-background-color', '#6c757d')
  root.style.setProperty('--clear-color', '#ffffff')
  root.style.setProperty('--keyboard-key-color', '#000')
  root.style.setProperty('--keyboard-key-background-color', '#fff')
  root.style.setProperty('--keyboard-background-color', '#ececec')

  // Then, apply the definition settings
  for (const key of Object.keys(definition?.style?.color ?? {})) {
    const value = definition.style.color[key]
    root.style.setProperty('--' + key + '-color', value)
  }

  // Background settings
  if (definition?.style?.background) {
    exCommon.setBackground(definition.style.background, root, '#fff', true)
  }

  // Font settings
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--prompt-font', 'prompt-default')
  root.style.setProperty('--input-font', 'input-default')
  root.style.setProperty('--submit-font', 'submit-default')
  root.style.setProperty('--clear-font', 'clear-default')

  // Then, apply the definition settings

  for (const key of Object.keys(definition?.style?.font ?? {})) {
    const font = new FontFace(key, 'url(' + encodeURI(definition.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  }

  // Text size settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--prompt-font-adjust', 0)

  // Then, apply the definition settings
  for (const key of Object.keys(definition?.style?.text_size ?? {})) {
    const value = definition.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  }
  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 100)
}

// Add a listener to each input so we direct keyboard input to the right one
document.querySelectorAll('.input').forEach(input => {
  input.addEventListener('focus', onInputFocus)
})
function onInputFocus (event) {
  keyboard?.setOptions({
    inputName: event.target.id
  })
}
function onInputChange (event) {
  keyboard.setInput(event.target.value, event.target.id)
}
function onKeyPress (button) {
  if (button === '{lock}' || button === '{shift}') handleShiftButton()
}
document.querySelector('#inputField').addEventListener('input', event => {
  keyboard?.setInput(event.target.value)
})
function onChange (input) {
  document.querySelector('#inputField').value = input
  setLengthHint(input.length)
}

exCommon.configureApp({
  name: 'word_cloud_input',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

let currentDefintion = ''
let collectionName = 'default'

document.getElementById('clearButton').addEventListener('click', clear)
document.getElementById('submitButton').addEventListener('click', sendTextToServer)
