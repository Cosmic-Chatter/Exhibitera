/* global bootstrap */

import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exLang from '../js/exhibitera_setup_languages.js'
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
  document.getElementById('behaviorInput_inactivity_timeout').value = 10

  // Markdown fields
  for (const item of []) {
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

  // const successEditor = new exMarkdown.ExhibiteraMarkdownEditor({
  //   content: 'Thank you!',
  //   editorDiv: document.getElementById('success_messageInput'),
  //   commandDiv: document.getElementById('success_messageInputCommandBar'),
  //   commands: ['basic'],
  //   callback: (content) => {
  //     exSetup.updateWorkingDefinition(['text', 'success_message'], content)
  //     exSetup.previewDefinition(true)
  //   }
  // })

  // Reset color options
  const colorInputs = ['button-color', 'button-selected-color', 'next-button-color', 'header-color', 'button-text-color', 'next-button-text-color', 'body-text-color', 'active-dot-color', 'inactive-dot-color']
  for (const input of colorInputs) {
    const el = document.getElementById('colorPicker_' + input)
    el.value = el.dataset.default
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#22222E'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()

  // Reset text size options
  document.getElementById('headerTextSizeSlider').value = 0
  document.getElementById('buttonTextSizeSlider').value = 0
  document.getElementById('nextButtonTextSizeSlider').value = 0

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
  for (const item of []) {
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

  // const successEditor = new exMarkdown.ExhibiteraMarkdownEditor({
  //   content: def?.text?.success_message ?? 'Thank you!',
  //   editorDiv: document.getElementById('success_messageInput'),
  //   commandDiv: document.getElementById('success_messageInputCommandBar'),
  //   commands: ['basic'],
  //   callback: (content) => {
  //     exSetup.updateWorkingDefinition(['text', 'success_message'], content)
  //     exSetup.previewDefinition(true)
  //   }
  // })

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background, { mode: 'color', color: '#22222E' })
  exSetup.updateColorPickers(def?.style?.color ?? {})
  exSetup.updateAdvancedFontPickers(def?.style?.font ?? {})
  exSetup.updateTextSizeSliders(def?.style?.text_size ?? {})

  // Set the appropriate values for the layout options
  exSetup.createAdvancedSlider(document.getElementById('headerToButtonsSlider'), def?.style?.layout?.top_height)
  exSetup.createAdvancedSlider(document.getElementById('headerPaddingHeightSlider'), def?.style?.layout?.header_padding)
  exSetup.createAdvancedSlider(document.getElementById('buttonsToFooterSlider'), def?.style?.layout?.bottom_height)
  exSetup.createAdvancedSlider(document.getElementById('footerPaddingHeightSlider'), def?.style?.layout?.footer_padding)
  exSetup.createAdvancedSlider(document.getElementById('buttonPaddingHeightSlider'), def?.style?.layout?.button_padding)
  exSetup.createAdvancedSlider(document.getElementById('imageHeightSlider'), def.style.layout.image_height)

  const langSelect = document.getElementById('language-picker')
  exLang.createLanguagePicker(langSelect,
    {
      onLanguageRebuild: rebuildItems
    }
  )

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
  exSetup.previewDefinition()
}

function createItem (itemType) {
  // Add an item of the given type to the working definitino and rebuild the GUI.
  console.log('here')
  const item = {
    type: itemType,
    uuid: exUtilities.uuid()
  }

  // Add to the working definition
  const items = exSetup.config.workingDefinition?.items ?? {}
  items[item.uuid] = item
  exSetup.updateWorkingDefinition(['items'], items)

  const itemOrder = exSetup.config.workingDefinition?.item_order ?? []
  itemOrder.push(item.uuid)
  exSetup.updateWorkingDefinition(['item_order'], itemOrder)

  const languages = exSetup.config.workingDefinition?.languages ?? {}
  for (const langCode of Object.keys(languages)) {
    const lang = languages[langCode]
    if (!lang.items) lang.items = {}
    lang.items[item.uuid] = { header: { text: 'New item' } }
  }
  exSetup.updateWorkingDefinition(['languages'], languages)
  rebuildItems()
}

function deleteItem (uuidToRemove) {
  // Remove the given item from the working definition and rebuild the GUI.

  const data = exSetup.config.workingDefinition

  // Remove from item_order array
  data.item_order = data.item_order.filter(uuid => uuid !== uuidToRemove)
  exSetup.updateWorkingDefinition(['item_order'], data.item_order)

  // Remove from items object
  delete data.items[uuidToRemove]
  exSetup.updateWorkingDefinition(['items'], data.items)

  // Remove from each language's items
  for (const lang of Object.keys(data?.languages ?? {})) {
    if (
      data.languages[lang].items &&
        data.languages[lang].items[uuidToRemove]
    ) {
      delete data.languages[lang].items[uuidToRemove]
    }
  }
  exSetup.updateWorkingDefinition(['languages'], data?.languages ?? {})
  rebuildItems()
}

function rebuildItems () {
  // Rebuild the item interface

  document.getElementById('surveryItems').innerText = ''
  for (const uuid of exSetup.config.workingDefinition?.item_order ?? []) {
    const item = exSetup.config.workingDefinition?.items?.[uuid]
    if (item) createSurveyItemGUI(item)
  }
  exSetup.previewDefinition(true)
}

function createOption (itemUUID) {
  // Create a new option and add it to the given item in the working definition.

  const newOption = { uuid: exUtilities.uuid(), value: '' }

  const options = exSetup.config.workingDefinition?.items?.[itemUUID]?.options ?? {}
  options[newOption.uuid] = newOption
  exSetup.updateWorkingDefinition(['items', itemUUID, 'options'], options)

  const optionOrder = exSetup.config.workingDefinition?.items?.[itemUUID]?.option_order ?? []
  optionOrder.push(newOption.uuid)
  exSetup.updateWorkingDefinition(['items', itemUUID, 'option_order'], optionOrder)

  for (const code of exSetup.config.workingDefinition?.language_order ?? []) {
    const lang = exSetup.config.workingDefinition.languages[code]

    const langOptions = lang.items[itemUUID]?.options ?? {}
    langOptions[newOption.uuid] = { text: '' }
    exSetup.updateWorkingDefinition(['languages', code, 'items', itemUUID, 'options'], langOptions)
    rebuildOptions(itemUUID, code)
  }
}

function deleteOption (itemUUID, optionUUID) {
  // Remove the given option from the working definition and rebuild the GUI.

  const data = exSetup.config.workingDefinition.items?.[itemUUID]
  if (data == null) return

  // Remove from option_order array
  data.option_order = data.option_order.filter(uuid => uuid !== optionUUID)
  exSetup.updateWorkingDefinition(['items', itemUUID, 'option_order'], data.option_order)

  // Remove from options object
  delete data.options[optionUUID]
  exSetup.updateWorkingDefinition(['items', itemUUID, 'options'], data.options)

  // Remove from each language
  const langData = exSetup.config.workingDefinition?.languages ?? {}
  for (const lang of exSetup.config.workingDefinition?.language_order ?? []) {
    if (
      langData[lang]?.items?.[itemUUID]?.options &&
        langData[lang]?.items?.[itemUUID]?.options[optionUUID]
    ) {
      delete langData[lang].items[itemUUID].options[optionUUID]
    }
  }
  exSetup.updateWorkingDefinition(['languages'], langData)

  for (const lang of exSetup.config.workingDefinition?.language_order ?? []) {
    rebuildOptions(itemUUID, lang)
  }
}

function rebuildOptions (itemUUID, lang) {
  // Rebuild the options GUI for the given item.

  const item = exSetup.config.workingDefinition.items[itemUUID]
  if (item == null) return

  const defLang = exSetup.config.workingDefinition?.languages?.[lang]?.items?.[item.uuid]?.options ?? {}

  const accord = document.getElementById(`itemAccordion_${itemUUID}_${lang}`)
  accord.innerText = ''

  for (const optionUUID of item?.option_order ?? []) {
    const optionText = exMarkdown.formatText(
      defLang?.[optionUUID]?.text ?? '',
      { string: true, removeParagraph: true }
    )

    // Create accordion-item
    const accordItem = document.createElement('div')
    accordItem.className = 'accordion-item'
    accord.appendChild(accordItem)

    // --- Header ---
    const header = document.createElement('h2')
    header.className = 'accordion-header'

    const button = document.createElement('button')
    button.className = 'accordion-button collapsed d-flex align-items-center'
    button.type = 'button'
    button.setAttribute('data-bs-toggle', 'collapse')
    button.setAttribute('data-bs-target', `#itemOption_${optionUUID}_${lang}`)
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('aria-controls', `itemOption_${optionUUID}_${lang}`)

    const nameSpan = document.createElement('span')
    nameSpan.setAttribute('id', `itemOptionName_${optionUUID}_${lang}`)
    nameSpan.innerHTML = optionText
    button.appendChild(nameSpan)

    header.appendChild(button)
    accordItem.appendChild(header)

    const collapse = document.createElement('div')
    collapse.className = 'accordion-collapse collapse'
    collapse.id = `itemOption_${optionUUID}_${lang}`
    collapse.setAttribute('data-bs-parent', `#itemAccordion_${item.uuid}_${lang}`)
    accordItem.appendChild(collapse)

    const body = document.createElement('div')
    body.className = 'accordion-body'
    collapse.appendChild(body)

    // Widgets for editing the various parts of the option

    const row = document.createElement('div')
    row.classList = 'row gy-2 mt-2'
    body.appendChild(row)

    const toolsCol = document.createElement('div')
    toolsCol.classList = 'col-12 d-flex'
    toolsCol.innerHTML = `
        <button
        id="${item.uuid}_option_${optionUUID}_${lang}_moveUpButton"
        type="button"
        class="btn btn-sm btn-outline-info"
        >
        ▲
        </button>
        <button
          id="${item.uuid}_option_${optionUUID}_${lang}_moveDownButton"
          type="button"
          class="btn btn-sm btn-outline-info ms-1"
        >
        ▼
        </button>
        <button
          id="${item.uuid}_option_${optionUUID}_${lang}_deleteButton"
          type="button"
          class="btn btn-sm btn-outline-danger ms-auto"
        >
        Delete
        </button>
      `
    row.appendChild(toolsCol)

    document.getElementById(`${item.uuid}_option_${optionUUID}_${lang}_moveUpButton`).addEventListener('click', (ev) => {
      changeOptionOrder(item.uuid, optionUUID, 'up')
    })
    document.getElementById(`${item.uuid}_option_${optionUUID}_${lang}_moveDownButton`).addEventListener('click', (ev) => {
      changeOptionOrder(item.uuid, optionUUID, 'down')
    })
    document.getElementById(`${item.uuid}_option_${optionUUID}_${lang}_deleteButton`).addEventListener('click', () => {
      deleteOption(item.uuid, optionUUID)
    })

    const textCol = document.createElement('div')
    textCol.classList = 'col-6'
    row.appendChild(textCol)

    const textLabel = document.createElement('label')
    textLabel.classList = 'form-label'
    textLabel.innerHTML = 'Button text'
    textCol.appendChild(textLabel)

    const textCommandBar = document.createElement('div')
    textCol.appendChild(textCommandBar)

    const textInput = document.createElement('div')
    textCol.appendChild(textInput)

    const headerEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: exSetup.config.workingDefinition.languages?.[lang]?.items?.[item.uuid]?.options?.[optionUUID]?.text ?? '',
      editorDiv: textInput,
      commandDiv: textCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['languages', lang, 'items', item.uuid, 'options', optionUUID, 'text'], content)
        document.getElementById(`itemOptionName_${optionUUID}_${lang}`).innerHTML = exMarkdown.formatText(content, { string: true, removeParagraph: true })
        exSetup.previewDefinition(true)
      }
    })

    const valueCol = document.createElement('div')
    valueCol.classList = 'col-6'
    row.appendChild(valueCol)

    const valueLabel = document.createElement('label')
    valueLabel.classList = 'form-label'
    valueLabel.innerHTML = `
        Value
        <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="How this option should appear in your data spreadsheet. E.g., 'two_stars'." style="font-size: 0.55em;">?</span>
        `
    valueCol.appendChild(valueLabel)

    const valueInput = document.createElement('input')
    valueInput.classList = 'form-control option-value-input'
    valueInput.setAttribute('type', 'text')
    valueInput.dataset.optionuuid = optionUUID
    valueInput.value = item?.options?.[optionUUID]?.value ?? ''
    valueInput.addEventListener('change', (ev) => {
      exSetup.updateWorkingDefinition(['items', item.uuid, 'options', optionUUID, 'value'], ev.target.value)
      // Make sure other languages are in sync
      for (const el of document.querySelectorAll('.option-value-input')) {
        if (el.dataset.optionuuid === optionUUID) el.value = ev.target.value
      }
      exSetup.previewDefinition(true)
    })
    valueCol.appendChild(valueInput)

    const backgroundCol = document.createElement('div')
    backgroundCol.classList = 'col-12 advanced-color-picker'
    backgroundCol.setAttribute('data-constACP-name', 'Background')
    backgroundCol.setAttribute('data-constACP-path', `items>${item.uuid}>options>${optionUUID}>background`)
    row.appendChild(backgroundCol)
    exSetup.createAdvancedColorPicker(backgroundCol, 'Background', ['items', item.uuid, 'options', optionUUID, 'background'])

    exSetup.updateAdvancedColorPicker(`items>${item.uuid}>options>${optionUUID}>background`, item?.options?.[optionUUID]?.background)

    const iconCol = document.createElement('div')
    iconCol.classList = 'col-12'
    row.appendChild(iconCol)

    const iconLabel = document.createElement('label')
    iconLabel.classList = 'form-label'
    iconLabel.innerHTML = 'Icon'
    iconCol.appendChild(iconLabel)

    const iconRow = document.createElement('div')
    iconRow.classList = 'row gy-2'
    iconCol.appendChild(iconRow)

    const iconSelectCol = document.createElement('div')
    iconSelectCol.classList = 'col-12 col-md-6'
    iconRow.appendChild(iconSelectCol)

    const iconSelect = document.createElement('select')
    iconSelect.classList = 'form-select icon-select'
    iconSelect.dataset.optionuuid = optionUUID
    iconSelect.innerHTML = `
        <option value="">No icon</option>
        <option value="user">User-provided</option>
        <option disabled>Built-in</option>
        <option value="1-star_black">1 star (black)</option>
        <option value="1-star_white">1 star (white)</option>
        <option value="2-star_black">2 star (black)</option>
        <option value="2-star_white">2 star (white)</option>
        <option value="3-star_black">3 star (black)</option>
        <option value="3-star_white">3 star (white)</option>
        <option value="4-star_black">4 star (black)</option>
        <option value="4-star_white">4 star (white)</option>
        <option value="5-star_black">5 star (black)</option>
        <option value="5-star_white">5 star (white)</option>
        <option value="thumbs-down_black">Thumbs down (black)</option>
        <option value="thumbs-down_red">Thumbs down (red)</option>
        <option value="thumbs-down_white">Thumbs down (white)</option>
        <option value="thumbs-up_black">Thumbs up (black)</option>
        <option value="thumbs-up_green">Thumbs up (green)</option>
        <option value="thumbs-up_white">Thumbs up (white)</option>
      `
    iconSelect.addEventListener('change', (ev) => {
      setItemIcon(item.uuid, optionUUID, { icon: ev.target.value, icon_user_file: item?.options?.[optionUUID]?.icon_user_file ?? '' })
    })
    iconSelectCol.appendChild(iconSelect)

    const iconInputCol = document.createElement('div')
    iconInputCol.classList = 'col-12 col-md-6'
    iconRow.appendChild(iconInputCol)

    const iconFileInput = document.createElement('button')
    iconFileInput.classList = 'btn btn-outline-primary w-100 icon-file-input'
    iconFileInput.dataset.optionuuid = optionUUID
    iconFileInput.innerText = 'Select file'
    iconFileInput.addEventListener('click', () => {
      exFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
        .then((result) => {
          if (result != null && result.length > 0) {
            setItemIcon(item.uuid, optionUUID, { icon: 'user', icon_user_file: result[0] })
          }
        })
    })
    iconInputCol.appendChild(iconFileInput)
    setItemIcon(item.uuid, optionUUID, {
      icon: item?.options?.[optionUUID]?.icon ?? '',
      icon_user_file: item?.options?.[optionUUID]?.icon_user_file
    })
  }

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function createSurveyItemGUI (item) {
  // Create the GUI representation of an item in the survey

  const def = exSetup.config.workingDefinition
  const surveryItems = document.getElementById('surveryItems')

  const html = `
    <div class="accordion-item">
      <h2 class="accordion-header">
        <div
          class="accordion-button d-flex align-items-center collapsed"
          style="cursor: pointer;"
          data-bs-toggle="collapse"
          data-bs-target="#${item.uuid}_accordion"
          aria-expanded="false"
          aria-controls="${item.uuid}_accordion"
        >
        <span id="${item.uuid}_accordionName">
        ${exMarkdown.formatText(def.languages?.[def.language_order[0]]?.items?.[item.uuid]?.header?.text ?? '', { string: true, removeParagraph: true })}
        </span>

        </div>
      </h2>
      <div id="${item.uuid}_accordion" class="accordion-collapse collapse " data-bs-parent="#surveryItems">
        <div class="accordion-body">
          <div class="d-flex">
            <button
            id="${item.uuid}_accordion_moveUpButton"
            type="button"
            class="btn btn-sm btn-outline-info"
            >
            ▲
            </button>
            <button
              id="${item.uuid}_accordion_moveDownButton"
              type="button"
              class="btn btn-sm btn-outline-info ms-1"
            >
            ▼
            </button>
            <button
              id="${item.uuid}_accordion_deleteButton"
              type="button"
              class="btn btn-sm btn-outline-danger ms-auto"
            >
            Delete
            </button>
          </div>
          
          <nav class="mt-3">
            <div id="${item.uuid}_accordion_tabs" class="nav nav-tabs" role="tablist">
            </div>
          </nav>
          <div class="tab-content" id="${item.uuid}_accordion_content">
        </div>
      </div>
    </div>
  `
  surveryItems.insertAdjacentHTML('beforeend', html)
  document.getElementById(item.uuid + '_accordion_moveUpButton').addEventListener('click', (ev) => {
    changeItemOrder(item.uuid, 'up')
  })
  document.getElementById(item.uuid + '_accordion_moveDownButton').addEventListener('click', (ev) => {
    changeItemOrder(item.uuid, 'down')
  })
  document.getElementById(item.uuid + '_accordion_deleteButton').addEventListener('click', (ev) => {
    deleteItem(item.uuid)
  })

  if (item.type === 'text') {
    createSurveyItemGUIText(item)
  } else if (['single_vote', 'multiple_vote'].includes(item.type)) {
    createSurveyItemGUIVote(item)
  }
}

function createSurveyItemGUIText (item) {
  // Create GUI elements for a text survey item

  const nav = document.getElementById(item.uuid + '_accordion_tabs')
  const pane = document.getElementById(item.uuid + '_accordion_content')

  let first = true
  for (const code of exSetup.config.workingDefinition?.language_order ?? []) {
    // Create the tab button
    const tabButton = document.createElement('button')
    tabButton.classList = 'nav-link language-tab'
    tabButton.setAttribute('id', item.uuid + '_accordion_contentTab_' + code)
    tabButton.setAttribute('data-bs-toggle', 'tab')
    tabButton.setAttribute('data-bs-target', '#' + item.uuid + '_accordion_contentPane_' + code)
    tabButton.setAttribute('type', 'button')
    tabButton.setAttribute('role', 'tab')
    tabButton.innerHTML = exLang.getLanguageDisplayName(code, true)
    nav.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', item.uuid + '_accordion_contentPane_' + code)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', '#' + item.uuid + '_accordion_contentTab_' + code)
    pane.appendChild(tabPane)

    const row = document.createElement('div')
    row.classList = 'row gy-2 mt-2'
    tabPane.appendChild(row)

    const headerCol = document.createElement('div')
    headerCol.classList = 'col-6'
    row.appendChild(headerCol)

    const headerLabel = document.createElement('label')
    headerLabel.classList = 'form-label'
    headerLabel.innerHTML = 'Header'
    headerCol.appendChild(headerLabel)

    const headerCommandBar = document.createElement('div')
    headerCol.appendChild(headerCommandBar)

    const headerInput = document.createElement('div')
    headerCol.appendChild(headerInput)

    const headerEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: exSetup.config.workingDefinition.languages?.[code]?.items?.[item.uuid]?.header?.text ?? '',
      editorDiv: headerInput,
      commandDiv: headerCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['languages', code, 'items', item.uuid, 'header', 'text'], content)
        if (code === exSetup.config.workingDefinition.language_order[0]) {
          console.log(document.getElementById(item.uuid + '_accordionName'))
          document.getElementById(item.uuid + '_accordionName').innerHTML = exMarkdown.formatText(content, { string: true, removeParagraph: true })
        }
        exSetup.previewDefinition(true)
      }
    })

    const nextButtonCol = document.createElement('div')
    nextButtonCol.classList = 'col-6'
    row.appendChild(nextButtonCol)

    const nextButtonLabel = document.createElement('label')
    nextButtonLabel.classList = 'form-label'
    nextButtonLabel.innerHTML = 'Next button text'
    nextButtonCol.appendChild(nextButtonLabel)

    const nextButtonInput = document.createElement('input')
    nextButtonInput.setAttribute('type', 'text')
    nextButtonInput.setAttribute('placeholder', 'Next')
    nextButtonInput.classList = 'form-control'
    nextButtonInput.value = exSetup.config.workingDefinition.languages?.[code]?.items?.[item.uuid]?.next_button?.text ?? ''
    nextButtonInput.addEventListener('change', () => {
      exSetup.updateWorkingDefinition(['languages', code, 'items', item.uuid, 'next_button', 'text'], nextButtonInput.value.trim())
      exSetup.previewDefinition(true)
    })
    nextButtonCol.appendChild(nextButtonInput)

    const bodyCol = document.createElement('div')
    bodyCol.classList = 'col-12'
    row.appendChild(bodyCol)

    const bodyLabel = document.createElement('label')
    bodyLabel.classList = 'form-label'
    bodyLabel.innerHTML = 'Body'
    bodyCol.appendChild(bodyLabel)

    const bodyCommandBar = document.createElement('div')
    bodyCol.appendChild(bodyCommandBar)

    const bodyInput = document.createElement('div')
    bodyCol.appendChild(bodyInput)

    const bodyEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: exSetup.config.workingDefinition.languages?.[code]?.items?.[item.uuid]?.body?.text ?? '',
      editorDiv: bodyInput,
      commandDiv: bodyCommandBar,
      callback: (content) => {
        exSetup.updateWorkingDefinition(['languages', code, 'items', item.uuid, 'body', 'text'], content)
        exSetup.previewDefinition(true)
      }
    })

    if (first) {
      tabButton.click()
      first = false
    }
  }
}

function createSurveyItemGUIVote (item) {
  // Create GUI elements for a voting survey item

  const nav = document.getElementById(item.uuid + '_accordion_tabs')
  nav.classList.add('mt-3')
  const pane = document.getElementById(item.uuid + '_accordion_content')

  // First, insert language-independant options before the nav.
  const row = document.createElement('div')
  row.classList = 'row gy-2 mt-2'
  nav.parentElement.insertBefore(row, nav)

  const layoutCol = document.createElement('div')
  layoutCol.classList = 'col-12 col-md-6'
  row.appendChild(layoutCol)

  const layoutLabel = document.createElement('label')
  layoutLabel.classList = 'form-label'
  layoutLabel.innerHTML = 'Options per row'
  layoutCol.appendChild(layoutLabel)

  const layoutSelect = document.createElement('select')
  layoutSelect.classList = 'form-select'
  layoutSelect.addEventListener('change', (ev) => {
    exSetup.updateWorkingDefinition(['items', item.uuid, 'num_columns'], ev.target.value)
    exSetup.previewDefinition(true)
  })
  layoutCol.appendChild(layoutSelect)

  const autoOption = new Option('Automatic', 'auto')
  layoutSelect.appendChild(autoOption)

  for (const op of ['1', '2', '3', '4', '5', '6', '7', '8']) {
    layoutSelect.appendChild(new Option(op))
  }
  layoutSelect.value = item?.num_columns ?? 'auto'

  const randomCol = document.createElement('div')
  randomCol.classList = 'col-12 col-md-6'
  row.appendChild(randomCol)

  const randomCheckGroup = document.createElement('div')
  randomCheckGroup.classList = 'form-check'
  randomCol.appendChild(randomCheckGroup)

  const randomCheck = document.createElement('input')
  randomCheck.classList = 'form-check-input mutli-checkbox'
  randomCheck.setAttribute('type', 'checkbox')
  randomCheck.value = ''
  randomCheck.id = 'randomCheck_' + item.uuid
  randomCheck.dataset.itemuuid = item.uuid
  randomCheck.checked = item?.randomize_options ?? false
  randomCheckGroup.appendChild(randomCheck)
  randomCheck.addEventListener('change', (ev) => {
    exSetup.updateWorkingDefinition(['items', item.uuid, 'randomize_options'], ev.target.checked)
    exSetup.previewDefinition(true)
  })

  const randomCheckLabel = document.createElement('label')
  randomCheckLabel.classList = 'form-check-label'
  randomCheckLabel.setAttribute('for', 'randomCheck_' + item.uuid)
  randomCheckLabel.innerHTML = 'Randomize options'

  randomCheckGroup.appendChild(randomCheckLabel)

  // Build out the nav and pane for each language
  let first = true
  for (const code of exSetup.config.workingDefinition?.language_order ?? []) {
    // Create the tab button
    const tabButton = document.createElement('button')
    tabButton.classList = 'nav-link language-tab'
    tabButton.setAttribute('id', item.uuid + '_accordion_contentTab_' + code)
    tabButton.setAttribute('data-bs-toggle', 'tab')
    tabButton.setAttribute('data-bs-target', '#' + item.uuid + '_accordion_contentPane_' + code)
    tabButton.setAttribute('type', 'button')
    tabButton.setAttribute('role', 'tab')
    tabButton.innerHTML = exLang.getLanguageDisplayName(code, true)
    nav.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', item.uuid + '_accordion_contentPane_' + code)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', '#' + item.uuid + '_accordion_contentTab_' + code)
    pane.appendChild(tabPane)

    const row = document.createElement('div')
    row.classList = 'row gy-2 mt-2'
    tabPane.appendChild(row)

    const headerCol = document.createElement('div')
    headerCol.classList = 'col-6'
    row.appendChild(headerCol)

    const headerLabel = document.createElement('label')
    headerLabel.classList = 'form-label'
    headerLabel.innerHTML = 'Header'
    headerCol.appendChild(headerLabel)

    const headerCommandBar = document.createElement('div')
    headerCol.appendChild(headerCommandBar)

    const headerInput = document.createElement('div')
    headerCol.appendChild(headerInput)

    const headerEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: exSetup.config.workingDefinition.languages?.[code]?.items?.[item.uuid]?.header?.text ?? '',
      editorDiv: headerInput,
      commandDiv: headerCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['languages', code, 'items', item.uuid, 'header', 'text'], content)
        if (code === exSetup.config.workingDefinition.language_order[0]) {
          console.log(document.getElementById(item.uuid + '_accordionName'))
          document.getElementById(item.uuid + '_accordionName').innerHTML = exMarkdown.formatText(content, { string: true, removeParagraph: true })
        }
        exSetup.previewDefinition(true)
      }
    })

    const nextButtonCol = document.createElement('div')
    nextButtonCol.classList = 'col-6'
    row.appendChild(nextButtonCol)

    const nextButtonLabel = document.createElement('label')
    nextButtonLabel.classList = 'form-label'
    nextButtonLabel.innerHTML = 'Next button text'
    nextButtonCol.appendChild(nextButtonLabel)

    const nextButtonInput = document.createElement('input')
    nextButtonInput.setAttribute('type', 'text')
    nextButtonInput.setAttribute('placeholder', 'Next')
    nextButtonInput.classList = 'form-control'
    nextButtonInput.value = exSetup.config.workingDefinition.languages?.[code]?.items?.[item.uuid]?.next_button?.text ?? ''
    nextButtonInput.addEventListener('change', () => {
      exSetup.updateWorkingDefinition(['languages', code, 'items', item.uuid, 'next_button', 'text'], nextButtonInput.value.trim())
      exSetup.previewDefinition(true)
    })
    nextButtonCol.appendChild(nextButtonInput)

    const addOptionCol = document.createElement('div')
    addOptionCol.classList = 'col-12 col-md-4'
    row.appendChild(addOptionCol)

    const optionsLabel = document.createElement('label')
    optionsLabel.classList = 'form-label'
    optionsLabel.innerText = 'Options'
    addOptionCol.appendChild(optionsLabel)

    addOptionCol.innerHTML += '<br>'

    const addOptionButton = document.createElement('button')
    addOptionButton.classList = 'btn btn-primary'
    addOptionButton.innerText = 'Add option'
    addOptionButton.addEventListener('click', () => {
      createOption(item.uuid)
    })
    addOptionCol.appendChild(addOptionButton)

    const optionsMultiCol = document.createElement('div')
    optionsMultiCol.classList = 'col-12 col-md-8 d-flex align-items-end'
    row.appendChild(optionsMultiCol)

    const optionsMutliCheckGroup = document.createElement('div')
    optionsMutliCheckGroup.classList = 'form-check ms-auto'
    optionsMultiCol.appendChild(optionsMutliCheckGroup)

    const optionsMutliCheck = document.createElement('input')
    optionsMutliCheck.classList = 'form-check-input mutli-checkbox'
    optionsMutliCheck.setAttribute('type', 'checkbox')
    optionsMutliCheck.value = ''
    optionsMutliCheck.id = 'optionsMutliCheck_' + item.uuid + '_' + code
    optionsMutliCheck.dataset.itemuuid = item.uuid
    optionsMutliCheck.checked = item?.type === 'multiple_vote'
    optionsMutliCheckGroup.appendChild(optionsMutliCheck)
    optionsMutliCheck.addEventListener('change', (ev) => {
      if (ev.target.checked) {
        exSetup.updateWorkingDefinition(['items', item.uuid, 'type'], 'multiple_vote')
      } else exSetup.updateWorkingDefinition(['items', item.uuid, 'type'], 'single_vote')

      // Sync the same checkbox for other languages
      const inputs = document.querySelectorAll(`.mutli-checkbox[data-itemuuid="${item.uuid}"]`)
      for (const el of inputs) {
        el.checked = ev.target.checked
      }

      exSetup.previewDefinition(true)
    })

    const optionsMutliCheckLabel = document.createElement('label')
    optionsMutliCheckLabel.classList = 'form-check-label'
    optionsMutliCheckLabel.setAttribute('for', 'optionsMutliCheck_' + item.uuid + '_' + code)
    optionsMutliCheckLabel.innerHTML = `
      Alllow multiple selections
      <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="Allow the user to select multiple options." style="font-size: 0.55em;">?</span>
    `
    optionsMutliCheckGroup.appendChild(optionsMutliCheckLabel)

    const optionsCol = document.createElement('div')
    optionsCol.classList = 'col-12'
    row.appendChild(optionsCol)

    // Create main accordion container
    const accord = document.createElement('div')
    accord.className = 'accordion mt-3'
    accord.id = `itemAccordion_${item.uuid}_${code}`
    optionsCol.appendChild(accord)

    rebuildOptions(item.uuid, code)

    if (first) {
      tabButton.click()
      first = false
    }
  }
}

function setItemIcon (itemUUID, optionUUID, details = {}) {
  // Set the given filename as the icon and configure the GUI to match.
  // details should be of the form {icon, icon_user_file}

  const inputs = document.querySelectorAll(`.icon-file-input[data-optionuuid="${optionUUID}"]`)
  for (const el of inputs) {
    if (details.icon === 'user') {
      el.style.display = 'block'
      el.innerText = details?.icon_user_file || 'Select file' // default on '' too
    } else {
      el.style.display = 'none'
      el.innerText = 'Select file'
    }
  }

  const selects = document.querySelectorAll(`.icon-select[data-optionuuid="${optionUUID}"]`)
  for (const el of selects) {
    el.value = details.icon
  }

  exSetup.updateWorkingDefinition(['items', itemUUID, 'options', optionUUID, 'icon_user_file'], details.icon_user_file)
  exSetup.updateWorkingDefinition(['items', itemUUID, 'options', optionUUID, 'icon'], details.icon)
  exSetup.previewDefinition(true)
}

function changeItemOrder (uuid, dir) {
  // Move the item with the given UUID one place in the given direction

  const order = exSetup.config.workingDefinition.item_order
  const index = order.indexOf(uuid)

  // If item not found or already at the edge, do nothing
  if (index === -1) return

  const newIndex = dir === 'up'
    ? index - 1
    : dir === 'down'
      ? index + 1
      : index

  if (newIndex < 0 || newIndex >= order.length) return

  // Swap the items
  const temp = order[newIndex]
  order[newIndex] = order[index]
  order[index] = temp

  exSetup.updateWorkingDefinition(['item_order'], order)
  rebuildItems()
}

function changeOptionOrder (itemUUID, optionUUID, dir) {
  // Move the given option for the given item one place in the given direction

  const order = exSetup.config.workingDefinition?.items?.[itemUUID]?.option_order
  const index = order.indexOf(optionUUID)

  // If item not found or already at the edge, do nothing
  if (index === -1) return

  const newIndex = dir === 'up'
    ? index - 1
    : dir === 'down'
      ? index + 1
      : index

  if (newIndex < 0 || newIndex >= order.length) return

  // Swap the items
  const temp = order[newIndex]
  order[newIndex] = order[index]
  order[index] = temp

  exSetup.updateWorkingDefinition(['items', itemUUID, 'option_order'], order)
  for (const code of exSetup.config.workingDefinition?.language_order ?? []) {
    rebuildOptions(itemUUID, code)
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

// Item fields

for (const el of document.querySelectorAll('.createItemButton')) {
  el.addEventListener('click', (ev) => {
    const itemType = ev.target.dataset.type
    createItem(itemType)
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
    items: {},
    item_order: [],
    languages: {},
    language_order: [],
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
