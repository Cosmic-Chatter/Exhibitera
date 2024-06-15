/* global Coloris */

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
              color: '#719abf',
              mode: 'color'
            },
            color: {},
            font: {},
            text_size: {}
          }
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          languages: {},
          style: {
            background: {
              color: '#719abf',
              mode: 'color'
            },
            color: {},
            font: {},
            text_size: {}
          }
        })
        exSetup.previewDefinition()
        resolve()
      })
  })
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
    await initializeDefinition()
  }

  // Language add
  $('#languageAddEmptyFieldsWarning').hide()
  $('#languageAddExistsWarning').hide()

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
  let first = null
  Object.keys(def.languages).forEach((lang) => {
    const langDef = def.languages[lang]
    createLanguageTab(lang, langDef.display_name)
    if (first == null) first = lang

    $('#languagePane_' + lang).removeClass('active').removeClass('show')
    $('#headerText' + '_' + lang).val(langDef.header_text)

    // Then build out any InfoStation tabs
    def.languages[lang].tab_order.forEach((uuid) => {
      createInfoStationTab(lang, uuid)
    })
  })
  $('#languageTab_' + first).click()
  $('#languagePane_' + first).addClass('active')

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../infostation.html?standalone=true&definition=' + def.uuid
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
    default: defaultLang,
    tabs: {},
    tab_order: []
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
  deleteButton.setAttribute('data-bs-toggle', 'popover')
  deleteButton.setAttribute('title', 'Are you sure?')
  deleteButton.setAttribute('data-bs-content', `<a id='deleteLang_${code}' class='btn btn-danger w-100 lang-delete'>Confirm</a>`)
  deleteButton.setAttribute('data-bs-trigger', 'focus')
  deleteButton.setAttribute('data-bs-html', 'true')
  // Note: The event listener to detect is the delete button is clicked is defined in webpage.js
  deleteButton.addEventListener('click', function () { deleteButton.focus() })
  deleteButton.innerHTML = 'Delete language'

  deleteCol.appendChild(deleteButton)
  $(deleteButton).popover()

  // Create the header input
  const headerCol = document.createElement('div')
  headerCol.classList = 'col-12'
  row.appendChild(headerCol)

  const headerInputLabel = document.createElement('label')
  headerInputLabel.classList = 'form-label'
  headerInputLabel.innerHTML = 'Header'
  headerInputLabel.setAttribute('for', 'languageTabHeader_' + code)
  headerCol.appendChild(headerInputLabel)

  const headerInput = document.createElement('input')
  headerInput.classList = 'form-control'
  headerInput.setAttribute('type', 'text')
  headerInput.setAttribute('id', 'languageTabHeader_' + code)
  headerInput.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['languages', code, 'header'], event.target.value)
    exSetup.previewDefinition(true)
  })
  headerInput.value = workingDefinition.languages[code].header ?? ''
  headerCol.appendChild(headerInput)

  // Create the new sub-tab button
  const newInfoTabCol = document.createElement('div')
  newInfoTabCol.classList = 'col col-12 col-lg-6 col-xl-4 d-flex mt-2'
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

function createInfoStationTab (lang, uuid = '') {
  // Create a new InfoStation tab and attach it to the given language.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  if (uuid === '') {
    uuid = new Date() * 1e6 * Math.random()
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

  const buttonTextCol = document.createElement('div')
  buttonTextCol.classList = 'col-12 col-md-6'
  row.appendChild(buttonTextCol)

  const buttonTextLabel = document.createElement('label')
  buttonTextLabel.classList = 'form-label'
  buttonTextLabel.innerHTML = 'Button text'
  buttonTextLabel.setAttribute('for', 'infostationTabButtonTextInput_' + uuid)
  buttonTextCol.appendChild(buttonTextLabel)

  const buttonTextInput = document.createElement('input')
  buttonTextInput.classList = 'form-control'
  buttonTextInput.setAttribute('type', 'text')
  buttonTextInput.setAttribute('id', 'infostationTabButtonTextInput_' + uuid)
  buttonTextInput.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['languages', lang, 'tabs', uuid, 'button_text'], event.target.value)
    document.getElementById('infostationTab_' + lang + '_' + uuid).innerHTML = event.target.value
    exSetup.previewDefinition(true)
  })
  buttonTextInput.value = workingDefinition.languages[lang].tabs[uuid].button_text
  buttonTextCol.appendChild(buttonTextInput)

  const textTabTipCol = document.createElement('div')
  textTabTipCol.classList = 'col-12 mt-3 fst-italic alert alert-info'
  textTabTipCol.innerHTML = 'Text and images in text tabs are formatted using Markdown. See the help page to learn more about Markdown.'
  row.appendChild(textTabTipCol)

  const textCol = document.createElement('div')
  textCol.classList = 'col-12'
  row.appendChild(textCol)

  const textLabel = document.createElement('label')
  textLabel.classList = 'form-label'
  textLabel.innerHTML = 'Text'
  textLabel.setAttribute('for', 'infostationTabTextInput_' + uuid)
  textCol.appendChild(textLabel)

  const textInput = document.createElement('textarea')
  textInput.classList = 'form-control'
  textInput.setAttribute('rows', '5')
  textInput.setAttribute('id', 'infostationTabTextInput_' + uuid)
  textInput.setAttribute('placeholder', '# Header\nThis is a sentence with a **bold** word and an _italics_ word.\n\n## Subheader\nThis is a sentance under the subheader.')
  textInput.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['languages', lang, 'tabs', uuid, 'text'], event.target.value)
    exSetup.previewDefinition(true)
  })
  textInput.value = workingDefinition.languages[lang].tabs[uuid].text
  textCol.appendChild(textInput)

  // Create the delete button
  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-12'
  row.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger w-100 align-self-center'
  deleteButton.setAttribute('data-bs-toggle', 'popover')
  deleteButton.setAttribute('title', 'Are you sure?')
  deleteButton.setAttribute('data-bs-content', `<a id='deleteTab_${lang}_${uuid}' class='btn btn-danger w-100 tab-delete'>Confirm</a>`)
  deleteButton.setAttribute('data-bs-trigger', 'focus')
  deleteButton.setAttribute('data-bs-html', 'true')
  // Note: The event listener to detect is the delete button is clicked is defined in webpage.js
  deleteButton.addEventListener('click', function () { deleteButton.focus() })
  deleteButton.innerHTML = 'Delete tab'

  deleteCol.appendChild(deleteButton)
  $(deleteButton).popover()

  $(tabButton).click()
  exSetup.previewDefinition(true)
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
  definition.app = 'infostation'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  exCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        exCommon.getAvailableDefinitions('infostation')
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
$('#languageAddButton').click(addLanguage)
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
  initializeDefinition,
  loadDefinition: editDefinition,
  saveDefinition
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
