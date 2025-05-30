/* global Coloris, bootstrap */

import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exLang from '../js/exhibitera_setup_languages.js'

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
  document.getElementById('wizardLanguages').innerHTML = ''
  document.getElementById('wizardLanguagesBlankWarning').style.display = 'none'
  document.getElementById('wizardCheckboxTitle').checked = true
  document.getElementById('wizardCheckboxCaption').checked = true
  document.getElementById('wizardCheckboxCredit').checked = true
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
      wizardGoTo('Languages')
    } else {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Languages') {
    if (document.getElementById('wizardLanguages').children.length > 0) {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'none'
      wizardGoTo('MediaInfo')
    } else {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'MediaInfo') {
    wizardGoTo('Spreadsheet')
  } else if (currentPage === 'Spreadsheet') {
    const selectedFile = document.getElementById('wizardUploadTemplateButton').getAttribute('data-spreadsheet')
    if (selectedFile !== '') {
      document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'none'
      wizardGoTo('MediaUpload')
    } else {
      document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'MediaUpload') {
    // Check that each file listed in the spreadsheet has an uploaded copy.
    const spreadsheet = document.getElementById('wizardUploadTemplateButton').getAttribute('data-spreadsheet')
    let missing = []
    try {
      missing = await _checkContentExists(spreadsheet, ['Media filename'])
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
      wizardGoTo('Layout')
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
    wizardGoTo('Welcome')
  } else if (currentPage === 'MediaInfo') {
    wizardGoTo('Languages')
  } else if (currentPage === 'Spreadsheet') {
    wizardGoTo('MediaInfo')
  } else if (currentPage === 'MediaUpload') {
    wizardGoTo('Spreadsheet')
  } else if (currentPage === 'Layout') {
    wizardGoTo('MediaUpload')
  }
}

function wizardGoTo (page) {
  Array.from(document.querySelectorAll('.wizard-pane')).forEach((el) => {
    el.style.display = 'none'
  })
  document.getElementById('wizardPane_' + page).style.display = 'block'
  console.log('wizardPane_' + page)
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
      caption_key: null,
      code: lang,
      credit_key: null,
      display_name: exLang.getLanguageDisplayName(lang),
      filter_order: [],
      filters: {},
      media_key: 'Media filename',
      title_key: null
    }
    if (document.getElementById('wizardCheckboxTitle').checked === true) {
      langDef.title_key = 'Title (' + lang + ')'
    }
    if (document.getElementById('wizardCheckboxCaption').checked === true) {
      langDef.caption_key = 'Caption (' + lang + ')'
    }
    if (document.getElementById('wizardCheckboxCredit').checked === true) {
      langDef.credit_key = 'Credit (' + lang + ')'
    }
    exSetup.updateWorkingDefinition(['languages', lang], langDef)
  }
  exSetup.updateWorkingDefinition(['language_older'], langOrder)

  // Basics
  exSetup.updateWorkingDefinition(['name'], document.getElementById('wizardDefinitionNameInput').value.trim())
  exSetup.updateWorkingDefinition(['spreadsheet'], document.getElementById('wizardUploadTemplateButton').getAttribute('data-spreadsheet'))

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
  $('#setupWizardModal').modal('hide')

  if (orientation === 'horizontal') {
    exSetup.configurePreview('16x9', true)
  } else exSetup.configurePreview('9x16', true)

  const uuid = $('#definitionSaveButton').data('workingDefinition').uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('media_browser')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exSetup.hideModal('#setupWizardModal')
}

function generateSpreadsheetTemplate () {
  // Based on selections made in the wizard, generate a template spreadsheet and download it to the user's system.

  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()

  const languages = []
  for (const child of document.getElementById('wizardLanguages').children) {
    const lang = child.querySelector('select').value
    if (languages.includes(lang) === false) languages.push(lang)
  }

  const details = []
  if (document.getElementById('wizardCheckboxTitle').checked === true) details.push('Title')
  if (document.getElementById('wizardCheckboxCaption').checked === true) details.push('Caption')
  if (document.getElementById('wizardCheckboxCredit').checked === true) details.push('Credit')

  // Loop through the various combinations to make the header line for the CSV file
  let csv = 'Media filename'
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

  if (full === true) {
    await exSetup.initializeDefinition()
  }

  // Spreadsheet
  const spreadsheetSelect = document.getElementById('spreadsheetSelect')
  spreadsheetSelect.innerHTML = 'Select file'
  spreadsheetSelect.setAttribute('data-filename', '')
  spreadsheetSelect.setAttribute('data-availableKeys', '[]')

  // Language
  exLang.clearLanguagePicker(document.getElementById('language-picker'))
  exLang.createLanguagePicker(document.getElementById('language-picker'), { onLanguageRebuild: rebuildLanguageElements })

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
  document.getElementById('languageNav').innerHTML = ''
  document.getElementById('missingContentWarningField').innerHTML = ''

  // Reset layout options
  // document.getElementById('showSearchPaneCheckbox').checked = false
  document.getElementById('itemsPerPageInput').value = 6
  document.getElementById('numColsSelect').value = 3
  document.getElementById('imageHeightSlider').value = 80
  document.getElementById('titleHeightSlider').value = 100
  document.getElementById('cornerRadiusSlider').value = 0
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

  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  // Configure preview behavior
  exSetup.configurePreviewFromDefinition(def)

  document.getElementById('definitionNameInput').value = def.name

  // Spreadsheet
  const spreadsheetSelect = document.getElementById('spreadsheetSelect')
  spreadsheetSelect.innerHTML = def.spreadsheet
  spreadsheetSelect.dataset.filename = def.spreadsheet

  // Attractor
  const attractorSelect = document.getElementById('attractorSelect')
  if ('attractor' in def && def.attractor.trim() !== '') {
    attractorSelect.innerHTML = def.attractor
  } else {
    attractorSelect.innerHTML = 'Select file'
  }
  attractorSelect.dataset.filename = def.attractor
  document.getElementById('inactivityTimeoutField').value = def?.inactivity_timeout ?? 30

  // Page looping
  document.getElementById('loopResultsCheckbox').checked = def?.behavior?.loop_results ?? true

  // Set the layout options
  document.getElementById('itemsPerPageInput').value = def?.style?.layout?.items_per_page ?? 12
  document.getElementById('numColsSelect').value = def?.style?.layout?.num_columns ?? 6
  document.getElementById('imageHeightSlider').value = def?.style?.layout?.image_height ?? 70
  document.getElementById('titleHeightSlider').value = def?.style?.layout?.title_height ?? 50

  document.getElementById('cornerRadiusSlider').value = def?.style?.layout?.corner_radius ?? 0
  document.getElementById('imageShapeSelect').value = def?.style?.layout?.thumbnail_shape ?? 'original'

  document.getElementById('lightboxTitleHeightSlider').value = def.style.layout.lightbox_title_height
  document.getElementById('lightboxCaptionHeightSlider').value = def.style.layout.lightbox_caption_height
  document.getElementById('lightboxCreditHeightSlider').value = def.style.layout.lightbox_credit_height

  if ('background' in def.style === false) {
    def.style.background = {
      mode: 'color',
      color: '#000'
    }
    exSetup.updateWorkingDefinition(['style', 'background', 'mode'], 'color')
    exSetup.updateWorkingDefinition(['style', 'background', 'color'], '#fff')
  }

  // Set the appropriate values for any advanced color pickers
  if (def?.style?.background) {
    exSetup.updateAdvancedColorPicker('style>background', def.style.background)
  }

  // Set the appropriate values for the color pickers
  for (const key of Object.keys(def.style.color)) {
    const el = document.getElementById('colorPicker_' + key)
    if (el == null) continue
    el.value = def.style.color[key]
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // Set the appropriate values for the advanced font pickers
    Object.keys(def?.style?.font ?? {}).forEach((key) => {
      const picker = document.querySelector(`.AFP-select[data-path="style>font>${key}"`)
      exSetup.setAdvancedFontPicker(picker, def.style.font[key])
    })

  // Set the appropriate values for the text size selects
  Object.keys(def?.style?.text_size ?? {}).forEach((key) => {
    const el = document.getElementById(key + 'TextSizeSlider')
    if (el != null) el.value = def.style.text_size[key]
  })

  // Set up any existing languages and tabs
  // In Ex5.3, we added the language_order field. If it doesn't exist
  // set it up now
  if ((def?.language_order ?? []).length === 0) {
    def.language_order = []
    for (const code of Object.keys(def.languages)) {
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
      onLanguageRebuild: rebuildLanguageElements
    }
  )

  // Load the spreadsheet to populate the existing keys
  onSpreadsheetFileChange()

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../media_browser.html?standalone=true&definition=' + def.uuid
}

function rebuildLanguageElements (langOrder) {
  // Clear and rebuild GUI elements when the languages have been modified

  document.getElementById('languageNav').innerHTML = ''
  document.getElementById('languageNavContent').innerHTML = ''

  let first = null
  for (const lang of langOrder) {
    const tabButton = createLanguageTab(lang)
    if (first == null) {
      first = tabButton
    }
  }
  if (first) first.click()
}

function createLanguageTab (code) {
  // Create a new language tab for the given details.
  // first = true means this is the first tab to be built on this cycle, so show it.

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

  // Create default language checkbox
  // const defaultCol = document.createElement('div')
  // defaultCol.classList = 'col-12'
  // row.appendChild(defaultCol)

  // const checkContainer = document.createElement('div')
  // checkContainer.classList = 'form-check'
  // defaultCol.appendChild(checkContainer)

  // const defaultCheckbox = document.createElement('input')
  // defaultCheckbox.classList = 'form-check-input default-lang-checkbox'
  // defaultCheckbox.setAttribute('id', 'defaultCheckbox_' + code)
  // defaultCheckbox.setAttribute('data-lang', code)
  // defaultCheckbox.setAttribute('type', 'radio')
  // defaultCheckbox.checked = workingDefinition.languages[code].default
  // defaultCheckbox.addEventListener('change', (event) => {
  //   // If the checkbox is checked, uncheck all the others and save to the working definition.
  //   Array.from(document.querySelectorAll('.default-lang-checkbox')).forEach((el) => {
  //     el.checked = false
  //     exSetup.updateWorkingDefinition(['languages', el.getAttribute('data-lang'), 'default'], false)
  //   })
  //   event.target.checked = true
  //   exSetup.updateWorkingDefinition(['languages', code, 'default'], true)
  //   exSetup.previewDefinition(true)
  // })
  // checkContainer.appendChild(defaultCheckbox)

  // const defaultCheckboxLabel = document.createElement('label')
  // defaultCheckboxLabel.classList = 'form-check-label'
  // defaultCheckboxLabel.setAttribute('for', 'defaultCheckbox_' + code)
  // defaultCheckboxLabel.innerHTML = 'Default language'
  // checkContainer.appendChild(defaultCheckboxLabel)

  // // Create the flag input
  // const flagImgCol = document.createElement('div')
  // flagImgCol.classList = 'col-3 col-lg-2 d-flex'
  // row.append(flagImgCol)

  // const flagImg = document.createElement('img')
  // flagImg.setAttribute('id', 'flagImg_' + code)
  // const customFlag = $('#definitionSaveButton').data('workingDefinition').languages[code].custom_flag
  // if (customFlag != null) {
  //   flagImg.src = '../content/' + customFlag
  // } else {
  //   flagImg.src = '../_static/flags/' + code + '.svg'
  // }
  // flagImg.classList = 'align-self-center'
  // flagImg.style.width = '100%'
  // flagImg.addEventListener('error', function () {
  //   this.src = '../_static/icons/translation-icon_black.svg'
  // })
  // flagImgCol.appendChild(flagImg)

  // const clearFlagCol = document.createElement('div')
  // clearFlagCol.classList = 'col-2 col-lg-1 d-flex mx-0 px-0 text-center4'
  // row.appendChild(clearFlagCol)

  // const clearFlagButton = document.createElement('button')
  // clearFlagButton.classList = 'btn btn-danger align-self-center'
  // clearFlagButton.innerHTML = '✕'
  // clearFlagButton.addEventListener('click', function () {
  //   deleteLanguageFlag(code)
  // })
  // clearFlagCol.append(clearFlagButton)

  // const uploadFlagCol = document.createElement('div')
  // uploadFlagCol.classList = 'col-7 col-lg-3 d-flex'
  // row.append(uploadFlagCol)

  // const uploadFlagBox = document.createElement('label')
  // uploadFlagBox.classList = 'btn btn-outline-primary w-100 align-self-center d-flex'
  // uploadFlagCol.appendChild(uploadFlagBox)

  // const uploadFlagFileName = document.createElement('span')
  // uploadFlagFileName.setAttribute('id', 'uploadFlagFilename_' + code)
  // uploadFlagFileName.classList = 'w-100 align-self-center'
  // uploadFlagFileName.innerHTML = 'Upload flag'
  // uploadFlagBox.appendChild(uploadFlagFileName)

  // const uploadFlagInput = document.createElement('input')
  // uploadFlagInput.setAttribute('id', 'uploadFlagInput_' + code)
  // uploadFlagInput.classList = 'form-control-file w-100 align-self-center'
  // uploadFlagInput.setAttribute('type', 'file')
  // uploadFlagInput.setAttribute('hidden', true)
  // uploadFlagInput.setAttribute('accept', 'image/*')
  // uploadFlagInput.addEventListener('change', function () {
  //   onFlagUploadChange(code)
  // })
  // uploadFlagBox.appendChild(uploadFlagInput)

  // // Create the delete button
  // const deleteCol = document.createElement('div')
  // deleteCol.classList = 'col col-12 col-lg-6 col-xl-4 d-flex'
  // row.appendChild(deleteCol)

  // const deleteButton = document.createElement('button')
  // deleteButton.classList = 'btn btn-danger w-100 align-self-center'
  // deleteButton.innerHTML = 'Delete language'
  // deleteButton.addEventListener('click', () => {
  //   deleteLanguageTab(code)
  // })
  // deleteCol.appendChild(deleteButton)

  // Create the various inputs
  Object.keys(inputFields).forEach((key) => {
    const langKey = key + '_' + code
    const col = document.createElement('div')
    col.classList = 'col-12 col-md-6'
    row.appendChild(col)

    const label = document.createElement('label')
    label.classList = 'form-label'
    label.setAttribute('for', langKey)
    label.innerHTML = inputFields[key].name

    if ('hint' in inputFields[key]) {
      label.innerHTML += ' ' + `<span class="badge bg-info ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="${inputFields[key].hint}" style="font-size: 0.55em;">?</span>`
    }

    if ('tooltip' in inputFields[key]) {
      const tooltip = '\n<span class="badge bg-info ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="' + inputFields[key].tooltip + '" style="font-size: 0.55em;">?</span>'
      label.innerHTML += tooltip
    }
    col.appendChild(label)

    let input

    if (inputFields[key].kind === 'select') {
      input = document.createElement('select')
      input.classList = 'form-select'
      if ('multiple' in inputFields[key] && inputFields[key].multiple === true) {
        input.setAttribute('multiple', true)
      }
    } else if (inputFields[key].kind === 'input') {
      input = document.createElement('input')
      input.setAttribute('type', inputFields[key].type)
      input.classList = 'form-control'
    }
    input.setAttribute('id', langKey)
    input.addEventListener('change', function () {
      let value = this.value
      if (typeof value === 'string') value = value.trim()
      exSetup.updateWorkingDefinition(['languages', code, inputFields[key].property], value)
      exSetup.previewDefinition(true)
    })
    col.appendChild(input)
  })

  // If we have already loaded a spreadhseet, populate the key options
  const keyList = document.getElementById('spreadsheetSelect').getAttribute('data-availableKeys')
  if (keyList != null) {
    populateKeySelects(JSON.parse(keyList), code)
  }

  // Create the filter options
  const filterCol = document.createElement('div')
  filterCol.classList = 'col-12 mt-2'
  row.appendChild(filterCol)

  const filterHeader = document.createElement('H5')
  filterHeader.innerHTML = 'Filter options'
  filterCol.appendChild(filterHeader)

  const filterLabel = document.createElement('div')
  filterLabel.classList = 'fst-italic'
  filterLabel.innerHTML = 'Filters let the user sort the entries based on groupings such as decade, artist, etc.'
  filterCol.appendChild(filterLabel)

  const addFilterbutton = document.createElement('button')
  addFilterbutton.classList = 'btn btn-primary mt-2'
  addFilterbutton.innerHTML = 'Add filter column'
  addFilterbutton.addEventListener('click', () => {
    addFilter(code)
  })
  filterCol.appendChild(addFilterbutton)

  const filterEntriesRow = document.createElement('div')
  filterEntriesRow.classList = 'row mt-2 gy-2 row-cols-1 row-cols-md-2'
  filterEntriesRow.setAttribute('id', 'filterEntriesRow_' + code)
  filterCol.appendChild(filterEntriesRow)

  // Create any existing filter entries
  if ('filter_order' in workingDefinition.languages[code]) {
    for (const uuid of workingDefinition.languages[code].filter_order) {
      addFilter(code, workingDefinition.languages[code].filters[uuid], false)
    }
  }

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })

  return tabButton
}

function addFilter (lang, details = {}, addition = true) {
  // Add a new filter element to the current language

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  if (('uuid' in details) === false) details.uuid = exCommon.uuid()
  if (('display_name' in details) === false) details.display_name = ''
  if (('key' in details) === false) details.key = ''

  if (addition === true) {
    exSetup.updateWorkingDefinition(['languages', lang, 'filters', details.uuid], details)
    let filterOrder = []
    if ('filter_order' in workingDefinition.languages[lang]) filterOrder = workingDefinition.languages[lang].filter_order
    filterOrder.push(details.uuid)
    exSetup.updateWorkingDefinition(['languages', lang, 'filter_order'], filterOrder)
  }

  const col = document.createElement('div')
  col.classList = 'col'
  document.getElementById('filterEntriesRow_' + lang).appendChild(col)

  const html = `
  <div class='col'>
    <div class='border rounded px-2 py-2'>
      <label class='form-label'>
        Display name
      </label>
      <input id='filterName_${details.uuid}' type='text' class='form-control' data-uuid='${details.uuid}' value='${details.display_name}'>
      <label class='filter-name form-label mt-2'>
        Column
      </label>
      <select id='filterSelect_${details.uuid}' class='filter-select form-select' data-uuid='${details.uuid}' value='${details.key}'></select>
      <div class='row mt-2'>
        <div class='col-12 col-lg-6'>
          <button id='filterDeleteButton_${details.uuid}' class='btn btn-danger w-100'>Delete</button>
        </div>
        <div class='col-6 col-lg-3 pe-1 mt-2 mt-lg-0'>
          <button id='filterLeftButton_${details.uuid}' class='btn btn-info w-100'><</button>
        </div>
        <div id='filterRightButton_${details.uuid}' class='col-6 col-lg-3 ps-1 mt-2 mt-lg-0'>
          <button class='btn btn-info w-100'>></button>
        </div>
      </div>
    </div>
  </div>
  `
  col.innerHTML = html

  document.getElementById('filterName_' + details.uuid).addEventListener('change', () => {
    onFilterValueChange(lang, details.uuid)
    exSetup.previewDefinition(true)
  })
  document.getElementById('filterSelect_' + details.uuid).addEventListener('change', () => {
    onFilterValueChange(lang, details.uuid)
    exSetup.previewDefinition(true)
  })
  document.getElementById('filterLeftButton_' + details.uuid).addEventListener('click', () => {
    changeFilterOrder(lang, details.uuid, -1)
  })
  document.getElementById('filterRightButton_' + details.uuid).addEventListener('click', () => {
    changeFilterOrder(lang, details.uuid, 1)
  })
  document.getElementById('filterDeleteButton_' + details.uuid).addEventListener('click', () => {
    deleteFilter(lang, details.uuid)
  })

  // If we have already loaded a spreadhseet, populate the key options
  const keyList = document.getElementById('spreadsheetSelect').getAttribute('data-availableKeys')
  if (keyList != null) {
    populateFilterSelects(JSON.parse(keyList))
  }

  exSetup.previewDefinition(true)
}

function deleteFilter (lang, uuid) {
  // Remove the given filter and rebuild the GUI

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const index = workingDefinition.languages[lang].filter_order.indexOf(uuid)
  if (index > -1) { // only splice array when item is found
    workingDefinition.languages[lang].filter_order.splice(index, 1)
    delete workingDefinition.languages[lang].filters[uuid]
  }

  document.getElementById('filterEntriesRow_' + lang).innerHTML = ''
  for (const uuid of workingDefinition.languages[lang].filter_order) {
    addFilter(lang, workingDefinition.languages[lang].filters[uuid], false)
  }
  exSetup.previewDefinition(true)
}

function onFilterValueChange (lang, uuid) {
  // Update the details of the filter.

  const details = {
    display_name: document.getElementById('filterName_' + uuid).value.trim(),
    key: document.getElementById('filterSelect_' + uuid).value,
    uuid
  }
  exSetup.updateWorkingDefinition(['languages', lang, 'filters', details.uuid], details)
}

function changeFilterOrder (lang, uuid, direction) {
  // Move the given filter in the given direction

  const def = $('#definitionSaveButton').data('workingDefinition')
  const searchFunc = (el) => el === uuid
  const currentIndex = def.languages[lang].filter_order.findIndex(searchFunc)

  // Handle the edge cases
  if (currentIndex === 0 && direction < 0) return
  if (currentIndex === def.languages[lang].filter_order.length - 1 && direction > 0) return

  // Handle middle cases
  const newIndex = currentIndex + direction
  const currentValueOfNewIndex = def.languages[lang].filter_order[newIndex]
  def.languages[lang].filter_order[newIndex] = uuid
  def.languages[lang].filter_order[currentIndex] = currentValueOfNewIndex

  // Rebuild the filter entries GUI
  document.getElementById('filterEntriesRow_' + lang).innerHTML = ''
  def.languages[lang].filter_order.forEach((uuid) => {
    const details = def.languages[lang].filters[uuid]
    addFilter(lang, details, false)
  })
  exSetup.previewDefinition(true)
}

function onAttractorFileChange () {
  // Called when a new image or video is selected.

  const file = document.getElementById('attractorSelect').getAttribute('data-filename')
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  workingDefinition.attractor = file
  $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))

  exSetup.previewDefinition(true)
}

function onSpreadsheetFileChange () {
  // Called when a new spreadsheet is selected. Get the csv file and populate the options.

  const file = document.getElementById('spreadsheetSelect').getAttribute('data-filename')
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  if (file == null) {
    return
  } else {
    workingDefinition.spreadsheet = file
    $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))
  }

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + file,
    rawResponse: true,
    noCache: true
  })
    .then((result) => {
      const csvAsJSON = exCommon.csvToJSON(result)
      if (csvAsJSON.error === true) {
        document.getElementById('badSpreadsheetWarningLineNumber').innerHTML = csvAsJSON.error_index + 2
        document.getElementById('badSpreadsheetWarning').style.display = 'block'
      } else {
        document.getElementById('badSpreadsheetWarning').style.display = 'none'
      }
      const spreadsheet = csvAsJSON.json
      const keys = Object.keys(spreadsheet[0])
      document.getElementById('spreadsheetSelect').setAttribute('data-availableKeys', JSON.stringify(keys))
      populateKeySelects(keys)
      populateFilterSelects(keys)
      exSetup.previewDefinition(true)
    })
}

async function checkContentExists () {
  // Cross-check content from the spreadsheet with files in the content directory.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const mediaKeys = []
  const missingContentField = document.getElementById('missingContentWarningField')

  missingContentField.innerHTML = ''

  // Loop through the defintion and collect any unique media keys
  Object.keys(workingDefinition.languages).forEach((lang) => {
    if (mediaKeys.includes(workingDefinition.languages[lang].media_key) === false) {
      mediaKeys.push(workingDefinition.languages[lang].media_key)
    }
  })

  const missingContent = await _checkContentExists(workingDefinition.spreadsheet, mediaKeys)

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
  // Take the given spreadsheet filename and media keys and cross check with
  // the files available in the content directory. Return the names of any
  // files that do not exist.

  return new Promise(function (resolve, reject) {
    // Get a list of available content

    let availableContent
    const missingContent = []

    exCommon.makeHelperRequest({
      method: 'GET',
      endpoint: '/getAvailableContent'
    })
      .then((result) => {
        availableContent = result.all_exhibits
        // Retrieve the spreadsheet and check the content for each image key against the available content
        exCommon.makeHelperRequest({
          method: 'GET',
          endpoint: '/content/' + spreadsheet,
          rawResponse: true,
          noCache: true
        })
          .then((raw) => {
            const spreadsheet = exCommon.csvToJSON(raw).json
            spreadsheet.forEach((row) => {
              keys.forEach((key) => {
                if ((key in row) === false) {
                  reject(new Error('bad_key: ' + key))
                  return
                }
                if (row[key].trim() === '') return
                if (availableContent.includes(row[key]) === false) missingContent.push(row[key])
              })
            })
            resolve(missingContent)
          })
      })
  })
}

// function showOptimizeContentModal () {
//   // Show the modal for optimizing the content and thumbnails.

//   document.getElementById('optimizeContentProgressBarDiv').style.display = 'none'
//   $('#optimizeContentModal').modal('show')
// }

// function optimizeMediaFromModal () {
//   // Collect the necessary information and then optimize the media.

//   const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

//   const resolution = document.getElementById('resolutionSelect').value
//   const width = parseInt(resolution.split('_')[0])
//   const nCols = parseInt(document.getElementById('numColsSelect').value)
//   const thumbRes = width / nCols

//   // Loop through the defintion and collect any unique image keys
//   const imageKeys = []

//   Object.keys(workingDefinition.languages).forEach((lang) => {
//     if (imageKeys.includes(workingDefinition.languages[lang].media_key) === false) {
//       imageKeys.push(workingDefinition.languages[lang].media_key)
//     }
//   })

//   // Retrieve the spreadsheet and collect all images
//   const toOptimize = []

//   exCommon.makeHelperRequest({
//     method: 'GET',
//     endpoint: '/content/' + workingDefinition.spreadsheet,
//     rawResponse: true,
//     noCache: true
//   })
//     .then((raw) => {
//       const spreadsheet = exCommon.csvToJSON(raw).json
//       spreadsheet.forEach((row) => {
//         imageKeys.forEach((key) => {
//           if (row[key].trim() === '') return
//           toOptimize.push(row[key])
//         })
//       })
//       const total = toOptimize.length
//       let numComplete = 0

//       // Show the progress bar
//       document.getElementById('optimizeContentProgressBarDiv').style.display = 'flex'
//       document.getElementById('optimizeContentProgressBar').style.width = '0%'
//       document.getElementById('optimizeContentProgressBarDiv').setAttribute('aria-valuenow', 0)

//       toOptimize.forEach((file) => {
//         exCommon.makeHelperRequest({
//           method: 'POST',
//           endpoint: '/files/generateThumbnail',
//           params: {
//             source: file,
//             mimetype: 'image',
//             width: thumbRes
//           }
//         })
//           .then((result) => {
//             if (result.success === true) {
//               numComplete += 1
//               const percent = Math.round(100 * numComplete / total)
//               document.getElementById('optimizeContentProgressBar').style.width = String(percent) + '%'
//               document.getElementById('optimizeContentProgressBarDiv').setAttribute('aria-valuenow', percent)
//             }
//           })
//       })
//     })
// }

function populateKeySelects (keyList, langToPopulate = null) {
  // Take a list of keys and use it to populate all the selects used to match keys to parameters.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  if (('languages' in workingDefinition) === false) return

  // Add a blank entry for no selection
  keyList.unshift(null)

  let langs
  if (langToPopulate == null) {
    langs = workingDefinition.language_order
  } else langs = [langToPopulate]
  langs.forEach((lang) => {
    console.log(lang)
    const langDict = workingDefinition.languages[lang]

    Object.keys(inputFields).forEach((input) => {
      const inputDict = inputFields[input]
      const inputEl = document.getElementById(input + '_' + lang)

      if (inputDict.kind === 'select') {
        inputEl.innerHTML = ''

        keyList.forEach((key) => {
          const option = document.createElement('option')
          option.value = key || ''
          option.innerHTML = key || '-'
          inputEl.appendChild(option)
        })

        // If we already have a value for this select, set it
        if (inputDict.property in langDict) {
          inputEl.value = langDict[inputDict.property]
        } else {
          inputEl.valule = null
        }
      }
    })
  })
}

function populateFilterSelects (keyList) {
  // Populate all the selects used for choosing filter columns.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  if (('languages' in workingDefinition) === false) return

  Object.keys(workingDefinition.languages).forEach((lang) => {
    if (('filters' in workingDefinition.languages[lang]) === false) return
    const filterDict = workingDefinition.languages[lang].filters
    Object.keys(filterDict).forEach((uuid) => {
      const details = filterDict[uuid]
      const el = document.getElementById('filterSelect_' + uuid)
      if (el == null) return // No GUI for this entry yet
      el.innerHTML = ''

      keyList.forEach((key) => {
        const option = document.createElement('option')
        option.value = key
        option.innerHTML = key
        el.appendChild(option)
      })

      if ('key' in details) {
        el.value = details.key
      } else {
        el.value = null
      }
    })
  })
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// The input fields to specifiy content for each langauge
const inputFields = {
  keyTitleSelect: {
    name: 'Title column',
    kind: 'select',
    property: 'title_key'
  },
  keyCaptionSelect: {
    name: 'Caption column',
    kind: 'select',
    property: 'caption_key'
  },
  keyCreditSelect: {
    name: 'Credit column',
    kind: 'select',
    property: 'credit_key'
  },
  keyMediaSelect: {
    name: 'Media column',
    kind: 'select',
    property: 'media_key'
  },
  keyThumbnailSelect: {
    name: 'Thumbnail column',
    kind: 'select',
    property: 'thumbnail_key',
    hint: 'An optional column to provide a separate thumbnail image from the main image or video.'
  }
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
  document.getElementById('missingContentWarningField').innerHTML = ''
  $('#checkContentModal').modal('show')
})
document.getElementById('checkContentButton').addEventListener('click', checkContentExists)
// document.getElementById('optimizeContentButton').addEventListener('click', showOptimizeContentModal)
// document.getElementById('optimizeContentBeginButton').addEventListener('click', optimizeMediaFromModal)

// Definition fields
document.getElementById('spreadsheetSelect').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['csv'], multiple: false })
    .then((files) => {
      if (files.length === 1) {
        event.target.innerHTML = files[0]
        event.target.setAttribute('data-filename', files[0])
        onSpreadsheetFileChange()
      }
    })
})

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
document.getElementById('imageHeightSlider').addEventListener('input', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'image_height'], parseInt(event.target.value))
  exSetup.previewDefinition(true)
})
document.getElementById('titleHeightSlider').addEventListener('input', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'title_height'], parseInt(event.target.value))
  exSetup.previewDefinition(true)
})
document.getElementById('cornerRadiusSlider').addEventListener('input', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'corner_radius'], parseInt(event.target.value))
  exSetup.previewDefinition(true)
})
document.getElementById('imageShapeSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'thumbnail_shape'], event.target.value)
  exSetup.previewDefinition(true)
})

Array.from(document.querySelectorAll('.height-slider')).forEach((el) => {
  el.addEventListener('input', () => {
    const titleHeight = parseInt(document.getElementById('lightboxTitleHeightSlider').value)
    const captionHeight = parseInt(document.getElementById('lightboxCaptionHeightSlider').value)
    const creditHeight = parseInt(document.getElementById('lightboxCreditHeightSlider').value)
    const imageHeight = 100 - titleHeight - captionHeight - creditHeight
    exSetup.updateWorkingDefinition(['style', 'layout', 'lightbox_title_height'], titleHeight)
    exSetup.updateWorkingDefinition(['style', 'layout', 'lightbox_caption_height'], captionHeight)
    exSetup.updateWorkingDefinition(['style', 'layout', 'lightbox_credit_height'], creditHeight)
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

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Populate available languages
exLang.createLanguagePicker(document.getElementById('language-picker'), { onLanguageRebuild: rebuildLanguageElements })

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

exSetup.configure({
  app: 'media_browser',
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
