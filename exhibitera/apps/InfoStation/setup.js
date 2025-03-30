/* global Coloris, TinyMDE */

import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exLang from '../js/exhibitera_setup_languages.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'

async function initializeWizard () {
  // Set up the wizard

  exSetup.initializeDefinition()

  // Hide all but the welcome screen
  Array.from(document.querySelectorAll('.wizard-pane')).forEach((el) => {
    el.style.display = 'none'
  })
  document.getElementById('wizardPane_Welcome').style.display = 'block'

  // Reset fields
  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) exSetup.initializeDefinition()

  // Language
  exLang.clearLanguagePicker(document.getElementById('languagePicker'))
  exLang.createLanguagePicker(document.getElementById('languagePicker'), { onLanguageRebuild: rebuildLanguageElements })

  rebuildLanguageElements([])

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('languageNav').innerHTML = ''
  document.getElementById('languageNavContent').innerHTML = ''
  document.getElementById('inactivityTimeoutField').value = 30
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')

  // Reset style options
  Array.from(document.querySelectorAll('.coloris')).forEach((el) => {
    el.value = el.getAttribute('data-default')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

  Array.from(document.querySelectorAll('.layout-slider')).forEach((el) => {
    el.value = el.getAttribute('start')
  })

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#719abf',
    gradient_color_1: '#719abf',
    gradient_color_2: '#719abf'
  })

  exSetup.resetAdvancedFontPickers()

  Array.from(document.querySelectorAll('.text-size-slider')).forEach((el) => {
    el.value = 0
  })
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)

  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)

  // Attractor
  if ('attractor' in def && def.attractor.trim() !== '') {
    document.getElementById('attractorSelect').innerHTML = def.attractor
  } else {
    document.getElementById('attractorSelect').innerHTML = 'Select file'
  }
  document.getElementById('attractorSelect').setAttribute('data-filename', def.attractor)
  if ('inactivity_timeout' in def) {
    document.getElementById('inactivityTimeoutField').value = def.inactivity_timeout
  }

  // Layout fields
  const buttonSizeSlider = document.getElementById('buttonSizeSlider')
  buttonSizeSlider.value = def?.style?.layout?.button_size || buttonSizeSlider.getAttribute('start')

  const headerSizeSlider = document.getElementById('headerSizeSlider')
  headerSizeSlider.value = def?.style?.layout?.header_height || headerSizeSlider.getAttribute('start')

  if ('background' in def.style === false) {
    def.style.background = {
      mode: 'color',
      color: '#719abf'
    }
    exSetup.updateWorkingDefinition(['style', 'background', 'mode'], 'color')
    exSetup.updateWorkingDefinition(['style', 'background', 'color'], '#719abf')
  }

  // Set the appropriate values for any advanced color pickers
  if ('background' in def.style) {
    exSetup.updateAdvancedColorPicker('style>background', def.style.background)
  }

  // Set the appropriate values for the color pickers
  Object.keys(def.style.color).forEach((key) => {
    $('#colorPicker_' + key).val(def.style.color[key])
    document.querySelector('#colorPicker_' + key).dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Set the appropriate values for the advanced font pickers
  if ('font' in def.style) {
    Object.keys(def.style.font).forEach((key) => {
      const picker = document.querySelector(`.AFP-select[data-path="style>font>${key}"`)
      exSetup.setAdvancedFontPicker(picker, def.style.font[key])
    })
  }

  // Set the appropriate values for the text size sliders
  Object.keys(def.style.text_size).forEach((key) => {
    console.log(key + 'TextSizeSlider')
    document.getElementById(key + 'TextSizeSlider').value = def.style.text_size[key]
  })

  // Set up any existing languages and tabs
  // In Ex5.3, we added the language_order field. If it doesn't exist
  // set it up now
  if ((def?.language_order || []).length === 0) {
    def.language_order = []
    for (const code of Object.keys(def.languages)) {
      const lang = def.languages[code]
      if (lang.default === true) {
        def.language_order.unshift(code)
      } else def.language_order.push(code)
    }
    exSetup.updateWorkingDefinition(['language_order'], def.language_order)
  }
  exLang.createLanguagePicker(document.getElementById('languagePicker'),
    {
      onLanguageRebuild: rebuildLanguageElements
    }
  )

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../infostation.html?standalone=true&definition=' + def.uuid
}

function rebuildLanguageElements (langOrder) {
  // Called whenever we modify the languages to rebuild the GUI representation.

  document.getElementById('languageNav').innerHTML = ''
  document.getElementById('languageNavContent').innerHTML = ''

  let first = null
  for (const lang of langOrder) {
    if (first == null) first = lang
    createLanguageTab(lang)

    // document.getElementById('languagePane_' + lang).classList.remove('active', 'show')
    // $('#headerText' + '_' + lang).val(langDef.header_text)
  }

  if (first != null) {
    document.getElementById('languageTab_' + first).click()
    document.getElementById('languagePane_' + first).classList.add('active')
  }
}

function addLanguage (code, displayName, englishName) {
  // Add a new supported language to the definition.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  // Check if language already exists
  let error = false
  Object.keys(workingDefinition.languages).forEach((key) => {
    if (key === code) {
      $('#languageAddExistsWarning').show()
      error = true
    } else {
      $('#languageAddExistsWarning').hide()
    }
  })
  if (error) return

  if ((workingDefinition?.language_order || []).length === 0) {
    workingDefinition.language_order = [code]
  } else {
    workingDefinition.language_order.push(code)
  }

  workingDefinition.languages[code] = {
    display_name: displayName,
    english_name: englishName,
    code,
    tabs: {},
    tab_order: []
  }

  createLanguageTab(code)

  $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))
  exSetup.previewDefinition(true)
}

function createLanguageTab (code) {
  // Create a new language tab for the given details.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  // Create the tab button
  const tabButton = document.createElement('button')
  tabButton.classList = 'nav-link language-tab'
  tabButton.setAttribute('id', 'languageTab_' + code)
  tabButton.setAttribute('data-bs-toggle', 'tab')
  tabButton.setAttribute('data-bs-target', '#languagePane_' + code)
  tabButton.setAttribute('type', 'button')
  tabButton.setAttribute('role', 'tab')
  tabButton.innerHTML = exLang.getLanguageDisplayName(code, true)
  $('#languageNav').append(tabButton)

  // Create corresponding pane
  const tabPane = document.createElement('div')
  tabPane.classList = 'tab-pane fade'
  tabPane.setAttribute('id', 'languagePane_' + code)
  tabPane.setAttribute('role', 'tabpanel')
  tabPane.setAttribute('aria-labelledby', 'languageTab_' + code)
  $('#languageNavContent').append(tabPane)

  const row = document.createElement('div')
  row.classList = 'row gy-2 mt-2 mb-3'
  tabPane.appendChild(row)

  // Create the left and right shift buttons
  const leftCol = document.createElement('div')
  leftCol.classList = 'col-4 col-md-3 col-lg-2'
  row.appendChild(leftCol)

  // Create the header input
  const headerCol = document.createElement('div')
  headerCol.classList = 'col-12'
  row.appendChild(headerCol)

  const headerInputLabel = document.createElement('label')
  headerInputLabel.classList = 'form-label'
  headerInputLabel.innerHTML = 'Header'
  headerInputLabel.setAttribute('for', 'languageTabHeader_' + code)
  headerCol.appendChild(headerInputLabel)

  const headerCommandBar = document.createElement('div')
  headerCol.appendChild(headerCommandBar)

  const headerInput = document.createElement('div')
  headerCol.appendChild(headerInput)

  const titleEditor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: workingDefinition.languages[code].header ?? '',
    editorDiv: headerInput,
    commandDiv: headerCommandBar,
    commands: ['basic'],
    callback: (content) => {
      exSetup.updateWorkingDefinition(['languages', code, 'header'], content)
      exSetup.previewDefinition(true)
    }
  })

  // Create the new sub-tab button
  const newInfoTabCol = document.createElement('div')
  newInfoTabCol.classList = 'col col-12 col-md-6 col-lg-4 col-xl-3 d-flex mt-2'
  row.appendChild(newInfoTabCol)

  const newInfoTabButton = document.createElement('button')
  newInfoTabButton.classList = 'btn btn-primary w-100 align-self-center'
  newInfoTabButton.innerHTML = 'Add tab'
  newInfoTabButton.addEventListener('click', () => {
    createInfoStationTab(code)
  })
  newInfoTabCol.appendChild(newInfoTabButton)

  // Create sub-tab nav
  const subTabNav = document.createElement('nav')
  tabPane.appendChild(subTabNav)

  const subTabNavDiv = document.createElement('div')
  subTabNavDiv.classList = 'nav nav-tabs'
  subTabNavDiv.setAttribute('role', 'tablist')
  subTabNavDiv.setAttribute('id', 'subTabNav_' + code)
  subTabNav.appendChild(subTabNavDiv)

  const subTabPane = document.createElement('div')
  subTabPane.classList = 'tab-content'
  subTabPane.setAttribute('id', 'subTabPane_' + code)
  tabPane.appendChild(subTabPane)

  // Then build out any InfoStation tabs
  for (const uuid of workingDefinition.languages[code]?.tab_order || []) {
    createInfoStationTab(code, uuid)
  }

  // Switch to this new tab
  $(tabButton).click()
}

function deleteLanguageTab (lang) {
  // Delete the given language tab.

  delete $('#definitionSaveButton').data('workingDefinition').languages[lang]
  $('#languageTab_' + lang).remove()
  $('#languagePane_' + lang).remove()
  $('.language-tab').click()
}

function createInfoStationTab (lang, uuid = '') {
  // Create a new InfoStation tab and attach it to the given language.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  if (('tabs' in workingDefinition.languages[lang]) === false) {
    workingDefinition.languages[lang].tabs = {}
  }
  if (('tab_order' in workingDefinition.languages[lang]) === false) {
    workingDefinition.languages[lang].tab_order = []
  }
  if (uuid === '') {
    uuid = exCommon.uuid()
    workingDefinition.languages[lang].tabs[uuid] = {
      button_text: '',
      type: 'text',
      text: '',
      uuid
    }
    workingDefinition.languages[lang].tab_order.push(uuid)

    $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))
  }

  // Build the GUI
  // Create the tab button
  const tabButton = document.createElement('button')
  tabButton.classList = 'nav-link infostation-tab'
  tabButton.setAttribute('id', 'infostationTab_' + lang + '_' + uuid)
  tabButton.setAttribute('data-bs-toggle', 'tab')
  tabButton.setAttribute('data-bs-target', '#infostationPane_' + lang + '_' + uuid)
  tabButton.setAttribute('type', 'button')
  tabButton.setAttribute('role', 'tab')
  if (workingDefinition.languages[lang].tabs[uuid].button_text === '') {
    tabButton.innerHTML = 'New tab'
  } else {
    tabButton.innerHTML = workingDefinition.languages[lang].tabs[uuid].button_text
  }

  document.getElementById('subTabNav_' + lang).appendChild(tabButton)

  // Create corresponding pane
  const tabPane = document.createElement('div')
  tabPane.classList = 'tab-pane fade show'
  tabPane.setAttribute('id', 'infostationPane_' + lang + '_' + uuid)
  tabPane.setAttribute('role', 'tabpanel')
  tabPane.setAttribute('aria-labelledby', 'infostationTab_' + lang + '_' + uuid)
  document.getElementById('subTabPane_' + lang).appendChild(tabPane)

  const row = document.createElement('div')
  row.classList = 'row gy-2 mt-2 mb-3'
  tabPane.appendChild(row)

  // Create the delete button
  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-12'
  row.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger align-self-center'
  deleteButton.setAttribute('data-bs-toggle', 'popover')
  deleteButton.setAttribute('title', 'Are you sure?')
  deleteButton.setAttribute('data-bs-content', `<a id='deleteTab_${lang}_${uuid}' class='btn btn-danger w-100 tab-delete'>Confirm</a>`)
  deleteButton.setAttribute('data-bs-trigger', 'focus')
  deleteButton.setAttribute('data-bs-html', 'true')
  // Note: The event listener to detect is the delete button is clicked is defined elsewhere
  deleteButton.addEventListener('click', function () { deleteButton.focus() })
  deleteButton.innerHTML = 'Delete tab'

  deleteCol.appendChild(deleteButton)
  $(deleteButton).popover()

  const buttonTextCol = document.createElement('div')
  buttonTextCol.classList = 'col-12 col-md-6'
  row.appendChild(buttonTextCol)

  const buttonTextLabel = document.createElement('label')
  buttonTextLabel.classList = 'form-label'
  buttonTextLabel.innerHTML = 'Button text'
  buttonTextLabel.setAttribute('for', 'infostationTabButtonTextInput_' + uuid)
  buttonTextCol.appendChild(buttonTextLabel)

  const buttonTextCommandBar = document.createElement('div')
  buttonTextCol.appendChild(buttonTextCommandBar)

  const buttonTextInput = document.createElement('div')
  buttonTextCol.appendChild(buttonTextInput)

  const titleEditor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: workingDefinition.languages[lang].tabs[uuid].button_text ?? '',
    editorDiv: buttonTextInput,
    commandDiv: buttonTextCommandBar,
    commands: ['basic'],
    callback: (content) => {
      exSetup.updateWorkingDefinition(['languages', lang, 'tabs', uuid, 'button_text'], content)
      document.getElementById('infostationTab_' + lang + '_' + uuid).innerHTML = exMarkdown.formatText(content, { string: true, removeParagraph: true })
      exSetup.previewDefinition(true)
    }
  })

  // const textTabTipCol = document.createElement('div')
  // textTabTipCol.classList = 'col-12 mt-3 fst-italic alert alert-info'
  // textTabTipCol.innerHTML = 'Text and images in text tabs are formatted using Markdown. See the help page to learn more about Markdown.'
  // row.appendChild(textTabTipCol)

  const textCol = document.createElement('div')
  textCol.classList = 'col-12'
  row.appendChild(textCol)

  const textLabel = document.createElement('label')
  textLabel.classList = 'form-label'
  textLabel.innerHTML = `
  Text
  <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="Text and images are formatted using Markdown. See the help page to learn more about Markdown." style="font-size: 0.55em;">?</span>
  `
  textCol.appendChild(textLabel)

  const textInputCMD = document.createElement('div')
  textCol.appendChild(textInputCMD)
  const textInput = document.createElement('div')
  textCol.appendChild(textInput)

  const textEditor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: workingDefinition.languages[lang].tabs[uuid].text,
    editorDiv: textInput,
    commandDiv: textInputCMD,
    callback: (content) => {
      exSetup.updateWorkingDefinition(['languages', lang, 'tabs', uuid, 'text'], content)
      exSetup.previewDefinition(true)
    }
  })

  $(tabButton).click()
  exSetup.previewDefinition(true)

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function deleteInfoStationTab (lang, uuid) {
  // Delete the given InfoStation tab

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  delete workingDefinition.languages[lang].tabs[uuid]
  const index = workingDefinition.languages[lang].tab_order.indexOf(parseInt(uuid))
  workingDefinition.languages[lang].tab_order.splice(index, 1)
  $('#infostationTab_' + lang + '_' + uuid).remove()
  $('#infostationPane_' + lang + '_' + uuid).remove()
  $('.infostation-tab').click()
}

function onAttractorFileChange () {
  // Called when a new image or video is selected.

  const file = document.getElementById('attractorSelect').getAttribute('data-filename')
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  workingDefinition.attractor = file
  $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))

  exSetup.previewDefinition(true)
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

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
// Call with a slight delay to make sure the elements are loaded
setTimeout(setUpColorPickers, 100)

// Add event listeners
// -------------------------------------------------------------

// Main buttons
document.getElementById('manageContentButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ manage: true })
})

// Definition fields
document.getElementById('attractorSelect').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['image', 'video'], multiple: false })
    .then((files) => {
      if (files.length === 1) {
        event.target.innerHTML = files[0]
        event.target.setAttribute('data-filename', files[0])
        onAttractorFileChange()
      }
    })
})
document.getElementById('attractorSelectClear').addEventListener('click', (event) => {
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')
  onAttractorFileChange()
})

document.getElementById('inactivityTimeoutField').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['inactivity_timeout'], event.target.value)
  exSetup.previewDefinition(true)
})

// Style fields
document.getElementById('buttonSizeSlider').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'button_size'], event.target.value)
  exSetup.previewDefinition(true)
})

document.getElementById('headerSizeSlider').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'header_height'], event.target.value)
  exSetup.previewDefinition(true)
})

$('.coloris').change(function () {
  const value = $(this).val().trim()
  exSetup.updateWorkingDefinition(['style', 'color', $(this).data('property')], value)
  exSetup.previewDefinition(true)
})
document.getElementById('manageFontsButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['otf', 'ttf', 'woff', 'woff2'], manage: true })
    .then(exSetup.refreshAdvancedFontPickers)
})

// Text size fields
Array.from(document.querySelectorAll('.text-size-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['style', 'text_size', property], parseFloat(event.target.value))
    exSetup.previewDefinition(true)
  })
})

// Listen for popover delete buttons
document.addEventListener('click', (event) => {
  if (event.target.classList.contains('lang-delete') === false && event.target.classList.contains('tab-delete') === false) return

  if (event.target.classList.contains('lang-delete')) {
    const lang = event.target.getAttribute('id').split('_').slice(-1)[0]
    deleteLanguageTab(lang)
    exSetup.previewDefinition(true)
  }

  if (event.target.classList.contains('tab-delete')) {
    const split = event.target.getAttribute('id').split('_')
    const lang = split.slice(-2)[0]
    const uuid = split.slice(-1)[0]

    deleteInfoStationTab(lang, uuid)
    exSetup.previewDefinition(true)
  }
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

clearDefinitionInput()

exSetup.configure({
  app: 'infostation',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    languages: {},
    language_order: [],
    style: {
      background: {
        color: '#719abf',
        mode: 'color'
      },
      color: {},
      font: {},
      text_size: {}
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
