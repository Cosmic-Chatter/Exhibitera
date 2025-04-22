/* global bootstrap, Coloris */

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

  exSetup.initializeDefinition()

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
      wizardGoTo('Languages')
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
      wizardGoTo('Header')
    } else {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Header') {
    wizardGoTo('Spreadsheet')
  } else if (currentPage === 'Spreadsheet') {
    const selectedFile = document.getElementById('wizardUploadTemplateButton').getAttribute('data-spreadsheet')
    if (selectedFile !== '') {
      document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'none'
      document.getElementById('wizardUploadMediaMissingWarning').style.display = 'none'
      document.getElementById('wizardUploadMediaMissingRow').style.display = 'none'
      wizardGoTo('MediaUpload')
    } else {
      document.getElementById('wizardUploadTemplateBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'MediaUpload') {
    // Check that each file listed in the spreadsheet has an uploaded copy.
    const spreadsheet = document.getElementById('wizardUploadTemplateButton').getAttribute('data-spreadsheet')
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
  } else if (currentPage === 'Header') {
    wizardGoTo('Languages')
  } else if (currentPage === 'Spreadsheet') {
    wizardGoTo('Header')
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

  $('#setupWizardModal').modal('hide')

  if (orientation === 'horizontal') {
    exSetup.configurePreview('16x9', true)
  } else exSetup.configurePreview('9x16', true)

  const uuid = $('#definitionSaveButton').data('workingDefinition').uuid

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

  // Spreadsheet
  const spreadsheetSelect = document.getElementById('spreadsheetSelect')
  spreadsheetSelect.innerHTML = 'Select file'
  spreadsheetSelect.setAttribute('data-filename', '')
  $(spreadsheetSelect).data('availableKeys', [])

  // Language
  exLang.clearLanguagePicker(document.getElementById('language-picker'))
  exLang.createLanguagePicker(document.getElementById('language-picker'), { onLanguageRebuild: rebuildLanguageElements })

  rebuildLanguageElements([])

  // Definition details
  document.getElementById('definitionNameInput').value = ''
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

  // Reset text size options
  document.getElementById('timeTextSizeSlider').value = 0
  document.getElementById('titleTextSizeSlider').value = 0
  document.getElementById('bodyTextSizeSlider').value = 0
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

  // Set the appropriate values for the text size selects
  Object.keys(def.style?.text_size ?? {}).forEach((key) => {
    document.getElementById(key + 'TextSizeSlider').value = def.style.text_size[key]
  })

  // Set up any existing languages and tabs
  // In Ex5.3, we added the language_order field. If it doesn't exist
  // set it up now
  if ((def?.language_order || []).length === 0) {
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

  // Build out the key input interface
  // let first = null
  // Object.keys(def.languages).forEach((lang) => {
  //   const langDef = def.languages[lang]
  //   if (first == null) {
  //     createLanguageTab(lang, langDef.display_name)
  //     first = lang
  //   } else {
  //     createLanguageTab(lang, langDef.display_name)
  //   }
  //   $('#languagePane_' + lang).removeClass('active').removeClass('show')

  //   $('#headerText' + '_' + lang).val(langDef.header_text)
  // })
  // $('#languageTab_' + first).click()
  // $('#languagePane_' + first).addClass('active')

  // Load the spreadsheet to populate the existing keys
  onSpreadsheetFileChange()

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
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
  tabButton.innerHTML = exLang.getLanguageDisplayName(code, true)
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

  // Create the header input
  const headerCol = document.createElement('div')
  headerCol.classList = 'col-12 col-md-6'
  row.appendChild(headerCol)

  const label = document.createElement('label')
  label.classList = 'form-label mt-2'
  label.setAttribute('for', 'headerInput_' + code)
  label.innerHTML = 'Header'
  headerCol.appendChild(label)

  const headerCommandBar = document.createElement('div')
  headerCol.appendChild(headerCommandBar)

  const headerInput = document.createElement('div')
  headerInput.setAttribute('id', 'headerInput_' + code)
  headerCol.appendChild(headerInput)

  const headerEditor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: workingDefinition?.languages?.[code]?.header_text ?? '',
    editorDiv: headerInput,
    commandDiv: headerCommandBar,
    commands: ['basic'],
    callback: (content) => {
      exSetup.updateWorkingDefinition(['languages', code, 'header_text'], content)
      exSetup.previewDefinition(true)
    }
  })

  // Create the key selectors
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
  return tabButton
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
      $('#spreadsheetSelect').data('availableKeys', keys)
      populateKeySelects(keys)
      exSetup.previewDefinition(true)
    })
}

async function checkContentExists () {
  // Cross-check content from the spreadsheet with files in the content directory.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const imageKeys = []
  const missingContentField = document.getElementById('missingContentWarningField')

  missingContentField.innerHTML = ''

  // Loop through the defintion and collect any unique media keys
  Object.keys(workingDefinition.languages).forEach((lang) => {
    if (imageKeys.includes(workingDefinition.languages[lang].image_key) === false) {
      imageKeys.push(workingDefinition.languages[lang].image_key)
    }
  })

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

// Populate available languages
exLang.createLanguagePicker(document.getElementById('language-picker'), { onLanguageRebuild: rebuildLanguageElements })

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
