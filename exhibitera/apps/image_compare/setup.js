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

  // Definition details
  $('#definitionNameInput').val('')

  // Reset style options
  document.querySelectorAll('.coloris').forEach(el => {
    el.value = el.getAttribute('data-default')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#000',
    gradient_color_1: '#000',
    gradient_color_2: '#000'
  })

  // Reset font face options
  exSetup.resetAdvancedFontPickers()

  // Reset text size options
  document.querySelectorAll('.text-size-slider').forEach(el => {
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
  rebuildItemList()
  rebuildLanguageList()

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
  Object.keys(def.style.color).forEach((key) => {
    const el = document.getElementById('colorPicker_' + key)
    el.value = def.style.color[key]
    el.dispatchEvent(new Event('input', { bubbles: true }))
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
  Object.keys(def.style.text_size).forEach((key) => {
    document.getElementById(key + 'TextSizeSlider').value = def.style.text_size?.[key] || 0
  })

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../image_compare.html?standalone=true&definition=' + def.uuid
}

function addItem () {
  // Add an item to the working defintiion

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  if (workingDefinition.content_order.length > 7) {
    // We've reached the max number of items
    document.getElementById('imagePairMaxNumberWarning').style.display = 'block'
    return
  }

  const item = {
    uuid: exCommon.uuid(),
    image1: '',
    image2: ''
  }
  workingDefinition.content[item.uuid] = item
  workingDefinition.content_order.push(item.uuid)

  createItemHTML(item, workingDefinition.content_order.length, true)
  console.log($('#definitionSaveButton').data('workingDefinition'))
}

function createItemHTML (item, num, show = false) {
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
  tabButton.innerHTML = item?.localization?.[def?.language_order?.[0] || null]?.name || String(num)
  document.getElementById('contentNav').appendChild(tabButton)

  // Create corresponding pane
  const tabPane = document.createElement('div')
  tabPane.classList = 'tab-pane fade'
  tabPane.setAttribute('id', 'itemPane_' + item.uuid)
  tabPane.setAttribute('role', 'tabpanel')
  tabPane.setAttribute('aria-labelledby', 'itemTab_' + item.uuid)
  document.getElementById('contentNavContent').appendChild(tabPane)

  const row = document.createElement('div')
  row.classList = 'row gy-2 mt-2'
  tabPane.appendChild(row)

  const image1Pane = document.createElement('div')
  image1Pane.classList = 'col-12 col-md-6 d-flex flex-column justify-content-start'
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
    image1.src = exCommon.config.helperAddress + '/thumbnails/' + item.image1
  } else {
    image1.style.display = 'none'
  }
  previewImage1Col.appendChild(image1)

  const selectImage1Col = document.createElement('div')
  selectImage1Col.classList = 'col-12 mt-2'
  image1Row.appendChild(selectImage1Col)

  const selectImage1Button = document.createElement('button')
  selectImage1Button.classList = 'btn btn-outline-primary w-100'
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
        selectImage1Button.innerHTML = file
        image1.src = exCommon.config.helperAddress + '/thumbnails/' + file
        exSetup.updateWorkingDefinition(['content', item.uuid, 'image1'], file)
        image1.style.display = 'block'
        exSetup.previewDefinition(true)
      })
  })

  const image2Pane = document.createElement('div')
  image2Pane.classList = 'col-12 col-md-6 d-flex flex-column justify-content-start'
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
    image2.src = exCommon.config.helperAddress + '/thumbnails/' + item.image2
  } else {
    image2.style.display = 'none'
  }
  previewImage2Col.appendChild(image2)

  const selectImage2Col = document.createElement('div')
  selectImage2Col.classList = 'col-12 mt-2'
  image2Row.appendChild(selectImage2Col)

  const selectImage2Button = document.createElement('button')
  selectImage2Button.classList = 'btn btn-outline-primary w-100'
  if ((item.image2 !== '') && (item.image2 != null)) {
    selectImage2Button.innerHTML = item.image2
  } else {
    selectImage2Button.innerHTML = 'Select image 2'
  }
  selectImage2Button.addEventListener('click', () => {
    exFileSelect.createFileSelectionModal({ filetypes: ['image'], multiple: false })
      .then((result) => {
        const file = result[0]
        selectImage2Button.innerHTML = file
        image2.src = exCommon.config.helperAddress + '/thumbnails/' + file
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

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-6'
  modifyRow.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm w-100'
  deleteButton.innerHTML = 'Delete'
  deleteButton.addEventListener('click', (event) => {
    deleteItem(item.uuid)
  })
  deleteCol.appendChild(deleteButton)

  const localizeHeader = document.createElement('H5')
  localizeHeader.innerHTML = 'Item content'
  row.appendChild(localizeHeader)

  const localizePane = document.createElement('div')
  localizePane.classList = 'col-12'
  row.appendChild(localizePane)

  createItemLocalizationHTML(item, localizePane, num)

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

    const nameInput = document.createElement('input')
    nameInput.classList = 'form-control'
    nameInput.value = item?.localization?.[code]?.name || ''
    const thisLangI = i
    nameInput.addEventListener('change', () => {
      const name = nameInput.value.trim()
      const itemTab = document.getElementById('itemTab_' + item.uuid)

      exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'name'], name)

      // If this is the primary language, update the name on the tab
      if (thisLangI === 0) {
        if (name !== '') {
          itemTab.innerHTML = name
        } else {
          itemTab.innerHTML = String(itemNum)
        }
      }
      exSetup.previewDefinition(true)
    })
    nameCol.appendChild(nameInput)

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

    const image1NameInput = document.createElement('input')
    image1NameInput.classList = 'form-control'
    image1NameInput.value = item?.localization?.[code]?.image1_name || ''
    image1NameInput.addEventListener('change', () => {
      exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'image1_name'], image1NameInput.value.trim())
      exSetup.previewDefinition(true)
    })
    image1NameCol.appendChild(image1NameInput)

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

    const image2NameInput = document.createElement('input')
    image2NameInput.classList = 'form-control'
    image2NameInput.value = item?.localization?.[code]?.image2_name || ''
    image2NameInput.addEventListener('change', () => {
      exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'image2_name'], image2NameInput.value.trim())
      exSetup.previewDefinition(true)
    })
    image2NameCol.appendChild(image2NameInput)

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

    const infoTitleInput = document.createElement('input')
    infoTitleInput.classList = 'form-control'
    infoTitleInput.value = item?.localization?.[code]?.info_title || ''
    infoTitleInput.addEventListener('change', () => {
      exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'info_title'], infoTitleInput.value.trim())
      exSetup.previewDefinition(true)
    })
    infoTitleCol.appendChild(infoTitleInput)

    //

    const infoBodyCol = document.createElement('div')
    infoBodyCol.classList = 'col-12'
    tabRow.appendChild(infoBodyCol)

    const infoBodyLabel = document.createElement('label')
    infoBodyLabel.classList = 'form-label'
    infoBodyLabel.innerHTML = `
    Info pane text
    <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="Up to a few sentenaces describing the image pair. Formatting with Markdown is supported." style="font-size: 0.55em;">?</span>
    `
    infoBodyCol.appendChild(infoBodyLabel)

    const infoBodyInput = document.createElement('textarea')
    infoBodyInput.classList = 'form-control'
    infoBodyInput.value = item?.localization?.[code]?.info_text || ''
    infoBodyInput.addEventListener('change', () => {
      exSetup.updateWorkingDefinition(['content', item.uuid, 'localization', code, 'info_text'], infoBodyInput.value.trim())
      exSetup.previewDefinition(true)
    })
    infoBodyCol.appendChild(infoBodyInput)

    if (i === 0) tabButton.click()
    i++
  }
}

function createHomeTextLocalizationHTML () {
  // Create the GUI for editing the localization of the home screen text.

  const def = $('#definitionSaveButton').data('workingDefinition')

  // Get the basic elements
  const tabList = document.getElementById('homeTextNav')
  const navContent = document.getElementById('homeTextContent')

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
    titleCol.classList = 'col-12 col-md-6 col-xl-4'
    tabRow.appendChild(titleCol)

    const titleLabel = document.createElement('label')
    titleLabel.classList = 'form-label'
    titleLabel.innerHTML = 'Title'
    titleCol.appendChild(titleLabel)

    const titleInput = document.createElement('input')
    titleInput.classList = 'form-control'
    titleInput.value = def?.misc_text?.title?.localization?.[code] || ''
    titleInput.addEventListener('change', () => {
      const title = titleInput.value.trim()
      exSetup.updateWorkingDefinition(['misc_text', 'title', 'localization', code], title)
      exSetup.previewDefinition(true)
    })
    titleCol.appendChild(titleInput)

    const subtitleCol = document.createElement('div')
    subtitleCol.classList = 'col-12 col-md-6 col-xl-4'
    tabRow.appendChild(subtitleCol)

    const subtitleLabel = document.createElement('label')
    subtitleLabel.classList = 'form-label'
    subtitleLabel.innerHTML = 'Subtitle'
    subtitleCol.appendChild(subtitleLabel)

    const subtitleInput = document.createElement('input')
    subtitleInput.classList = 'form-control'
    subtitleInput.value = def?.misc_text?.subtitle?.localization?.[code] || ''
    subtitleInput.addEventListener('change', () => {
      exSetup.updateWorkingDefinition(['misc_text', 'subtitle', 'localization', code], subtitleInput.value.trim())
      exSetup.previewDefinition(true)
    })
    subtitleCol.appendChild(subtitleInput)

    if (i === 0) tabButton.click()
    i++
  }
}

function deleteItem (uuid) {
  // Remove this item from the working defintion and destroy its GUI representation.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  delete workingDefinition.content[uuid]
  workingDefinition.content_order = workingDefinition.content_order.filter(item => item !== uuid)
  rebuildItemList()
  exSetup.previewDefinition(true)
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

function rebuildLanguageList () {
  // Use the definition to rebuild the GUI representation for each language

  const def = $('#definitionSaveButton').data('workingDefinition')
  document.getElementById('languageList').innerHTML = ''

  let i = 0
  def.language_order.forEach((code) => {
    const lang = def.languages[code]
    createLanguageHTML(code, lang.display_name, lang.english_name, i === 0)
    i++
  })

  createHomeTextLocalizationHTML()
}

function rebuildItemList () {
  // Use the definition to rebuild the GUI representations of each item

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  // Clear any existing items
  document.getElementById('contentNav').innerHTML = ''
  document.getElementById('contentNavContent').innerHTML = ''

  let num = 1
  workingDefinition.content_order.forEach((uuid) => {
    const item = workingDefinition.content[uuid]
    createItemHTML(item, num, num === 1)
    num += 1
  })
}

function addLanguage (code, displayName, englishName) {
  // Add a new language to the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')

  exSetup.updateWorkingDefinition(['languages', code], {
    code,
    display_name: displayName,
    english_name: englishName
  })
  definition.language_order.push(code)

  createLanguageHTML(code, displayName, englishName)
  rebuildItemList()
  rebuildLanguageList()
  exSetup.previewDefinition(true)
}

function deleteLanguage (code) {
  // Remove this language from the working defintion and destroy its GUI representation.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  delete workingDefinition.languages[code]
  workingDefinition.language_order = workingDefinition.language_order.filter(lang => lang !== code)

  rebuildLanguageList()
  rebuildItemList()
  exSetup.previewDefinition(true)
}

function changeLanguageOrder (code, dir) {
  // Move the language specified by code by dir places
  // dir = 1 means move down the list by one place; dir = -1 is moves up the list.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const arr = workingDefinition?.language_order || []

  const index = arr.indexOf(code)

  if (index === -1) return // code doesn't exist
  if (dir === 0) return // No motion

  if (dir < 1) {
    if (index === 0) return // Can't move higher
  } else {
    if (index >= arr.length - 1) return // Can't move lower
  }

  // Swap the element with the next one
  [arr[index], arr[index + dir]] = [arr[index + dir], arr[index]]

  workingDefinition.language_order = arr
  rebuildLanguageList()
  rebuildItemList()
  exSetup.previewDefinition(true)
}

function createLanguageHTML (code, displayName, englishName, isDefault = false) {
  // Create the HTML representation of a language.

  const col = document.createElement('div')
  col.classList = 'col-12'

  const card = document.createElement('div')
  card.classList = 'card'
  col.appendChild(card)

  const cardBody = document.createElement('div')
  cardBody.classList = 'card-body row gy-2 d-flex align-items-center p-2'
  card.appendChild(cardBody)

  const englishNameCol = document.createElement('div')
  englishNameCol.classList = 'col-12 col-lg-6'
  cardBody.appendChild(englishNameCol)

  const englishNameDiv = document.createElement('div')
  englishNameDiv.innerHTML = englishName
  englishNameCol.appendChild(englishNameDiv)

  if (isDefault === true) {
    const badge = document.createElement('span')
    badge.classList = 'badge text-bg-secondary ms-2'
    badge.innerHTML = 'Default'
    englishNameDiv.appendChild(badge)
  }

  const orderButtonLeftCol = document.createElement('div')
  orderButtonLeftCol.classList = 'col-4 col-lg-2'
  cardBody.appendChild(orderButtonLeftCol)

  const orderButtonLeft = document.createElement('button')
  orderButtonLeft.classList = 'btn btn-info btn-sm w-100'
  orderButtonLeft.innerHTML = '▲'
  orderButtonLeft.addEventListener('click', (event) => {
    changeLanguageOrder(code, -1)
  })
  orderButtonLeftCol.appendChild(orderButtonLeft)

  const orderButtonRightCol = document.createElement('div')
  orderButtonRightCol.classList = 'col-4 col-lg-2'
  cardBody.appendChild(orderButtonRightCol)

  const orderButtonRight = document.createElement('button')
  orderButtonRight.classList = 'btn btn-info btn-sm w-100'
  orderButtonRight.innerHTML = '▼'
  orderButtonRight.addEventListener('click', (event) => {
    changeLanguageOrder(code, 1)
  })
  orderButtonRightCol.appendChild(orderButtonRight)

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-4 col-lg-2'
  cardBody.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm w-100'
  deleteButton.innerHTML = '×'
  deleteButton.addEventListener('click', (event) => {
    deleteLanguage(code)
  })
  deleteCol.appendChild(deleteButton)

  document.getElementById('languageList').appendChild(col)
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
exSetup.createLanguagePicker('language-select', addLanguage)

// Add event listeners
// -------------------------------------------------------------

// Main buttons

// Content
document.getElementById('addItemButton').addEventListener('click', (event) => {
  addItem()
})
document.getElementById('imagePairMaxNumberWarningDismissButton').addEventListener('click', (ev) => {
  console.log(ev.target)
  ev.target.parentElement.style.display = 'none'
})

// Style fields
document.querySelectorAll('.coloris').forEach((element) => {
  element.addEventListener('change', function () {
    const value = this.value.trim()
    const property = this.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['style', 'color', property], value)
    exSetup.previewDefinition(true)
  })
})

// Font fields
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
