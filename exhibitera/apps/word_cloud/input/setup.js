import * as exCommon from '../../js/exhibitera_app_common.js'
import * as exSetup from '../../js/exhibitera_setup_common.js'
import * as exMarkdown from '../../js/exhibitera_setup_markdown.js'

async function initializeWizard () {
  // Setup the wizard

  exSetup.prepareWizard()

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
    if (exSetup.wizardCheckDefinitionName()) exSetup.wizardGoTo('Question')
  } else if (currentPage === 'Question') {
    exSetup.wizardGoTo('Collection')
  } else if (currentPage === 'Collection') {
    const collection = document.getElementById('wizardCollection').value.trim()
    if (collection !== '') {
      document.getElementById('wizardCollectionBlankWarning').style.display = 'none'
      exSetup.wizardGoTo('ColorMode')
    } else {
      document.getElementById('wizardCollectionBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'ColorMode') {
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Question') {
    exSetup.wizardGoTo('Welcome')
  } else if (currentPage === 'Collection') {
    exSetup.wizardGoTo('Question')
  } else if (currentPage === 'ColorMode') {
    exSetup.wizardGoTo('Collection')
  }
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

  // Switch to light color scheme if needed
  if (document.getElementById('wizardColorModeLight').checked) {
    exSetup.updateWorkingDefinition(['style', 'color'], {
      clear: '#f5f5f0',
      'clear-background': '#6b7280',
      input: '#0f1419',
      'input-background': '#f5f5f0',
      'input-font-hint': '#1a2b3c',
      'keyboard-background': '#6b7280',
      'keyboard-key': '#0f1419',
      'keyboard-key-background': '#f5f5f0',
      prompt: '#0f1419',
      submit: '#f5f5f0',
      'submit-background': '#6b7280'
    })
    exSetup.updateWorkingDefinition(['style', 'background'], {
      color: '#e6e6e2',
      gradient_color_1: '#f5f5f0',
      gradient_color_2: '#e6e6e2',
      mode: 'color'
    })
  }

  await exSetup.finishWizard(defName)
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) exSetup.initializeDefinition()

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('collectionNameInput').value = ''
  document.getElementById('enableKeyboardInput').checked = false
  document.getElementById('maxCharacterCount').value = '-1'

  // Content details
  exMarkdown.createMarkdownEditor({
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
    const el = document.getElementById('colorPicker_' + input)
    el.value = el.dataset.default
    document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
  })
  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#1a2b3c',
    gradient_color_1: '#1a2b3c',
    gradient_color_2: '#1a2b3c'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()

  document.getElementById('promptTextSizeSlider').value = 0
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)
  exSetup.config.initialDefinition = structuredClone(def)
  exSetup.config.workingDefinition = structuredClone(def)

  // Configure preview behavior
  exSetup.configurePreviewFromDefinition(def)

  document.getElementById('definitionNameInput').value = def.name
  document.getElementById('collectionNameInput').value = def?.behavior?.collection_name ?? ''
  document.getElementById('enableKeyboardInput').checked = def?.behavior?.enable_keyboard_input ?? false
  document.getElementById('maxCharacterCount').value = def?.behavior?.max_character_count ?? -1

  // Content
  exMarkdown.createMarkdownEditor({
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

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background)
  exSetup.showDefinitionStyle(def)

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
  exSetup.previewDefinition()
}

// Set helperAddress for calls to exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// Add event listeners
// -------------------------------------------------------------

// Wizard

// Connect the forward and back buttons
exSetup.connectWizardButtons(wizardForward, wizardBack)

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
exSetup.connectFontManager()

// Color
exSetup.connectColorInputs()

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['style', 'text_size', property], event.target.value)
    exSetup.previewDefinition(true)
  })
})

exSetup.configure({
  app: 'word_cloud_input',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    style: {
      background: {
        color: '#1a2b3c',
        gradient_color_1: '#1a2b3c',
        gradient_color_2: '#1a2b3c',
        mode: 'color'
      },
      color: {
        clear: '#f5f5f0',
        'clear-background': '#6b7280',
        input: '#0f1419',
        'input-background': '#f5f5f0',
        'input-font-hint': '#1a2b3c',
        'keyboard-background': '#6b7280',
        'keyboard-key': '#0f1419',
        'keyboard-key-background': '#f5f5f0',
        prompt: '#f5f5f0',
        submit: '#f5f5f0',
        'submit-background': '#6b7280'
      },
      font: {
        clear: { path: '/_fonts/Noto/NotoSans-VariableFont_wdth,wght.ttf', axes: { wght: 400, wdth: 100 } },
        input: { path: '/_fonts/Noto/NotoSans-VariableFont_wdth,wght.ttf', axes: { wght: 400, wdth: 100 } },
        prompt: { path: '/_fonts/Noto/NotoSans-VariableFont_wdth,wght.ttf', axes: { wght: 700, wdth: 100 } },
        submit: { path: '/_fonts/Noto/NotoSans-VariableFont_wdth,wght.ttf', axes: { wght: 400, wdth: 100 } }
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
