/* global Coloris WordCloud */

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
  document.getElementById('wizard_wordRotationSelect').value = 'horizontal'
  document.getElementById('wizard_cloudShapeSelect').value = 'circle'
  document.getElementById('wizard_textCaseSelect').value = 'lowercase'
}

async function wizardForward (currentPage) {
  // Check if the wizard is ready to advance and perform the move

  if (currentPage === 'Welcome') {
    const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
    if (defName !== '') {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
      wizardGoTo('Collection')
    } else {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Collection') {
    const collection = document.getElementById('wizardCollection').value.trim()
    if (collection !== '') {
      document.getElementById('wizardCollectionBlankWarning').style.display = 'none'
      wizardGoTo('Question')
    } else {
      document.getElementById('wizardCollectionBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Question') {
    wizardGoTo('Style')
    createWordCloud()
  } else if (currentPage === 'Style') {
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Collection') {
    wizardGoTo('Welcome')
  } else if (currentPage === 'Question') {
    wizardGoTo('Collection')
  } else if (currentPage === 'Style') {
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

  // Appearance options
  exSetup.updateWorkingDefinition(['appearance', 'text_case'], document.getElementById('wizard_textCaseSelect').value)
  exSetup.updateWorkingDefinition(['appearance', 'rotation'], document.getElementById('wizard_wordRotationSelect').value)
  exSetup.updateWorkingDefinition(['appearance', 'cloud_shape'], document.getElementById('wizard_cloudShapeSelect').value)

  const uuid = $('#definitionSaveButton').data('workingDefinition').uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('word_cloud_viewer')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid
  editDefinition(uuid)
  exSetup.hideModal('#setupWizardModal')
}

function createWordList (textDict) {
  // Take a dictionary of the form {"word": num_occurances} and convert it
  // into the nested list required by the wordcloud

  let maxValue = 0
  Object.keys(textDict).forEach((item) => {
    if (textDict[item] > maxValue) {
      maxValue = textDict[item]
    }
  })
  // Then, format the list, scaling each value to the range [3, 9]
  const wordList = []
  Object.keys(textDict).forEach((item) => {
    wordList.push([item, 6 * textDict[item] / maxValue + 3])
  })
  return (wordList)
}

function createWordCloud () {
  // Create a test wordcloud with the given options

  const divForWC = document.getElementById('wordCloudContainer')

  const WordCloudOptions = {
    color: 'random-dark',
    gridSize: Math.round(16 * $(divForWC).width() / 1024),
    weightFactor: function (size) {
      return Math.pow(size, 2.3) * $(divForWC).width() / 1024
    },
    drawOutOfBound: false,
    rotateRatio: 0.125,
    shrinkToFit: true,
    shuffle: true,
    backgroundColor: 'white',
    fontFamily: 'words-default'
  }

  let wordDict = {}
  if (document.getElementById('wizard_textCaseSelect').value === 'uppercase') {
    Object.keys(animalDict).forEach((key) => {
      wordDict[key.toUpperCase()] = animalDict[key]
    })
  } else {
    wordDict = structuredClone(animalDict)
  }
  const rotationOption = document.getElementById('wizard_wordRotationSelect').value

  if (rotationOption === 'horizontal') {
    WordCloudOptions.minRotation = 0
    WordCloudOptions.maxRotation = 0
  } else if (rotationOption === 'right_angles') {
    WordCloudOptions.minRotation = 1.5708
    WordCloudOptions.maxRotation = 1.5708
    WordCloudOptions.rotationSteps = 2
  } else {
    WordCloudOptions.minRotation = -1.5708
    WordCloudOptions.maxRotation = 1.5708 // 6.2821
    WordCloudOptions.rotationSteps = 100
    WordCloudOptions.rotateRatio = 0.5
  }

  WordCloudOptions.list = createWordList(wordDict)
  WordCloudOptions.shape = document.getElementById('wizard_cloudShapeSelect').value

  WordCloud(divForWC, WordCloudOptions)
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
    await exSetup.initializeDefinition()
  }

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('collectionNameInput').value = ''
  document.getElementById('refreshRateInput').value = 15

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

  // Reset word cloud options
  document.getElementById('wordRotationSelect').value = 'horizontal'
  document.getElementById('cloudShapeSelect').value = 'circle'
  document.getElementById('textCaseSelect').value = 'lowercase'

  // Reset color options
  const colorInputs = ['prompt']
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
  document.getElementById('refreshRateInput').value = def?.behavior?.refresh_rate ?? 15

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

  // Set values for the word cloud shape
  document.getElementById('wordRotationSelect').value = def?.appearance?.rotation ?? 'horizontal'
  document.getElementById('cloudShapeSelect').value = def?.appearance?.cloud_shape ?? 'circle'
  document.getElementById('textCaseSelect').value = def?.appearance?.text_case ?? 'lowercase'

  // Set the appropriate values for the color pickers
  if ('color' in def.appearance) {
    Object.keys(def.appearance.color).forEach((key) => {
      document.getElementById('colorPicker_' + key).value = def.appearance.color[key]
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

  if ('prompt' in def.appearance.text_size) {
    document.getElementById('promptTextSizeSlider').value = def.appearance.text_size.prompt
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../word_cloud_viewer.html?standalone=true&definition=' + def.uuid
  exSetup.previewDefinition()
}

function showExcludedWordsModal () {
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const el = document.getElementById('excludedWordsInput')
  el.value = workingDefinition?.behavior?.excluded_words_raw ?? ''

  $('#excludedWordsModal').modal('show')
}

function updateExcludedWordsList () {
  // Use the input field from the modal to update the working definition.

  const text = document.getElementById('excludedWordsInput').value
  exSetup.updateWorkingDefinition(['behavior', 'excluded_words_raw'], text)

  const lines = text.split('\n')
  const words = []
  lines.forEach((line) => {
    const wordSplit = line.split(',')
    wordSplit.forEach((word) => {
      words.push(word.trim().toLowerCase())
    })
  })
  exSetup.updateWorkingDefinition(['behavior', 'excluded_words'], words)

  $('#excludedWordsModal').modal('hide')
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

// Update the word cloud preview when changing wizard options
Array.from(document.querySelectorAll('.wizard-style-option')).forEach((el) => {
  el.addEventListener('change', () => {
    createWordCloud()
  })
})

// Settings
document.getElementById('collectionNameInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['behavior', 'collection_name'], event.target.value)
  exSetup.previewDefinition(true)
})
document.getElementById('refreshRateInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['behavior', 'refresh_rate'], event.target.value)
  exSetup.previewDefinition(true)
})

// Content
document.getElementById('promptInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['content', 'prompt'], event.target.value)
  exSetup.previewDefinition(true)
})
document.getElementById('showExcludedWordsModalButton').addEventListener('click', showExcludedWordsModal)
document.getElementById('excludedWordsListSaveButton').addEventListener('click', updateExcludedWordsList)

// Appearance
// Rotation
document.getElementById('wordRotationSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['appearance', 'rotation'], event.target.value)
  exSetup.previewDefinition(true)
})
// Shape
document.getElementById('cloudShapeSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['appearance', 'cloud_shape'], event.target.value)
  exSetup.previewDefinition(true)
})
// Text case
document.getElementById('textCaseSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['appearance', 'text_case'], event.target.value)
  exSetup.previewDefinition(true)
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

document.getElementById('wordColorMode').addEventListener('change', (event) => {
  if (event.target.value === 'specific') {
    const value = document.getElementById('colorPicker_words').value
    exSetup.updateWorkingDefinition(['appearance', 'color', 'words'], value)
  } else {
    exSetup.updateWorkingDefinition(['appearance', 'color', 'words'], event.target.value)
  }
  exSetup.previewDefinition(true)
})

document.getElementById('colorPicker_words').addEventListener('change', (event) => {
  // We only need to save this change to the definition is the word color mode is set to specific.

  const mode = document.getElementById('wordColorMode').value
  if (mode !== 'specific') return

  exSetup.updateWorkingDefinition(['appearance', 'color', 'words'], event.target.value)
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

exSetup.configure({
  app: 'word_cloud_viewer',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    appearance: {
      background: {
        mode: 'color',
        color: '#fff'
      },
      text_case: 'lowercase',
      text_size: {}
    },
    attractor: {},
    behavior: {},
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

const animalDict = {
  dog: 108,
  cat: 94,
  pony: 71,
  horse: 63,
  butterfly: 62,
  moose: 61,
  penguin: 51,
  dolphin: 46,
  fox: 40,
  elk: 39,
  lion: 37,
  tiger: 35,
  deer: 35,
  leopard: 34,
  turtle: 28,
  snake: 25,
  robin: 19,
  seagull: 19,
  parrot: 18,
  jellyfish: 16,
  kangaroo: 15,
  coyote: 15,
  rabbit: 11,
  moth: 7,
  snail: 6,
  zebra: 5,
  beetle: 5,
  bear: 4,
  hare: 4,
  lizard: 3,
  tuna: 2,
  donkey: 1,
  slug: 1
}
