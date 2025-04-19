/* global Coloris */

import * as exCommon from '../js/exhibitera_app_common.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'

async function initializeWizard () {
  // Setup the wizard

  await exSetup.initializeDefinition()

  // Hide all but the welcome screen
  Array.from(document.querySelectorAll('.wizard-pane')).forEach((el) => {
    el.style.display = 'none'
  })
  document.getElementById('wizardPane_Welcome').style.display = 'block'

  // Reset fields
  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
  document.getElementById('wizardCollection').value = ''
  document.getElementById('wizardCollectionBlankWarning').style.display = 'none'
  document.getElementById('wizardQuestion').value = ''
}

async function wizardForward (currentPage) {
  // Check if the wizard is ready to advance and perform the move

  if (currentPage === 'Welcome') {
    const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
    if (defName !== '') {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
      wizardGoTo('Question')
    } else {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'block'
    }
  } if (currentPage === 'Question') {
    wizardGoTo('Collection')
  } if (currentPage === 'Collection') {
    const collection = document.getElementById('wizardCollection').value.trim()
    if (collection !== '') {
      document.getElementById('wizardCollectionBlankWarning').style.display = 'none'
      wizardCreateDefinition()
    } else {
      document.getElementById('wizardCollectionBlankWarning').style.display = 'block'
    }
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Question') {
    wizardGoTo('Welcome')
  } else if (currentPage === 'Collection') {
    wizardGoTo('Question')
  }
}

function wizardGoTo (page) {
  Array.from(document.querySelectorAll('.wizard-pane')).forEach((el) => {
    el.style.display = 'none'
  })
  document.getElementById('wizardPane_' + page).style.display = 'block'
}

async function wizardCreateDefinition () {
  // Use the provided details to build a definition file.

  // Definition name
  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
  exSetup.updateWorkingDefinition(['name'], defName)

  // Prompt
  const prompt = document.getElementById('wizardQuestion').value.trim()
  exSetup.updateWorkingDefinition(['content', 'prompt'], prompt)

  // Collection
  const collection = document.getElementById('wizardCollection').value.trim()
  exSetup.updateWorkingDefinition(['behavior', 'collection_name'], collection)

  const uuid = $('#definitionSaveButton').data('workingDefinition').uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('word_cloud_input')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exSetup.hideModal('#setupWizardModal')
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
    await exSetup.initializeDefinition()
  }

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('collectionNameInput').value = ''
  document.getElementById('enableKeyboardInput').checked = false
  document.getElementById('maxCharacterCount').value = '-1'

  // Content details
  const editor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: '',
    editorDiv: document.getElementById('promptInput'),
    commandDiv: document.getElementById('promptInputCommandBar'),
    commands: ['basic'],
    callback: (content) => {
    }
  })
  Array.from(document.querySelectorAll('.localization-input')).forEach((el) => {
    el.value = ''
  })

  // Attractor details
  // document.getElementById('attractorInput_attractor_timeout').value = 30

  // Reset color options
  const colorInputs = ['input', 'input-background', 'submit', 'submit-background', 'clear', 'clear-background', 'prompt', 'keyboard-key', 'keyboard-key-background', 'keyboard-background']
  colorInputs.forEach((input) => {
    const el = $('#colorPicker_' + input)
    el.val(el.data('default'))
    document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
  })
  exSetup.updateAdvancedColorPicker('appearance>background', {
    mode: 'color',
    color: '#fff',
    gradient_color_1: '#fff',
    gradient_color_2: '#fff'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()

  document.getElementById('promptTextSizeSlider').value = 0
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  document.getElementById('definitionNameInput').value = def.name
  document.getElementById('collectionNameInput').value = def?.behavior?.collection_name ?? ''
  document.getElementById('enableKeyboardInput').checked = def?.behavior?.enable_keyboard_input ?? false
  document.getElementById('maxCharacterCount').value = def?.behavior?.max_character_count ?? -1

  // Content
  const editor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: def?.content?.prompt ?? '',
    editorDiv: document.getElementById('promptInput'),
    commandDiv: document.getElementById('promptInputCommandBar'),
    commands: ['basic'],
    callback: (content) => {
      exSetup.updateWorkingDefinition(['content', 'prompt'], content)
      exSetup.previewDefinition(true)
    }
  })

  Array.from(document.querySelectorAll('.localization-input')).forEach((el) => {
    const property = el.getAttribute('data-property')
    if (property in def.content.localization) el.value = def.content.localization[property]
  })

  // Set the appropriate values for the attractor fields

  // Set the appropriate values for the color pickers
  if ('color' in def.appearance) {
    Object.keys(def.appearance.color).forEach((key) => {
      $('#colorPicker_' + key).val(def.appearance.color[key])
      document.querySelector('#colorPicker_' + key).dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  // Set the appropriate values for any advanced color pickers
  if ('background' in def.appearance) {
    exSetup.updateAdvancedColorPicker('appearance>background', def.appearance.background)
  }

  // Set the appropriate values for the advanced font pickers
  if ('font' in def.appearance) {
    Object.keys(def.appearance.font).forEach((key) => {
      const picker = document.querySelector(`.AFP-select[data-path="appearance>font>${key}"`)
      exSetup.setAdvancedFontPicker(picker, def.appearance.font[key])
    })
  }

  if ('text_size' in def.appearance) {
    if ('prompt' in def.appearance.text_size) {
      document.getElementById('promptTextSizeSlider').value = def.appearance.text_size.prompt
    }
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../word_cloud_input.html?standalone=true&definition=' + def.uuid
  exSetup.previewDefinition()
}

// Set up the color pickers
function setUpColorPickers () {
  Coloris({
    el: '.coloris',
    theme: 'pill',
    themeMode: 'dark',
    formatToggle: false,
    clearButton: false,
    swatches: [
      '#000',
      '#22222E',
      '#393A5A',
      '#719abf',
      '#fff'
    ]
  })
}

// Set helperAddress for calls to exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// Call with a slight delay to make sure the elements are loaded
setTimeout(setUpColorPickers, 100)

// Add event listeners
// -------------------------------------------------------------

// Wizard

// Connect the forward and back buttons
Array.from(document.querySelectorAll('.wizard-forward')).forEach((el) => {
  el.addEventListener('click', () => {
    wizardForward(el.getAttribute('data-current-page'))
  })
})
Array.from(document.querySelectorAll('.wizard-back')).forEach((el) => {
  el.addEventListener('click', () => {
    wizardBack(el.getAttribute('data-current-page'))
  })
})

// Settings
document.getElementById('collectionNameInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['behavior', 'collection_name'], event.target.value)
  exSetup.previewDefinition(true)
})
document.getElementById('enableKeyboardInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['behavior', 'enable_keyboard_input'], event.target.checked)
  if (event.target.checked) {
    document.getElementById('previewFrame').src = '../word_cloud_input.html?standalone=true'
  } else {
    document.getElementById('previewFrame').src = '../word_cloud_input.html?standalone=true'
  }
  exSetup.previewDefinition(true)
})
document.getElementById('maxCharacterCount').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['behavior', 'max_character_count'], parseInt(event.target.value))
  exSetup.previewDefinition(true)
})
// Content
document.getElementById('promptInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['content', 'prompt'], event.target.value)
  exSetup.previewDefinition(true)
})

Array.from(document.querySelectorAll('.localization-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['content', 'localization', property], event.target.value)
    exSetup.previewDefinition(true)
  })
})

// Font upload
document.getElementById('manageFontsButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['otf', 'ttf', 'woff', 'woff2'], manage: true })
    .then(exSetup.refreshAdvancedFontPickers)
})

// Color
$('.coloris').change(function () {
  const value = $(this).val().trim()
  exSetup.updateWorkingDefinition(['appearance', 'color', $(this).data('property')], value)
  exSetup.previewDefinition(true)
})

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['appearance', 'text_size', property], event.target.value)
    exSetup.previewDefinition(true)
  })
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

exSetup.configure({
  app: 'word_cloud_input',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    appearance: {
      background: {
        mode: 'color',
        color: '#fff'
      }
    },
    attractor: {},
    behavior: {
      enable_keyboard_input: false,
      max_character_count: -1
    },
    content: {
      localization: {}
    }
  }
})

exCommon.askForDefaults(false)
  .then(() => {
    if (exCommon.config.standalone === false) {
      // We are using Hub, so attempt to log in
      exSetup.authenticateUser()
    } else {
      // Hide the login details
      document.getElementById('loginMenu').style.display = 'none'
      document.getElementById('helpNewAccountMessage').style.display = 'none'
    }
  })
