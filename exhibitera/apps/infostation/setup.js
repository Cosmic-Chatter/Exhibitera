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

async function wizardForward (currentPage) {
  // Check if the wizard is ready to advance and perform the move

  if (currentPage === 'Welcome') {
    const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
    if (defName !== '') {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
      exSetup.wizardGoTo('Languages')
    } else {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Languages') {
    if (document.getElementById('wizardLanguages').children.length > 0) {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'none'

      // Add the selected langauges to the definition
      const langOrder = []
      for (const langEl of document.getElementById('wizardLanguages').children) {
        const lang = langEl.querySelector('select').value
        if (langOrder.includes(lang) === false) langOrder.push(lang)

        const langDef = {
          code: lang,
          display_name: exLang.getLanguageDisplayName(lang),
          english_name: exLang.getLanguageDisplayName(lang, true),
          tabs: {}
        }
        exSetup.updateWorkingDefinition(['languages', lang], langDef)
      }
      exSetup.updateWorkingDefinition(['language_order'], langOrder)

      document.getElementById('wizardTabList').innerText = ''
      exSetup.updateWorkingDefinition(['tab_order'], [])

      // Build the Markdown text editor
      const defaultLang = exSetup.config.workingDefinition.language_order[0]
      const titleEditor = new exMarkdown.ExhibiteraMarkdownEditor({
        content: exSetup.config.workingDefinition.languages?.[defaultLang]?.header?.text ?? '',
        editorDiv: document.getElementById('wizardHeaderInput'),
        commandDiv: document.getElementById('wizardHeaderCommandBar'),
        commands: ['basic'],
        callback: (content) => {
          exSetup.updateWorkingDefinition(['languages', defaultLang, 'header', 'text'], content)
        }
      })

      exSetup.wizardGoTo('Header')
    } else {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Header') {
    exSetup.wizardGoTo('Topics')
  } else if (currentPage === 'Topics') {
    const topics = document.querySelectorAll('.wizard-topic')
    if (topics.length === 0) {
      document.getElementById('wizardTabsNoneWarning').style.display = 'block'
      return
    }

    for (const t of topics) {
      if (t.value.trim() === '') {
        document.getElementById('wizardTabsBlankWarning').style.display = 'block'
        return
      }
    }
    document.getElementById('wizardTabsNoneWarning').style.display = 'none'
    document.getElementById('wizardTabsBlankWarning').style.display = 'none'

    exSetup.previewDefinition(true)
    exSetup.wizardGoTo('Layout')
  } else if (currentPage === 'Layout') {
    exSetup.wizardGoTo('ColorMode')
  } else if (currentPage === 'ColorMode') {
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Languages') {
    exSetup.wizardGoTo('Welcome')
  } else if (currentPage === 'Questions') {
    exSetup.wizardGoTo('Languages')
  } else if (currentPage === 'Answers') {
    exSetup.wizardGoTo('Questions')
  } else if (currentPage === 'Layout') {
    exSetup.wizardGoTo('Answers')
  } else if (currentPage === 'ColorMode') {
    exSetup.wizardGoTo('Layout')
  }
}

function wizardCreateTab (userDetails) {
  // Create the GUI representation of a new question in the wizard

  const tabOrder = exSetup.config.workingDefinition?.tab_order ?? []
  const defaultLang = exSetup.config.workingDefinition.language_order[0]

  const defaults = {
    uuid: exUtilities.uuid(),
    type: 'text'
  }

  // Merge in user details
  const details = { ...defaults, ...userDetails }

  if (tabOrder.includes(details.uuid) === false) {
    tabOrder.push(details.uuid)
    exSetup.updateWorkingDefinition(['tab_order', tabOrder])
    for (const key of Object.keys(defaults)) {
      exSetup.updateWorkingDefinition(['tabs', details.uuid, key], details[key])
    }
  }

  const col = document.createElement('div')
  col.classList = 'col-12'
  col.setAttribute('id', 'wizardTab_' + details.uuid)
  document.getElementById('wizardTabList').appendChild(col)

  const row = document.createElement('div')
  row.classList = 'row'
  col.appendChild(row)

  const topicCol = document.createElement('div')
  topicCol.classList = 'col-10 pe-1'
  row.appendChild(topicCol)

  const topicText = document.createElement('input')
  topicText.setAttribute('type', 'text')
  topicText.classList = 'form-control wizard-topic'
  topicText.value = ''
  topicText.addEventListener('change', () => {
    for (const code of exSetup.config.workingDefinition.language_order) {
      exSetup.updateWorkingDefinition(['languages', code, 'tabs', details.uuid, 'button_text'], topicText.value.trim())
      exSetup.updateWorkingDefinition(['languages', code, 'tabs', details.uuid, 'text'], `# ${topicText.value.trim()}\nSome basic text\n## Subheader\nSome more text`)
      exSetup.updateWorkingDefinition(['languages', code, 'tabs', details.uuid, 'uuid'], details.uuid)
    }
  })
  topicCol.appendChild(topicText)

  const buttonCol = document.createElement('div')
  buttonCol.classList = 'col-2 ps-1'
  row.appendChild(buttonCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger w-100'
  deleteButton.innerHTML = '×'
  deleteButton.addEventListener('click', () => {
    deleteInfoStationTab(details.uuid, true)
  })
  buttonCol.appendChild(deleteButton)
}

async function wizardCreateDefinition () {
  // Use the provided details to build a definition file.

  // Definition name
  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
  exSetup.updateWorkingDefinition(['name'], defName)

  const orientation = document.getElementById('wizardOrientationSelect').value
  if (orientation === 'horizontal') {
    exSetup.configurePreview('16x9', true)
  } else exSetup.configurePreview('9x16', true)

  // Switch to light color scheme if needed
  if (document.getElementById('wizardColorModeLight').checked) {
    exSetup.updateWorkingDefinition(['style', 'color'], {
      caption: '#e6e6e2',
      footer: '#3b5c8a',
      header: '#2f3e4f',
      quote: '#f5f5f0',
      'section-background': '#5a7ba8',
      'section-border': '#4b5563',
      'section-header': '#f5f5f0',
      'section-shadow': '#0f141900',
      'tab-button': '#6b7280',
      'tab-button-active': '#c3512f',
      text: '#f5f5f0'
    })
    exSetup.updateWorkingDefinition(['style', 'background'], {
      color: '#2f3e4f',
      gradient_color_1: '#2f3e4f',
      gradient_color_2: '#243447',
      mode: 'color'
    })
  }

  const uuid = exSetup.config.workingDefinition.uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('infostation')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exUtilities.hideModal('#setupWizardModal')
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

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#0f1419',
    gradient_color_1: '#5a7ba8',
    gradient_color_2: '#1a2b3c'
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
  if (def?.behavior?.attractor && def.behavior.attractor.trim() !== '') {
    attractorSelect.innerText = def.behavior.attractor
  } else {
    attractorSelect.innerText = 'Select file'
  }
  attractorSelect.dataset.filename = def?.behavior?.attractor ?? ''
  document.getElementById('inactivityTimeoutField').value = def?.behavior?.inactivity_timeout ?? 30

  // Layout fields
  const buttonSizeSlider = document.getElementById('buttonSizeSlider')
  exSetup.createAdvancedSlider(buttonSizeSlider, def?.style?.layout?.button_size)

  const headerSizeSlider = document.getElementById('headerSizeSlider')
  exSetup.createAdvancedSlider(headerSizeSlider, def?.style?.layout?.header_height)

  const sidebarSizeSlider = document.getElementById('sidebarSizeSlider')
  exSetup.createAdvancedSlider(sidebarSizeSlider, def?.style?.layout?.sidebar_width)

  const toolbarSizeSlider = document.getElementById('toolbarSizeSlider')
  exSetup.createAdvancedSlider(toolbarSizeSlider, def?.style?.layout?.toolbar_height)

  const sectionCornerRadiusSlider = document.getElementById('sectionCornerRadiusSlider')
  exSetup.createAdvancedSlider(sectionCornerRadiusSlider, def?.style?.layout?.section_corner_radius)

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
        <div id="${item.uuid}_accordion" class="accordion-collapse collapse " data-bs-parent="#infoTabs">
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

function addInfoStationTab (buttonText = null, bodyText = null) {
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
    lang.tabs[item.uuid] = { button_text: buttonText || 'New Tab', text: bodyText || '# Header\nSome basic text\n\n## Subheader\nSome more text', uuid: item.uuid }
  }
  exSetup.updateWorkingDefinition(['languages'], languages)

  rebuildTabs()
}

function deleteInfoStationTab (uuidToRemove, wizard = false) {
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

  if (wizard) {
    document.getElementById('wizardTab_' + uuidToRemove).remove()
  } else rebuildTabs()
}

function onAttractorFileChange () {
  // Called when a new image or video is selected.

  const file = document.getElementById('attractorSelect').dataset.filename
  exSetup.config.workingDefinition.behavior.attractor = file

  exSetup.previewDefinition(true)
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// Add event listeners
// -------------------------------------------------------------

// Wizard

// Connect the forward and back buttons
for (const el of document.querySelectorAll('.wizard-forward')) {
  el.addEventListener('click', () => {
    wizardForward(el.getAttribute('data-current-page'))
  })
}
for (const el of document.querySelectorAll('.wizard-back')) {
  el.addEventListener('click', () => {
    wizardBack(el.getAttribute('data-current-page'))
  })
}

document.getElementById('wizardAddTabButton').addEventListener('click', (event) => {
  wizardCreateTab()
})

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
  exSetup.updateWorkingDefinition(['behavior', 'inactivity_timeout'], event.target.value)
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
        color: '#0f1419',
        mode: 'color'
      },
      color: {
        caption: '#e6e6e2',
        footer: '#243447',
        header: '#243447',
        quote: '#f5f5f0',
        'section-background': '#2f3e4f',
        'section-border': '#e6e6e2',
        'section-header': '#f5f5f0',
        'section-shadow': '#0f141900',
        'tab-button': '#4b5563',
        'tab-button-active': '#e06a47',
        text: '#e6e6e2'
      },
      font: {
        body: '/_fonts/OpenSans-Regular.ttf',
        button: '/_fonts/OpenSans-Regular.ttf',
        caption: '/_fonts/OpenSans-LightItalic.ttf',
        header: '/_fonts/OpenSans-Bold.ttf',
        quote: '/_fonts/OpenSans-SemiboldItalic.ttf',
        'section-header': '/_fonts/OpenSans-Bold.ttf'
      },
      text_size: {}
    },
    tabs: {},
    tab_order: []
  }
})
