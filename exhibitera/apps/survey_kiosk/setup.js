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
  document.getElementById('wizardQuestionsNoneWarning').style.display = 'none'
  document.getElementById('wizardQuestionsBlankWarning').style.display = 'none'
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

      // Add the selected langauges to the definition
      const langOrder = []
      for (const langEl of document.getElementById('wizardLanguages').children) {
        const lang = langEl.querySelector('select').value
        if (langOrder.includes(lang) === false) langOrder.push(lang)

        const langDef = {
          code: lang,
          display_name: exLang.getLanguageDisplayName(lang),
          english_name: exLang.getLanguageDisplayName(lang, true),
          items: {}
        }
        exSetup.updateWorkingDefinition(['languages', lang], langDef)
      }
      exSetup.updateWorkingDefinition(['language_order'], langOrder)

      document.getElementById('wizardQuestionList').innerText = ''
      exSetup.updateWorkingDefinition(['item_order'], [])
      exSetup.wizardGoTo('Questions')
    } else {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Questions') {
    const questions = document.querySelectorAll('.wizard-question')
    if (questions.length === 0) {
      document.getElementById('wizardQuestionsNoneWarning').style.display = 'block'
      return
    }

    for (const q of questions) {
      if (q.value.trim() === '') {
        document.getElementById('wizardQuestionsBlankWarning').style.display = 'block'
        return
      }
    }
    document.getElementById('wizardQuestionsNoneWarning').style.display = 'none'
    document.getElementById('wizardQuestionsBlankWarning').style.display = 'none'

    // Set up the answers page
    document.getElementById('wizardAnswersList').innerText = ''
    for (const itemUUID of exSetup.config.workingDefinition.item_order) {
      wizardCreateAnswers(itemUUID)
    }
    exSetup.wizardGoTo('Answers')
  } else if (currentPage === 'Answers') {
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Languages') {
    exSetup.wizardGoTo('Welcome')
  } else if (currentPage === 'Questions') {
    exSetup.wizardGoTo('Languages')
  } else if (currentPage === 'Answers') {
    exSetup.wizardGoTo('Questions')
  }
}

async function wizardCreateDefinition () {
  // Use the provided details to build a definition file.

  // Definition name
  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
  exSetup.updateWorkingDefinition(['name'], defName)

  // Cycle the questions and populate the answer options
  for (const questUUID of exSetup.config.workingDefinition.item_order) {
    const answersType = document.getElementById('wizardAnswerTypeSelect_' + questUUID).value

    if (answersType === 'thumbs') {
      const optionOrder = [exUtilities.uuid(), exUtilities.uuid()]
      exSetup.updateWorkingDefinition(['items', questUUID, 'option_order'], optionOrder)
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[0]], {
        icon: 'thumbs-down_red',
        icon_user_file: '',
        uuid: optionOrder[0],
        value: 'Bad'
      })
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[1]], {
        icon: 'thumbs-up_green',
        icon_user_file: '',
        uuid: optionOrder[1],
        value: 'Good'
      })
    } else if (answersType === 'threeStars') {
      const optionOrder = [exUtilities.uuid(), exUtilities.uuid(), exUtilities.uuid()]
      exSetup.updateWorkingDefinition(['items', questUUID, 'option_order'], optionOrder)
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[0]], {
        icon: '1-star_white',
        icon_user_file: '',
        uuid: optionOrder[0],
        value: '1_star'
      })
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[1]], {
        icon: '2-star_white',
        icon_user_file: '',
        uuid: optionOrder[1],
        value: '2_star'
      })
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[2]], {
        icon: '3-star_white',
        icon_user_file: '',
        uuid: optionOrder[2],
        value: '3_star'
      })
    } else if (answersType === 'fiveStars') {
      const optionOrder = [exUtilities.uuid(), exUtilities.uuid(), exUtilities.uuid(), exUtilities.uuid(), exUtilities.uuid()]
      exSetup.updateWorkingDefinition(['items', questUUID, 'option_order'], optionOrder)
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[0]], {
        icon: '1-star_white',
        icon_user_file: '',
        uuid: optionOrder[0],
        value: '1_star'
      })
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[1]], {
        icon: '2-star_white',
        icon_user_file: '',
        uuid: optionOrder[1],
        value: '2_star'
      })
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[2]], {
        icon: '3-star_white',
        icon_user_file: '',
        uuid: optionOrder[2],
        value: '3_star'
      })
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[3]], {
        icon: '4-star_white',
        icon_user_file: '',
        uuid: optionOrder[3],
        value: '4_star'
      })
      exSetup.updateWorkingDefinition(['items', questUUID, 'options', optionOrder[4]], {
        icon: '5-star_white',
        icon_user_file: '',
        uuid: optionOrder[4],
        value: '5_star'
      })
    }
  }

  const uuid = exSetup.config.workingDefinition.uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('survey_kiosk')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exUtilities.hideModal('#setupWizardModal')
}

function wizarddCreateQuestion (userDetails) {
  // Create the GUI representation of a new question in the wizard

  const itemOrder = exSetup.config.workingDefinition?.item_order ?? []
  const defaultLang = exSetup.config.workingDefinition.language_order[0]

  const defaults = {
    uuid: exUtilities.uuid(),
    value: '',
    options: {},
    option_order: [],
    type: 'single_vote',
    randomize_options: false
  }

  // Merge in user details
  const details = { ...defaults, ...userDetails }

  if (itemOrder.includes(details.uuid) === false) {
    itemOrder.push(details.uuid)
    exSetup.updateWorkingDefinition(['item_order', itemOrder])
    for (const key of Object.keys(defaults)) {
      exSetup.updateWorkingDefinition(['items', details.uuid, key], details[key])
    }
  }

  const col = document.createElement('div')
  col.classList = 'col-12'
  col.setAttribute('id', 'wizardQuestion_' + details.uuid)
  document.getElementById('wizardQuestionList').appendChild(col)

  const row = document.createElement('div')
  row.classList = 'row'
  col.appendChild(row)

  const questionCol = document.createElement('div')
  questionCol.classList = 'col-10 pe-1'
  row.appendChild(questionCol)

  const questionText = document.createElement('input')
  questionText.setAttribute('type', 'text')
  questionText.classList = 'form-control wizard-question'
  questionText.value = ''
  questionText.addEventListener('change', () => {
    exSetup.updateWorkingDefinition(['languages', defaultLang, 'items', details.uuid, 'header', 'text'], questionText.value.trim())
  })
  questionCol.appendChild(questionText)

  const buttonCol = document.createElement('div')
  buttonCol.classList = 'col-2 ps-1'
  row.appendChild(buttonCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger w-100'
  deleteButton.innerHTML = '×'
  deleteButton.addEventListener('click', () => {
    deleteItem(details.uuid, true)
  })
  buttonCol.appendChild(deleteButton)
}

function wizardCreateAnswers (questionUUID) {
  // Create a picker to populate answers for the given question.

  const defaultLang = exSetup.config.workingDefinition.language_order[0]
  const question = exSetup.config.workingDefinition.languages[defaultLang].items[questionUUID].header.text

  const col = document.createElement('div')
  col.classList = 'col-12'
  col.innerHTML = `
  <H3>${question}</H3>
  <label class="form-label" for="wizardAnswerTypeSelect_${questionUUID}">Choose answer options</label>
  <select id="wizardAnswerTypeSelect_${questionUUID}" class="form-select">
    <option value="thumbs">Thumbs-up/down</option>
    <option value="threeStars">Stars (1 - 3)</option>
    <option value="fiveStars">Stars (1 - 5)</option>
    <option value="custom">Write your own answers</option>
  </select>
  <div id="wizardCustomAnswersGUI_${questionUUID}" class="row gy-2 mt-2" style="display: none;">
    <div class="col-12">
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="wizardRandomizeAnswers_${questionUUID}">
        <label class="form-check-label" for="wizardRandomizeAnswers_${questionUUID}">Randomize options</label>
      </div>
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="wizardMultipleSelect_${questionUUID}">
        <label class="form-check-label" for="wizardMultipleSelect_${questionUUID}">
          Allow multiple selections
          <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="Allow the user to select multiple options." style="font-size: 0.55em;">?</span>
        </label>
      </div>
    </div>
    <div class="col-3">
      <button id="wizardAddAnswerOptionButton_${questionUUID}" class="btn btn-primary">Add option</button>
    </div>
    <div class="col-9">
      <div id="wizardCustomAnswersRow_${questionUUID}" class="row gy-2"></div>
    </div>
    <div id="wizardCustomAnswersNoOptionsWarning_${questionUUID}" class="col-12 text-warning" style="display: none;">
      You must add at least one answer option.
    </div>
    <div id="wizardCustomAnswersBlankOptionsWarning_${questionUUID}" class="col-12 text-warning" style="display: none;">
      Answer options must not be blank (you can remove text after completing the setup wizard).
    </div>
  </div>
  `
  document.getElementById('wizardAnswersList').appendChild(col)

  document.getElementById('wizardAnswerTypeSelect_' + questionUUID).addEventListener('change', (event) => {
    if (event.target.value === 'custom') {
      document.getElementById('wizardCustomAnswersGUI_' + questionUUID).style.display = 'flex'
    } else {
      document.getElementById('wizardCustomAnswersGUI_' + questionUUID).style.display = 'none'
    }
  })
  document.getElementById('wizardAddAnswerOptionButton_' + questionUUID).addEventListener('click', () => {
    wizardCreateAnswerOption(questionUUID)
  })

  document.getElementById('wizardMultipleSelect_' + questionUUID).addEventListener('change', (ev) => {
    if (ev.target.checked) {
      exSetup.updateWorkingDefinition(['items', questionUUID, 'type'], 'multiple_vote')
    } else exSetup.updateWorkingDefinition(['items', questionUUID, 'type'], 'single_vote')
  })

  document.getElementById('wizardRandomizeAnswers_' + questionUUID).addEventListener('change', (ev) => {
    exSetup.updateWorkingDefinition(['items', questionUUID, 'randomize_options'], ev.target.checked)
  })

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function wizardCreateAnswerOption (questionUUID, userDetails) {
  // Create the GUI representation of a new answer option in the wizard

  const optionOrder = exSetup.config.workingDefinition.items[questionUUID].option_order
  const defaultLang = exSetup.config.workingDefinition.language_order[0]

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
    exSetup.updateWorkingDefinition(['items', questionUUID, 'option_order', optionOrder])
    for (const key of Object.keys(defaults)) {
      exSetup.updateWorkingDefinition(['items', questionUUID, 'options', details.uuid, key], details[key])
    }
  }

  const col = document.createElement('div')
  col.classList = 'col-12'
  col.setAttribute('id', 'wizardAnswerCol_' + questionUUID + '_' + details.uuid)
  document.getElementById(`wizardCustomAnswersRow_${questionUUID}`).appendChild(col)

  const row = document.createElement('div')
  row.classList = 'row'
  col.appendChild(row)

  const answerCol = document.createElement('div')
  answerCol.classList = 'col-10 pe-1'
  row.appendChild(answerCol)

  const answerText = document.createElement('input')
  answerText.setAttribute('type', 'text')
  answerText.classList = 'form-control wizard-answer-option'
  answerText.value = details.label
  answerText.addEventListener('change', () => {
    exSetup.updateWorkingDefinition(['languages', defaultLang, 'items', questionUUID, 'options', details.uuid, 'text'], answerText.value.trim())
  })
  answerCol.appendChild(answerText)

  const buttonCol = document.createElement('div')
  buttonCol.classList = 'col-2 ps-1'
  row.appendChild(buttonCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger w-100'
  deleteButton.innerHTML = '×'
  deleteButton.addEventListener('click', () => {
    deleteOption(questionUUID, details.uuid, true)
  })
  buttonCol.appendChild(deleteButton)
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) exSetup.initializeDefinition()

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('behaviorInput_inactivity_timeout').value = 10

  // Reset langauges
  const langSelect = document.getElementById('language-picker')
  exLang.createLanguagePicker(langSelect,
    {
      onLanguageRebuild: rebuildItems
    }
  )

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

  // Reset color options
  const colorInputs = ['button-color', 'button-selected-color', 'next-button-color', 'restart-button-color', 'header-color', 'button-text-color', 'next-button-text-color', 'restart-button-text-color', 'body-text-color', 'active-dot-color', 'inactive-dot-color']
  for (const input of colorInputs) {
    const el = document.getElementById('colorPicker_' + input)
    el.value = el.dataset.default
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#fff'
  })
  exSetup.updateAdvancedColorPicker('style>item_background', {
    mode: 'color',
    color: '#6c757d'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()

  // Reset text size options
  document.getElementById('headerTextSizeSlider').value = 0
  document.getElementById('buttonTextSizeSlider').value = 0
  document.getElementById('nextButtonTextSizeSlider').value = 0

  exSetup.createAdvancedSliders()

  // Clear any created items
  document.getElementById('surveyItems').innerText = ''
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

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background, { mode: 'color', color: '#fff' })
  exSetup.updateAdvancedColorPicker('style>item_background', def?.style?.item_background, { mode: 'color', color: '#6c757d' })
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
  sortEndScreen()

  const languages = exSetup.config.workingDefinition?.languages ?? {}
  for (const langCode of Object.keys(languages)) {
    const lang = languages[langCode]
    if (!lang.items) lang.items = {}
    lang.items[item.uuid] = { header: { text: 'New item' } }
  }
  exSetup.updateWorkingDefinition(['languages'], languages)
  rebuildItems()
}

function deleteItem (uuidToRemove, wizard = false) {
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

  if (wizard) {
    document.getElementById('wizardQuestion_' + uuidToRemove).remove()
  } else rebuildItems()
}

function rebuildItems () {
  // Rebuild the item interface

  document.getElementById('surveyItems').innerText = ''
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

function deleteOption (itemUUID, optionUUID, wizard = false) {
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

  if (wizard) {
    document.getElementById('wizardAnswerCol_' + itemUUID + '_' + optionUUID).remove()
  } else {
    for (const lang of exSetup.config.workingDefinition?.language_order ?? []) {
      rebuildOptions(itemUUID, lang)
    }
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
    textCol.classList = 'col-12 col-lg-6'
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
    valueCol.classList = 'col-12 col-lg-6'
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
    iconSelectCol.classList = 'col-12 col-lg-6'
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
    iconInputCol.classList = 'col-12 col-lg-6'
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
  const surveyItems = document.getElementById('surveyItems')

  let badgeText = 'Question'
  if (item.type === 'text') {
    if (item?.end_screen) {
      badgeText = 'End screen'
    } else badgeText = 'Text'
  }

  const html = `
    <div class="accordion-item">
      <h2 class="accordion-header">
        <div
          class="accordion-button d-flex justify-content-between align-items-center collapsed"
          style="cursor: pointer;"
          data-bs-toggle="collapse"
          data-bs-target="#${item.uuid}_accordion"
          aria-expanded="false"
          aria-controls="${item.uuid}_accordion"
        >
          <span class='flex-grow-1' id="${item.uuid}_accordionName">
          ${exMarkdown.formatText(def.languages?.[def.language_order[0]]?.items?.[item.uuid]?.header?.text ?? '', { string: true, removeParagraph: true })}
          </span>
          <small>
            <span class='badge rounded-pill border me-2'>${badgeText}</span>
          </small>
        </div>
      </h2>
      <div id="${item.uuid}_accordion" class="accordion-collapse collapse " data-bs-parent="#surveyItems">
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
          <hr>
          
          <nav class="mt-3">
            <div id="${item.uuid}_accordion_tabs" class="nav nav-tabs" role="tablist">
            </div>
          </nav>
          <div class="tab-content" id="${item.uuid}_accordion_content">
        </div>
      </div>
    </div>
  `
  surveyItems.insertAdjacentHTML('beforeend', html)
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
    if (item?.end_screen === true) {
      document.getElementById(item.uuid + '_accordion_moveUpButton').remove()
      document.getElementById(item.uuid + '_accordion_moveDownButton').remove()
    }
    createSurveyItemGUIText(item)
  } else if (['single_vote', 'multiple_vote'].includes(item.type)) {
    createSurveyItemGUIVote(item)
  }
}

function createSurveyItemGUIText (item) {
  // Create GUI elements for a text survey item

  const nav = document.getElementById(item.uuid + '_accordion_tabs')
  const pane = document.getElementById(item.uuid + '_accordion_content')
  nav.classList.add('mt-3')

  // First, insert language-independant options before the nav.
  const row = document.createElement('div')
  row.classList = 'row gy-2'
  nav.parentElement.insertBefore(row, nav)

  const positionCol = document.createElement('div')
  positionCol.classList = 'col-6'
  row.appendChild(positionCol)

  const positionLabel = document.createElement('label')
  positionLabel.classList = 'form-label'
  positionLabel.innerText = 'Text position'
  positionCol.appendChild(positionLabel)

  const positionSelect = document.createElement('select')
  positionSelect.classList = 'form-select'
  positionSelect.appendChild(new Option('Top', 'top'))
  positionSelect.appendChild(new Option('Middle', 'middle'))
  positionSelect.value = item?.text_position ?? 'top'
  positionSelect.addEventListener('change', (ev) => {
    exSetup.updateWorkingDefinition(['items', item.uuid, 'text_position'], ev.target.value)
    exSetup.previewDefinition(true)
  })
  positionCol.appendChild(positionSelect)

  const endCol = document.createElement('div')
  endCol.classList = 'col-6'
  row.appendChild(endCol)

  const endCheckGroup = document.createElement('div')
  endCheckGroup.classList = 'form-check'
  endCol.appendChild(endCheckGroup)

  const endCheck = document.createElement('input')
  endCheck.classList = 'form-check-input end-check'
  endCheck.setAttribute('type', 'checkbox')
  endCheck.value = ''
  endCheck.id = 'endCheck_' + item.uuid
  endCheck.dataset.itemuuid = item.uuid
  endCheck.checked = item?.end_screen ?? false
  endCheckGroup.appendChild(endCheck)
  endCheck.addEventListener('change', (ev) => {
    setEndScreen(item.uuid, ev.target.checked)
    exSetup.previewDefinition(true)
  })

  const endCheckLabel = document.createElement('label')
  endCheckLabel.classList = 'form-check-label'
  endCheckLabel.setAttribute('for', 'endCheck_' + item.uuid)
  endCheckLabel.innerHTML = `
        End screen
        <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="This text item will appear automatically after the user submits their survey responses." style="font-size: 0.55em;">?</span>
        `
  endCheckGroup.appendChild(endCheckLabel)

  const endDurationCol = document.createElement('div')
  endDurationCol.classList = 'col-6'
  row.appendChild(endDurationCol)

  endDurationCol.innerHTML = `
    <div 
      id="endScreenDuration_${item.uuid}"
      class="advanced-slider" 
      data-name="End screen duration" 
      data-path="items>${item.uuid}>end_screen_duration" 
      data-min="1" 
      data-max="15" 
      data-start="${item?.end_screen_duration ?? 3}" 
      data-step="1" 
      data-unit="sec" 
      data-note="How long to display the end screen."
    ></div>
  `
  const endDurationEl = document.getElementById('endScreenDuration_' + item.uuid)
  exSetup.createAdvancedSlider(endDurationEl)
  if (!(item?.end_screen === true)) endDurationEl.style.display = 'none'

  // Then, add the language-specific options

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

    if ((item?.end_screen ?? false) === false) {
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
    }

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

function setEndScreen (itemUUID, value = true) {
  // Set the given text item to be the end screen.

  // Set the given item as the end screen
  exSetup.updateWorkingDefinition(['items', itemUUID, 'end_screen'], value)

  if (value === true) {
  // Move this item to the end of the items
    const itemOrder = exSetup.config.workingDefinition.item_order
    itemOrder.push(itemOrder.splice(itemOrder.indexOf(itemUUID), 1)[0])
    exSetup.updateWorkingDefinition(['item_order', itemOrder])

    // Ensure no other item is the end screen
    for (const el of document.querySelectorAll('.end-check')) {
      if (el.dataset.itemuuid === itemUUID) continue
      if (el.checked) {
        el.checked = false
        exSetup.updateWorkingDefinition(['items', el.dataset.itemuuid, 'end_screen'], false)
      }
    }
  }
  rebuildItems()
}

function sortEndScreen () {
  // Ensure that if an end screen exists, it's the last item

  const itemOrder = exSetup.config.workingDefinition.item_order
  for (const uuid of itemOrder) {
    if (exSetup.config.workingDefinition.items[uuid]?.end_screen === true) {
      itemOrder.push(itemOrder.splice(itemOrder.indexOf(uuid), 1)[0])
      break // There can be only one end screen
    }
  }
  exSetup.updateWorkingDefinition(['item_order', itemOrder])
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

  const valueCol = document.createElement('div')
  valueCol.classList = 'col-12 col-md-6'
  row.appendChild(valueCol)

  const valueLabel = document.createElement('label')
  valueLabel.classList = 'form-label'
  valueLabel.innerHTML = `
        Value
        <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="How this item should appear in your data spreadsheet. E.g., 'favorite_gallery'." style="font-size: 0.55em;">?</span>
        `
  valueCol.appendChild(valueLabel)

  const valueInput = document.createElement('input')
  valueInput.classList = 'form-control'
  valueInput.setAttribute('type', 'text')
  valueInput.value = item?.value ?? ''
  valueInput.addEventListener('change', (ev) => {
    exSetup.updateWorkingDefinition(['items', item.uuid, 'value'], ev.target.value)
    exSetup.previewDefinition(true)
  })
  valueCol.appendChild(valueInput)

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

  const checkboxCol = document.createElement('div')
  checkboxCol.classList = 'col-12 mt-3'
  row.appendChild(checkboxCol)

  const randomCheckGroup = document.createElement('div')
  randomCheckGroup.classList = 'form-check form-check-inline'
  checkboxCol.appendChild(randomCheckGroup)

  const randomCheck = document.createElement('input')
  randomCheck.classList = 'form-check-input random-checkbox'
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

  const optionsMutliCheckGroup = document.createElement('div')
  optionsMutliCheckGroup.classList = 'form-check form-check-inline'
  checkboxCol.appendChild(optionsMutliCheckGroup)

  const optionsMutliCheck = document.createElement('input')
  optionsMutliCheck.classList = 'form-check-input mutli-checkbox'
  optionsMutliCheck.setAttribute('type', 'checkbox')
  optionsMutliCheck.value = ''
  optionsMutliCheck.id = 'optionsMutliCheck_' + item.uuid
  optionsMutliCheck.dataset.itemuuid = item.uuid
  optionsMutliCheck.checked = item?.type === 'multiple_vote'
  optionsMutliCheckGroup.appendChild(optionsMutliCheck)
  optionsMutliCheck.addEventListener('change', (ev) => {
    if (ev.target.checked) {
      exSetup.updateWorkingDefinition(['items', item.uuid, 'type'], 'multiple_vote')
    } else exSetup.updateWorkingDefinition(['items', item.uuid, 'type'], 'single_vote')

    exSetup.previewDefinition(true)
  })

  const optionsMutliCheckLabel = document.createElement('label')
  optionsMutliCheckLabel.classList = 'form-check-label'
  optionsMutliCheckLabel.setAttribute('for', 'optionsMutliCheck_' + item.uuid)
  optionsMutliCheckLabel.innerHTML = `
      Allow multiple selections
      <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="Allow the user to select multiple options." style="font-size: 0.55em;">?</span>
    `
  optionsMutliCheckGroup.appendChild(optionsMutliCheckLabel)

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
    headerCol.classList = 'col-12 col-lg-6'
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
    nextButtonCol.classList = 'col-12 col-lg-6'
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
    addOptionCol.classList = 'col-12 col-lg-4'
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

  // Make sure any end screen is still at the end
  sortEndScreen()

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

document.getElementById('wizardAddQuestionButton').addEventListener('click', (event) => {
  wizarddCreateQuestion()
})

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
