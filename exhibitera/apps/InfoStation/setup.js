/* global Coloris, bootstrap */

import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exLang from '../js/exhibitera_setup_languages.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'

async function initializeWizard () {
  // Set up the wizard

  exSetup.prepareWizard()

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

  exSetup.config.initialDefinition = structuredClone(def)
  exSetup.config.workingDefinition = structuredClone(def)

  document.getElementById('definitionNameInput').value = def.name

  // Attractor
  const attractorSelect = document.getElementById('attractorSelect')
  if (def.attractor && def.attractor.trim() !== '') {
    attractorSelect.innerText = def.attractor
  } else {
    attractorSelect.innerText = 'Select file'
  }
  attractorSelect.dataset.filename = def.attractor
  document.getElementById('inactivityTimeoutField').value = def?.inactivity_timeout ?? 30

  // Layout fields
  const buttonSizeSlider = document.getElementById('buttonSizeSlider')
  buttonSizeSlider.value = def?.style?.layout?.button_size ?? buttonSizeSlider.getAttribute('start')

  const headerSizeSlider = document.getElementById('headerSizeSlider')
  headerSizeSlider.value = def?.style?.layout?.header_height ?? headerSizeSlider.getAttribute('start')

  exSetup.updateAdvancedColorPicker('style>background',
    def?.style?.background,
    {
      mode: 'color',
      color: '#719abf'
    })
  exSetup.updateColorPickers(def?.style?.color ?? {})
  exSetup.updateAdvancedFontPickers(def?.style?.font ?? {})
  exSetup.updateTextSizeSliders(def?.style?.text_size ?? {})

  // Set up any existing languages and tabs
  // In Ex5.3, we added the language_order field. If it doesn't exist
  // set it up now
  if ((def?.language_order ?? []).length === 0) {
    def.language_order = []
    for (const code of Object.keys(def?.languages ?? {})) {
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
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
}

function rebuildLanguageElements (langOrder) {
  // Called whenever we modify the languages to rebuild the GUI representation.

  document.getElementById('languageNav').innerText = ''
  document.getElementById('languageNavContent').innerText = ''

  let first = null
  for (const lang of langOrder) {
    if (first == null) first = lang
    createLanguageTab(lang)
  }

  if (first != null) {
    document.getElementById('languageTab_' + first).click()
    document.getElementById('languagePane_' + first).classList.add('active')
  }
}

function createLanguageTab (code) {
  // Create a new language tab for the given details.

  const workingDefinition = exSetup.config.workingDefinition

  // Create the tab button
  const tabButton = document.createElement('button')
  tabButton.classList = 'nav-link language-tab'
  tabButton.setAttribute('id', 'languageTab_' + code)
  tabButton.setAttribute('data-bs-toggle', 'tab')
  tabButton.setAttribute('data-bs-target', '#languagePane_' + code)
  tabButton.setAttribute('type', 'button')
  tabButton.setAttribute('role', 'tab')
  tabButton.innerHTML = exLang.getLanguageDisplayName(code, true)
  document.getElementById('languageNav').appendChild(tabButton)

  // Create corresponding pane
  const tabPane = document.createElement('div')
  tabPane.classList = 'tab-pane fade'
  tabPane.setAttribute('id', 'languagePane_' + code)
  tabPane.setAttribute('role', 'tabpanel')
  tabPane.setAttribute('aria-labelledby', 'languageTab_' + code)
  document.getElementById('languageNavContent').appendChild(tabPane)

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
  tabButton.click()
}

function deleteLanguageTab (lang) {
  // Delete the given language tab.

  delete exSetup.config.workingDefinition.languages[lang]

  const tab = document.getElementById('languageTab_' + lang)
  if (tab) tab.remove()

  const pane = document.getElementById('languagePane_' + lang)
  if (pane) pane.remove()

  const languageTabs = document.querySelectorAll('.language-tab')
  if (languageTabs.length > 0) languageTabs[0].click()
}

function createInfoStationTab (lang, uuid = '') {
  // Create a new InfoStation tab and attach it to the given language.

  if (('tabs' in exSetup.config.workingDefinition.languages[lang]) === false) {
    exSetup.config.workingDefinition.languages[lang].tabs = {}
  }
  if (('tab_order' in exSetup.config.workingDefinition.languages[lang]) === false) {
    exSetup.config.workingDefinition.languages[lang].tab_order = []
  }
  if (uuid === '') {
    uuid = exUtilities.uuid()
    exSetup.config.workingDefinition.languages[lang].tabs[uuid] = {
      button_text: '',
      type: 'text',
      text: '',
      uuid
    }
    exSetup.config.workingDefinition.languages[lang].tab_order.push(uuid)
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
  if (exSetup.config.workingDefinition.languages[lang].tabs[uuid].button_text === '') {
    tabButton.innerText = 'New tab'
  } else {
    tabButton.innerText = exSetup.config.workingDefinition.languages[lang].tabs[uuid].button_text
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
  const popover = new bootstrap.Popover(deleteButton)

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
    content: exSetup.config.workingDefinition.languages[lang].tabs[uuid].button_text ?? '',
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
    content: exSetup.config.workingDefinition.languages[lang].tabs[uuid].text,
    editorDiv: textInput,
    commandDiv: textInputCMD,
    callback: (content) => {
      exSetup.updateWorkingDefinition(['languages', lang, 'tabs', uuid, 'text'], content)
      exSetup.previewDefinition(true)
    }
  })

  tabButton.click()
  exSetup.previewDefinition(true)

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function deleteInfoStationTab (lang, uuid) {
  // Delete the given InfoStation tab

  delete exSetup.config.workingDefinition.languages[lang].tabs[uuid]
  const index = exSetup.config.workingDefinition.languages[lang].tab_order.indexOf(parseInt(uuid))
  exSetup.config.workingDefinition.languages[lang].tab_order.splice(index, 1)

  const tabElement = document.getElementById(`infostationTab_${lang}_${uuid}`)
  if (tabElement) tabElement.remove()

  const paneElement = document.getElementById(`infostationPane_${lang}_${uuid}`)
  if (paneElement) paneElement.remove()

  const tabButtons = document.querySelectorAll('.infostation-tab')
  if (tabButtons.length > 0) tabButtons[0].click()
}

function onAttractorFileChange () {
  // Called when a new image or video is selected.

  const file = document.getElementById('attractorSelect').dataset.filename
  exSetup.config.workingDefinition.attractor = file

  exSetup.previewDefinition(true)
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

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

const colorInputs = document.querySelectorAll('.coloris')
for (const input of colorInputs) {
  input.addEventListener('change', function () {
    const value = this.value.trim()
    exSetup.updateWorkingDefinition(['style', 'color', this.dataset.property], value)
    exSetup.previewDefinition(true)
  })
}

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
