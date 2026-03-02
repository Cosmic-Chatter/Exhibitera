/* global bootstrap, Coloris */

import exConfig from '../../common/config.js'
import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exLang from '../js/exhibitera_setup_languages.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'

let wizardHeaders = {} // Holds the markdown-formatted header text in each language

async function initializeWizard () {
  // Setup the wizard

  exSetup.prepareWizard()

  // Reset fields
  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
  document.getElementById('wizardLanguages').innerHTML = ''
  document.getElementById('wizardLanguagesBlankWarning').style.display = 'none'
  document.getElementById('wizardUploadTemplateButton').setAttribute('data-spreadsheet', '')
  document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'none'
  document.getElementById('wizardUploadMediaMissingWarning').style.display = 'none'
  document.getElementById('wizardUploadMediaMissingRow').innerHTML = ''
  document.getElementById('wizardUploadMediaBadKeyWarning').style.display = 'none'
  document.getElementById('wizardOrientationSelect').value = 'vertical'
  wizardHeaders = {}
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

      // Populate with a header input for each language
      const headerDiv = document.getElementById('wizardHeaderInputDiv')
      headerDiv.innerHTML = ''
      for (const langEl of document.getElementById('wizardLanguages').children) {
        const lang = langEl.querySelector('select').value

        const label = document.createElement('label')
        label.classList = 'form-label mt-2'
        label.setAttribute('for', 'wizardHeaderInput_' + lang)
        label.innerHTML = exLang.getLanguageDisplayName(lang, true)
        headerDiv.appendChild(label)

        const headerCommandBar = document.createElement('div')
        headerDiv.appendChild(headerCommandBar)

        const headerInput = document.createElement('div')
        headerInput.setAttribute('id', 'wizardHeaderInput_' + lang)
        headerDiv.appendChild(headerInput)

        const headerEditor = new exMarkdown.ExhibiteraMarkdownEditor({
          content: '',
          editorDiv: headerInput,
          commandDiv: headerCommandBar,
          commands: ['basic'],
          callback: (content) => {
            wizardHeaders[lang] = content
          }
        })
      }
      exSetup.wizardGoTo('Header')
    } else {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Header') {
    exSetup.wizardGoTo('Option')
  } else if (currentPage === 'Option') {
    if (document.getElementById('wizardImportOptionsSingle').checked) {
      exSetup.wizardGoTo('Layout')
    } else {
      exSetup.wizardGoTo('Spreadsheet')
    }
  } else if (currentPage === 'Spreadsheet') {
    const selectedFile = document.getElementById('wizardUploadTemplateButton').dataset.spreadsheet

    if (selectedFile && selectedFile !== '') {
      document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'none'
      document.getElementById('wizardUploadMediaMissingWarning').style.display = 'none'
      document.getElementById('wizardUploadMediaMissingRow').style.display = 'none'
      exSetup.wizardGoTo('MediaUpload')
    } else {
      document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'MediaUpload') {
    // Check that each file listed in the spreadsheet has an uploaded copy.
    const spreadsheet = document.getElementById('wizardUploadTemplateButton').dataset.spreadsheet
    const missingContent = await checkBulkImportContent(spreadsheet, ['Media filename'])

    if (missingContent.length === 0) {
      document.getElementById('wizardUploadMediaMissingWarning').style.display = 'none'
      document.getElementById('wizardUploadMediaMissingRow').style.display = 'none'
      exSetup.wizardGoTo('Layout')
    } else {
      const missingRow = document.getElementById('wizardUploadMediaMissingRow')
      missingRow.innerHTML = ''
      missingRow.style.display = 'flex'
      document.getElementById('wizardUploadMediaMissingWarning').style.display = 'block'

      for (const item of missingContent) {
        const col = document.createElement('div')
        col.classList = 'col-12 col-md-4'
        col.innerHTML = item
        missingRow.appendChild(col)
      }
    }
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
  } else if (currentPage === 'Header') {
    exSetup.wizardGoTo('Languages')
  } else if (currentPage === 'Option') {
    exSetup.wizardGoTo('Header')
  } else if (currentPage === 'Spreadsheet') {
    exSetup.wizardGoTo('Option')
  } else if (currentPage === 'MediaUpload') {
    exSetup.wizardGoTo('Spreadsheet')
  } else if (currentPage === 'Layout') {
    exSetup.wizardGoTo('Option')
  } else if (currentPage === 'ColorMode') {
    exSetup.wizardGoTo('Layout')
  }
}

async function wizardCreateDefinition () {
  // Use the provided details to build a definition file.

  // Definition name
  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
  exSetup.updateWorkingDefinition(['name'], defName)

  // Langauges
  const langOrder = []
  for (const langEl of document.getElementById('wizardLanguages').children) {
    const lang = langEl.querySelector('select').value
    langOrder.push(lang)
    const langDef = {
      code: lang,
      content: {},
      display_name: exLang.getLanguageDisplayName(lang),
      header_text: wizardHeaders?.[lang] ?? ''
    }
    exSetup.updateWorkingDefinition(['languages', lang], langDef)
  }
  exSetup.updateWorkingDefinition(['language_order'], langOrder)

  // Basics
  exSetup.updateWorkingDefinition(['name'], document.getElementById('wizardDefinitionNameInput').value.trim())

  // Layout
  const orientation = document.getElementById('wizardOrientationSelect').value

  if (document.getElementById('wizardImportOptionsSingle').checked) {
    // Add a demo item so they have something to see
    const tempUUID = exUtilities.uuid()
    exSetup.updateWorkingDefinition(['content_order'], [tempUUID])
    const tempContent = {}
    tempContent[tempUUID] = {
      filename: '',
      level: 4,
      uuid: tempUUID
    }
    exSetup.updateWorkingDefinition(['content'], tempContent)
    const tempLangContent = {}
    tempLangContent[tempUUID] = {
      description: 'This is your first timeline item',
      time: 'January 1, 1970',
      title: 'Your First Item!',
      uuid: tempUUID
    }
    exSetup.updateWorkingDefinition(['languages', exSetup.config.workingDefinition.language_order[0], 'content'], tempLangContent)
  } else {
    // Import from spreadsheet
    const spreadsheet = document.getElementById('wizardUploadTemplateButton').dataset.spreadsheet
    bulkImportFiles(spreadsheet)
  }

  if (orientation === 'horizontal') {
    exSetup.configurePreview('16x9', true)
  } else exSetup.configurePreview('9x16', true)

  // Switch to light color scheme if needed
  if (document.getElementById('wizardColorModeLight').checked) {
    exSetup.updateWorkingDefinition(['style', 'color'], {
      footerColor: '#2f3e4f',
      headerColor: '#2f3e4f',
      itemColor: '#3b5c8a',
      lineColor: '#6b7280',
      textColor: '#f5f5f0'
    })
    exSetup.updateWorkingDefinition(['style', 'background'], {
      color: '#e6e6e2',
      gradient_color_1: '#f5f5f0',
      gradient_color_2: '#e6e6e2',
      mode: 'color'
    })
  }

  const uuid = exSetup.config.workingDefinition.uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('timeline_explorer')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exUtilities.hideModal('#setupWizardModal')
}

function generateSpreadsheetTemplate (wizard = true) {
  // Generate a template spreadsheet and download it to the user's system.

  let defName = 'New Definition'
  let languages = []
  const details = ['Time', 'Title', 'Description']

  if (wizard) {
    defName = document.getElementById('wizardDefinitionNameInput').value.trim()
    for (const child of document.getElementById('wizardLanguages').children) {
      const lang = child.querySelector('select').value
      if (languages.includes(lang) === false) languages.push(lang)
    }
  } else {
    const def = exSetup.config.workingDefinition
    if (def.name && def.name !== '') defName = def.name
    languages = def.language_order
  }

  // Loop through the various combinations to make the header line for the CSV file
  let csv = 'Media filename'
  // if (wizard === false || document.getElementById('wizardCheckboxThumbnail').checked === true) csv += ', Custom thumbnail'
  csv += ', Level'
  for (const lang of languages) {
    for (const detail of details) {
      csv += ', ' + detail + ' (' + lang + ')'
    }
  }

  // Add a second line so it looks like a spreadsheet
  csv += '\n'
  for (let i = 0; i < languages.length * details.length; i++) csv += ', '

  // Initiate file download
  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(csv))
  element.setAttribute('download', defName + ' - timeline items.csv')
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) exSetup.initializeDefinition()

  // Language
  exLang.clearLanguagePicker(document.getElementById('language-picker'))
  exLang.createLanguagePicker(document.getElementById('language-picker'), {
    onLanguageAdd: addLanguage,
    beforeLanguageDelete: deleteLanguage,
    onLanguageRebuild: rebuildLanguageElements
  })

  rebuildLanguageElements([])

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('missingContentWarningField').innerHTML = ''
  document.getElementById('itemsList').innerHTML = ''
  document.getElementById('editPane').dataset.uuid = ''

  // Reset style options
  const colorInputs = ['textColor', 'headerColor', 'footerColor', 'itemColor', 'lineColor']
  colorInputs.forEach((input) => {
    const el = document.getElementById('colorPicker_' + input)
    el.value = el.dataset.default
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#1a2b3c',
    gradient_color_1: '#1a2b3c',
    gradient_color_2: '#0f1419'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()

  // Reset text size options
  document.getElementById('timeTextSizeSlider').value = 0
  document.getElementById('titleTextSizeSlider').value = 0
  document.getElementById('bodyTextSizeSlider').value = 0
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
  attractorSelect.innerText = def?.attractor ?? 'Select file'
  attractorSelect.dataset.filename = def.attractor
  document.getElementById('inactivityTimeoutField').value = def?.inactivity_timeout ?? 30

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background, { mode: 'color', color: '#719abf' })
  exSetup.updateColorPickers(def?.style?.color ?? {})
  exSetup.updateAdvancedFontPickers(def?.style?.font ?? {})
  exSetup.updateTextSizeSliders(def?.style?.text_size ?? {})

  const langSelect = document.getElementById('language-picker')
  exLang.createLanguagePicker(langSelect, {
    onLanguageAdd: addLanguage,
    beforeLanguageDelete: deleteLanguage,
    onLanguageRebuild: rebuildLanguageElements
  }
  )

  rebuildItemList()

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
}

function rebuildItemList () {
  // Rebuild the list of content items

  const def = exSetup.config.workingDefinition
  const itemsList = document.getElementById('itemsList')
  const defaultLang = def.language_order[0]

  itemsList.innerText = ''

  for (const uuid of def.content_order) {
    const itemDef = def.content[uuid]
    const itemLangDef = def.languages[defaultLang].content[uuid]

    let itemName
    if ((itemLangDef?.title ?? '') !== '' || (itemLangDef?.time ?? '') !== '') {
      itemName = exMarkdown.formatText(itemLangDef.title, { string: true, removeParagraph: true })
      let time = exMarkdown.formatText(itemLangDef.time ?? '', { string: true, removeParagraph: true })
      if (time !== '') time += '<br>'
      const title = exMarkdown.formatText(itemLangDef.title, { string: true, removeParagraph: true })
      itemName = time + title
    } else if ((itemDef?.filename ?? '') !== '') {
      itemName = itemDef.filename
    } else itemName = 'New Item'

    const col = document.createElement('div')
    col.classList = 'col'

    const button = document.createElement('button')
    button.classList = 'btn btn-info w-100 text-break item-button'
    button.id = 'itemButton_' + uuid
    button.addEventListener('click', () => {
      editItem(uuid)
    })
    button.innerHTML = itemName
    col.appendChild(button)
    itemsList.appendChild(col)
  }
}

function addItem (details = {}, after = '') {
  // Create a new item and add it to the definition

  const def = exSetup.config.workingDefinition
  const uuid = exUtilities.uuid()

  if (after === '') {
    // Insert item at end
    def.content_order.push(uuid)
  } else {
    // Insert item after the given one
    const index = def.content_order.indexOf(after)

    if (index === -1) {
      def.content_order.push(uuid)
    } else {
      def.content_order.splice(index + 1, 0, uuid)
    }
  }
  def.content[uuid] = {
    custom_thumbnail: details?.custom_thumbnail ?? '',
    filename: details?.filename ?? '',
    level: details?.level ?? 4,
    uuid
  }

  for (const code of def.language_order) {
    def.languages[code].content[uuid] = {
      description: details?.languages?.[code]?.description ?? '',
      time: details?.languages?.[code]?.time ?? '',
      title: details?.languages?.[code]?.title ?? '',
      uuid
    }
  }
  rebuildItemList()
  editItem(uuid)
  exSetup.previewDefinition(true)
}

function deleteItem (uuid, rebuildList = true) {
  // Remove the given item and clean up any references to it

  const def = exSetup.config.workingDefinition

  if (!def.content[uuid]) return

  document.getElementById('editPane').dataset.uuid = ''

  // Remove from content_order
  const index = def.content_order.indexOf(uuid)
  if (index !== -1) {
    def.content_order.splice(index, 1)
  }
  // Remove main content entry
  delete def.content[uuid]

  // Remove per-language content entries
  for (const code of def.language_order) {
    if (def.languages[code]?.content) {
      delete def.languages[code].content[uuid]
    }
  }

  if (rebuildList) {
    rebuildItemList()

    // Select a sane next item (or none)
    const nextUUID = def.content_order[index] || def.content_order[index - 1]
    if (nextUUID) {
      editItem(nextUUID)
    } else {
      const nav = document.getElementById('editPaneNav')
      const content = document.getElementById('editPaneContent')
      nav.innerText = ''
      content.innerText = ''
    }

    exSetup.previewDefinition(true)
  }
}

function moveItem (direction) {
  const def = exSetup.config.workingDefinition
  const order = def.content_order

  const uuid = document.getElementById('editPane').dataset.uuid

  const index = order.indexOf(uuid)
  if (index === -1) return false

  const target = index + direction
  if (target < 0 || target >= order.length) return false

  order.splice(index, 1)
  order.splice(target, 0, uuid)

  rebuildItemList()
  editItem(uuid)
  exSetup.previewDefinition(true)

  return true
}

function editItem (itemUUID) {
  // Build the interface for editing the given item

  const def = exSetup.config.workingDefinition
  const itemDef = def.content[itemUUID]

  // Turn the button green and make sure it's visible
  for (const el of document.querySelectorAll('.item-button')) {
    el.classList.remove('btn-success')
    el.classList.add('btn-info')
  }
  const button = document.getElementById('itemButton_' + itemUUID)
  button.classList.remove('btn-info')
  button.classList.add('btn-success')

  button.parentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  // Set up the edit interface
  document.getElementById('editPane').dataset.uuid = itemUUID // Tag for later use

  const fileSelect = document.getElementById('editItemFileSelect')
  // const thumbSelect = document.getElementById('editItemThumbnailSelect')
  const imagePreview = document.getElementById('editItemPreviewImage')
  const videoPreview = document.getElementById('editItemPreviewVideo')
  // const thumbImageTPreview = document.getElementById('editItemThumbPreviewImage')
  document.getElementById('fillModeSelect').value = itemDef?.fill_mode ?? 'cover'

  imagePreview.style.display = 'none'
  videoPreview.style.display = 'none'
  // thumbImageTPreview.style.display = 'none'

  fileSelect.innerText = itemDef?.filename || 'Select File' // Default for '' or null
  // thumbSelect.innerText = itemDef?.custom_thumbnail || 'Select File' // Default for '' or null

  // Media file preview
  if (itemDef.filename && itemDef.filename !== '') {
    const mimetype = exFiles.guessMimetype(itemDef.filename)
    let preview
    if (mimetype === 'video') {
      preview = videoPreview
    } else {
      preview = imagePreview
    }
    preview.style.display = 'block'
    preview.src = exConfig.api + '/files/' + itemDef.filename + '/thumbnail'
  }

  // Optional thumbnail
  // if (itemDef.custom_thumbnail && itemDef.custom_thumbnail !== '') {
  //   // Show preview
  //   thumbImageTPreview.style.display = 'block'
  //   thumbImageTPreview.src = exConfig.api + '/files/' + itemDef.custom_thumbnail + '/thumbnail'
  // }

  // Build nav to edit title, time, level, description in each language
  const nav = document.getElementById('editPaneNav')
  const content = document.getElementById('editPaneContent')
  nav.innerText = ''
  content.innerText = ''

  let first = true
  for (const code of def.language_order) {
    // Create the tab button
    const tabButton = document.createElement('button')
    tabButton.classList = 'nav-link header-tab'
    tabButton.setAttribute('id', 'editItemTab_' + code)
    tabButton.setAttribute('data-bs-toggle', 'tab')
    tabButton.setAttribute('data-bs-target', '#editItemContent_' + code)
    tabButton.setAttribute('type', 'button')
    tabButton.setAttribute('role', 'tab')
    tabButton.innerHTML = exLang.getLanguageDisplayName(code, true)
    nav.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', 'editItemContent_' + code)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', '#editItemTab_' + code)
    content.appendChild(tabPane)

    const row = document.createElement('div')
    row.classList = 'row row-cols-1 gy-2 mt-2 mb-3'
    tabPane.appendChild(row)

    for (const field of ['time', 'title', 'description']) {
      const col = document.createElement('div')
      col.classList = 'col'
      row.appendChild(col)

      const label = document.createElement('label')
      label.classList = 'form-label'
      label.innerHTML = field.charAt(0).toUpperCase() + field.slice(1)
      col.appendChild(label)

      const commandBar = document.createElement('div')
      col.appendChild(commandBar)

      const input = document.createElement('div')
      col.appendChild(input)

      const editor = new exMarkdown.ExhibiteraMarkdownEditor({
        content: exSetup.config.workingDefinition.languages?.[code]?.content?.[itemUUID]?.[field] ?? '',
        editorDiv: input,
        commandDiv: commandBar,
        commands: ['basic'],
        callback: (content) => {
          exSetup.updateWorkingDefinition(['languages', code, 'content', itemUUID, field], content)
          if (code === def.language_order[0]) {
            // Update the button when editing the default language
            if (field === 'title' || field === 'time') {
              let time = exMarkdown.formatText(exSetup.config.workingDefinition.languages[code].content[itemUUID].time ?? '', { string: true, removeParagraph: true })
              if (time !== '') time += '<br>'
              const title = exMarkdown.formatText(exSetup.config.workingDefinition.languages[code].content[itemUUID].title, { string: true, removeParagraph: true })
              document.getElementById('itemButton_' + itemUUID).innerHTML = time + title
            }
          }
          exSetup.previewDefinition(true)
        }
      })
    }

    const col = document.createElement('div')
    col.classList = 'col'
    row.appendChild(col)

    const label = document.createElement('label')
    label.classList = 'form-label'
    label.innerHTML = `
    Importance
    <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="More important items will be shown with larger text." style="font-size: 0.55em;">?</span>
    `
    col.appendChild(label)

    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

    const importance = document.createElement('select')
    importance.classList = 'form-select'
    importance.appendChild(new Option('High', 1))
    importance.appendChild(new Option('Medium-high', 2))
    importance.appendChild(new Option('Medium-low', 3))
    importance.appendChild(new Option('Low', 4))
    importance.value = itemDef?.level ?? 4
    importance.addEventListener('change', (ev) => {
      exSetup.updateWorkingDefinition(['content', itemUUID, 'level'], parseInt(importance.value))
      exSetup.previewDefinition(true)
      console.log(exSetup.config.workingDefinition)
    })
    col.appendChild(importance)

    if (first) {
      tabButton.click()
      first = false
    }
  }

  const editPaneRow = document.getElementById('editPaneRow')
  editPaneRow.style.display = 'block'
  editPaneRow.scrollTop = 0
}

function addLanguage (code, displayName, englishName) {
  // Set up the definition for a new langauge

  exSetup.updateWorkingDefinition(['languages', code, 'filter_order'], [])
  exSetup.updateWorkingDefinition(['languages', code, 'filters'], {})

  const content = {}
  for (const uuid of exSetup.config.workingDefinition.content_order) {
    content[uuid] = {
      caption: '',
      credit: '',
      title: '',
      uuid
    }
  }
  exSetup.updateWorkingDefinition(['languages', code, 'content'], content)
}

function deleteLanguage (code) {
  // Clean up when a language is deleted

  const def = exSetup.config.workingDefinition

  for (const filterUUID of def.languages[code].filter_order) {
    for (const contentUUID of def.content_order) {
      delete def.content?.[contentUUID]?.filter_data?.[filterUUID]
    }
  }
}

function rebuildLanguageElements (langOrder) {
  // Clear and rebuild GUI elements when the languages have been modified

  const contentNoLanguagesAlert = document.getElementById('contentNoLanguagesAlert')
  const contentInterface = document.getElementById('contentInterface')
  const headerPaneNav = document.getElementById('headerPaneNav')
  const headerPaneContent = document.getElementById('headerPaneContent')

  // Show/hide the item interface
  if (langOrder.length === 0) {
    contentNoLanguagesAlert.style.display = 'block'
    contentInterface.style.display = 'none'
  } else {
    contentNoLanguagesAlert.style.display = 'none'
    contentInterface.style.display = 'block'
  }

  // Create header edit interface
  headerPaneNav.innerText = ''
  headerPaneContent.innerText = ''

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
    headerPaneNav.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', 'headerContent_' + code)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', '#headerTab_' + code)
    headerPaneContent.appendChild(tabPane)

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
      content: exSetup.config.workingDefinition.languages?.[code]?.header_text ?? '',
      editorDiv: headerInput,
      commandDiv: headerCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['languages', code, 'header_text'], content)
        exSetup.previewDefinition(true)
      }
    })

    if (first) {
      tabButton.click()
      first = false
    }
  }

  const currentItemUUID = document.getElementById('editPane').dataset.uuid
  if (currentItemUUID) editItem(currentItemUUID)
}

function onAttractorFileChange () {
  // Called when a new image or video is selected.

  const file = document.getElementById('attractorSelect').dataset.filename
  exSetup.config.workingDefinition.attractor = file

  exSetup.previewDefinition(true)
}

async function checkContentExists () {
  // Cross-check content from the definition with files in the content directory.

  const def = exSetup.config.workingDefinition

  const missingContentWarning = document.getElementById('missingContentWarningField')
  const missingContentSuccess = document.getElementById('missingContentSuccessField')
  const missingContentList = document.getElementById('missingContentList')
  const missingContentListDiv = document.getElementById('missingContentListDiv')

  // Loop through the items and collect all media files listed
  const media = new Set()

  for (const uuid of def.content_order) {
    const item = def.content[uuid]
    if (item.filename && item.filename !== '') media.add(item.filename)
    if (item.custom_thumbnail && item.custom_thumbnail !== '') media.add(item.custom_thumbnail)
  }
  const missingContent = await _checkContentExists(Array.from(media))

  if (missingContent.length === 0) {
    missingContentSuccess.style.display = 'block'
    missingContentWarning.style.display = 'none'
    missingContentListDiv.style.display = 'none'
  } else {
    missingContentSuccess.style.display = 'none'
    missingContentWarning.style.display = 'block'
    missingContentListDiv.style.display = 'block'

    for (const file of missingContent) {
      missingContentList.innerHTML += `<li>${file}</li>`
    }
  }
}

async function _checkContentExists (media) {
  // Cross-reference the files in the items with a list of available content

  const missingContent = new Set()

  const availableContentReq = await exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/files/availableContent'
  })
  const availableContent = availableContentReq.content

  // Loop through the definition and compare referenced content to what's available
  for (const file of media) {
    if (!availableContent.includes(file)) missingContent.add(file)
  }
  return Array.from(missingContent)
}

async function checkBulkImportContent (spreadsheetFile, keys) {
  // Load the given spreadsheet and check that all the content listed exists
  // Retrieve the spreadsheet and check the content for each image key against the available content

  const rawText = await exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + spreadsheetFile,
    api: '',
    rawResponse: true,
    noCache: true
  })
  const spreadsheet = exFiles.csvToJSON(rawText).json

  // Iterate the spreadsheet rows and collect all media files
  const media = new Set()
  for (const row of spreadsheet) {
    for (const key of keys) {
      if ((key in row) === false) {
        continue
      }
      if (row[key].trim() === '') continue

      media.add(row[key].trim())
    }
  }
  const missingContent = await _checkContentExists(media)
  return missingContent
}

async function onBulkImportFileUpload (ev) {
  // Check if there are missing files when bulk importing

  const bulkUploadMissingContentDiv = document.getElementById('bulkUploadMissingContentDiv')
  const bulkUploadMissingContent = document.getElementById('bulkUploadMissingContent')

  const missingFiles = await checkBulkImportContent(document.getElementById('bulkImportUploadTemplate').dataset.spreadsheet, ['Media filename', 'Custom thumbnail'])
  if (missingFiles.length === 0) {
    ev.target.classList.remove('btn-secondary')
    ev.target.classList.remove('btn-warning')
    ev.target.classList.add('btn-success')
    bulkUploadMissingContentDiv.style.display = 'none'
  } else {
    ev.target.classList.remove('btn-secondary')
    ev.target.classList.remove('btn-success')
    ev.target.classList.add('btn-warning')
    bulkUploadMissingContentDiv.style.display = 'block'
    bulkUploadMissingContent.innerText = ''
    for (const file of missingFiles) {
      bulkUploadMissingContent.innerHTML += `<li>${file}</li>`
    }
  }
}

async function bulkImportFiles (spreadsheetFile) {
  // Use the selected spreadsheet to create new items

  if (!spreadsheetFile || spreadsheetFile === '') return

  const rawText = await exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + spreadsheetFile,
    api: '',
    rawResponse: true,
    noCache: true
  })
  const spreadsheet = exFiles.csvToJSON(rawText).json

  // Iterate the spreadsheet and create an item for each row
  for (const row of spreadsheet) {
    const details = parseBulkImportSpreadsheetRow(row)
    addItem(details)
  }
  exUtilities.hideModal('#bulkImportModal')
}

function parseBulkImportSpreadsheetRow (input) {
  const result = {
    filename: input['Media filename'] || '',
    custom_thumbnail: input['Custom thumbnail'] || '',
    level: parseInt(input.Level) || 4,
    languages: {}
  }

  for (const [key, value] of Object.entries(input)) {
    const open = key.lastIndexOf('(')
    const close = key.lastIndexOf(')')

    if (open === -1 || close === -1) continue

    const field = key.slice(0, open).trim().toLowerCase()
    const lang = key.slice(open + 1, close)

    if (!result.languages[lang]) {
      result.languages[lang] = {}
    }

    result.languages[lang][field] = value
  }

  return result
}

// Set helper address for use with exCommon.makeHelperRequest
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

document.getElementById('wizardDownloadTemplateButton').addEventListener('click', () => {
  generateSpreadsheetTemplate()
})
document.getElementById('wizardUploadTemplateButton').addEventListener('click', () => {
  exFileSelect.createFileSelectionModal({
    filetypes: ['csv'],
    multiple: false
  })
    .then((selectedFiles) => {
      if (selectedFiles.length === 0) return
      document.getElementById('wizardUploadTemplateButton').dataset.spreadsheet = selectedFiles[0]
    })
})

document.getElementById('wizardUploadMediaButton').addEventListener('click', () => {
  exFileSelect.createFileSelectionModal({
    filetypes: ['image', 'video'],
    manage: true,
    multiple: true
  })
})

// Main buttons
document.getElementById('manageContentButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ manage: true })
})
document.getElementById('showCheckContentButton').addEventListener('click', () => {
  document.getElementById('missingContentWarningField').style.display = 'none'
  document.getElementById('missingContentSuccessField').style.display = 'none'
  document.getElementById('missingContentList').innerText = ''
  document.getElementById('missingContentListDiv').style.display = 'none'
  exUtilities.showModal('#checkContentModal')
})
document.getElementById('checkContentButton').addEventListener('click', checkContentExists)
document.getElementById('clearItemsButton').addEventListener('click', () => {
  exUtilities.showModal('#clearItemsModal')
})

// Definition fields

document.getElementById('attractorSelect').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['image', 'video'], multiple: false })
    .then((files) => {
      if (files.length === 1) {
        event.target.innerText = files[0]
        event.target.dataset.filename = files[0]
        onAttractorFileChange()
      }
    })
})
document.getElementById('attractorSelectClear').addEventListener('click', (event) => {
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerText = 'Select file'
  attractorSelect.dataset.filename = ''
  onAttractorFileChange()
})

document.getElementById('inactivityTimeoutField').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['inactivity_timeout'], event.target.value)
  exSetup.previewDefinition(true)
})

// Content buttons

document.getElementById('clearItemsButton').addEventListener('click', () => {
  exUtilities.showModal('#clearItemsModal')
})
document.getElementById('clearItemsConfirmButton').addEventListener('click', () => {
  const items = exSetup.config.workingDefinition.content_order.slice() // Clone
  for (const item of items) {
    deleteItem(item, false)
  }
  rebuildItemList()
  exSetup.previewDefinition(true)
  exUtilities.hideModal('#clearItemsModal')
})
document.getElementById('addItemButton').addEventListener('click', addItem)
document.getElementById('addItemAfterCurrentButton').addEventListener('click', () => {
  const currentItem = document.getElementById('editPane').dataset.uuid
  addItem({}, currentItem)
})
document.getElementById('editPaneDeleteButton').addEventListener('click', () => {
  const uuid = document.getElementById('editPane').dataset.uuid
  deleteItem(uuid)
})
document.getElementById('editPaneUpButton').addEventListener('click', () => {
  moveItem(-1)
})
document.getElementById('editPaneDownButton').addEventListener('click', () => {
  moveItem(1)
})

for (const id of ['editItemFileSelect', 'editItemPreviewImage', 'editItemPreviewVideo']) {
  document.getElementById(id).addEventListener('click', () => {
  // Handle selecting the media file for the current item

    const uuid = document.getElementById('editPane').dataset.uuid
    if (!uuid || uuid === '') return

    exFileSelect.createFileSelectionModal({ filetypes: ['image', 'video'], multiple: false })
      .then((files) => {
        if (files.length !== 1) return
        exSetup.updateWorkingDefinition(['content', uuid, 'filename'], files[0])
        document.getElementById('editItemFileSelect').innerText = files[0]
        console.log(exSetup.config.workingDefinition)
        const imagePreview = document.getElementById('editItemPreviewImage')
        const videoPreview = document.getElementById('editItemPreviewVideo')
        imagePreview.style.display = 'none'
        videoPreview.style.display = 'none'

        const mimetype = exFiles.guessMimetype(files[0])
        let preview
        if (mimetype === 'video') {
          preview = videoPreview
        } else {
          preview = imagePreview
        }
        preview.style.display = 'block'
        preview.src = exConfig.api + '/files/' + files[0] + '/thumbnail'

        exSetup.previewDefinition(true)
      })
  })
}

document.getElementById('editItemFileDelete').addEventListener('click', () => {
  // Handle deleting the media file from the current item.

  const uuid = document.getElementById('editPane').dataset.uuid
  if (!uuid || uuid === '') return

  exSetup.updateWorkingDefinition(['content', uuid, 'filename'], '')
  document.getElementById('editItemFileSelect').innerText = 'Select File'
  document.getElementById('editItemPreviewImage').style.display = 'none'
  document.getElementById('editItemPreviewVideo').style.display = 'none'
  exSetup.previewDefinition(true)
})

document.getElementById('fillModeSelect').addEventListener('change', (ev) => {
  // Handle deleting the media file from the current item.

  const uuid = document.getElementById('editPane').dataset.uuid
  if (!uuid || uuid === '') return

  exSetup.updateWorkingDefinition(['content', uuid, 'fill_mode'], ev.target.value)
  exSetup.previewDefinition(true)
})

// Bulk import
document.getElementById('showBulkImportButton').addEventListener('click', () => {
  for (const el of document.querySelectorAll('.bulk-import-button')) {
    el.classList.remove('btn-success')
    el.classList.remove('btn-warning')
    el.classList.add('btn-secondary')
  }
  document.getElementById('bulkImportUploadTemplate').dataset.spreadsheet = ''
  document.getElementById('bulkUploadMissingContentDiv').style.display = 'none'
  exUtilities.showModal('#bulkImportModal')
})
document.getElementById('bulkImportDownloadTemplate').addEventListener('click', (ev) => {
  ev.target.classList.remove('btn-secondary')
  ev.target.classList.add('btn-success')
  generateSpreadsheetTemplate(false)
})
document.getElementById('bulkImportUploadTemplate').addEventListener('click', (ev) => {
  exFileSelect.createFileSelectionModal({
    filetypes: ['csv'],
    multiple: false
  })
    .then((selectedFiles) => {
      if (selectedFiles.length > 0) {
        document.getElementById('bulkImportUploadTemplate').dataset.spreadsheet = selectedFiles[0]
        ev.target.classList.remove('btn-secondary')
        ev.target.classList.add('btn-success')
      }
    })
})
document.getElementById('bulkImportUploadMedia').addEventListener('click', (ev) => {
  exFileSelect.createFileSelectionModal({
    filetypes: ['audio', 'image', 'video'],
    manage: true
  })
    .then(() => {
      onBulkImportFileUpload(ev)
    })
})
document.getElementById('bulkImportButton').addEventListener('click', () => {
  const spreadsheetFile = document.getElementById('bulkImportUploadTemplate').dataset.spreadsheet
  bulkImportFiles(spreadsheetFile)
})

// Style fields
const colorInputs = document.querySelectorAll('.coloris')

for (const input of colorInputs) {
  input.addEventListener('change', function () {
    const value = this.value.trim()
    const property = this.dataset.property
    exSetup.updateWorkingDefinition(['style', 'color', property], value)
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

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// Populate available languages
exLang.createLanguagePicker(document.getElementById('language-picker'), {
  onLanguageAdd: addLanguage,
  beforeLanguageDelete: deleteLanguage,
  onLanguageRebuild: rebuildLanguageElements
})

exSetup.configure({
  app: 'timeline_explorer',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    content: {},
    content_order: [],
    languages: {},
    language_order: [],
    style: {
      background: {
        color: '#1a2b3c',
        gradient_color_1: '#1a2b3c',
        gradient_color_2: '#0f1419',
        mode: 'color'
      },
      color: {
        footerColor: '#0f1419',
        headerColor: '#0f1419',
        itemColor: '#2f3e4f',
        lineColor: '#6b7280',
        textColor: '#e6e6e2'
      },
      font: {
        Body: '/_fonts/OpenSans-Regular.ttf',
        Header: '/_fonts/OpenSans-Bold.ttf',
        Time: '/_fonts/OpenSans-Regular.ttf',
        Title: '/_fonts/OpenSans-Bold.ttf'
      },
      text_size: {}
    }
  }
})
