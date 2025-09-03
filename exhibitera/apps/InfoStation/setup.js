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
  exLang.createLanguagePicker(document.getElementById('languagePicker'), {
    onLanguageAdd: addLanguage,
    onLanguageRebuild: rebuildTabs
  })

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('inactivityTimeoutField').value = 30
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')

  // Reset style options
  Array.from(document.querySelectorAll('.coloris')).forEach((el) => {
    el.value = el.getAttribute('data-default')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Array.from(document.querySelectorAll('.layout-slider')).forEach((el) => {
  //   el.value = el.getAttribute('start')
  // })

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#719abf',
    gradient_color_1: '#719abf',
    gradient_color_2: '#719abf'
  })

  exSetup.createAdvancedSliders()

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

  // Configure preview behavior
  exSetup.configurePreviewFromDefinition(def)

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
  exSetup.createAdvancedSlider(buttonSizeSlider, def?.style?.layout?.button_size)

  const headerSizeSlider = document.getElementById('headerSizeSlider')
  exSetup.createAdvancedSlider(headerSizeSlider, def?.style?.layout?.header_height)

  const sidebarSizeSlider = document.getElementById('sidebarSizeSlider')
  exSetup.createAdvancedSlider(sidebarSizeSlider, def?.style?.layout?.sidebar_width)

  const toolbarSizeSlider = document.getElementById('toolbarSizeSlider')
  exSetup.createAdvancedSlider(toolbarSizeSlider, def?.style?.layout?.toolbar_height)

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
  exLang.createLanguagePicker(document.getElementById('languagePicker'), {
    onLanguageAdd: addLanguage,
    onLanguageRebuild: rebuildTabs
  })

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
}

function addLanguage (code, displayName, englishName) {
  // Called when a new language is added so we can set up the definition

  exSetup.updateWorkingDefinition(['languages', code, 'header', 'text'], '')
  for (const uuid of exSetup.config.workingDefinition.tab_order) {
    exSetup.updateWorkingDefinition(['languages', code, 'tabs', uuid], {
      uuid,
      button_text: '',
      text: ''
    })
  }
}
function rebuildTabs () {
  // Rebuild the tab interface

  // First rebuild the interface for setting the overall header per language
  const nav = document.getElementById('headerInputTabs')
  const pane = document.getElementById('headerInputContent')
  nav.innerText = ''
  pane.innerText = ''

  let first = true
  for (const code of exSetup.config.workingDefinition.language_order) {
    // Create the tab button
    const tabButton = document.createElement('button')
    tabButton.classList = 'nav-link header-tab'
    tabButton.setAttribute('id', 'headerTab_' + code)
    tabButton.setAttribute('data-bs-toggle', 'tab')
    tabButton.setAttribute('data-bs-target', '#headerContent_' + code)
    tabButton.setAttribute('type', 'button')
    tabButton.setAttribute('role', 'tab')
    tabButton.innerHTML = exLang.getLanguageDisplayName(code, true)
    nav.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', 'headerContent_' + code)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', '#headerTab_' + code)
    pane.appendChild(tabPane)

    const row = document.createElement('div')
    row.classList = 'row gy-2 mt-2 mb-3'
    tabPane.appendChild(row)

    const headerCol = document.createElement('div')
    headerCol.classList = 'col-6'
    row.appendChild(headerCol)

    const headerInputLabel = document.createElement('label')
    headerInputLabel.classList = 'form-label'
    headerInputLabel.innerHTML = 'Header'
    headerCol.appendChild(headerInputLabel)

    const headerCommandBar = document.createElement('div')
    headerCol.appendChild(headerCommandBar)

    const headerInput = document.createElement('div')
    headerCol.appendChild(headerInput)
    console.log(exSetup.config.workingDefinition)
    const titleEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: exSetup.config.workingDefinition.languages?.[code]?.header?.text ?? '',
      editorDiv: headerInput,
      commandDiv: headerCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['languages', code, 'header', 'text'], content)
        exSetup.previewDefinition(true)
      }
    })

    if (first) {
      tabButton.click()
      first = false
    }
  }

  document.getElementById('infoTabs').innerText = ''

  for (const uuid of exSetup.config.workingDefinition?.tab_order ?? []) {
    const tab = exSetup.config.workingDefinition?.tabs?.[uuid]
    if (tab) createInfoStationTabGUI(tab)
  }

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })

  exSetup.previewDefinition(true)
}

function changeItemOrder (uuid, dir) {
  // Move the item with the given UUID one place in the given direction

  const order = exSetup.config.workingDefinition.tab_order
  const index = order.indexOf(uuid)

  // If item not found or already at the edge, do nothing
  if (index === -1) return

  const newIndex = dir === 'up'
    ? index - 1
    : dir === 'down'
      ? index + 1
      : index

  if (newIndex < 0 || newIndex >= order.length) return

  // Swap the items
  const temp = order[newIndex]
  order[newIndex] = order[index]
  order[index] = temp

  exSetup.updateWorkingDefinition(['tab_order'], order)

  rebuildTabs()
}

function createInfoStationTabGUI (item) {
  // Create the GUI for the given InfoStation tab

  const def = exSetup.config.workingDefinition
  const infoTabs = document.getElementById('infoTabs')

  const html = `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <div
            class="accordion-button d-flex justify-content-between align-items-center collapsed"
            style="cursor: pointer;"
            data-bs-toggle="collapse"
            data-bs-target="#${item.uuid}_accordion"
            aria-expanded="false"
            aria-controls="${item.uuid}_accordion"
          >
            <span class='flex-grow-1' id="${item.uuid}_accordionName">
            ${exMarkdown.formatText(def.languages?.[def.language_order[0]]?.tabs?.[item.uuid]?.button_text ?? '', { string: true, removeParagraph: true })}
            </span>
          </div>
        </h2>
        <div id="${item.uuid}_accordion" class="accordion-collapse collapse " data-bs-parent="#surveryItems">
          <div class="accordion-body">
            <div class="d-flex">
              <button
              id="${item.uuid}_accordion_moveUpButton"
              type="button"
              class="btn btn-sm btn-outline-info"
              >
              ▲
              </button>
              <button
                id="${item.uuid}_accordion_moveDownButton"
                type="button"
                class="btn btn-sm btn-outline-info ms-1"
              >
              ▼
              </button>
              <button
                id="${item.uuid}_accordion_deleteButton"
                type="button"
                class="btn btn-sm btn-outline-danger ms-auto"
                data-bs-toggle="popover"
                title="Are you sure?"
                data-bs-content="<a id='deleteTab_${item.uuid}' class='btn btn-danger w-100 tab-delete' data-uuid='${item.uuid}'>Confirm</a>"
                data-bs-trigger="focus"
                data-bs-html="true"
              >
              Delete
              </button>
            </div>
            <hr>
            
            <nav class="mt-3">
              <div id="${item.uuid}_accordion_tabs" class="nav nav-tabs" role="tablist">
              </div>
            </nav>
            <div class="tab-content" id="${item.uuid}_accordion_content">
          </div>
        </div>
      </div>
    `
  infoTabs.insertAdjacentHTML('beforeend', html)
  document.getElementById(item.uuid + '_accordion_moveUpButton').addEventListener('click', (ev) => {
    changeItemOrder(item.uuid, 'up')
  })
  document.getElementById(item.uuid + '_accordion_moveDownButton').addEventListener('click', (ev) => {
    changeItemOrder(item.uuid, 'down')
  })
  const deleteButton = document.getElementById(item.uuid + '_accordion_deleteButton')
  const popover = new bootstrap.Popover(deleteButton)
  deleteButton.addEventListener('click', (ev) => {
    deleteButton.focus()
  })

  const nav = document.getElementById(item.uuid + '_accordion_tabs')
  const pane = document.getElementById(item.uuid + '_accordion_content')

  let first = true
  for (const code of exSetup.config.workingDefinition?.language_order ?? []) {
    // Create the tab button
    const tabButton = document.createElement('button')
    tabButton.classList = 'nav-link language-tab'
    tabButton.setAttribute('id', item.uuid + '_accordion_contentTab_' + code)
    tabButton.setAttribute('data-bs-toggle', 'tab')
    tabButton.setAttribute('data-bs-target', '#' + item.uuid + '_accordion_contentPane_' + code)
    tabButton.setAttribute('type', 'button')
    tabButton.setAttribute('role', 'tab')
    tabButton.innerHTML = exLang.getLanguageDisplayName(code, true)
    nav.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', item.uuid + '_accordion_contentPane_' + code)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', '#' + item.uuid + '_accordion_contentTab_' + code)
    pane.appendChild(tabPane)

    const row = document.createElement('div')
    row.classList = 'row gy-2 mt-2 mb-3'
    tabPane.appendChild(row)

    const buttonTextCol = document.createElement('div')
    buttonTextCol.classList = 'col-12 col-md-6'
    row.appendChild(buttonTextCol)

    const buttonTextLabel = document.createElement('label')
    buttonTextLabel.classList = 'form-label'
    buttonTextLabel.innerHTML = 'Button text'
    buttonTextLabel.setAttribute('for', 'infostationTabButtonTextInput_' + item.uuid)
    buttonTextCol.appendChild(buttonTextLabel)

    const buttonTextCommandBar = document.createElement('div')
    buttonTextCol.appendChild(buttonTextCommandBar)

    const buttonTextInput = document.createElement('div')
    buttonTextCol.appendChild(buttonTextInput)

    const buttonEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: exSetup.config.workingDefinition.languages?.[code]?.tabs?.[item.uuid]?.button_text ?? '',
      editorDiv: buttonTextInput,
      commandDiv: buttonTextCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['languages', code, 'tabs', item.uuid, 'button_text'], content)
        // If this is the default language, update the accordion title
        if (code === exSetup.config.workingDefinition.language_order[0]) {
          document.getElementById(item.uuid + '_accordionName').innerHTML = exMarkdown.formatText(content, { string: true, removeParagraph: true })
        }
        exSetup.previewDefinition(true)
      }
    })

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
      content: exSetup.config.workingDefinition.languages?.[code]?.tabs?.[item.uuid]?.text ?? '',
      editorDiv: textInput,
      commandDiv: textInputCMD,
      callback: (content) => {
        exSetup.updateWorkingDefinition(['languages', code, 'tabs', item.uuid, 'text'], content)
        exSetup.previewDefinition(true)
      }
    })

    if (first) {
      tabButton.click()
      first = false
    }
  }
}

function addInfoStationTab () {
  // Create a new tab and add it to the definition.

  const item = {
    type: 'text',
    uuid: exUtilities.uuid()
  }

  // Add to the working definition
  const tabs = exSetup.config.workingDefinition?.tabs ?? {}
  tabs[item.uuid] = item
  exSetup.updateWorkingDefinition(['tabs'], tabs)

  const tabOrder = exSetup.config.workingDefinition?.tab_order ?? []
  tabOrder.push(item.uuid)
  exSetup.updateWorkingDefinition(['tab_order'], tabOrder)

  const languages = exSetup.config.workingDefinition?.languages ?? {}
  for (const langCode of Object.keys(languages)) {
    const lang = languages[langCode]
    if (!lang.tabs) lang.tabs = {}
    lang.tabs[item.uuid] = { button_text: 'New Tab', text: '# Header\nSome basic text\n\n## Subheader\nSome more text', uuid: item.uuid }
  }
  exSetup.updateWorkingDefinition(['languages'], languages)
  rebuildTabs()
}

function deleteInfoStationTab (uuidToRemove) {
  // Delete the given InfoStation tab

  const data = exSetup.config.workingDefinition

  // Remove from item_order array
  data.tab_order = data.tab_order.filter(uuid => uuid !== uuidToRemove)
  exSetup.updateWorkingDefinition(['tab_order'], data.tab_order)

  // Remove from items object
  delete data.tabs[uuidToRemove]
  exSetup.updateWorkingDefinition(['tabs'], data.tabs)

  // Remove from each language's items
  for (const lang of Object.keys(data?.languages ?? {})) {
    if (
      data.languages[lang].tabs &&
          data.languages[lang].tabs[uuidToRemove]
    ) {
      delete data.languages[lang].tabs[uuidToRemove]
    }
  }
  exSetup.updateWorkingDefinition(['languages'], data?.languages ?? {})
  rebuildTabs()
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

// Content fields
document.getElementById('addTabButton').addEventListener('click', () => {
  addInfoStationTab()
})
// Style fields

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
  if (event.target.classList.contains('tab-delete') === false) return
  const uuid = event.target.id.slice(10)

  deleteInfoStationTab(uuid)
  exSetup.previewDefinition(true)
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
