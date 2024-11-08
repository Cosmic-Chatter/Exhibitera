/* global bootstrap, Coloris */

import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'

async function initializeWizard () {
  // Set up the wizard

  await exSetup.initializeDefinition()

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

  if (full === true) {
    await exSetup.initializeDefinition()
  }

  // Spreadsheet
  const spreadsheetSelect = document.getElementById('spreadsheetSelect')
  spreadsheetSelect.innerHTML = 'Select file'
  spreadsheetSelect.setAttribute('data-filename', '')
  $(spreadsheetSelect).data('availableKeys', [])

  // Language add
  $('#languageAddEmptyFieldsWarning').hide()
  $('#languageAddExistsWarning').hide()

  // Definition details
  $('#definitionNameInput').val('')
  $('#languageNav').empty()
  $('#languageNavContent').empty()
  document.getElementById('missingContentWarningField').innerHTML = ''

  // Reset style options
  const colorInputs = ['textColor', 'headerColor', 'footerColor', 'itemColor', 'lineColor']
  colorInputs.forEach((input) => {
    const el = $('#colorPicker_' + input)
    el.val(el.data('default'))
    document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
  })

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#719abf',
    gradient_color_1: '#719abf',
    gradient_color_2: '#719abf'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)
  console.log(def)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)

  // Spreadsheet
  $('#spreadsheetSelect').html(def.spreadsheet)
  document.getElementById('spreadsheetSelect').setAttribute('data-filename', def.spreadsheet)

  // Attractor
  $('#attractorSelect').html(def.attractor)
  document.getElementById('attractorSelect').setAttribute('data-filename', def.attractor)
  if ('inactivity_timeout' in def) {
    document.getElementById('inactivityTimeoutField').value = def.inactivity_timeout
  } else {
    document.getElementById('inactivityTimeoutField').value = 30
  }

  // Set the appropriate values for the color pickers
  Object.keys(def.style.color).forEach((key) => {
    $('#colorPicker_' + key).val(def.style.color[key])
    document.querySelector('#colorPicker_' + key).dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Set the appropriate values for any advanced color pickers
  if ('background' in def.style) {
    exSetup.updateAdvancedColorPicker('style>background', def.style.background)
  }

  // Set the appropriate values for the advanced font pickers
  if ('font' in def.style) {
    Object.keys(def.style.font).forEach((key) => {
      const picker = document.querySelector(`.AFP-select[data-path="style>font>${key}"`)
      exSetup.setAdvancedFontPicker(picker, def.style.font[key])
    })
  }

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
  document.getElementById('previewFrame').src = '../timeline_explorer.html?standalone=true&definition=' + def.uuid
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
  // Set first=true when creating the first tab

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

    col.appendChild(label)

    let input

    if (inputFields[key].kind === 'select') {
      input = document.createElement('select')
      input.classList = 'form-select'
    } else if (inputFields[key].kind === 'input') {
      input = document.createElement('input')
      input.setAttribute('type', inputFields[key].type)
      input.classList = 'form-control'
    }
    input.setAttribute('id', langKey)
    input.addEventListener('change', function () {
      const value = $(this).val().trim()
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

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })

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
    if (imageKeys.includes(workingDefinition.languages[lang].image_key) === false) {
      imageKeys.push(workingDefinition.languages[lang].image_key)
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
      console.log(result)
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
  const height = parseInt(resolution.split('_')[1])
  let thumbRes
  if (width > height) {
    thumbRes = Math.round(width * 0.25)
  } else {
    thumbRes = Math.round(width * 0.5)
  }

  // Loop through the defintion and collect any unique image keys
  const imageKeys = []

  Object.keys(workingDefinition.languages).forEach((lang) => {
    if (imageKeys.includes(workingDefinition.languages[lang].image_key) === false) {
      imageKeys.push(workingDefinition.languages[lang].image_key)
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

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// The input fields to specifiy content for each langauge
const inputFields = {
  headerText: {
    name: 'Header',
    kind: 'input',
    type: 'text',
    property: 'header_text'
  },
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

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

exSetup.configure({
  app: 'timeline_explorer',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    languages: {},
    style: {
      background: {
        mode: 'color',
        color: '#719abf'
      },
      color: {},
      font: {}
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
