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
  document.getElementById('columnCountSelect').value = def?.style?.layout?.num_columns ?? 'auto'
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

function rebuildItems () {
  // Rebuild the item interface

  document.getElementById('surveryItems').innerText = ''
  for (const uuid of exSetup.config.workingDefinition?.item_order ?? []) {
    const item = exSetup.config.workingDefinition?.items?.[uuid]
    if (item) createSurveyItem(item)
  }
  exSetup.previewDefinition(true)
}

function createSurveyItem (item) {
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

  if (item.type === 'text') {
    createSurveyItemText(item)
  } else if (['single_vote', 'multiple_vote'].includes(item.type)) {
    createSurveyItemVote(item)
  }
}

function createSurveyItemText (item) {
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
      content: exSetup.config.workingDefinition.languages?.[code]?.items?.[item.uuid].header?.text ?? '',
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

function createSurveyItemVote (item) {
  // Create GUI elements for a voting survey item

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

    const optionsCol = document.createElement('div')
    optionsCol.classList = 'col-12'
    row.appendChild(optionsCol)

    const optionsLabel = document.createElement('label')
    optionsLabel.classList = 'form-label'
    optionsLabel.innerText = 'Options'
    optionsCol.appendChild(optionsLabel)

    optionsCol.innerHTML += '<br>'

    const addOptionButton = document.createElement('button')
    addOptionButton.classList = 'btn btn-primary'
    addOptionButton.innerText = 'Add option'
    optionsCol.appendChild(addOptionButton)

    optionsCol.innerHTML += '<br>'

    const defLang = exSetup.config.workingDefinition?.languages?.[code]?.items?.[item.uuid]?.options ?? {}

    // Create main accordion container
    const accord = document.createElement('div')
    accord.className = 'accordion mt-3'
    accord.id = `itemAccordion_${item.uuid}_${code}`
    optionsCol.appendChild(accord)

    for (const optionUUID of item.option_order) {
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
      button.setAttribute('data-bs-target', `#itemOption_${optionUUID}_${code}`)
      button.setAttribute('aria-expanded', 'false')
      button.setAttribute('aria-controls', `itemOption_${optionUUID}_${code}`)

      const nameSpan = document.createElement('span')
      nameSpan.setAttribute('id', `itemOptionName_${optionUUID}_${code}`)
      nameSpan.innerHTML = optionText
      button.appendChild(nameSpan)

      header.appendChild(button)
      accordItem.appendChild(header)

      const collapse = document.createElement('div')
      collapse.className = 'accordion-collapse collapse'
      collapse.id = `itemOption_${optionUUID}_${code}`
      collapse.setAttribute('data-bs-parent', `#itemAccordion_${item.uuid}_${code}`)
      accordItem.appendChild(collapse)

      const body = document.createElement('div')
      body.className = 'accordion-body'
      collapse.appendChild(body)

      // Widgets for editing the various parts of the option

      const row = document.createElement('div')
      row.classList = 'row gy-2 mt-2'
      body.appendChild(row)

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
        content: exSetup.config.workingDefinition.languages?.[code]?.items?.[item.uuid]?.options?.[optionUUID]?.text ?? '',
        editorDiv: textInput,
        commandDiv: textCommandBar,
        commands: ['basic'],
        callback: (content) => {
          exSetup.updateWorkingDefinition(['languages', code, 'items', item.uuid, 'options', optionUUID, 'text'], content)
          document.getElementById(`itemOptionName_${optionUUID}_${code}`).innerHTML = exMarkdown.formatText(content, { string: true, removeParagraph: true })
          exSetup.previewDefinition(true)
        }
      })

      const backgroundCol = document.createElement('div')
      backgroundCol.classList = 'col-12 advanced-color-picker'
      backgroundCol.setAttribute('data-constACP-name', 'Background')
      backgroundCol.setAttribute('data-constACP-path', `items>${item.uuid}>options>${optionUUID}>background`)
      row.appendChild(backgroundCol)
      exSetup.createAdvancedColorPickers()
      exSetup.updateAdvancedColorPicker(`items>${item.uuid}>options>${optionUUID}>background`, item?.options?.[optionUUID]?.background)
    }

    if (first) {
      tabButton.click()
      first = false
    }
  }
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

  rebuildItems()
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
