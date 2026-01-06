/* global bootstrap, Coloris */

import exConfig from '../../common/config.js'
import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exLang from '../js/exhibitera_setup_languages.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'

const wizardHeaders = {} // Holds the markdown-formatted header text in each language

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
    exSetup.wizardGoTo('Spreadsheet')
  } else if (currentPage === 'Spreadsheet') {
    const selectedFile = document.getElementById('wizardUploadTemplateButton').getAttribute('data-spreadsheet')
    if (selectedFile !== '') {
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
    let missing = []
    try {
      missing = await _checkContentExists(spreadsheet, ['Image'])
      document.getElementById('wizardUploadMediaBadKeyWarning').style.display = 'none'
    } catch (e) {
      if (String(e).slice(0, 14) === 'Error: bad_key') {
        document.getElementById('wizardUploadMediaBadKeyWarning').style.display = 'block'
        return
      }
    }

    if (missing.length === 0) {
      document.getElementById('wizardUploadMediaMissingWarning').style.display = 'none'
      document.getElementById('wizardUploadMediaMissingRow').style.display = 'none'
      exSetup.wizardGoTo('Layout')
    } else {
      const missingRow = document.getElementById('wizardUploadMediaMissingRow')
      missingRow.innerHTML = ''
      missingRow.style.display = 'flex'
      document.getElementById('wizardUploadMediaMissingWarning').style.display = 'block'

      for (const item of missing) {
        const col = document.createElement('div')
        col.classList = 'col-12 col-md-4'
        col.innerHTML = item
        missingRow.appendChild(col)
      }
    }
  } else if (currentPage === 'Layout') {
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Languages') {
    exSetup.wizardGoTo('Welcome')
  } else if (currentPage === 'Header') {
    exSetup.wizardGoTo('Languages')
  } else if (currentPage === 'Spreadsheet') {
    exSetup.wizardGoTo('Header')
  } else if (currentPage === 'MediaUpload') {
    exSetup.wizardGoTo('Spreadsheet')
  } else if (currentPage === 'Layout') {
    exSetup.wizardGoTo('MediaUpload')
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
      display_name: exLang.getLanguageDisplayName(lang),
      image_key: 'Image',
      level_key: 'Level',
      title_key: 'Title (' + lang + ')',
      time_key: 'Time (' + lang + ')',
      short_text_key: 'Description (' + lang + ')',
      header_text: wizardHeaders?.[lang] ?? ''
    }
    exSetup.updateWorkingDefinition(['languages', lang], langDef)
  }
  exSetup.updateWorkingDefinition(['language_order'], langOrder)

  // Basics
  exSetup.updateWorkingDefinition(['name'], document.getElementById('wizardDefinitionNameInput').value.trim())
  exSetup.updateWorkingDefinition(['spreadsheet'], document.getElementById('wizardUploadTemplateButton').getAttribute('data-spreadsheet'))

  // Layout
  const orientation = document.getElementById('wizardOrientationSelect').value

  // if (orientation === 'horizontal') {
  //   exSetup.updateWorkingDefinition(['setup'], { auto_refresh: true, preview_ratio: '16x9' })
  // } else {
  //   exSetup.updateWorkingDefinition(['setup'], { auto_refresh: true, preview_ratio: '9x16' })
  // }

  exUtilities.hideModal('#setupWizardModal')

  if (orientation === 'horizontal') {
    exSetup.configurePreview('16x9', true)
  } else exSetup.configurePreview('9x16', true)

  const uuid = exSetup.config.workingDefinition.uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('timeline_explorer')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exUtilities.hideModal('#setupWizardModal')
}

function generateSpreadsheetTemplate () {
  // Based on selections made in the wizard, generate a template spreadsheet and download it to the user's system.

  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()

  const languages = []
  for (const child of document.getElementById('wizardLanguages').children) {
    const lang = child.querySelector('select').value
    if (languages.includes(lang) === false) languages.push(lang)
  }

  const details = ['Time', 'Title', 'Description']

  // Loop through the various combinations to make the header line for the CSV file
  let csv = 'Level, Image'
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
  element.setAttribute('download', defName + ' - event list.csv')
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

  // Reset style options
  const colorInputs = ['textColor', 'headerColor', 'footerColor', 'itemColor', 'lineColor']
  colorInputs.forEach((input) => {
    const el = document.getElementById('colorPicker_' + input)
    el.value = el.dataset.default
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#719abf',
    gradient_color_1: '#719abf',
    gradient_color_2: '#719abf'
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

function addItem (details = {}) {
  // Create a new item and add it to the definition

  const def = exSetup.config.workingDefinition
  const uuid = exUtilities.uuid()

  def.content_order.push(uuid)
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
  const thumbSelect = document.getElementById('editItemThumbnailSelect')
  const imagePreview = document.getElementById('editItemPreviewImage')
  const videoPreview = document.getElementById('editItemPreviewVideo')
  const thumbImageTPreview = document.getElementById('editItemThumbPreviewImage')

  imagePreview.style.display = 'none'
  videoPreview.style.display = 'none'
  thumbImageTPreview.style.display = 'none'

  fileSelect.innerText = itemDef?.filename || 'Select File' // Default for '' or null
  thumbSelect.innerText = itemDef?.custom_thumbnail || 'Select File' // Default for '' or null

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
  if (itemDef.custom_thumbnail && itemDef.custom_thumbnail !== '') {
    // Show preview
    thumbImageTPreview.style.display = 'block'
    thumbImageTPreview.src = exConfig.api + '/files/' + itemDef.custom_thumbnail + '/thumbnail'
  }

  // Build nav to edit title, time, description in each language
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
  // Show/hide the item interface
  if (langOrder.length === 0) {
    contentNoLanguagesAlert.style.display = 'block'
    contentInterface.style.display = 'none'
  } else {
    contentNoLanguagesAlert.style.display = 'none'
    contentInterface.style.display = 'block'
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

function onSpreadsheetFileChange () {
  // Called when a new spreadsheet is selected. Get the csv file and populate the options.

  const file = document.getElementById('spreadsheetSelect').dataset.filename
  if (file == null) return
  exSetup.config.workingDefinition.spreadsheet = file

  exCommon.makeHelperRequest({
    api: '',
    method: 'GET',
    endpoint: '/content/' + file,
    rawResponse: true,
    noCache: true
  })
    .then((result) => {
      const csvAsJSON = exFiles.csvToJSON(result)
      if (csvAsJSON.error === true) {
        document.getElementById('badSpreadsheetWarningLineNumber').innerHTML = csvAsJSON.error_index + 2
        document.getElementById('badSpreadsheetWarning').style.display = 'block'
      } else {
        document.getElementById('badSpreadsheetWarning').style.display = 'none'
      }
      const spreadsheet = csvAsJSON.json
      const keys = Object.keys(spreadsheet[0])
      document.getElementById('spreadsheetSelect').dataset.availableKeys = keys
      populateKeySelects(keys)
      exSetup.previewDefinition(true)
    })
}

async function checkContentExists () {
  // Cross-check content from the spreadsheet with files in the content directory.

  const workingDefinition = exSetup.config.workingDefinition
  const imageKeys = []
  const missingContentField = document.getElementById('missingContentWarningField')

  missingContentField.innerHTML = ''

  // Loop through the defintion and collect any unique media keys
  for (const lang of Object.keys(workingDefinition.languages)) {
    if (imageKeys.includes(workingDefinition.languages[lang].image_key) === false) {
      imageKeys.push(workingDefinition.languages[lang].image_key)
    }
  }

  const missingContent = await _checkContentExists(workingDefinition.spreadsheet, imageKeys)

  if (missingContent.length === 0) {
    missingContentField.classList.add('text-success')
    missingContentField.classList.remove('text-danger')
    missingContentField.innerHTML = 'No missing content!'
  } else {
    missingContentField.classList.add('text-danger')
    missingContentField.classList.remove('text-success')
    let html = '<b>Missing content found:</b><ul>'
    missingContent.forEach((file) => {
      html += '<li>' + file + '</li>'
    })
    html += '</ul>'
    missingContentField.innerHTML = html
  }
}

function _checkContentExists (spreadsheet, keys) {
  // Take the given spreadsheet filename and image keys and cross check with
  // the files available in the content directory. Return the names of any
  // files that do not exist.

  return new Promise(function (resolve, reject) {
    // Get a list of available content

    let availableContent
    const missingContent = []

    exCommon.makeHelperRequest({
      method: 'GET',
      endpoint: '/files/availableContent'
    })
      .then((result) => {
        availableContent = result.content
        // Retrieve the spreadsheet and check the content for each image key against the available content
        exCommon.makeHelperRequest({
          api: '',
          method: 'GET',
          endpoint: '/content/' + spreadsheet,
          rawResponse: true,
          noCache: true
        })
          .then((raw) => {
            const spreadsheet = exFiles.csvToJSON(raw).json
            spreadsheet.forEach((row) => {
              for (const key of keys) {
                if ((key in row) === false) {
                  reject(new Error('bad_key: ' + key))
                  continue
                }
                if (row[key].trim() === '') continue
                if (availableContent.includes(row[key]) === false) missingContent.push(row[key])
              }
            })
            resolve(missingContent)
          })
      })
  })
}

function populateKeySelects (keyList) {
  // Take a list of keys and use it to populate all the selects used to match keys to parameters.

  const workingDefinition = exSetup.config.workingDefinition

  for (const lang of Object.keys(workingDefinition?.languages ?? {})) {
    const langDict = workingDefinition.languages[lang]
    for (const input of Object.keys(inputFields)) {
      const inputDict = inputFields[input]
      if (inputDict.kind === 'select') {
        const thisInput = document.getElementById(input + '_' + lang)
        if (thisInput == null) continue
        thisInput.innerText = ''

        for (const key of keyList) {
          const option = document.createElement('option')
          option.value = key
          option.innerHTML = key
          thisInput.appendChild(option)
        }

        // If we already have a value for this select, set it
        thisInput.value = langDict?.[inputDict?.property]
      }
    }
  }
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// The input fields to specifiy content for each langauge
const inputFields = {
  keyTimeSelect: {
    name: 'Time column',
    kind: 'select',
    property: 'time_key'
  },
  keyTitleSelect: {
    name: 'Title column',
    kind: 'select',
    property: 'title_key'
  },
  keyLevelSelect: {
    name: 'Level column',
    kind: 'select',
    property: 'level_key',
    hint: 'A number from 1 - 4 giving the importance of the event.'
  },
  keyShortSelect: {
    name: 'Short text column',
    kind: 'select',
    property: 'short_text_key'
  },
  keyImageSelect: {
    name: 'Image column',
    kind: 'select',
    property: 'image_key'
  }
  // keyThumbnailSelect: {
  //   name: 'Thumbnail key',
  //   kind: 'select',
  //   property: 'thumbnail_key'
  // }
}

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

document.getElementById('wizardDownloadTemplateButton').addEventListener('click', generateSpreadsheetTemplate)
document.getElementById('wizardUploadTemplateButton').addEventListener('click', () => {
  exFileSelect.createFileSelectionModal({
    filetypes: ['csv'],
    multiple: false
  })
    .then((selectedFiles) => {
      document.getElementById('wizardUploadTemplateButton').setAttribute('data-spreadsheet', selectedFiles[0])
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
  document.getElementById('missingContentWarningField').innerText = ''
  exUtilities.showModal('#checkContentModal')
})
document.getElementById('checkContentButton').addEventListener('click', checkContentExists)

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

    exFileSelect.createFileSelectionModal({ filetypes: ['audio', 'image', 'video'], multiple: false })
      .then((files) => {
        if (files.length !== 1) return
        exSetup.updateWorkingDefinition(['content', uuid, 'filename'], files[0])
        document.getElementById('editItemFileSelect').innerText = files[0]

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
    languages: {},
    language_order: [],
    style: {
      background: {
        mode: 'color',
        color: '#719abf'
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
