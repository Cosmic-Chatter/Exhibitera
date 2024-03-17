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
          options: {},
          option_order: [],
          text: {},
          style: {
            background: {
              mode: 'color',
              color: '#22222E'
            },
            color: {},
            font: {},
            layout: {},
            text_size: {}
          },
          behavior: {}
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          options: {},
          option_order: [],
          text: {},
          style: {
            background: {
              mode: 'color',
              color: '#22222E'
            },
            color: {},
            font: {},
            layout: {},
            text_size: {}
          },
          behavior: {}
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

  // Definition details
  $('#definitionNameInput').val('')
  document.getElementById('behaviorInput_recording_interval').value = 60
  document.getElementById('behaviorInput_touch_cooldown').value = 2

  // Reset text inputs
  document.getElementById('headerInput').value = ''
  document.getElementById('subheaderInput').value = ''
  document.getElementById('footerInput').value = ''
  document.getElementById('subfooterInput').value = ''
  document.getElementById('success_messageInput').value = ''

  // Reset option edit fields
  document.getElementById('optionRow').innerHTML = ''
  document.getElementById('optionInput_label').value = ''
  document.getElementById('optionInput_value').value = ''
  document.getElementById('optionInput_icon').value = ''
  setIconUserFile('')

  // Reset color options
  const colorInputs = ['button-color', 'button-touched-color', 'success-message-color', 'header-color', 'subheader-color', 'footer-color', 'subfooter-color', 'button-text-color']
  colorInputs.forEach((input) => {
    const el = $('#colorPicker_' + input)
    el.val(el.data('default'))
    document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
  })
  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#22222E'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()

  // Reset text size options
  document.getElementById('headerTextSizeSlider').value = 0
  document.getElementById('subheaderTextSizeSlider').value = 0
  document.getElementById('footerTextSizeSlider').value = 0
  document.getElementById('subfooterTextSizeSlider').value = 0
  document.getElementById('buttonTextSizeSlider').value = 0

  // Reset layout options
  document.getElementById('columnCountSelect').value = 'auto'
  document.getElementById('headerToButtonsSlider').value = 20
  document.getElementById('headerPaddingHeightSlider').value = 5
  document.getElementById('buttonsToFooterSlider').value = 20
  document.getElementById('footerPaddingHeightSlider').value = 5
  document.getElementById('buttonPaddingHeightSlider').value = 10
  document.getElementById('imageHeightSlider').value = 90
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)

  // Set the appropriate values for the behavior fields
  Object.keys(def.behavior).forEach((key) => {
    document.getElementById('behaviorInput_' + key).value = def.behavior[key]
  })

  // Set the appropriate values for the text fields
  Object.keys(def.text).forEach((key) => {
    document.getElementById(key + 'Input').value = def.text[key]
  })

  // Create any existing options
  document.getElementById('optionRow').innerHTML = ''
  def.option_order.forEach((optionUUID) => {
    const option = def.options[optionUUID]
    createSurveyOption(option)
  })

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

  // Set the appropriate values for the text size sliders
  Object.keys(def.style.text_size).forEach((key) => {
    document.getElementById(key + 'TextSizeSlider').value = def.style.text_size[key]
  })

  // Set the appropriate values for the layout options
  if ('num_columns' in def.style.layout) {
    document.getElementById('columnCountSelect').value = def.style.layout.num_columns
  }
  if ('top_height' in def.style.layout) {
    document.getElementById('headerToButtonsSlider').value = def.style.layout.top_height
  }
  if ('header_padding' in def.style.layout) {
    document.getElementById('headerPaddingHeightSlider').value = def.style.layout.header_padding
  }
  if ('bottom_height' in def.style.layout) {
    document.getElementById('buttonsToFooterSlider').value = def.style.layout.bottom_height
  }
  if ('footer_padding' in def.style.layout) {
    document.getElementById('footerPaddingHeightSlider').value = def.style.layout.footer_padding
  }
  if ('button_padding' in def.style.layout) {
    document.getElementById('buttonPaddingHeightSlider').value = def.style.layout.button_padding
  }
  if ('image_height' in def.style.layout) {
    document.getElementById('imageHeightSlider').value = def.style.layout.image_height
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../voting_kiosk.html?standalone=true&definition=' + def.uuid
}

function formatOptionHeader (details) {
  // Return a string that labels the option with the best information we have
  if (details.label !== '') return details.label
  if (details.value !== '') return details.value
  if (details.icon !== '') {
    if (details.icon === 'user' && details.icon_user_file !== '') return details.icon_user_file
    return details.icon
  }
  return 'New Option'
}

function createSurveyOption (userDetails, populateEditor = false) {
  // Create the HTML representation of a survey question and add it to the row.

  const optionOrder = $('#definitionSaveButton').data('workingDefinition').option_order

  const defaults = {
    uuid: String(Math.random() * 1e20),
    label: '',
    value: '',
    icon: '',
    icon_user_file: ''
  }
  // Merge in user details
  const details = { ...defaults, ...userDetails }

  if (optionOrder.includes(details.uuid) === false) {
    optionOrder.push(details.uuid)
    exSetup.updateWorkingDefinition(['option_order', optionOrder])
    Object.keys(defaults).forEach((key) => {
      exSetup.updateWorkingDefinition(['options', details.uuid, key], details[key])
    })
  }

  const col = document.createElement('div')
  col.setAttribute('id', 'Option_' + details.uuid)
  col.classList = 'col col-12 mt-2'

  const container = document.createElement('div')
  container.classList = 'mx-3'
  col.appendChild(container)

  const topRow = document.createElement('div')
  topRow.classList = 'row'
  container.appendChild(topRow)

  const headerCol = document.createElement('div')
  headerCol.classList = 'col-12 bg-secondary rounded-top'
  topRow.appendChild(headerCol)

  const headerText = document.createElement('div')
  headerText.setAttribute('id', 'OptionHeaderText_' + details.uuid)
  headerText.classList = 'text-light w-100 text-center font-weight-bold'
  headerText.innerHTML = formatOptionHeader(details) || 'New option'
  headerCol.appendChild(headerText)

  const bottomRow = document.createElement('div')
  bottomRow.classList = 'row'
  container.appendChild(bottomRow)

  const editCol = document.createElement('div')
  editCol.classList = 'col-12 col-sm-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(editCol)

  const editButton = document.createElement('button')
  editButton.classList = 'btn btn-sm rounded-0 text-light bg-info w-100 h-100 justify-content-center d-flex pl-1'
  editButton.style.cursor = 'pointer'
  editButton.innerHTML = 'Edit'
  editButton.addEventListener('click', () => {
    populateOptionEditor(details.uuid)
  })
  editCol.appendChild(editButton)

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-12 col-sm-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-sm rounded-0 text-light bg-danger w-100 h-100 justify-content-center d-flex pl-1'
  deleteButton.style.cursor = 'pointer'
  deleteButton.innerHTML = 'Delete'
  deleteButton.setAttribute('data-bs-toggle', 'popover')
  deleteButton.setAttribute('title', 'Are you sure?')
  deleteButton.setAttribute('data-bs-content', `<a id="DeleteOptionPopover_${details.uuid}" class="btn btn-danger w-100">Confirm</a>`)
  deleteButton.setAttribute('data-bs-trigger', 'focus')
  deleteButton.setAttribute('data-bs-html', 'true')
  $(document).on('click', '#DeleteOptionPopover_' + details.uuid, function () {
    deleteOption(details.uuid)
  })
  deleteButton.addEventListener('click', function () { deleteButton.focus() })
  deleteCol.appendChild(deleteButton)

  const leftArrowCol = document.createElement('div')
  leftArrowCol.classList = 'col-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(leftArrowCol)

  const leftArrowButton = document.createElement('button')
  leftArrowButton.classList = 'btn btn-sm rounded-0 text-light bg-primary w-100 h-100 justify-content-center d-flex'
  leftArrowButton.style.cursor = 'pointer'
  leftArrowButton.innerHTML = '◀'
  leftArrowButton.addEventListener('click', () => {
    changeOptionOrder(details.uuid, -1)
  })
  leftArrowCol.appendChild(leftArrowButton)

  const RightArrowCol = document.createElement('div')
  RightArrowCol.classList = 'col-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(RightArrowCol)

  const rightArrowButton = document.createElement('button')
  rightArrowButton.classList = 'btn btn-sm rounded-0 text-light bg-primary w-100 h-100 justify-content-center d-flex'
  rightArrowButton.style.cursor = 'pointer'
  rightArrowButton.innerHTML = '▶'
  rightArrowButton.addEventListener('click', () => {
    changeOptionOrder(details.uuid, 1)
  })
  RightArrowCol.appendChild(rightArrowButton)

  document.getElementById('optionRow').appendChild(col)

  if (populateEditor === true) {
    populateOptionEditor(details.uuid)
  }

  // Activate the popover
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl)
  })
}

function deleteOption (uuid) {
  // Delete an option and rebuild the GUI

  const def = $('#definitionSaveButton').data('workingDefinition')

  // Delete from the options dictionary
  delete def.options[uuid]

  // Delete from option order array
  const searchFunc = (el) => el === uuid
  const index = def.option_order.findIndex(searchFunc)
  if (index > -1) { // only splice array when item is found
    def.option_order.splice(index, 1)
  }

  // Rebuild the optionList GUI
  document.getElementById('optionRow').innerHTML = ''
  def.option_order.forEach((optionUUID) => {
    const option = def.options[optionUUID]
    createSurveyOption(option)
  })
  exSetup.previewDefinition(true)
}

function changeOptionOrder (uuid, direction) {
  // Move the option given by uuid in the direction specified
  // direction should be -1 or 1

  const def = $('#definitionSaveButton').data('workingDefinition')
  const searchFunc = (el) => el === uuid
  const currentIndex = def.option_order.findIndex(searchFunc)

  // Handle the edge cases
  if (currentIndex === 0 && direction < 0) return
  if (currentIndex === def.option_order.length - 1 && direction > 0) return

  // Handle middle cases
  const newIndex = currentIndex + direction
  const currentValueOfNewIndex = def.option_order[newIndex]
  def.option_order[newIndex] = uuid
  def.option_order[currentIndex] = currentValueOfNewIndex

  // Rebuild the optionList GUI
  document.getElementById('optionRow').innerHTML = ''
  def.option_order.forEach((optionUUID) => {
    const option = def.options[optionUUID]
    createSurveyOption(option)
  })
  exSetup.previewDefinition(true)
}

function populateOptionEditor (id) {
  // Take the details from an option and fill in the editor GUI

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const details = workingDefinition.options[id]
  document.getElementById('optionEditor').setAttribute('data-option-id', id)

  // Fill in the input fields
  document.getElementById('optionInput_label').value = details.label
  document.getElementById('optionInput_value').value = details.value
  document.getElementById('optionInput_icon').value = details.icon
  setIconUserFile(details.icon_user_file)
}

function setIconUserFile (file = '') {
  // Set the icon_user_file style option and format the GUI to match.
  if (file !== '') {
    document.getElementById('optionInput_icon_user_file').innerHTML = file
    document.getElementById('optionInput_icon_user_file_DeleteButtonCol').style.display = 'block'
    document.getElementById('optionInput_icon_user_file_Col').classList.add('col-lg-9')
  } else {
    document.getElementById('optionInput_icon_user_file').innerHTML = 'Select file'
    document.getElementById('optionInput_icon_user_file_DeleteButtonCol').style.display = 'none'
    document.getElementById('optionInput_icon_user_file_Col').classList.remove('col-lg-9')
  }
}

function saveDefinition () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'voting_kiosk'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  exCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        exCommon.getAvailableDefinitions('voting_kiosk')
          .then((response) => {
            if ('success' in response && response.success === true) {
              exSetup.populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = definition.uuid
            }
          })
      }
    })
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

// Behavior fields
Array.from(document.querySelectorAll('.behavior-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const key = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['behavior', key], event.target.value)
    exSetup.previewDefinition(true)
  })
})

// Definition fields
Array.from(document.querySelectorAll('.definition-text-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const key = event.target.getAttribute('data-def-key')
    exSetup.updateWorkingDefinition(['text', key], event.target.value)
    exSetup.previewDefinition(true)
  })
})

// Option fields
document.getElementById('addOptionButton').addEventListener('click', () => {
  createSurveyOption(null, true)
})
document.getElementById('optionInput_icon_user_file').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        const id = document.getElementById('optionEditor').getAttribute('data-option-id')
        exSetup.updateWorkingDefinition(['options', id, 'icon_user_file'], result[0])
        document.getElementById('optionInput_icon').value = 'user'
        exSetup.updateWorkingDefinition(['options', id, 'icon'], 'user')
        setIconUserFile(result[0])
        exSetup.previewDefinition(true)
      }
    })
})
document.getElementById('optionInput_icon_user_file_DeleteButton').addEventListener('click', () => {
  const id = document.getElementById('optionEditor').getAttribute('data-option-id')
  exSetup.updateWorkingDefinition(['options', id, 'icon_user_file'], '')
  setIconUserFile('')
  document.getElementById('optionInput_icon').value = ''
  exSetup.updateWorkingDefinition(['options', id, 'icon'], '')
  exSetup.previewDefinition(true)
})
Array.from(document.getElementsByClassName('option-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const id = document.getElementById('optionEditor').getAttribute('data-option-id')
    const field = event.target.getAttribute('data-field')
    if (id == null) return
    exSetup.updateWorkingDefinition(['options', id, field], event.target.value)
    document.getElementById('OptionHeaderText_' + id).innerHTML = formatOptionHeader($('#definitionSaveButton').data('workingDefinition').options[id])
    exSetup.previewDefinition(true)
  })
})

// Style fields
$('.color-picker').change(function () {
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

// Layout fields
document.getElementById('columnCountSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'num_columns'], event.target.value)
  exSetup.previewDefinition(true)
})
Array.from(document.querySelectorAll('.height-slider')).forEach((el) => {
  el.addEventListener('input', () => {
    const headerHeight = parseInt(document.getElementById('headerToButtonsSlider').value)
    const footerHeight = parseInt(document.getElementById('buttonsToFooterSlider').value)
    const buttonHeight = 100 - headerHeight - footerHeight
    exSetup.updateWorkingDefinition(['style', 'layout', 'top_height'], headerHeight)
    exSetup.updateWorkingDefinition(['style', 'layout', 'button_height'], buttonHeight)
    exSetup.updateWorkingDefinition(['style', 'layout', 'bottom_height'], footerHeight)
    console.log(headerHeight, buttonHeight, footerHeight)
    exSetup.previewDefinition(true)
  })
})
Array.from(document.querySelectorAll('.padding-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['style', 'layout', property], parseInt(event.target.value))
    exSetup.previewDefinition(true)
  })
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

exSetup.configure({
  app: 'voting_kiosk',
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
    }
  })
