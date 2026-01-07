/* global Coloris, bootstrap */

import exConfig from '../../common/config.js'
import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exLang from '../js/exhibitera_setup_languages.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'

async function initializeWizard () {
  // Setup the wizard

  exSetup.prepareWizard()

  // Reset fields
  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
  document.getElementById('wizardLanguages').innerHTML = ''
  document.getElementById('wizardLanguagesBlankWarning').style.display = 'none'
  document.getElementById('wizardCheckboxTitle').checked = true
  document.getElementById('wizardCheckboxCaption').checked = true
  document.getElementById('wizardCheckboxCredit').checked = true
  document.getElementById('wizardCheckboxThumbnail').checked = false
  document.getElementById('wizardUploadTemplateButton').setAttribute('data-spreadsheet', '')
  document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'none'
  document.getElementById('wizardUploadMediaMissingWarning').style.display = 'none'
  document.getElementById('wizardUploadMediaMissingRow').innerHTML = ''
  document.getElementById('wizardUploadMediaBadKeyWarning').style.display = 'none'
  document.getElementById('wizardOrientationSelect').value = 'horizontal'
  document.getElementById('wizardDensitySelect').value = '2'
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
      exSetup.wizardGoTo('ImportOptions')
    } else {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'ImportOptions') {
    if (document.getElementById('wizardMediaImportOptionsSingle').checked) {
      exSetup.wizardGoTo('BasicImport')
    } else {
      exSetup.wizardGoTo('MediaInfo')
    }
  } else if (currentPage === 'BasicImport') {
    const numFiles = document.getElementById('wizardMediaImportList').childElementCount
    if (numFiles === 0) {
      document.getElementById('wizardMediaImportBlankWarning').style.display = 'block'
    } else {
      document.getElementById('wizardMediaImportBlankWarning').style.display = 'none'
      exSetup.wizardGoTo('Layout')
    }
  } else if (currentPage === 'MediaInfo') {
    exSetup.wizardGoTo('Spreadsheet')
  } else if (currentPage === 'Spreadsheet') {
    const selectedFile = document.getElementById('wizardUploadTemplateButton').getAttribute('data-spreadsheet')
    if (selectedFile !== '') {
      document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'none'
      exSetup.wizardGoTo('MediaUpload')
    } else {
      document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'MediaUpload') {
    // Check that each file listed in the spreadsheet has an uploaded copy.
    const spreadsheet = document.getElementById('wizardUploadTemplateButton').dataset.spreadsheet

    const keys = ['Media filename']
    if (document.getElementById('wizardCheckboxThumbnail').checked) keys.push('Custom thumbnail')

    const missingContent = await checkBulkImportContent(spreadsheet, keys)

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
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Languages') {
    exSetup.wizardGoTo('Welcome')
  } else if (currentPage === 'ImportOptions') {
    exSetup.wizardGoTo('Languages')
  } else if (currentPage === 'MediaInfo') {
    exSetup.wizardGoTo('ImportOptions')
  } else if (currentPage === 'Spreadsheet') {
    exSetup.wizardGoTo('MediaInfo')
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
    exSetup.updateWorkingDefinition(['languages', lang], {
      code: lang,
      content: {},
      display_name: exLang.getLanguageDisplayName(lang),
      filter_order: [],
      filters: {}
    })
    addLanguage(lang)
  }
  exSetup.updateWorkingDefinition(['language_order'], langOrder)

  // Media
  if (document.getElementById('wizardMediaImportOptionsSingle').checked) {
    const children = document.getElementById('wizardMediaImportList').children
    for (const child of children) {
      const filename = child.dataset.filename
      addItem({ filename })
    }
  } else {
    // Bulk import
    const spreadsheet = document.getElementById('wizardUploadTemplateButton').dataset.spreadsheet
    bulkImportFiles(spreadsheet)
  }

  // Layout
  const orientation = document.getElementById('wizardOrientationSelect').value
  const density = parseInt(document.getElementById('wizardDensitySelect').value)
  const layoutDef = {
    corner_radius: 10,
    items_per_page: density,
    thumbnail_shape: 'square'
  }

  if (orientation === 'horizontal' && density === 2) {
    layoutDef.imageHeight = 70
    layoutDef.num_columns = 2
    layoutDef.title_height = 40
  } else if (orientation === 'vertical' && density === 2) {
    layoutDef.imageHeight = 80
    layoutDef.num_columns = 1
    layoutDef.title_height = 70
  } else if (orientation === 'horizontal' && density === 6) {
    layoutDef.imageHeight = 75
    layoutDef.num_columns = 3
    layoutDef.title_height = 100
  } else if (orientation === 'vertical' && density === 6) {
    layoutDef.imageHeight = 65
    layoutDef.num_columns = 2
    layoutDef.title_height = 70
  } else if (orientation === 'horizontal' && density === 8) {
    layoutDef.imageHeight = 65
    layoutDef.num_columns = 4
    layoutDef.title_height = 65
  } else if (orientation === 'vertical' && density === 8) {
    layoutDef.imageHeight = 70
    layoutDef.num_columns = 2
    layoutDef.title_height = 85
  }

  exSetup.updateWorkingDefinition(['style', 'layout'], layoutDef)
  exUtilities.hideModal('#setupWizardModal')

  if (orientation === 'horizontal') {
    exSetup.configurePreview('16x9', true)
  } else exSetup.configurePreview('9x16', true)

  const uuid = exSetup.config.workingDefinition.uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('media_browser')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exUtilities.hideModal('#setupWizardModal')
}

function onWizardMediaImport (files) {
  // Take a list of filenames and create a preview for each

  const wizardMediaImportList = document.getElementById('wizardMediaImportList')
  const wizardMediaImportBlankWarning = document.getElementById('wizardMediaImportBlankWarning')
  if (files.length === 0) {
    wizardMediaImportBlankWarning.style.display = 'block'
  } else {
    wizardMediaImportBlankWarning.style.display = 'none'
  }

  for (const file of files) {
    const mimetype = exFiles.guessMimetype(file)
    const col = document.createElement('div')
    col.dataset.filename = file
    col.className = 'col'

    const card = document.createElement('div')
    card.className = 'card position-relative'

    let preview = null

    if (mimetype === 'image' || mimetype === 'audio') {
      preview = document.createElement('img')
      preview.src = exConfig.api + '/files/' + file + '/thumbnail'
      preview.className = 'card-img-top'
      preview.alt = file
    } else if (mimetype === 'video') {
      preview = document.createElement('video')
      preview.src = exConfig.api + '/files/' + file + '/thumbnail'
      preview.className = 'card-img-top'
      preview.muted = true
      preview.loop = true
      preview.autoplay = true
      preview.playsInline = true
      preview.setAttribute('webkit-playsinline', true)
      preview.setAttribute('disablePictureInPicture', true)
    } else {
      // Unsupported file type — skip
      continue
    }
    card.appendChild(preview)

    const removeBtn = document.createElement('button')
    removeBtn.className =
      'btn btn-sm btn-danger position-absolute top-0 end-0 m-1'
    removeBtn.textContent = '✕'
    removeBtn.addEventListener('click', () => col.remove())
    card.appendChild(removeBtn)

    const body = document.createElement('div')
    body.className = 'card-body p-2'

    const filenameEl = document.createElement('div')
    filenameEl.className = 'small text-truncate'
    filenameEl.textContent = file
    filenameEl.title = file

    body.appendChild(filenameEl)
    card.appendChild(body)

    col.appendChild(card)
    wizardMediaImportList.appendChild(col)
  }
}

function generateSpreadsheetTemplate (wizard = true) {
  // Generate a template spreadsheet and download it to the user's system.

  let defName = 'New Definition'
  let languages = []
  let details = []

  if (wizard) {
    defName = document.getElementById('wizardDefinitionNameInput').value.trim()
    for (const child of document.getElementById('wizardLanguages').children) {
      const lang = child.querySelector('select').value
      if (languages.includes(lang) === false) languages.push(lang)
    }

    if (document.getElementById('wizardCheckboxTitle').checked === true) details.push('Title')
    if (document.getElementById('wizardCheckboxCaption').checked === true) details.push('Caption')
    if (document.getElementById('wizardCheckboxCredit').checked === true) details.push('Credit')
  } else {
    const def = exSetup.config.workingDefinition
    if (def.name && def.name !== '') defName = def.name
    languages = def.language_order
    details = ['Title', 'Caption', 'Credit']
  }

  // Loop through the various combinations to make the header line for the CSV file
  let csv = 'Media filename'
  if (wizard === false || document.getElementById('wizardCheckboxThumbnail').checked === true) csv += ', Custom thumbnail'
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
  element.setAttribute('download', defName + ' - media list.csv')
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) exSetup.initializeDefinition()

  exSetup.configurePreview('16x9', true)

  // Language
  exLang.clearLanguagePicker(document.getElementById('language-picker'))
  exLang.createLanguagePicker(document.getElementById('language-picker'), {
    onLanguageAdd: addLanguage,
    beforeLanguageDelete: deleteLanguage,
    onLanguageRebuild: rebuildLanguageElements
  })

  rebuildLanguageElements([])

  // Attractor
  document.getElementById('inactivityTimeoutField').value = 30
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')

  // Looping
  document.getElementById('loopResultsCheckbox').checked = true

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('itemsList').innerHTML = ''
  document.getElementById('editPane').dataset.uuid = ''

  // Reset layout options
  exSetup.createAdvancedSliders()
  // document.getElementById('showSearchPaneCheckbox').checked = false
  document.getElementById('itemsPerPageInput').value = 6
  document.getElementById('numColsSelect').value = 3
  document.getElementById('imageShapeSelect').value = 'original'

  // Reset style options
  const colorInputs = ['titleColor', 'filterBackgroundColor', 'filterLabelColor', 'filterTextColor']
  colorInputs.forEach((input) => {
    const el = document.getElementById('colorPicker_' + input)
    el.value = el.getAttribute('data-default')
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

  // Reset text size options
  document.getElementById('TitleTextSizeSlider').value = 0
  document.getElementById('Lightbox_titleTextSizeSlider').value = 0
  document.getElementById('Lightbox_captionTextSizeSlider').value = 0
  document.getElementById('Lightbox_creditTextSizeSlider').value = 0
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
  if ('attractor' in def && def.attractor.trim() !== '') {
    attractorSelect.innerHTML = def.attractor
  } else {
    attractorSelect.innerHTML = 'Select file'
  }
  attractorSelect.dataset.filename = def.attractor
  document.getElementById('inactivityTimeoutField').value = def?.inactivity_timeout || 30

  // Page looping
  document.getElementById('loopResultsCheckbox').checked = def?.behavior?.loop_results ?? true

  // Set the layout options
  document.getElementById('itemsPerPageInput').value = def?.style?.layout?.items_per_page ?? 12
  document.getElementById('numColsSelect').value = def?.style?.layout?.num_columns ?? 6
  exSetup.createAdvancedSlider(document.getElementById('imageHeightSlider'), def?.style?.layout?.image_height)
  exSetup.createAdvancedSlider(document.getElementById('titleHeightSlider'), def?.style?.layout?.title_height)
  exSetup.createAdvancedSlider(document.getElementById('cornerRadiusSlider'), def?.style?.layout?.corner_radius)
  document.getElementById('imageShapeSelect').value = def?.style?.layout?.thumbnail_shape ?? 'original'

  exSetup.createAdvancedSlider(document.getElementById('lightboxTitleHeightSlider'), def?.style?.layout?.lightbox_title_height)
  exSetup.createAdvancedSlider(document.getElementById('lightboxCaptionHeightSlider'), def?.style?.layout?.lightbox_caption_height)
  exSetup.createAdvancedSlider(document.getElementById('lightboxCreditHeightSlider'), def?.style?.layout?.lightbox_credit_height)

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background)
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

  const langSelect = document.getElementById('language-picker')
  exLang.createLanguagePicker(langSelect,
    {
      onLanguageAdd: addLanguage,
      beforeLanguageDelete: deleteLanguage,
      onLanguageRebuild: rebuildLanguageElements
    }
  )

  rebuildItemList()

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
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
    if ((itemLangDef?.title ?? '') !== '') {
      itemName = exMarkdown.formatText(itemLangDef.title, { string: true, removeParagraph: true })
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
    filter_data: {},
    uuid
  }

  for (const code of def.language_order) {
    def.languages[code].content[uuid] = {
      caption: details?.languages?.[code]?.caption ?? '',
      credit: details?.languages?.[code]?.credit ?? '',
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

  // Build nav to edit title, caption, credit in each language
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

    for (const field of ['title', 'caption', 'credit']) {
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
          if (field === 'title' && code === def.language_order[0]) {
            document.getElementById('itemButton_' + itemUUID).innerHTML = exMarkdown.formatText(content, { string: true, removeParagraph: true })
          }
          exSetup.updateWorkingDefinition(['languages', code, 'content', itemUUID, field], content)
          exSetup.previewDefinition(true)
        }
      })
    }

    // Add any filters
    const filterHeader = document.createElement('div')
    filterHeader.classList = 'col fs-4'
    filterHeader.innerText = 'Filter data'
    row.appendChild(filterHeader)

    if ((def.languages[code]?.filter_order?.length ?? 0) === 0) {
      const col = document.createElement('div')
      col.classList = 'col fst-italic'
      col.innerText = 'Use the Filters section to define filters for this language.'
      row.appendChild(col)
    }

    for (const filterUUID of def.languages[code]?.filter_order ?? []) {
      const existing = itemDef?.filter_data?.[filterUUID]

      // Ensure the filter entry exists
      if (!existing) {
        itemDef.filter_data[filterUUID] = {
          uuid: filterUUID,
          value: ''
        }
      }

      const col = document.createElement('div')
      col.classList = 'col'

      const label = document.createElement('label')
      label.className = 'form-label'
      label.textContent = def.languages[code].filters[filterUUID]?.display_name ?? filterUUID
      col.appendChild(label)

      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'form-control'
      input.value = itemDef.filter_data[filterUUID].value
      input.addEventListener('change', () => {
        exSetup.updateWorkingDefinition(['content', itemDef.uuid, 'filter_data', filterUUID, 'value'], input.value)
        exSetup.previewDefinition(true)
      })
      col.appendChild(input)
      row.appendChild(col)
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

function rebuildFilterInterface () {
  // Build the accordion tab for managing filters

  const nav = document.getElementById('defineFiltersNav')
  const content = document.getElementById('defineFiltersContent')
  nav.innerText = ''
  content.innerText = ''

  const def = exSetup.config.workingDefinition

  def.language_order.forEach((lang, index) => {
    const tabId = `defineFilters-${lang}`

    const navItem = document.createElement('li')
    navItem.className = 'nav-item'

    const navBtn = document.createElement('button')
    navBtn.className = `nav-link ${index === 0 ? 'active' : ''}`
    navBtn.type = 'button'
    navBtn.role = 'tab'
    navBtn.dataset.bsToggle = 'tab'
    navBtn.dataset.bsTarget = `#${tabId}`
    navBtn.textContent = exLang.getLanguageDisplayName(lang, true)

    navItem.appendChild(navBtn)
    nav.appendChild(navItem)

    const pane = document.createElement('div')
    pane.className = `tab-pane fade ${index === 0 ? 'show active' : ''}`
    pane.id = tabId
    pane.role = 'tabpanel'
    content.appendChild(pane)

    _rebuildFilterInterface(lang)
  })
}

function _rebuildFilterInterface (lang) {
  // Build out the filter GUI for one language

  const langDef = exSetup.config.workingDefinition.languages[lang]
  const pane = document.getElementById(`defineFilters-${lang}`)
  pane.innerText = ''

  const row = document.createElement('div')
  row.classList = 'row gy-2 mt-2'
  pane.appendChild(row)

  const addCol = document.createElement('div')
  addCol.classList = 'col-6 col-lg-4 col-xl-3 col-xxl-2'
  row.appendChild(addCol)

  const addButton = document.createElement('button')
  addButton.classList = 'btn btn-primary w-100'
  addButton.innerText = 'Add filter'
  addButton.addEventListener('click', () => {
    addFilter(lang)
    _rebuildFilterInterface(lang)
  })
  addCol.appendChild(addButton)

  // Build a card for each filter
  for (const filterUUID of langDef?.filter_order ?? []) {
    const filter = langDef.filters?.[filterUUID] ?? { display_name: '', uuid: filterUUID }

    const col = document.createElement('div')
    col.classList = 'col-12'
    row.appendChild(col)

    const card = document.createElement('div')
    card.classList = 'card'
    col.appendChild(card)

    const cardBody = document.createElement('div')
    cardBody.classList = 'card-body'
    card.appendChild(cardBody)

    const cardRow = document.createElement('div')
    cardRow.classList = 'row gy-2'
    cardBody.appendChild(cardRow)

    const inputCol = document.createElement('div')
    inputCol.classList = 'col-12 col-md-6 col-xl-9 '
    cardRow.appendChild(inputCol)

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'form-control'
    input.value = filter.display_name
    inputCol.appendChild(input)

    input.addEventListener('change', e => {
      exSetup.updateWorkingDefinition(['languages', lang, 'filters', filterUUID, 'display_name'], input.value)
      exSetup.previewDefinition(true)
    })

    const upCol = document.createElement('div')
    upCol.classList = 'col-4 col-md-2 col-xl-1 pe-1 d-flex align-items-center'
    cardRow.appendChild(upCol)

    const upButton = document.createElement('button')
    upButton.classList = 'btn btn-info w-100 btn-sm'
    upButton.innerText = '▲'
    upButton.addEventListener('click', () => {
      moveFilterInLanguage(lang, filterUUID, -1)
      _rebuildFilterInterface(lang)
    })
    upCol.appendChild(upButton)

    const downCol = document.createElement('div')
    downCol.classList = 'col-4 col-md-2 col-xl-1 ps-1 d-flex align-items-center'
    cardRow.appendChild(downCol)

    const downButton = document.createElement('button')
    downButton.classList = 'btn btn-info w-100 btn-sm'
    downButton.innerText = '▼'
    downButton.addEventListener('click', () => {
      moveFilterInLanguage(lang, filterUUID, 1)
      _rebuildFilterInterface(lang)
    })
    downCol.appendChild(downButton)

    const deleteCol = document.createElement('div')
    deleteCol.classList = 'col-4 col-md-2 col-xl-1 ps-1 pe-md-1 ps-md-1 d-flex align-items-center'
    cardRow.appendChild(deleteCol)

    const deleteButton = document.createElement('button')
    deleteButton.classList = 'btn btn-danger w-100 btn-sm'
    deleteButton.innerText = '✕'
    deleteButton.addEventListener('click', () => {
      deleteFilter(lang, filterUUID)
      _rebuildFilterInterface(lang)
      console.log(exSetup.config.workingDefinition)
    })
    deleteCol.appendChild(deleteButton)
  }
}

function moveFilterInLanguage (lang, filterUUID, direction) {
  const order = exSetup.config.workingDefinition.languages?.[lang]?.filter_order

  const index = order.indexOf(filterUUID)
  if (index === -1) return false

  const target = index + direction
  if (target < 0 || target >= order.length) return false

  order.splice(index, 1)
  order.splice(target, 0, filterUUID)

  console.log(order)
  exSetup.previewDefinition(true)
  return true
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

  rebuildFilterInterface()
}

function addFilter (lang) {
  // Add a new filter element to the current language

  const def = exSetup.config.workingDefinition

  const uuid = exUtilities.uuid()
  def.languages[lang].filter_order.push(uuid)
  def.languages[lang].filters[uuid] = { display_name: '', uuid }
  exSetup.previewDefinition(true)
}

function deleteFilter (lang, filterUUID) {
  // Remove the given filter and rebuild the GUI

  const def = exSetup.config.workingDefinition
  const index = def.languages[lang].filter_order.indexOf(filterUUID)
  if (index < 0) return // Nothing to delete

  // Remove from the language object
  def.languages[lang].filter_order.splice(index, 1)
  delete def.languages[lang].filters[filterUUID]

  // Search the content object and remove related filter data
  for (const contentUUID of def.content_order) {
    if (def.content[contentUUID]?.filter_data?.[filterUUID]) {
      delete def.content[contentUUID].filter_data[filterUUID]
    }
  }

  exSetup.previewDefinition(true)
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

document.getElementById('wizardMediaImportButton').addEventListener('click', () => {
  exFileSelect.createFileSelectionModal({
    filetypes: ['audio', 'image', 'video'],
    multiple: true
  }).then((files) => {
    onWizardMediaImport(files)
  })
})
document.getElementById('wizardMediaImportClearButton').addEventListener('click', () => {
  document.getElementById('wizardMediaImportList').innerText = ''
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
      document.getElementById('wizardUploadTemplateButton').setAttribute('data-spreadsheet', selectedFiles[0])
    })
})

document.getElementById('wizardUploadMediaButton').addEventListener('click', () => {
  exFileSelect.createFileSelectionModal({
    filetypes: ['audio', 'image', 'video'],
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
document.getElementById('clearItemsConfirmButton').addEventListener('click', () => {
  const items = exSetup.config.workingDefinition.content_order.slice() // Clone
  for (const item of items) {
    deleteItem(item, false)
  }
  rebuildItemList()
  exSetup.previewDefinition(true)
  exUtilities.hideModal('#clearItemsModal')
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

document.getElementById('loopResultsCheckbox').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['behavior', 'loop_results'], event.target.checked)
  exSetup.previewDefinition(true)
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

for (const id of ['editItemThumbnailSelect', 'editItemThumbPreviewImage']) {
  document.getElementById(id).addEventListener('click', () => {
  // Handle setting a custom thumbnail for hte current item

    const uuid = document.getElementById('editPane').dataset.uuid
    if (!uuid || uuid === '') return

    exFileSelect.createFileSelectionModal({ filetypes: ['image'], multiple: false })
      .then((files) => {
        if (files.length !== 1) return
        exSetup.updateWorkingDefinition(['content', uuid, 'custom_thumbnail'], files[0])
        document.getElementById('editItemThumbnailSelect').innerText = files[0]

        const thumbImageTPreview = document.getElementById('editItemThumbPreviewImage')
        thumbImageTPreview.style.display = 'block'
        thumbImageTPreview.src = exConfig.api + '/files/' + files[0] + '/thumbnail'
        exSetup.previewDefinition(true)
      })
  })
}

document.getElementById('editItemThumbnailDelete').addEventListener('click', () => {
  // Handle deleting a custom thumbnail from the current item.

  const uuid = document.getElementById('editPane').dataset.uuid
  if (!uuid || uuid === '') return

  exSetup.updateWorkingDefinition(['content', uuid, 'custom_thumbnail'], '')
  document.getElementById('editItemThumbnailSelect').innerText = 'Select File'
  document.getElementById('editItemThumbPreviewImage').style.display = 'none'
  exSetup.previewDefinition(true)
})

// Layout fields
// document.getElementById('showSearchPaneCheckbox').addEventListener('change', (event) => {
//   updateWorkingDefinition(['style', 'layout', 'show_search_and_filter'], event.target.checked)
//   exSetup.previewDefinition(true)
// })
document.getElementById('itemsPerPageInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'items_per_page'], parseInt(event.target.value))
  exSetup.previewDefinition(true)
})
document.getElementById('numColsSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'num_columns'], parseInt(event.target.value))
  exSetup.previewDefinition(true)
})
// document.getElementById('imageHeightSlider').addEventListener('input', (event) => {
//   exSetup.updateWorkingDefinition(['style', 'layout', 'image_height'], parseInt(event.target.value))
//   exSetup.previewDefinition(true)
// })
// document.getElementById('titleHeightSlider').addEventListener('input', (event) => {
//   exSetup.updateWorkingDefinition(['style', 'layout', 'title_height'], parseInt(event.target.value))
//   exSetup.previewDefinition(true)
// })
// document.getElementById('cornerRadiusSlider').addEventListener('input', (event) => {
//   exSetup.updateWorkingDefinition(['style', 'layout', 'corner_radius'], parseInt(event.target.value))
//   exSetup.previewDefinition(true)
// })
document.getElementById('imageShapeSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'thumbnail_shape'], event.target.value)
  exSetup.previewDefinition(true)
})

Array.from(document.querySelectorAll('.lightbox-slider')).forEach((el) => {
  el.addEventListener('input', () => {
    // Calculate the amount of space left for the lightbox image based on the values
    // of the other fields.

    const titleHeight = parseInt(document.getElementById('lightboxTitleHeightSlider').querySelector('input').value)
    const captionHeight = parseInt(document.getElementById('lightboxCaptionHeightSlider').querySelector('input').value)
    const creditHeight = parseInt(document.getElementById('lightboxCreditHeightSlider').querySelector('input').value)

    const imageHeight = 100 - titleHeight - captionHeight - creditHeight
    exSetup.updateWorkingDefinition(['style', 'layout', 'lightbox_image_height'], imageHeight)
    exSetup.previewDefinition(true)
  })
})

// Style fields
document.querySelectorAll('.coloris').forEach((element) => {
  element.addEventListener('change', function () {
    const value = this.value.trim()
    const property = this.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['style', 'color', property], value)
    exSetup.previewDefinition(true)
  })
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

// Populate available languages
exLang.createLanguagePicker(document.getElementById('language-picker'), {
  onLanguageAdd: addLanguage,
  beforeLanguageDelete: deleteLanguage,
  onLanguageRebuild: rebuildLanguageElements
})

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

exSetup.configure({
  app: 'media_browser',
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
        color: '#719abf',
        mode: 'color'
      },
      color: {},
      font: {},
      layout: {},
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
