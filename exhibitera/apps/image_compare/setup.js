/* global bootstrap, Coloris, showdown */

import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'
import * as exLang from '../js/exhibitera_setup_languages.js'

const markdownConverter = new showdown.Converter({ parseImgDimensions: true })

async function initializeWizard () {
  // Set up the wizard

  await exSetup.initializeDefinition()

  // Hide all but the welcome screen
  for (const el of document.querySelectorAll('.wizard-pane')) {
    el.style.display = 'none'
  }
  document.getElementById('wizardPane_Welcome').style.display = 'block'

  resetWizardFields()
}

function resetWizardFields () {
  // Reset populated fields in the wizard

  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
  document.getElementById('wizardLanguages').innerHTML = ''
  document.getElementById('wizardLanguagesBlankWarning').style.display = 'none'
  document.getElementById('wizardImagesNav').innerHTML = ''
  document.getElementById('wizardImagesNavContent').innerHTML = ''
  document.getElementById('wizardNoImagePairsWarning').style.display = 'none'
  document.getElementById('wizardEmptyImagePairsWarning').style.display = 'none'
  document.getElementById('wizardPairDetailsNav').innerHTML = ''
  document.getElementById('wizardPairDetailsNavContent').innerHTML = ''
  document.getElementById('wizardHomeDetailsNav').innerHTML = ''
  document.getElementById('wizardHomeDetailsNavContent').innerHTML = ''
}

async function wizardForward (currentPage) {
  // Check if the wizard is ready to advance and perform the move

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

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

      // Add languages to workingDefinition
      const langOrder = []
      for (const langEl of document.getElementById('wizardLanguages').children) {
        const code = langEl.querySelector('select').value
        const langDef = {
          code,
          display_name: exLang.getLanguageDisplayName(code),
          english_name: exLang.getLanguageDisplayName(code, true)
        }
        langOrder.push(code)

        exSetup.updateWorkingDefinition(['languages', code], langDef)
      }
      exSetup.updateWorkingDefinition(['language_order'], langOrder)
      wizardGoTo('SelectImages')
    } else {
      document.getElementById('wizardLanguagesBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'SelectImages') {
    const numItems = document.getElementById('wizardImagesNav').childElementCount
    if (numItems === 0) {
      document.getElementById('wizardNoImagePairsWarning').style.display = 'block'
      return
    } else document.getElementById('wizardNoImagePairsWarning').style.display = 'none'
    let error = false
    for (const itemUUID of workingDefinition?.content_order || []) {
      const item = workingDefinition?.content?.[itemUUID]
      if (item == null) continue
      if (((item?.image1 || '') === '') || ((item?.image2 || '') === '')) {
        error = true
      }
    }
    if (error) {
      document.getElementById('wizardEmptyImagePairsWarning').style.display = 'block'
      return
    } else {
      document.getElementById('wizardEmptyImagePairsWarning').style.display = 'none'
    }

    wizardBuildPairDetailsPage()
    wizardGoTo('PairDetails')
  } else if (currentPage === 'PairDetails') {
    const nav = document.getElementById('wizardHomeDetailsNav')
    nav.innerHTML = ''
    const content = document.getElementById('wizardHomeDetailsNavContent')
    content.innerHTML = ''
    createHomeTextLocalizationHTML(nav, content)
    wizardGoTo('HomeDetails')
  } else if (currentPage === 'HomeDetails') {
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Languages') {
    wizardGoTo('Welcome')
  } else if (currentPage === 'SelectImages') {
    wizardGoTo('Languages')
  } else if (currentPage === 'PairDetails') {
    wizardGoTo('SelectImages')
  } else if (currentPage === 'HomeDetails') {
    wizardGoTo('PairDetails')
  }
}

function wizardGoTo (page) {
  for (const el of document.querySelectorAll('.wizard-pane')) {
    el.style.display = 'none'
  }
  document.getElementById('wizardPane_' + page).style.display = 'block'
}

async function wizardCreateDefinition () {
  // Use the provided details to build a definition file.

  const uuid = $('#definitionSaveButton').data('workingDefinition').uuid

  // Definition name
  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
  exSetup.updateWorkingDefinition(['name'], defName)

  exSetup.hideModal('#setupWizardModal')
  resetWizardFields() // Must clear navs before building new ones for the main editor

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('image_compare')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid
  editDefinition(uuid)
  exSetup.hideModal('#setupWizardModal')
}

function wizardBuildPairDetailsPage () {
  // Take the working definition and build a nested set of tabs for the user
  // to add details for each language.

  const workingDef = $('#definitionSaveButton').data('workingDefinition')

  const nav = document.getElementById('wizardPairDetailsNav')
  nav.innerHTML = ''
  const content = document.getElementById('wizardPairDetailsNavContent')
  content.innerHTML = ''

  let num = 1
  for (const itemUUID of workingDef?.content_order || []) {
    const item = workingDef.content[itemUUID]

    // Create the tab button
    const tabButton = document.createElement('button')
    tabButton.classList = 'nav-link item-tab'
    tabButton.setAttribute('id', 'wizardPairDetailsTab_' + item.uuid)
    tabButton.setAttribute('data-bs-toggle', 'tab')
    tabButton.setAttribute('data-bs-target', '#wizardPairDetailsPane_' + item.uuid)
    tabButton.setAttribute('type', 'button')
    tabButton.setAttribute('role', 'tab')
    tabButton.innerHTML = String(num)
    nav.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', 'wizardPairDetailsPane_' + item.uuid)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', 'wizardPairDetailsTab_' + item.uuid)
    content.appendChild(tabPane)

    const row = document.createElement('div')
    row.classList = 'row gy-2'
    tabPane.appendChild(row)

    const imageCol = document.createElement('div')
    imageCol.classList = 'col-4'
    row.appendChild(imageCol)

    const imageRow = document.createElement('div')
    imageRow.classList = 'row gy-2'
    imageCol.appendChild(imageRow)

    const image1Col = document.createElement('div')
    image1Col.classList = 'col-12'
    imageRow.appendChild(image1Col)

    const image1 = document.createElement('img')
    image1.classList = 'w-100'
    image1.src = exCommon.config.helperAddress + '/files/' + item.image1 + '/thumbnail'
    image1Col.appendChild(image1)

    const image1Label = document.createElement('label')
    image1Label.classList = 'form-label w-100 text-center'
    image1Label.innerHTML = 'Image 1'
    image1Col.appendChild(image1Label)

    const image2Col = document.createElement('div')
    image2Col.classList = 'col-12'
    imageRow.appendChild(image2Col)

    const image2 = document.createElement('img')
    image2.classList = 'w-100'
    image2.src = exCommon.config.helperAddress + '/files/' + item.image2 + '/thumbnail'
    image2Col.appendChild(image2)

    const image2Label = document.createElement('label')
    image2Label.classList = 'form-label w-100 text-center'
    image2Label.innerHTML = 'Image 2'
    image2Col.appendChild(image2Label)

    const detailsCol = document.createElement('div')
    detailsCol.classList = 'col-8'
    row.appendChild(detailsCol)
    createItemLocalizationHTML(item, detailsCol, num)

    if (num === 1) tabButton.click()
    num++
  }

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
    await exSetup.initializeDefinition()
  }

  // Definition details
  $('#definitionNameInput').val('')

  // Attractor
  document.getElementById('inactivityTimeoutField').value = 30
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.dataset.filename = ''

  // Language
  exLang.clearLanguagePicker(document.getElementById('language-select'))
  exLang.createLanguagePicker(document.getElementById('language-select'), { onLanguageRebuild: rebuildLanguageElements })

  rebuildLanguageElements([])

  // Reset style options
  for (const el of document.querySelectorAll('.coloris')) {
    el.value = el.dataset.default
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#000',
    gradient_color_1: '#000',
    gradient_color_2: '#000'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()

  // Reset text size options
  for (const el of document.querySelectorAll('.text-size-slider')) {
    el.value = 0
  }
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)
  console.log(def)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  document.getElementById('definitionNameInput').value = def.name

  // Attractor
  const attractorSelect = document.getElementById('attractorSelect')
  if ('attractor' in def && def.attractor.trim() !== '') {
    attractorSelect.innerHTML = def.attractor
  } else {
    attractorSelect.innerHTML = 'Select file'
  }
  attractorSelect.dataset.filename = def.attractor
  document.getElementById('inactivityTimeoutField').value = def?.inactivity_timeout || 30

  rebuildItemList()
  const langSelect = document.getElementById('language-select')
  exLang.createLanguagePicker(langSelect,
    {
      onLanguageRebuild: rebuildLanguageElements
    }
  )

  if ('style' in def === false) {
    def.style = {
      background: {
        mode: 'color',
        color: '#000'
      }
    }
    exSetup.updateWorkingDefinition(['style', 'background', 'mode'], 'color')
    exSetup.updateWorkingDefinition(['style', 'background', 'color'], '#000')
  }

  // Set the appropriate values for the color pickers
  for (const key of Object.keys(def.style.color)) {
    const el = document.getElementById('colorPicker_' + key)
    if (el == null) continue
    el.value = def.style.color[key]
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // Set the appropriate values for any advanced color pickers
  if ('background' in def.style) {
    exSetup.updateAdvancedColorPicker('style>background', def.style.background)
  }

  // Set the appropriate values for the advanced font pickers
  if ('font' in def.style) {
    for (const key of Object.keys(def.style.font)) {
      const picker = document.querySelector(`.AFP-select[data-path="style>font>${key}"`)
      exSetup.setAdvancedFontPicker(picker, def.style.font[key])
    }
  }

  // Set the appropriate values for the text size selects
  for (const key of Object.keys(def.style.text_size)) {
    document.getElementById(key + 'TextSizeSlider').value = def.style.text_size?.[key] ?? 0
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../image_compare.html?standalone=true&definition=' + def.uuid
}

function rebuildLanguageElements () {
  // Called when something changes with the languages. Rebuild all relevant elements.

  rebuildItemList()
  createHomeTextLocalizationHTML()
}

function addItem (wizard = false) {
  // Add an item to the working defintiion

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  if (workingDefinition.content_order.length > 7) {
    // We've reached the max number of items
    if (wizard) {

    } else {
      document.getElementById('imagePairMaxNumberWarning').style.display = 'block'
    }
    return
  }

  const item = {
    uuid: exCommon.uuid(),
    image1: '',
    image2: ''
  }
  workingDefinition.content[item.uuid] = item
  workingDefinition.content_order.push(item.uuid)

  createItemHTML(item, workingDefinition.content_order.length, true, wizard)
}

function createItemHTML (item, num, show = false, wizard = false) {
  // Create an item tab and pane

  const def = $('#definitionSaveButton').data('workingDefinition')

  // Create the tab button
  const tabButton = document.createElement('button')
  tabButton.classList = 'nav-link item-tab'
  tabButton.setAttribute('id', 'itemTab_' + item.uuid)
  tabButton.setAttribute('data-bs-toggle', 'tab')
  tabButton.setAttribute('data-bs-target', '#itemPane_' + item.uuid)
  tabButton.setAttribute('type', 'button')
  tabButton.setAttribute('role', 'tab')
  // Convert possible Markdown-formatted name
  const temp = document.createElement('div')
  temp.innerHTML = markdownConverter.makeHtml(item?.localization?.[def?.language_order?.[0] || null]?.name || String(num))
  tabButton.innerHTML = temp.firstElementChild.innerHTML

  if (wizard === false) {
    document.getElementById('contentNav').appendChild(tabButton)
  } else {
    document.getElementById('wizardImagesNav').appendChild(tabButton)
  }

  // Create corresponding pane
  const tabPane = document.createElement('div')
  tabPane.classList = 'tab-pane fade'
  tabPane.setAttribute('id', 'itemPane_' + item.uuid)
  tabPane.setAttribute('role', 'tabpanel')
  tabPane.setAttribute('aria-labelledby', 'itemTab_' + item.uuid)
  if (wizard === false) {
    document.getElementById('contentNavContent').appendChild(tabPane)
  } else {
    document.getElementById('wizardImagesNavContent').appendChild(tabPane)
  }

  const row = document.createElement('div')
  row.classList = 'row gy-2 mt-2'
  tabPane.appendChild(row)

  const image1Pane = document.createElement('div')
  image1Pane.classList = 'col-12 col-md-6 d-flex flex-column justify-content-end'
  row.appendChild(image1Pane)

  const image1Row = document.createElement('div')
  image1Row.classList = 'row gy-2'
  image1Pane.appendChild(image1Row)

  const previewImage1Col = document.createElement('div')
  previewImage1Col.classList = 'col-12'
  image1Row.appendChild(previewImage1Col)

  const image1 = document.createElement('img')
  image1.classList = 'image-preview'
  image1.style.maxHeight = '200px'
  image1.style.width = '100%'
  image1.style.objectFit = 'contain'
  if ((item.image1 !== '') && (item.image1 != null)) {
    image1.src = exCommon.config.helperAddress + '/files/' + item.image1 + '/thumbnail'
  } else {
    image1.style.display = 'none'
  }
  previewImage1Col.appendChild(image1)

  const selectImage1Col = document.createElement('div')
  selectImage1Col.classList = 'col-12 mt-2'
  image1Row.appendChild(selectImage1Col)

  const selectImage1Button = document.createElement('button')
  selectImage1Button.classList = 'btn btn-outline-primary w-100 filename-button'
  if ((item.image1 !== '') && (item.image1 != null)) {
    selectImage1Button.innerHTML = item.image1
  } else {
    selectImage1Button.innerHTML = 'Select image 1'
  }
  selectImage1Col.appendChild(selectImage1Button)

  selectImage1Button.addEventListener('click', () => {
    exFileSelect.createFileSelectionModal({ filetypes: ['image'], multiple: false })
      .then((result) => {
        const file = result[0]
        if (file == null) return
        selectImage1Button.innerHTML = file
        image1.src = exCommon.config.helperAddress + '/files/' + file + '/thumbnail'
        exSetup.updateWorkingDefinition(['content', item.uuid, 'image1'], file)
        image1.style.display = 'block'
        exSetup.previewDefinition(true)
      })
  })

  const image2Pane = document.createElement('div')
  image2Pane.classList = 'col-12 col-md-6 d-flex flex-column justify-content-end'
  row.appendChild(image2Pane)

  const image2Row = document.createElement('div')
  image2Row.classList = 'row gy-2'
  image2Pane.appendChild(image2Row)

  const previewImage2Col = document.createElement('div')
  previewImage2Col.classList = 'col-12'
  image2Row.appendChild(previewImage2Col)

  const image2 = document.createElement('img')
  image2.classList = 'image-preview'
  image2.style.maxHeight = '200px'
  image2.style.width = '100%'
  image2.style.objectFit = 'contain'
  if ((item.image2 !== '') && (item.image2 != null)) {
    image2.src = exCommon.config.helperAddress + '/files/' + item.image2 + '/thumbnail'
  } else {
    image2.style.display = 'none'
  }
  previewImage2Col.appendChild(image2)

  const selectImage2Col = document.createElement('div')
  selectImage2Col.classList = 'col-12 mt-2'
  image2Row.appendChild(selectImage2Col)

  const selectImage2Button = document.createElement('button')
  selectImage2Button.classList = 'btn btn-outline-primary w-100 filename-button'
  if ((item.image2 !== '') && (item.image2 != null)) {
    selectImage2Button.innerHTML = item.image2
  } else {
    selectImage2Button.innerHTML = 'Select image 2'
  }
  selectImage2Button.addEventListener('click', () => {
    exFileSelect.createFileSelectionModal({ filetypes: ['image'], multiple: false })
      .then((result) => {
        const file = result[0]
        if (file == null) return
        selectImage2Button.innerHTML = file
        image2.src = exCommon.config.helperAddress + '/files/' + file + '/thumbnail'
        exSetup.updateWorkingDefinition(['content', item.uuid, 'image2'], file)
        image2.style.display = 'block'
        exSetup.previewDefinition(true)
      })
  })
  selectImage2Col.appendChild(selectImage2Button)

  const modifyPane = document.createElement('div')
  modifyPane.classList = 'col-12'
  row.appendChild(modifyPane)

  const modifyRow = document.createElement('div')
  modifyRow.classList = 'row gy-2'
  modifyPane.appendChild(modifyRow)

  if (wizard === false) {
    const optionsCol = document.createElement('div')
    optionsCol.classList = 'col-12'
    modifyRow.appendChild(optionsCol)

    const fullscreenImageCheckboxContainer = document.createElement('div')
    fullscreenImageCheckboxContainer.classList = 'form-check'
    optionsCol.appendChild(fullscreenImageCheckboxContainer)

    const fullscreenImageCheckbox = document.createElement('input')
    fullscreenImageCheckbox.classList = 'form-check-input'
    fullscreenImageCheckbox.setAttribute('type', 'checkbox')
    fullscreenImageCheckbox.setAttribute('id', 'fullscreenImageCheckbox_' + String(num))
    fullscreenImageCheckbox.checked = true
    fullscreenImageCheckbox.addEventListener('change', (event) => {
      exSetup.updateWorkingDefinition(['content', item.uuid, 'show_fullscreen'], event.target.checked)
      exSetup.previewDefinition(true)
    })
    fullscreenImageCheckboxContainer.appendChild(fullscreenImageCheckbox)

    const fullscreenImageCheckboxLabel = document.createElement('label')
    fullscreenImageCheckboxLabel.classList = 'form-check-label'
    fullscreenImageCheckboxLabel.setAttribute('for', 'fullscreenImageCheckbox_' + String(num))
    fullscreenImageCheckboxLabel.innerHTML = `
    Show images fullscreen
    <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="Images that don't match the display's aspect ratio will be enlarged to fill the screen. Some content may be cut off, but the image will not be distorted." style="font-size: 0.55em;">?</span>
    `
    fullscreenImageCheckboxContainer.appendChild(fullscreenImageCheckboxLabel)

    const orderButtonsCol = document.createElement('div')
    orderButtonsCol.classList = 'col-6 mt-2'
    modifyRow.appendChild(orderButtonsCol)

    const orderButtonsRow = document.createElement('div')
    orderButtonsRow.classList = 'row'
    orderButtonsCol.appendChild(orderButtonsRow)

    const orderButtonLeftCol = document.createElement('div')
    orderButtonLeftCol.classList = 'col-6'
    orderButtonsRow.appendChild(orderButtonLeftCol)

    const orderButtonLeft = document.createElement('button')
    orderButtonLeft.classList = 'btn btn-info btn-sm w-100'
    orderButtonLeft.innerHTML = '◀'
    orderButtonLeft.addEventListener('click', (event) => {
      changeItemOrder(item.uuid, -1)
    })
    orderButtonLeftCol.appendChild(orderButtonLeft)

    const orderButtonRightCol = document.createElement('div')
    orderButtonRightCol.classList = 'col-6'
    orderButtonsRow.appendChild(orderButtonRightCol)

    const orderButtonRight = document.createElement('button')
    orderButtonRight.classList = 'btn btn-info btn-sm w-100'
    orderButtonRight.innerHTML = '▶'
    orderButtonRight.addEventListener('click', (event) => {
      changeItemOrder(item.uuid, 1)
    })
    orderButtonRightCol.appendChild(orderButtonRight)
  }

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-6'
  modifyRow.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm w-100'
  deleteButton.innerHTML = 'Delete'
  deleteButton.addEventListener('click', (event) => {
    deleteItem(item.uuid, wizard)
    tabButton.remove()
    tabPane.remove()
    if (wizard) {
      document.getElementById('wizardMaxImagePairsWarning').style.display = 'none'
      const wizardImagesNav = document.getElementById('wizardImagesNav')
      // Renumber the remaining tabs
      let i = 1
      for (const el of wizardImagesNav.children) {
        if (i === 1) el.click()
        el.innerHTML = String(i)
        i++
      }
    }
  })
  deleteCol.appendChild(deleteButton)

  if (wizard === false) {
    const localizeHeader = document.createElement('H5')
    localizeHeader.innerHTML = 'Item content'
    row.appendChild(localizeHeader)

    const localizePane = document.createElement('div')
    localizePane.classList = 'col-12'
    row.appendChild(localizePane)

    createItemLocalizationHTML(item, localizePane, num)
  }

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })

  if (show === true) tabButton.click()
}

function createItemLocalizationHTML (item, pane, itemNum) {
  // Create the GUI for editing the localization of an item.

  const def = $('#definitionSaveButton').data('workingDefinition')

  // Make sure we have at least one language
  if (def.language_order.length === 0) {
    const span = document.createElement('span')
    span.classList = 'fst-italic text-warning'
    span.innerHTML = "Add at least one language to set the item's text content"
    pane.appendChild(span)
    return
  }

  // Create the basic elements
  const nav = document.createElement('nav')
  pane.appendChild(nav)

  const tabList = document.createElement('div')
  tabList.classList = 'nav nav-tabs'
  tabList.setAttribute('role', 'tablist')
  nav.appendChild(tabList)

  const navContent = document.createElement('div')
  navContent.classList = 'tab-content mx-2'
  pane.appendChild(navContent)

  let i = 0
  for (const code of def.language_order) {
    const lang = def.languages[code]

    // Create the tab button
    const tabButton = document.createElement('button')
    tabButton.classList = 'nav-link item-tab'
    tabButton.setAttribute('id', 'itemLocalizationTab_' + item.uuid + '_' + code)
    tabButton.setAttribute('data-bs-toggle', 'tab')
    tabButton.setAttribute('data-bs-target', '#itemLocalizationPane_' + item.uuid + '_' + code)
    tabButton.setAttribute('type', 'button')
    tabButton.setAttribute('role', 'tab')
    tabButton.innerHTML = String(lang.english_name)
    tabList.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', 'itemLocalizationPane_' + item.uuid + '_' + code)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', 'itemLocalizationTab_' + item.uuid + '_' + code)
    navContent.appendChild(tabPane)

    const tabRow = document.createElement('div')
    tabRow.classList = 'row gy-2 mt-2'
    tabPane.appendChild(tabRow)

    const nameCol = document.createElement('div')
    nameCol.classList = 'col-12 col-md-6 col-xl-4'
    tabRow.appendChild(nameCol)

    const nameLabel = document.createElement('label')
    nameLabel.classList = 'form-label'
    nameLabel.innerHTML = `
    Item name
    <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="The name is displayed under the icon for this item on the home screen." style="font-size: 0.55em;">?</span>
    `
    nameCol.appendChild(nameLabel)

    const nameInputCommandBar = document.createElement('div')
    nameCol.appendChild(nameInputCommandBar)

    const thisLangI = i
    const nameInput = document.createElement('div')
    nameCol.appendChild(nameInput)
    const nameEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: item?.localization?.[code]?.name || '',
      editorDiv: nameInput,
      commandDiv: nameInputCommandBar,
      commands: ['basic'],
      callback: (content) => {
        const name = content.trim()
        const itemTab = document.getElementById('itemTab_' + item.uuid)

        exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'name'], name)

        // If this is the primary language, update the name on the tab
        if (thisLangI === 0) {
          if (name !== '') {
            const temp = document.createElement('div')
            temp.innerHTML = markdownConverter.makeHtml(name)
            itemTab.innerHTML = temp.firstElementChild.innerHTML
          } else {
            itemTab.innerHTML = String(itemNum)
          }
        }
        exSetup.previewDefinition(true)
      }
    })

    const image1NameCol = document.createElement('div')
    image1NameCol.classList = 'col-12 col-md-6 col-xl-4'
    tabRow.appendChild(image1NameCol)

    const image1NameLabel = document.createElement('label')
    image1NameLabel.classList = 'form-label'
    image1NameLabel.innerHTML = `
    Image 1 name
    <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="A very short name that indentifies the image, such as a date." style="font-size: 0.55em;">?</span>
    `
    image1NameCol.appendChild(image1NameLabel)

    const image1CommandBar = document.createElement('div')
    image1NameCol.appendChild(image1CommandBar)

    const image1NameInput = document.createElement('div')
    image1NameCol.appendChild(image1NameInput)

    const image1NameEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: item?.localization?.[code]?.image1_name || '',
      editorDiv: image1NameInput,
      commandDiv: image1CommandBar,
      callback: (content) => {
        exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'image1_name'], content.trim())
        exSetup.previewDefinition(true)
      }
    })

    const image2NameCol = document.createElement('div')
    image2NameCol.classList = 'col-12 col-md-6 col-xl-4'
    tabRow.appendChild(image2NameCol)

    const image2NameLabel = document.createElement('label')
    image2NameLabel.classList = 'form-label'
    image2NameLabel.innerHTML = `
    Image 2 name
    <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="A very short name that indentifies the image, such as a date." style="font-size: 0.55em;">?</span>
    `
    image2NameCol.appendChild(image2NameLabel)

    const image2CommandBar = document.createElement('div')
    image2NameCol.appendChild(image2CommandBar)

    const image2NameInput = document.createElement('div')
    image2NameCol.appendChild(image2NameInput)

    const image2NameEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: item?.localization?.[code]?.image1_name || '',
      editorDiv: image2NameInput,
      commandDiv: image2CommandBar,
      callback: (content) => {
        exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'image2_name'], content.trim())
        exSetup.previewDefinition(true)
      }
    })

    const infoTitleCol = document.createElement('div')
    infoTitleCol.classList = 'col-12 col-md-6 col-xl-4'
    tabRow.appendChild(infoTitleCol)

    const infoTitleLabel = document.createElement('label')
    infoTitleLabel.classList = 'form-label'
    infoTitleLabel.innerHTML = `
    Info pane title
    <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="The header for an info pane that gives a description of the image pair." style="font-size: 0.55em;">?</span>
    `
    infoTitleCol.appendChild(infoTitleLabel)

    const infoTitleCommandBar = document.createElement('div')
    infoTitleCol.appendChild(infoTitleCommandBar)

    const infoTitleInput = document.createElement('div')
    infoTitleCol.appendChild(infoTitleInput)

    const titleEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: item?.localization?.[code]?.info_title || '',
      editorDiv: infoTitleInput,
      commandDiv: infoTitleCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'info_title'], content.trim())
        exSetup.previewDefinition(true)
      }
    })

    const infoBodyCol = document.createElement('div')
    infoBodyCol.classList = 'col-12'
    tabRow.appendChild(infoBodyCol)

    const infoBodyLabel = document.createElement('label')
    infoBodyLabel.classList = 'form-label'
    infoBodyLabel.innerHTML = `
    Info pane text
    <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="Up to a few sentenaces describing the image pair." style="font-size: 0.55em;">?</span>
    `
    infoBodyCol.appendChild(infoBodyLabel)

    const infoBodyCommandBar = document.createElement('div')
    infoBodyCol.appendChild(infoBodyCommandBar)
    const infoBodyInput = document.createElement('div')
    infoBodyCol.appendChild(infoBodyInput)

    const textEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: item?.localization?.[code]?.info_text || '',
      editorDiv: infoBodyInput,
      commandDiv: infoBodyCommandBar,
      callback: (content) => {
        exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'info_text'], content)
        exSetup.previewDefinition(true)
      }
    })

    if (i === 0) tabButton.click()
    i++
  }
}

function createHomeTextLocalizationHTML (tabList = null, navContent = null) {
  // Create the GUI for editing the localization of the home screen text.

  const def = $('#definitionSaveButton').data('workingDefinition')

  // Get the basic elements
  if (tabList == null) tabList = document.getElementById('homeTextNav')
  if (navContent == null) navContent = document.getElementById('homeTextContent')

  tabList.innerHTML = ''
  navContent.innerHTML = ''

  let i = 0
  for (const code of def.language_order) {
    const lang = def.languages[code]

    // Create the tab button
    const tabButton = document.createElement('button')
    tabButton.classList = 'nav-link item-tab'
    tabButton.setAttribute('id', 'homeTextLocalizationTab_' + code)
    tabButton.setAttribute('data-bs-toggle', 'tab')
    tabButton.setAttribute('data-bs-target', '#homeTextLocalizationPane_' + code)
    tabButton.setAttribute('type', 'button')
    tabButton.setAttribute('role', 'tab')
    tabButton.innerHTML = String(lang.english_name)
    tabList.appendChild(tabButton)

    // Create corresponding pane
    const tabPane = document.createElement('div')
    tabPane.classList = 'tab-pane fade'
    tabPane.setAttribute('id', 'homeTextLocalizationPane_' + code)
    tabPane.setAttribute('role', 'tabpanel')
    tabPane.setAttribute('aria-labelledby', 'homeTextLocalizationTab_' + code)
    navContent.appendChild(tabPane)

    const tabRow = document.createElement('div')
    tabRow.classList = 'row gy-2 mt-2'
    tabPane.appendChild(tabRow)

    const titleCol = document.createElement('div')
    titleCol.classList = 'col-12 col-lg-6'
    tabRow.appendChild(titleCol)

    const titleLabel = document.createElement('label')
    titleLabel.classList = 'form-label'
    titleLabel.innerHTML = 'Title'
    titleCol.appendChild(titleLabel)

    const titleCommandBar = document.createElement('div')
    titleCol.appendChild(titleCommandBar)

    const titleInput = document.createElement('div')
    titleCol.appendChild(titleInput)
    const titleEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: def?.misc_text?.title?.localization?.[code] || '',
      editorDiv: titleInput,
      commandDiv: titleCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['misc_text', 'title', 'localization', code], content.trim())
        exSetup.previewDefinition(true)
      }
    })

    const subtitleCol = document.createElement('div')
    subtitleCol.classList = 'col-12 col-lg-6'
    tabRow.appendChild(subtitleCol)

    const subtitleLabel = document.createElement('label')
    subtitleLabel.classList = 'form-label'
    subtitleLabel.innerHTML = 'Subtitle'
    subtitleCol.appendChild(subtitleLabel)

    const subtitleCommandBar = document.createElement('div')
    subtitleCol.appendChild(subtitleCommandBar)

    const subtitleInput = document.createElement('div')
    subtitleCol.appendChild(subtitleInput)
    const subtitleEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: def?.misc_text?.subtitle?.localization?.[code] || '',
      editorDiv: subtitleInput,
      commandDiv: subtitleCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['misc_text', 'subtitle', 'localization', code], content.trim())
        exSetup.previewDefinition(true)
      }
    })

    if (i === 0) {
      tabButton.click()
      tabPane.classList.add('show', 'active')
    }

    i++
  }
}

function deleteItem (uuid, wizard = false) {
  // Remove this item from the working defintion and destroy its GUI representation.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  delete workingDefinition.content[uuid]
  workingDefinition.content_order = workingDefinition.content_order.filter(item => item !== uuid)
  if (wizard === false) {
    rebuildItemList()
    exSetup.previewDefinition(true)
  }
}

function changeItemOrder (uuid, dir) {
  // Move the location of the given item.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const uuidIndex = workingDefinition.content_order.indexOf(uuid)
  if (dir === -1 && uuidIndex === 0) return
  if (dir === 1 && uuidIndex === workingDefinition.content_order.length - 1) return

  // Save the other value to swap them
  const otherUuid = workingDefinition.content_order[uuidIndex + dir]
  workingDefinition.content_order[uuidIndex + dir] = uuid
  workingDefinition.content_order[uuidIndex] = otherUuid
  rebuildItemList()
}

function rebuildItemList () {
  // Use the definition to rebuild the GUI representations of each item

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  // Clear any existing items
  document.getElementById('contentNav').innerHTML = ''
  document.getElementById('contentNavContent').innerHTML = ''

  let num = 1
  for (const uuid of workingDefinition.content_order) {
    const item = workingDefinition.content[uuid]
    createItemHTML(item, num, num === 1)
    num += 1
  }
}

function onAttractorFileChange () {
  // Called when a new image or video is selected.

  const file = document.getElementById('attractorSelect').dataset.filename
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  workingDefinition.attractor = file
  $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))

  exSetup.previewDefinition(true)
}

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// Activate tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

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

exLang.createLanguagePicker(document.getElementById('language-select'), rebuildItemList)

// Add event listeners
// -------------------------------------------------------------

// Wizard

// Connect the forward and back buttons
for (const el of document.querySelectorAll('.wizard-forward')) {
  el.addEventListener('click', () => {
    wizardForward(el.dataset.currentPage)
  })
}
for (const el of document.querySelectorAll('.wizard-back')) {
  el.addEventListener('click', () => {
    wizardBack(el.dataset.currentPage)
  })
}

document.getElementById('wizardAddImagePairButton').addEventListener('click', () => {
  const warning = document.getElementById('wizardMaxImagePairsWarning')
  const nav = document.getElementById('wizardImagesNav')
  if (nav.childElementCount > 7) {
    warning.style.display = 'block'
  } else {
    warning.style.display = 'none'
    addItem(true)
  }
})

// Main buttons
document.getElementById('attractorSelect').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['image', 'video'], multiple: false })
    .then((files) => {
      if (files.length === 1) {
        event.target.innerHTML = files[0]
        event.target.dataset.filename = files[0]
        onAttractorFileChange()
      }
    })
})
document.getElementById('attractorSelectClear').addEventListener('click', (event) => {
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.dataset.filename = ''
  onAttractorFileChange()
})
document.getElementById('inactivityTimeoutField').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['inactivity_timeout'], event.target.value)
  exSetup.previewDefinition(true)
})

// Content
document.getElementById('addItemButton').addEventListener('click', (event) => {
  addItem()
})
document.getElementById('imagePairMaxNumberWarningDismissButton').addEventListener('click', (ev) => {
  console.log(ev.target)
  ev.target.parentElement.style.display = 'none'
})

// Style fields
for (const el of document.querySelectorAll('.coloris')) {
  el.addEventListener('change', function () {
    const value = this.value.trim()
    const property = this.dataset.property
    exSetup.updateWorkingDefinition(['style', 'color', property], value)
    exSetup.previewDefinition(true)
  })
}

// Font fields
document.getElementById('manageFontsButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['otf', 'ttf', 'woff', 'woff2'], manage: true })
    .then(exSetup.refreshAdvancedFontPickers)
})

// Text size fields
for (const el of document.querySelectorAll('.text-size-slider')) {
  el.addEventListener('input', (event) => {
    const property = event.target.dataset.property
    exSetup.updateWorkingDefinition(['style', 'text_size', property], parseFloat(event.target.value))
    exSetup.previewDefinition(true)
  })
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

clearDefinitionInput()

exSetup.configure({
  app: 'image_compare',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    content: {},
    content_order: [],
    languages: {},
    language_order: [],
    style: {
      background: {
        color: '#000',
        mode: 'color'
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
