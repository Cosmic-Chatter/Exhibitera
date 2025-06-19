/* global bootstrap */

import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'

async function initializeWizard () {
  // Setup the wizard

  exSetup.prepareWizard()

  // Reset fields
  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
  document.getElementById('wizardHeaderTextInput').value = ''
  document.getElementById('wizardFooterTextInput').value = ''
  document.getElementById('wizardAnswerTypeSelect').value = 'thumbs'
  document.getElementById('wizardCustomAnswersRow').innerHTML = ''
  document.getElementById('wizardCustomAnswersNoOptionsWarning').style.display = 'none'
  document.getElementById('wizardCustomAnswersBlankOptionsWarning').style.display = 'none'
}

async function wizardForward (currentPage) {
  // Check if the wizard is ready to advance and perform the move

  if (currentPage === 'Welcome') {
    const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
    if (defName !== '') {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
      exSetup.wizardGoTo('Question')
    } else {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Question') {
    exSetup.wizardGoTo('Answers')
  } else if (currentPage === 'Answers') {
    const answers = document.querySelectorAll('.wizard-answer-option')
    const answersType = document.getElementById('wizardAnswerTypeSelect').value

    if (answersType === 'custom') {
      if (answers.length === 0) {
        document.getElementById('wizardCustomAnswersNoOptionsWarning').style.display = 'block'
        return
      } else {
        document.getElementById('wizardCustomAnswersNoOptionsWarning').style.display = 'none'
      }
      document.getElementById('wizardCustomAnswersBlankOptionsWarning').style.display = 'none'
      let error = false
      for (const answer of answers) {
        if (answer.value.trim() === '') {
          error = true
        }
      }
      if (error) {
        document.getElementById('wizardCustomAnswersBlankOptionsWarning').style.display = 'block'
        return
      }
    }
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Question') {
    exSetup.wizardGoTo('Welcome')
  } else if (currentPage === 'Answers') {
    exSetup.wizardGoTo('Question')
  }
}

async function wizardCreateDefinition () {
  // Use the provided details to build a definition file.

  // Definition name
  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
  exSetup.updateWorkingDefinition(['name'], defName)

  // Header/footer
  const header = document.getElementById('wizardHeaderTextInput').value.trim()
  const footer = document.getElementById('wizardFooterTextInput').value.trim()
  exSetup.updateWorkingDefinition(['text', 'header'], header)
  exSetup.updateWorkingDefinition(['text', 'footer'], footer)

  // Answers
  const answersType = document.getElementById('wizardAnswerTypeSelect').value
  if (answersType !== 'custom') {
    // Clear out any custom options that may have been set first
    exSetup.updateWorkingDefinition(['options'], {})
    exSetup.updateWorkingDefinition(['option_order'], [])
  }
  if (answersType === 'thumbs') {
    const optionOrder = [exUtilities.uuid(), exUtilities.uuid()]
    exSetup.updateWorkingDefinition(['option_order'], optionOrder)
    exSetup.updateWorkingDefinition(['options', optionOrder[0]], {
      icon: 'thumbs-down_red',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[0],
      value: 'Bad'
    })
    exSetup.updateWorkingDefinition(['options', optionOrder[1]], {
      icon: 'thumbs-up_green',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[1],
      value: 'Good'
    })
  } else if (answersType === 'threeStars') {
    const optionOrder = [exUtilities.uuid(), exUtilities.uuid(), exUtilities.uuid()]
    exSetup.updateWorkingDefinition(['option_order'], optionOrder)
    exSetup.updateWorkingDefinition(['options', optionOrder[0]], {
      icon: '1-star_white',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[0],
      value: '1_star'
    })
    exSetup.updateWorkingDefinition(['options', optionOrder[1]], {
      icon: '2-star_white',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[1],
      value: '2_star'
    })
    exSetup.updateWorkingDefinition(['options', optionOrder[2]], {
      icon: '3-star_white',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[2],
      value: '3_star'
    })
  } else if (answersType === 'fiveStars') {
    const optionOrder = [exUtilities.uuid(), exUtilities.uuid(), exUtilities.uuid(), exUtilities.uuid(), exUtilities.uuid()]
    exSetup.updateWorkingDefinition(['option_order'], optionOrder)
    exSetup.updateWorkingDefinition(['options', optionOrder[0]], {
      icon: '1-star_white',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[0],
      value: '1_star'
    })
    exSetup.updateWorkingDefinition(['options', optionOrder[1]], {
      icon: '2-star_white',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[1],
      value: '2_star'
    })
    exSetup.updateWorkingDefinition(['options', optionOrder[2]], {
      icon: '3-star_white',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[2],
      value: '3_star'
    })
    exSetup.updateWorkingDefinition(['options', optionOrder[3]], {
      icon: '4-star_white',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[3],
      value: '4_star'
    })
    exSetup.updateWorkingDefinition(['options', optionOrder[4]], {
      icon: '5-star_white',
      icon_user_file: '',
      label: '',
      uuid: optionOrder[4],
      value: '5_star'
    })
  }
  const uuid = exSetup.config.workingDefinition.uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('survey_kiosk')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exUtilities.hideModal('#setupWizardModal')
}

function wizardCreateAnswerOption (userDetails) {
  // Create the GUI representation of a new answer option in the wizard

  const optionOrder = exSetup.config.workingDefinition.option_order

  const defaults = {
    uuid: exUtilities.uuid(),
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
    for (const key of Object.keys(defaults)) {
      exSetup.updateWorkingDefinition(['options', details.uuid, key], details[key])
    }
  }

  const col = document.createElement('div')
  col.classList = 'col-12'
  document.getElementById('wizardCustomAnswersRow').appendChild(col)

  const row = document.createElement('div')
  row.classList = 'row'
  col.appendChild(row)

  const answerCol = document.createElement('div')
  answerCol.classList = 'col-7 pe-1'
  row.appendChild(answerCol)

  const answerText = document.createElement('input')
  answerText.setAttribute('type', 'text')
  answerText.classList = 'form-control wizard-answer-option'
  answerText.value = details.label
  answerText.addEventListener('change', () => {
    exSetup.updateWorkingDefinition(['options', details.uuid, 'label'], answerText.value)
  })
  answerCol.appendChild(answerText)

  const buttonCol = document.createElement('div')
  buttonCol.classList = 'col-5 ps-1'
  row.appendChild(buttonCol)

  const upButton = document.createElement('button')
  upButton.classList = 'btn btn-info me-1'
  upButton.innerHTML = '▲'
  upButton.addEventListener('click', () => {
    changeOptionOrder(details.uuid, -1, true)
  })
  buttonCol.appendChild(upButton)

  const downButton = document.createElement('button')
  downButton.classList = 'btn btn-info me-1'
  downButton.innerHTML = '▼'
  downButton.addEventListener('click', () => {
    changeOptionOrder(details.uuid, 1, true)
  })
  buttonCol.appendChild(downButton)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger'
  deleteButton.innerHTML = '×'
  deleteButton.addEventListener('click', () => {
    deleteOption(details.uuid, true)
  })
  buttonCol.appendChild(deleteButton)
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) exSetup.initializeDefinition()

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('behaviorInput_recording_interval').value = 60
  document.getElementById('behaviorInput_touch_cooldown').value = 2

  // Markdown fields
  for (const item of ['header', 'subheader', 'footer', 'subfooter']) {
    const editor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: '',
      editorDiv: document.getElementById(item + 'Input'),
      commandDiv: document.getElementById(item + 'InputCommandBar'),
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['text', item], content)
        exSetup.previewDefinition(true)
      }
    })
  }

  const successEditor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: 'Thank you!',
    editorDiv: document.getElementById('success_messageInput'),
    commandDiv: document.getElementById('success_messageInputCommandBar'),
    commands: ['basic'],
    callback: (content) => {
      exSetup.updateWorkingDefinition(['text', 'success_message'], content)
      exSetup.previewDefinition(true)
    }
  })

  // Reset option edit fields
  document.getElementById('optionRow').innerHTML = ''
  const editor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: '',
    editorDiv: document.getElementById('optionInput_label'),
    commandDiv: document.getElementById('optionInputCommandBar_label'),
    commands: ['basic'],
    callback: (content) => {
    }
  })
  document.getElementById('optionInput_value').value = ''
  document.getElementById('optionInput_icon').value = ''
  setIconUserFile('')

  // Reset color options
  const colorInputs = ['button-color', 'button-touched-color', 'success-message-color', 'header-color', 'subheader-color', 'footer-color', 'subfooter-color', 'button-text-color']
  colorInputs.forEach((input) => {
    const el = document.getElementById('colorPicker_' + input)
    el.value = el.dataset.default
    el.dispatchEvent(new Event('input', { bubbles: true }))
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
  exSetup.createAdvancedSliders()
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)
  exSetup.config.initialDefinition = structuredClone(def)
  exSetup.config.workingDefinition = structuredClone(def)

  document.getElementById('definitionNameInput').value = def.name

  // Set the appropriate values for the behavior fields
  for (const key of Object.keys(def?.behavior ?? {})) {
    const el = document.getElementById('behaviorInput_' + key)
    if (el != null) el.value = def.behavior[key]
  }

  // Markdown fields
  for (const item of ['header', 'subheader', 'footer', 'subfooter']) {
    const editor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: def?.text?.[item] ?? '',
      editorDiv: document.getElementById(item + 'Input'),
      commandDiv: document.getElementById(item + 'InputCommandBar'),
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['text', item], content)
        exSetup.previewDefinition(true)
      }
    })
  }

  const successEditor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: def?.text?.success_message ?? 'Thank you!',
    editorDiv: document.getElementById('success_messageInput'),
    commandDiv: document.getElementById('success_messageInputCommandBar'),
    commands: ['basic'],
    callback: (content) => {
      exSetup.updateWorkingDefinition(['text', 'success_message'], content)
      exSetup.previewDefinition(true)
    }
  })

  // Create any existing options
  document.getElementById('optionRow').innerHTML = ''
  for (const optionUUID of def?.option_order ?? []) {
    const option = def.options[optionUUID]
    createSurveyOption(option)
  }

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background, { mode: 'color', color: '#22222E' })
  exSetup.updateColorPickers(def?.style?.color ?? {})
  exSetup.updateAdvancedFontPickers(def?.style?.font ?? {})
  exSetup.updateTextSizeSliders(def?.style?.text_size ?? {})

  // Set the appropriate values for the layout options
  document.getElementById('columnCountSelect').value = def?.style?.layout?.num_columns ?? 'auto'
  exSetup.createAdvancedSlider(document.getElementById('headerToButtonsSlider'), def?.style?.layout?.top_height)
  exSetup.createAdvancedSlider(document.getElementById('headerPaddingHeightSlider'), def?.style?.layout?.header_padding)
  exSetup.createAdvancedSlider(document.getElementById('buttonsToFooterSlider'), def?.style?.layout?.bottom_height)
  exSetup.createAdvancedSlider(document.getElementById('footerPaddingHeightSlider'), def?.style?.layout?.footer_padding)
  exSetup.createAdvancedSlider(document.getElementById('buttonPaddingHeightSlider'), def?.style?.layout?.button_padding)
  exSetup.createAdvancedSlider(document.getElementById('imageHeightSlider'), def.style.layout.image_height)

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
  exSetup.previewDefinition()
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

  const optionOrder = exSetup.config.workingDefinition.option_order

  const defaults = {
    uuid: exUtilities.uuid(),
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
    for (const key of Object.keys(defaults)) {
      exSetup.updateWorkingDefinition(['options', details.uuid, key], details[key])
    }
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
  document.addEventListener('click', (event) => {
    if (event?.target?.id === 'DeleteOptionPopover_' + details.uuid) {
      deleteOption(details.uuid)
    }
  })
  deleteButton.addEventListener('click', function () { deleteButton.focus() })
  deleteCol.appendChild(deleteButton)

  const leftArrowCol = document.createElement('div')
  leftArrowCol.classList = 'col-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(leftArrowCol)

  const leftArrowButton = document.createElement('button')
  leftArrowButton.classList = 'btn btn-sm rounded-0 text-light bg-primary w-100 h-100 justify-content-center d-flex'
  leftArrowButton.style.cursor = 'pointer'
  leftArrowButton.innerHTML = '▲'
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
  rightArrowButton.innerHTML = '▼'
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

function deleteOption (uuid, wizard = false) {
  // Delete an option and rebuild the GUI

  const def = exSetup.config.workingDefinition

  // Delete from the options dictionary
  delete def.options[uuid]

  // Delete from option order array
  const searchFunc = (el) => el === uuid
  const index = def.option_order.findIndex(searchFunc)
  if (index > -1) { // only splice array when item is found
    def.option_order.splice(index, 1)
  }

  // Rebuild the options GUI
  if (wizard) {
    document.getElementById('wizardCustomAnswersRow').innerHTML = ''
    for (const optionUUID of def?.option_order ?? []) {
      const option = def.options[optionUUID]
      wizardCreateAnswerOption(option)
    }
  } else {
    document.getElementById('optionRow').innerHTML = ''
    for (const optionUUID of def?.option_order ?? []) {
      const option = def.options[optionUUID]
      createSurveyOption(option)
    }
    exSetup.previewDefinition(true)
  }
}

function changeOptionOrder (uuid, direction, wizard = false) {
  // Move the option given by uuid in the direction specified
  // direction should be -1 or 1

  const def = exSetup.config.workingDefinition
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

  // Rebuild the options GUI
  if (wizard) {
    document.getElementById('wizardCustomAnswersRow').innerHTML = ''
    for (const optionUUID of def?.option_order ?? []) {
      const option = def.options[optionUUID]
      wizardCreateAnswerOption(option)
    }
  } else {
    document.getElementById('optionRow').innerHTML = ''
    for (const optionUUID of def?.option_order ?? []) {
      const option = def.options[optionUUID]
      createSurveyOption(option)
    }
    exSetup.previewDefinition(true)
  }
}

function populateOptionEditor (id) {
  // Take the details from an option and fill in the editor GUI

  const workingDefinition = exSetup.config.workingDefinition
  const details = workingDefinition.options[id]
  document.getElementById('optionEditor').setAttribute('data-option-id', id)

  // Fill in the input fields
  const editor = new exMarkdown.ExhibiteraMarkdownEditor({
    content: details?.label ?? '',
    editorDiv: document.getElementById('optionInput_label'),
    commandDiv: document.getElementById('optionInputCommandBar_label'),
    commands: ['basic'],
    callback: (content) => {
      exSetup.updateWorkingDefinition(['options', id, 'label'], content)
      exSetup.previewDefinition(true)
    }
  })
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

document.getElementById('wizardAnswerTypeSelect').addEventListener('change', (event) => {
  if (event.target.value === 'custom') {
    document.getElementById('wizardCustomAnswersGUI').style.display = 'flex'
  } else {
    document.getElementById('wizardCustomAnswersGUI').style.display = 'none'
  }
})
document.getElementById('wizardAddAnswerOptionButton').addEventListener('click', wizardCreateAnswerOption)

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
for (const el of document.getElementsByClassName('option-input')) {
  el.addEventListener('change', (event) => {
    const id = document.getElementById('optionEditor').getAttribute('data-option-id')
    const field = event.target.getAttribute('data-field')
    if (id == null) return
    exSetup.updateWorkingDefinition(['options', id, field], event.target.value)
    document.getElementById('OptionHeaderText_' + id).innerHTML = formatOptionHeader(exSetup.config.workingDefinition.options[id])
    exSetup.previewDefinition(true)
  })
}

// Style fields
for (const el of document.querySelectorAll('.color-picker')) {
  el.addEventListener('change', function () {
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

// Layout fields
document.getElementById('columnCountSelect').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['style', 'layout', 'num_columns'], event.target.value)
  exSetup.previewDefinition(true)
})
for (const el of document.querySelectorAll('.height-slider')) {
  el.addEventListener('input', () => {
    const headerHeight = parseInt(document.getElementById('headerToButtonsSlider').querySelector('input').value)
    const footerHeight = parseInt(document.getElementById('buttonsToFooterSlider').querySelector('input').value)
    const buttonHeight = 100 - headerHeight - footerHeight

    exSetup.updateWorkingDefinition(['style', 'layout', 'button_height'], buttonHeight)
    exSetup.previewDefinition(true)
  })
}

exSetup.configure({
  app: 'survey_kiosk',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
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
