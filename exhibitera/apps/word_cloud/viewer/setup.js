/* global Coloris WordCloud */

import * as exUtilities from '../../../common/utilities.js'
import * as exCommon from '../../js/exhibitera_app_common.js'
import * as exSetup from '../../js/exhibitera_setup_common.js'
import * as exFileSelect from '../../js/exhibitera_file_select_modal.js'
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

  // Style options
  exSetup.updateWorkingDefinition(['style', 'text_case'], document.getElementById('wizard_textCaseSelect').value)
  exSetup.updateWorkingDefinition(['style', 'rotation'], document.getElementById('wizard_wordRotationSelect').value)
  exSetup.updateWorkingDefinition(['style', 'cloud_shape'], document.getElementById('wizard_cloudShapeSelect').value)

  const uuid = $('#definitionSaveButton').data('workingDefinition').uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('word_cloud_viewer')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid
  editDefinition(uuid)
  exUtilities.hideModal('#setupWizardModal')
}

function createWordList (textDict) {
  // Take a dictionary of the form {"word": num_occurances} and convert it
  // into the nested list required by the wordcloud

  let maxValue = 0
  for (const item of Object.keys(textDict)) {
    if (textDict[item] > maxValue) {
      maxValue = textDict[item]
    }
  }
  // Then, format the list, scaling each value to the range [3, 9]
  const wordList = []
  for (const item of Object.keys(textDict)) {
    wordList.push([item, 6 * textDict[item] / maxValue + 3])
  }
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
    for (const key of Object.keys(animalDict)) {
      wordDict[key.toUpperCase()] = animalDict[key]
    }
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

  if (full === true) exSetup.initializeDefinition()

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

  exSetup.updateAdvancedColorPicker('style>background', {
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

  for (const el of document.querySelectorAll('.localization-input') ?? []) {
    const property = el.dataset.property
    if (property in def.content.localization) el.value = def.content.localization[property]
  }

  // Set values for the word cloud shape
  document.getElementById('wordRotationSelect').value = def?.style?.rotation ?? 'horizontal'
  document.getElementById('cloudShapeSelect').value = def?.style?.cloud_shape ?? 'circle'
  document.getElementById('textCaseSelect').value = def?.style?.text_case ?? 'lowercase'

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background)
  exSetup.updateColorPickers(def?.style?.color ?? {})
  exSetup.updateAdvancedFontPickers(def?.style?.font ?? {})
  exSetup.updateTextSizeSliders(def?.style?.text_size ?? {})

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
  exSetup.previewDefinition()
}

function showExcludedWordsModal () {
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const el = document.getElementById('excludedWordsInput')
  el.value = workingDefinition?.behavior?.excluded_words_raw ?? ''

  exUtilities.showModal('#excludedWordsModal')
}

function updateExcludedWordsList () {
  // Use the input field from the modal to update the working definition.

  const text = document.getElementById('excludedWordsInput').value
  exSetup.updateWorkingDefinition(['behavior', 'excluded_words_raw'], text)

  const lines = text.split('\n')
  const words = []
  for (const line of lines) {
    const wordSplit = line.split(',')
    for (const word of wordSplit) {
      words.push(word.trim().toLowerCase())
    }
  }
  exSetup.updateWorkingDefinition(['behavior', 'excluded_words'], words)

  exUtilities.hideModal('#excludedWordsModal')
}

// Set helperAddress for calls to exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

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

// Style
// Rotation
document.getElementById('wordRotationSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'rotation'], event.target.value)
  exSetup.previewDefinition(true)
})
// Shape
document.getElementById('cloudShapeSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'cloud_shape'], event.target.value)
  exSetup.previewDefinition(true)
})
// Text case
document.getElementById('textCaseSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'text_case'], event.target.value)
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
  exSetup.updateWorkingDefinition(['style', 'color', $(this).data('property')], value)
  exSetup.previewDefinition(true)
})

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['style', 'text_size', property], event.target.value)
    exSetup.previewDefinition(true)
  })
})

document.getElementById('wordColorMode').addEventListener('change', (event) => {
  if (event.target.value === 'specific') {
    const value = document.getElementById('colorPicker_words').value
    exSetup.updateWorkingDefinition(['style', 'color', 'words'], value)
  } else {
    exSetup.updateWorkingDefinition(['style', 'color', 'words'], event.target.value)
  }
  exSetup.previewDefinition(true)
})

document.getElementById('colorPicker_words').addEventListener('change', (event) => {
  // We only need to save this change to the definition is the word color mode is set to specific.

  const mode = document.getElementById('wordColorMode').value
  if (mode !== 'specific') return

  exSetup.updateWorkingDefinition(['style', 'color', 'words'], event.target.value)
})

exSetup.configure({
  app: 'word_cloud_viewer',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    style: {
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
