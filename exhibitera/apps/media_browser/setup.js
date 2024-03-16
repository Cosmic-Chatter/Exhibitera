/* global Coloris, bootstrap */

import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'

function initializeDefinition () {
  // Create a blank definition at save it to workingDefinition.

  return new Promise(function (resolve, reject) {
    // Get a new temporary uuid
    exCommon.makeHelperRequest({
      method: 'GET',
      endpoint: '/uuid/new'
    })
      .then((response) => {
        $('#definitionSaveButton').data('initialDefinition', {
          uuid: response.uuid,
          languages: {},
          style: {
            background: {
              mode: 'color',
              color: '#fff'
            },
            color: {},
            font: {},
            layout: {},
            text_size: {}
          }
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          languages: {},
          style: {
            background: {
              mode: 'color',
              color: '#fff'
            },
            color: {},
            font: {},
            layout: {},
            text_size: {}
          }
        })
        exSetup.previewDefinition(false)
        resolve()
      })
  })
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
    await initializeDefinition()
  }

  // Spreadsheet
  const spreadsheetSelect = document.getElementById('spreadsheetSelect')
  spreadsheetSelect.innerHTML = 'Select file'
  spreadsheetSelect.setAttribute('data-filename', '')
  $(spreadsheetSelect).data('availableKeys', [])

  // Language add
  $('#languageAddEmptyFieldsWarning').hide()
  $('#languageAddExistsWarning').hide()

  // Attractor
  document.getElementById('inactivityTimeoutField').value = 30
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')

  // Definition details
  $('#definitionNameInput').val('')
  $('#languageNav').empty()
  $('#languageNavContent').empty()
  document.getElementById('missingContentWarningField').innerHTML = ''

  // Reset layout options
  // document.getElementById('showSearchPaneCheckbox').checked = false
  document.getElementById('itemsPerPageInput').value = 12
  document.getElementById('numColsSelect').value = 6
  document.getElementById('imageHeightSlider').value = 80

  // Reset style options
  const colorInputs = ['titleColor', 'filterBackgroundColor', 'filterLabelColor', 'filterTextColor']
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

  $('#definitionNameInput').val(def.name)

  // Spreadsheet
  $('#spreadsheetSelect').html(def.spreadsheet)
  document.getElementById('spreadsheetSelect').setAttribute('data-filename', def.spreadsheet)

  // Attractor
  if ('attractor' in def && def.attractor.trim() !== '') {
    $('#attractorSelect').html(def.attractor)
  } else {
    $('#attractorSelect').html('Select file')
  }
  document.getElementById('attractorSelect').setAttribute('data-filename', def.attractor)
  if ('inactivity_timeout' in def) {
    document.getElementById('inactivityTimeoutField').value = def.inactivity_timeout
  } else {
    document.getElementById('inactivityTimeoutField').value = 30
  }

  // Set the layout options
  if ('items_per_page' in def.style.layout) {
    document.getElementById('itemsPerPageInput').value = def.style.layout.items_per_page
  } else {
    document.getElementById('itemsPerPageInput').value = 12
  }
  if ('num_columns' in def.style.layout) {
    document.getElementById('numColsSelect').value = def.style.layout.num_columns
  } else {
    document.getElementById('numColsSelect').value = 6
  }
  document.getElementById('imageHeightSlider').value = def.style.layout.image_height
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

  // Set the appropriate values for the text size selects
  Object.keys(def.style.text_size).forEach((key) => {
    document.getElementById(key + 'TextSizeSlider').value = def.style.text_size[key]
  })

  // Build out the key input interface
  let first = null
  Object.keys(def.languages).forEach((lang) => {
    const langDef = def.languages[lang]
    if (first == null) {
      createLanguageTab(lang, langDef.display_name)
      first = lang
    } else {
      createLanguageTab(lang, langDef.display_name)
    }
    $('#languagePane_' + lang).removeClass('active').removeClass('show')

    $('#headerText' + '_' + lang).val(langDef.header_text)
  })
  $('#languageTab_' + first).click()
  $('#languagePane_' + first).addClass('active')

  // Load the spreadsheet to populate the existing keys
  onSpreadsheetFileChange()

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../media_browser.html?standalone=true&definition=' + def.uuid
}

function addLanguage () {
  // Collect details from the language fields and add a new supported language to the definition.

  const displayName = $('#languageNameInput').val().trim()
  const code = $('#languageCodeInput').val().trim()
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  // Check if fields are full
  if (displayName === '' || code === '') {
    $('#languageAddEmptyFieldsWarning').show()
    return
  } else {
    $('#languageAddEmptyFieldsWarning').hide()
  }

  // Check if name or code already exist
  let error = false
  Object.keys(workingDefinition.languages).forEach((key) => {
    if (key === code || workingDefinition.languages[key].display_name === displayName) {
      $('#languageAddExistsWarning').show()
      error = true
    } else {
      $('#languageAddExistsWarning').hide()
    }
  })
  if (error) return

  // If this is the first language added, make it the default
  let defaultLang = false
  if (Object.keys(workingDefinition.languages).length === 0) defaultLang = true

  workingDefinition.languages[code] = {
    display_name: displayName,
    code,
    default: defaultLang
  }
  createLanguageTab(code, displayName)

  $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))
  $('#languageNameInput').val('')
  $('#languageCodeInput').val('')
}

function createLanguageTab (code, displayName) {
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
  tabButton.innerHTML = displayName
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

  // Create default language checkbox
  const defaultCol = document.createElement('div')
  defaultCol.classList = 'col-12'
  row.appendChild(defaultCol)

  const checkContainer = document.createElement('div')
  checkContainer.classList = 'form-check'
  defaultCol.appendChild(checkContainer)

  const defaultCheckbox = document.createElement('input')
  defaultCheckbox.classList = 'form-check-input default-lang-checkbox'
  defaultCheckbox.setAttribute('id', 'defaultCheckbox_' + code)
  defaultCheckbox.setAttribute('data-lang', code)
  defaultCheckbox.setAttribute('type', 'radio')
  defaultCheckbox.checked = workingDefinition.languages[code].default
  defaultCheckbox.addEventListener('change', (event) => {
    // If the checkbox is checked, uncheck all the others and save to the working definition.
    Array.from(document.querySelectorAll('.default-lang-checkbox')).forEach((el) => {
      el.checked = false
      exSetup.updateWorkingDefinition(['languages', el.getAttribute('data-lang'), 'default'], false)
    })
    event.target.checked = true
    exSetup.updateWorkingDefinition(['languages', code, 'default'], true)
    exSetup.previewDefinition(true)
  })
  checkContainer.appendChild(defaultCheckbox)

  const defaultCheckboxLabel = document.createElement('label')
  defaultCheckboxLabel.classList = 'form-check-label'
  defaultCheckboxLabel.setAttribute('for', 'defaultCheckbox_' + code)
  defaultCheckboxLabel.innerHTML = 'Default language'
  checkContainer.appendChild(defaultCheckboxLabel)

  // Create the flag input
  const flagImgCol = document.createElement('div')
  flagImgCol.classList = 'col-3 col-lg-2 d-flex'
  row.append(flagImgCol)

  const flagImg = document.createElement('img')
  flagImg.setAttribute('id', 'flagImg_' + code)
  const customFlag = $('#definitionSaveButton').data('workingDefinition').languages[code].custom_flag
  if (customFlag != null) {
    flagImg.src = '../content/' + customFlag
  } else {
    flagImg.src = '../_static/flags/' + code + '.svg'
  }
  flagImg.classList = 'align-self-center'
  flagImg.style.width = '100%'
  flagImg.addEventListener('error', function () {
    this.src = '../_static/icons/translation-icon_black.svg'
  })
  flagImgCol.appendChild(flagImg)

  const clearFlagCol = document.createElement('div')
  clearFlagCol.classList = 'col-2 col-lg-1 d-flex mx-0 px-0 text-center4'
  row.appendChild(clearFlagCol)

  const clearFlagButton = document.createElement('button')
  clearFlagButton.classList = 'btn btn-danger align-self-center'
  clearFlagButton.innerHTML = '✕'
  clearFlagButton.addEventListener('click', function () {
    deleteLanguageFlag(code)
  })
  clearFlagCol.append(clearFlagButton)

  const uploadFlagCol = document.createElement('div')
  uploadFlagCol.classList = 'col-7 col-lg-3 d-flex'
  row.append(uploadFlagCol)

  const uploadFlagBox = document.createElement('label')
  uploadFlagBox.classList = 'btn btn-outline-primary w-100 align-self-center d-flex'
  uploadFlagCol.appendChild(uploadFlagBox)

  const uploadFlagFileName = document.createElement('span')
  uploadFlagFileName.setAttribute('id', 'uploadFlagFilename_' + code)
  uploadFlagFileName.classList = 'w-100 align-self-center'
  uploadFlagFileName.innerHTML = 'Upload flag'
  uploadFlagBox.appendChild(uploadFlagFileName)

  const uploadFlagInput = document.createElement('input')
  uploadFlagInput.setAttribute('id', 'uploadFlagInput_' + code)
  uploadFlagInput.classList = 'form-control-file w-100 align-self-center'
  uploadFlagInput.setAttribute('type', 'file')
  uploadFlagInput.setAttribute('hidden', true)
  uploadFlagInput.setAttribute('accept', 'image/*')
  uploadFlagInput.addEventListener('change', function () {
    onFlagUploadChange(code)
  })
  uploadFlagBox.appendChild(uploadFlagInput)

  // Create the delete button
  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col col-12 col-lg-6 col-xl-4 d-flex'
  row.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger w-100 align-self-center'
  deleteButton.innerHTML = 'Delete language'
  deleteButton.addEventListener('click', () => {
    deleteLanguageTab(code)
  })
  deleteCol.appendChild(deleteButton)

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
      label.innerHTML += ' ' + `<span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="${inputFields[key].hint}" style="font-size: 0.55em;">?</span>`
    }

    if ('tooltip' in inputFields[key]) {
      const tooltip = '\n<span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="' + inputFields[key].tooltip + '" style="font-size: 0.55em;">?</span>'
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
      let value = $(this).val()
      if (typeof value === 'string') value = value.trim()
      exSetup.updateWorkingDefinition(['languages', code, inputFields[key].property], value)
      exSetup.previewDefinition(true)
    })
    col.appendChild(input)
  })

  // If we have already loaded a spreadhseet, populate the key options
  const keyList = $('#spreadsheetSelect').data('availableKeys')
  if (keyList != null) {
    populateKeySelects(keyList)
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

  // Switch to this new tab
  $(tabButton).click()
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
  const keyList = $('#spreadsheetSelect').data('availableKeys')
  if (keyList != null) {
    populateFilterSelects(keyList)
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

function deleteLanguageTab (lang) {
  // Delete the given language tab.

  delete $('#definitionSaveButton').data('workingDefinition').languages[lang]
  $('#languageTab_' + lang).remove()
  $('#languagePane_' + lang).remove()
  $('.language-tab').click()
}

function deleteLanguageFlag (lang) {
  // Ask the server to delete the language flag and remove it from the working definition.

  const flag = $('#definitionSaveButton').data('workingDefinition').languages[lang].custom_flag

  if (flag == null) {
    // No custom flag
    return
  }

  // Delete filename from working definition
  delete $('#definitionSaveButton').data('workingDefinition').languages[lang].custom_flag

  // Remove the icon
  $('#flagImg_' + lang).attr('src', '../_static/flags/' + lang + '.svg')

  // Delete from server
  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/file/delete',
    params: {
      file: flag
    }
  })
}

function onFlagUploadChange (lang) {
  // Called when the user selects a flag image file to upload

  const fileInput = $('#uploadFlagInput_' + lang)[0]

  const file = fileInput.files[0]
  if (file == null) return

  $('#uploadFlagFilename_' + lang).html('Uploading')

  const ext = file.name.split('.').pop()
  const newName = $('#definitionSaveButton').data('workingDefinition').uuid + '_flag_' + lang + '.' + ext

  const formData = new FormData()

  formData.append('files', fileInput.files[0], newName)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/uploadContent', true)

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return
    if (this.status === 200) {
      const response = JSON.parse(this.responseText)

      if ('success' in response) {
        $('#uploadFlagFilename_' + lang).html('Upload')
        $('#flagImg_' + lang).attr('src', '../content/' + newName)
        exSetup.updateWorkingDefinition(['languages', lang, 'custom_flag'], newName)
      }
    } else if (this.status === 422) {
      console.log(JSON.parse(this.responseText))
    }
  }
  xhr.send(formData)
}

function saveDefinition () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'media_browser'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  exCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        exCommon.getAvailableDefinitions('media_browser')
          .then((response) => {
            if ('success' in response && response.success === true) {
              exSetup.populateAvailableDefinitions(response.definitions)
            }
          })
      }
    })
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
      $('#spreadsheetSelect').data('availableKeys', keys)
      populateKeySelects(keys)
      populateFilterSelects(keys)
      exSetup.previewDefinition(true)
    })
}

function checkContentExists () {
  // Cross-check content from the spreadsheet with files in the content directory.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const imageKeys = []
  document.getElementById('missingContentWarningField').innerHTML = ''

  // Loop through the defintion and collect any unique image keys
  Object.keys(workingDefinition.languages).forEach((lang) => {
    if (imageKeys.includes(workingDefinition.languages[lang].media_key) === false) {
      imageKeys.push(workingDefinition.languages[lang].media_key)
    }
  })

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
        endpoint: '/content/' + workingDefinition.spreadsheet,
        rawResponse: true,
        noCache: true
      })
        .then((raw) => {
          const spreadsheet = exCommon.csvToJSON(raw).json
          spreadsheet.forEach((row) => {
            imageKeys.forEach((key) => {
              if (row[key].trim() === '') return
              if (availableContent.includes(row[key]) === false) missingContent.push(row[key])
            })
          })
          const missingContentField = document.getElementById('missingContentWarningField')
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
        })
    })
}

function showOptimizeContentModal () {
  // Show the modal for optimizing the content and thumbnails.

  document.getElementById('optimizeContentProgressBarDiv').style.display = 'none'
  $('#optimizeContentModal').modal('show')
}

function optimizeMediaFromModal () {
  // Collect the necessary information and then optimize the media.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const resolution = document.getElementById('resolutionSelect').value
  const width = parseInt(resolution.split('_')[0])
  const nCols = parseInt(document.getElementById('numColsSelect').value)
  const thumbRes = width / nCols

  // Loop through the defintion and collect any unique image keys
  const imageKeys = []

  Object.keys(workingDefinition.languages).forEach((lang) => {
    if (imageKeys.includes(workingDefinition.languages[lang].media_key) === false) {
      imageKeys.push(workingDefinition.languages[lang].media_key)
    }
  })

  // Retrieve the spreadsheet and collect all images
  const toOptimize = []

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + workingDefinition.spreadsheet,
    rawResponse: true,
    noCache: true
  })
    .then((raw) => {
      const spreadsheet = exCommon.csvToJSON(raw).json
      spreadsheet.forEach((row) => {
        imageKeys.forEach((key) => {
          if (row[key].trim() === '') return
          toOptimize.push(row[key])
        })
      })
      const total = toOptimize.length
      let numComplete = 0

      // Show the progress bar
      document.getElementById('optimizeContentProgressBarDiv').style.display = 'flex'
      document.getElementById('optimizeContentProgressBar').style.width = '0%'
      document.getElementById('optimizeContentProgressBarDiv').setAttribute('aria-valuenow', 0)

      toOptimize.forEach((file) => {
        exCommon.makeHelperRequest({
          method: 'POST',
          endpoint: '/files/generateThumbnail',
          params: {
            source: file,
            mimetype: 'image',
            width: thumbRes
          }
        })
          .then((result) => {
            if (result.success === true) {
              numComplete += 1
              const percent = Math.round(100 * numComplete / total)
              document.getElementById('optimizeContentProgressBar').style.width = String(percent) + '%'
              document.getElementById('optimizeContentProgressBarDiv').setAttribute('aria-valuenow', percent)
            }
          })
      })
    })
}

function populateKeySelects (keyList) {
  // Take a list of keys and use it to populate all the selects used to match keys to parameters.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  if (('languages' in workingDefinition) === false) return

  Object.keys(workingDefinition.languages).forEach((lang) => {
    const langDict = workingDefinition.languages[lang]
    Object.keys(inputFields).forEach((input) => {
      const inputDict = inputFields[input]
      if (inputDict.kind === 'select') {
        $('#' + input + '_' + lang).empty()

        keyList.forEach((key) => {
          const option = document.createElement('option')
          option.value = key
          option.innerHTML = key
          $('#' + input + '_' + lang).append(option)
        })

        // If we already have a value for this select, set it
        if (inputDict.property in langDict) {
          $('#' + input + '_' + lang).val(langDict[inputDict.property])
        } else {
          $('#' + input + '_' + lang).val(null)
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

// Main buttons

$('#languageAddButton').click(addLanguage)
document.getElementById('manageContentButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ manage: true })
})
document.getElementById('showCheckContentButton').addEventListener('click', () => {
  document.getElementById('missingContentWarningField').innerHTML = ''
  $('#checkContentModal').modal('show')
})
document.getElementById('checkContentButton').addEventListener('click', checkContentExists)
document.getElementById('optimizeContentButton').addEventListener('click', showOptimizeContentModal)
document.getElementById('optimizeContentBeginButton').addEventListener('click', optimizeMediaFromModal)

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

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

exSetup.configure({
  app: 'media_browser',
  clearDefinition: clearDefinitionInput,
  initializeDefinition,
  loadDefinition: editDefinition,
  saveDefinition
})

exCommon.askForDefaults(false)
  .then(() => {
    if (exCommon.config.standalone === false) {
      // We are using Control Server, so attempt to log in
      exSetup.authenticateUser()
    } else {
      // Hide the login details
      document.getElementById('loginMenu').style.display = 'none'
    }
  })
