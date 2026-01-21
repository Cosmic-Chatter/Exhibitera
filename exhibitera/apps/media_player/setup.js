/* global bootstrap */

import exConfig from '../../common/config.js'
import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exMarkdown from '../js/exhibitera_setup_markdown.js'

async function initializeWizard () {
  // Set up the wizard

  exSetup.prepareWizard()

  // Reset fields
  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
}

function wizardPopulateContent (files, clear = false) {
  // Take an array of files and build an HTML representation for the wizard.

  document.getElementById('wizardMediaBlankWarning').style.display = 'none'

  const wizardContentRow = document.getElementById('wizardContentRow')
  let fileList = JSON.parse(wizardContentRow.dataset?.files ?? '[]')
  if (clear) {
    fileList = files
  } else {
    for (const filename of files) {
      if (!fileList.includes(filename)) fileList.push(filename)
    }
  }
  wizardContentRow.dataset.files = JSON.stringify(fileList)

  wizardContentRow.innerText = ''

  for (const filename of fileList) {
    const col = document.createElement('div')
    col.classList = 'col px-3'
    wizardContentRow.appendChild(col)

    const row = document.createElement('div')
    row.classList = 'row border rounded py-2'
    col.appendChild(row)

    const thumbCol = document.createElement('div')
    thumbCol.classList = 'col-12'
    row.appendChild(thumbCol)

    let thumb
    if (exFiles.guessMimetype(filename) === 'video') {
      thumb = document.createElement('video')
      thumb.classList = 'w-100 rounded'
      thumb.loop = true
      thumb.muted = true
      thumb.controls = false
      thumb.autoplay = true
      thumb.disablePictureInPicture = true
      thumb.disableremoteplayback = true
    } else {
      thumb = document.createElement('img')
      thumb.classList = 'w-100 rounded'
    }
    thumb.src = exConfig.api + '/files/' + filename + '/thumbnail'
    thumbCol.appendChild(thumb)

    const titleCol = document.createElement('div')
    titleCol.classList = 'col-12 text-center my-2 text-break'
    titleCol.innerText = filename
    row.appendChild(titleCol)

    const buttonCol = document.createElement('div')
    buttonCol.classList = 'col-12 d-flex justify-content-between'
    row.appendChild(buttonCol)

    const leftButton = document.createElement('button')
    leftButton.classList = 'btn btn-sm btn-outline-info'
    leftButton.style.width = '30%'
    leftButton.innerText = '◀'
    leftButton.addEventListener('click', (ev) => {
      wizardRearrageFiles(filename, 'left')
    })
    buttonCol.appendChild(leftButton)

    const rightButton = document.createElement('button')
    rightButton.classList = 'btn btn-sm btn-outline-info'
    rightButton.style.width = '30%'
    rightButton.innerText = '▶'
    rightButton.addEventListener('click', (ev) => {
      wizardRearrageFiles(filename, 'right')
    })
    buttonCol.appendChild(rightButton)

    const deleteButton = document.createElement('button')
    deleteButton.classList = 'btn btn-sm btn-outline-danger'
    deleteButton.style.width = '30%'
    deleteButton.innerText = '✕'
    deleteButton.addEventListener('click', () => {
      const wizardContentRow = document.getElementById('wizardContentRow')
      const arr = JSON.parse(wizardContentRow.dataset?.files ?? '[]')
      wizardPopulateContent(arr.filter(item => item !== filename), true)
    })
    buttonCol.appendChild(deleteButton)
  }
}

function wizardRearrageFiles (value, direction) {
  const wizardContentRow = document.getElementById('wizardContentRow')
  const arr = JSON.parse(wizardContentRow.dataset?.files ?? '[]')

  const index = arr.indexOf(value)
  if (index === -1) return arr // not found

  const isLeft = direction === 'left'
  const isRight = direction === 'right'

  if (!isLeft && !isRight) return arr // invalid direction

  const newIndex = isLeft ? index - 1 : index + 1

  // boundary check
  if (newIndex < 0 || newIndex >= arr.length) return arr

  // swap
  const temp = arr[newIndex]
  arr[newIndex] = arr[index]
  arr[index] = temp

  wizardPopulateContent(arr, true)
}

async function wizardForward (currentPage) {
  // Check if the wizard is ready to advance and perform the move

  if (currentPage === 'Welcome') {
    const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
    if (defName !== '') {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
      exSetup.wizardGoTo('Content')
    } else {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Content') {
    const wizardContentRow = document.getElementById('wizardContentRow')
    if (wizardContentRow.children.length === 0) {
      document.getElementById('wizardMediaBlankWarning').style.display = 'block'
      return
    } else document.getElementById('wizardMediaBlankWarning').style.display = 'none'

    // Check if there are images or 3D models which need a duration set.
    const files = JSON.parse(wizardContentRow.dataset?.files ?? '[]')

    if (files.length === 1) {
      document.getElementById('wizardDurationSlider').value = 30
      wizardCreateDefinition()
    } else {
      let timedFile = false
      for (const file of files) {
        if (['model', 'image'].includes(exFiles.guessMimetype(file))) timedFile = true
      }
      if (timedFile) {
        exSetup.createAdvancedSlider(document.getElementById('wizardDurationSlider'))
        exSetup.wizardGoTo('Duration')
      } else {
        document.getElementById('wizardDurationSlider').value = 30
        wizardCreateDefinition()
      }
    }
  } else if (currentPage === 'Duration') {
    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Content') {
    exSetup.wizardGoTo('Welcome')
  } else if (currentPage === 'Duration') {
    exSetup.wizardGoTo('Content')
  }
}

async function wizardCreateDefinition () {
  // Use the provided details to build a definition file.

  // Definition name
  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
  exSetup.updateWorkingDefinition(['name'], defName)

  // Cycle the list of files and build an entry for each
  const wizardContentRow = document.getElementById('wizardContentRow')
  const files = JSON.parse(wizardContentRow.dataset?.files ?? '[]')
  const content = {}
  const contentOrder = []
  for (const file of files) {
    const itemUUID = exUtilities.uuid()
    const mimetype = exFiles.guessMimetype(file)

    contentOrder.push(itemUUID)
    content[itemUUID] = {
      filename: file,
      mimetype,
      type: 'file',
      uuid: itemUUID
    }

    // Handle mimetype-specific attributes
    if (mimetype === 'image') {
      content[itemUUID].duration = parseFloat(document.getElementById('wizardDurationSlider').value)
      content[itemUUID].fill_mode = 'contain'
    } else if (mimetype === 'video') {
      content[itemUUID].fill_mode = 'contain'
    } else if (mimetype === 'model') {
      content[itemUUID].duration = parseFloat(document.getElementById('wizardDurationSlider').value)
    }
  }
  exSetup.updateWorkingDefinition(['content'], content)
  exSetup.updateWorkingDefinition(['content_order'], contentOrder)

  const uuid = exSetup.config.workingDefinition.uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('media_player')
  exSetup.populateAvailableDefinitions(result.definitions)
  document.getElementById('availableDefinitionSelect').value = uuid

  editDefinition(uuid)
  exUtilities.hideModal('#setupWizardModal')
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) exSetup.initializeDefinition()

  // Definition details
  document.getElementById('definitionNameInput').value = ''

  // Reset style options
  document.getElementById('showProgressCheckbox').checked = false
  document.getElementById('progressIndicatorPosSelect').value = 'bottom_left'
  document.getElementById('progressIndicatorSizeSelect').value = '1'
  document.getElementById('progressIndicatorPosCol').style.display = 'none'
  document.getElementById('progressIndicatorSizeCol').style.display = 'none'

  const colorInputs = ['subtitleColor', 'progressBackgroundColor', 'progressInactiveColor', 'progressActiveColor']
  colorInputs.forEach((input) => {
    const el = document.getElementById('colorPicker_' + input)
    el.value = el.getAttribute('data-default')
    document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
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
  document.getElementById('subtitleTextSizeSlider').value = 0

  document.getElementById('itemList').innerHTML = ''
  const watermarkSelect = document.getElementById('watermarkSelect')
  watermarkSelect.innerHTML = 'Select file'
  watermarkSelect.setAttribute('data-filename', '')
  exSetup.createAdvancedSliders()
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
  rebuildItemList()

  // Progress indicator
  document.getElementById('showProgressCheckbox').checked = def?.behavior?.progress_indicator?.visible ?? false
  const posCol = document.getElementById('progressIndicatorPosCol')
  const sizeCol = document.getElementById('progressIndicatorSizeCol')
  if (def?.behavior?.progress_indicator?.visible ?? false) {
    posCol.style.display = 'block'
    sizeCol.style.display = 'block'
  } else {
    posCol.style.display = 'none'
    sizeCol.style.display = 'none'
  }

  document.getElementById('progressIndicatorPosSelect').value = def?.behavior?.progress_indicator?.position ?? 'bottom_left'
  document.getElementById('progressIndicatorSizeSelect').value = def?.behavior?.progress_indicator?.size ?? '1'

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background)
  exSetup.updateColorPickers(def?.style?.color ?? {})
  exSetup.updateAdvancedFontPickers(def?.style?.font ?? {})
  exSetup.updateTextSizeSliders(def?.style?.text_size ?? {}, { mode: 'color', color: '#000' })

  // Set the appropriate values for the watermark
  if ((def?.watermark?.file ?? '') !== '') {
    const watermarkSelect = document.getElementById('watermarkSelect')
    watermarkSelect.innerHTML = def.watermark.file
    watermarkSelect.setAttribute('data-filename', def.watermark.file)
  }
  exSetup.createAdvancedSlider(document.getElementById('watermarkXPos'), def?.watermark?.x_position)
  exSetup.createAdvancedSlider(document.getElementById('watermarkYPos'), def?.watermark?.y_position)
  exSetup.createAdvancedSlider(document.getElementById('watermarkSize'), def?.watermark?.size)
  exSetup.createAdvancedSlider(document.getElementById('watermarkOpacity'), def?.watermark?.opacity)

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
}

function createThumbnail () {
  // Ask the helper to createa video thumbnail based on the thumbnails of all the selected media.

  const workingDefinition = exSetup.config.workingDefinition
  const files = []
  for (const uuid of workingDefinition?.content_order ?? []) {
    if (exFiles.guessMimetype(workingDefinition.content[uuid].filename) === 'audio') {
      // Pass
    } else if (exFiles.guessMimetype(workingDefinition.content[uuid].filename) === 'model') {
      // Pass
    } else {
      files.push(workingDefinition.content[uuid].filename)
    }
  }

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/files/thumbnailVideoFromFrames',
    params: {
      filename: workingDefinition.uuid,
      frames: files
    }
  })
}

function addItem () {
  // Add an item to the working defintiion

  const workingDefinition = exSetup.config.workingDefinition

  const item = {
    uuid: exUtilities.uuid(),
    filename: '',
    duration: 30
  }
  workingDefinition.content[item.uuid] = item
  workingDefinition.content_order.push(item.uuid)

  createItemHTML(item, workingDefinition.content_order.length)
}

function createItemHTML (item, num) {
  // Add a blank item to the itemList

  const itemCol = document.createElement('div')
  itemCol.classList = 'col-12 content-item'
  itemCol.setAttribute('id', 'Item_' + item.uuid)

  const card = document.createElement('div')
  card.classList = 'card'
  itemCol.appendChild(card)

  const cardBody = document.createElement('div')
  cardBody.classList = 'card-body row'
  card.appendChild(cardBody)

  const numberCol = document.createElement('div')
  numberCol.classList = 'col-1'
  cardBody.appendChild(numberCol)

  const number = document.createElement('div')
  number.classList = 'w-100 fw-bold h4 mb-3'
  number.innerHTML = num
  numberCol.appendChild(number)

  const nameCol = document.createElement('div')
  nameCol.classList = 'col-10 col-lg-9'
  cardBody.appendChild(nameCol)

  const name = document.createElement('div')
  name.classList = 'w-100 file-field'
  name.innerHTML = item.filename
  nameCol.appendChild(name)

  const orderButtonsCol = document.createElement('div')
  orderButtonsCol.classList = 'col-12 col-lg-2 mb-2 mb-lg-0 d-flex align-items-start justify-content-end'
  cardBody.appendChild(orderButtonsCol)

  const orderButtonLeft = document.createElement('button')
  orderButtonLeft.classList = 'btn btn-outline-info btn-sm'
  orderButtonLeft.innerHTML = '▲'
  orderButtonLeft.setAttribute('data-bs-toggle', 'tooltip')
  orderButtonLeft.setAttribute('title', 'Move item up')
  orderButtonLeft.addEventListener('click', (event) => {
    changeItemOrder(item.uuid, -1)
  })
  orderButtonsCol.appendChild(orderButtonLeft)

  const orderButtonRight = document.createElement('button')
  orderButtonRight.classList = 'btn btn-outline-info btn-sm ms-1'
  orderButtonRight.innerHTML = '▼'
  orderButtonRight.setAttribute('data-bs-toggle', 'tooltip')
  orderButtonRight.setAttribute('title', 'Move item down')
  orderButtonRight.addEventListener('click', (event) => {
    changeItemOrder(item.uuid, 1)
  })
  orderButtonsCol.appendChild(orderButtonRight)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-outline-danger btn-sm ms-3'
  deleteButton.innerHTML = 'Delete'
  deleteButton.addEventListener('click', (event) => {
    deleteitem(item.uuid)
  })
  orderButtonsCol.appendChild(deleteButton)

  const previewCol = document.createElement('div')
  previewCol.classList = 'col-12 col-md-6'
  cardBody.appendChild(previewCol)

  const image = document.createElement('img')
  image.classList = 'image-preview'
  image.style.maxHeight = '200px'
  image.style.width = '100%'
  image.style.objectFit = 'contain'
  image.style.display = 'none'
  previewCol.appendChild(image)

  const video = document.createElement('video')
  video.classList = 'video-preview'
  video.style.maxHeight = '200px'
  video.style.width = '100%'
  video.style.display = 'none'
  video.style.objectFit = 'contain'
  video.setAttribute('autoplay', true)
  video.muted = 'true'
  video.setAttribute('loop', 'true')
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('disablePictureInPicture', 'true')
  previewCol.appendChild(video)

  const selectButtonCol = document.createElement('div')
  selectButtonCol.classList = 'col-12 mt-2'
  previewCol.appendChild(selectButtonCol)

  const selectDropdown = document.createElement('div')
  selectDropdown.classList = 'dropdown w-100'
  selectButtonCol.appendChild(selectDropdown)

  const selectButton = document.createElement('button')
  selectButton.classList = 'btn btn-primary dropdown-toggle w-100'
  selectButton.setAttribute('type', 'button')
  selectButton.setAttribute('data-bs-toggle', 'dropdown')
  selectButton.setAttribute('aria-expanded', false)
  selectButton.innerHTML = 'Select media'
  selectDropdown.appendChild(selectButton)

  const selectMenu = document.createElement('ul')
  selectMenu.classList = 'dropdown-menu'
  selectDropdown.appendChild(selectMenu)

  const li1 = document.createElement('li')
  const li2 = document.createElement('li')
  selectMenu.appendChild(li1)
  selectMenu.appendChild(li2)

  const selectFile = document.createElement('a')
  selectFile.classList = 'dropdown-item'
  selectFile.innerHTML = 'From file'
  selectFile.style.cursor = 'pointer'
  selectFile.addEventListener('click', () => {
    exFileSelect.createFileSelectionModal({
      filetypes: ['audio', 'image', 'video', 'glb', 'mtl', 'obj'],
      multiple: false
    })
      .then((result) => {
        const file = result[0]
        if (file == null) return
        setItemContent(item.uuid, cardBody, file)
      })
  })
  li1.appendChild(selectFile)

  const selectURL = document.createElement('a')
  selectURL.classList = 'dropdown-item'
  selectURL.innerHTML = 'From URL'
  selectURL.style.cursor = 'pointer'
  selectURL.addEventListener('click', () => {
    showChooseURLModal(item.uuid)
  })
  li1.appendChild(selectURL)

  // Cache
  const cacheCol = document.createElement('div')
  cacheCol.classList = 'col-12 mt-2 cache-col'
  previewCol.appendChild(cacheCol)

  const cacheGroup = document.createElement('div')
  cacheGroup.classList = 'form-check'
  cacheCol.appendChild(cacheGroup)

  const cacheCheck = document.createElement('input')
  cacheCheck.classList = 'form-check-input'
  cacheCheck.setAttribute('type', 'checkbox')
  if ('no_cache' in item && item.no_cache === true) cacheCheck.checked = true
  cacheCheck.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['content', item.uuid, 'no_cache'], cacheCheck.checked)
    exSetup.previewDefinition(true)
  })
  cacheGroup.appendChild(cacheCheck)

  const cacheLabel = document.createElement('label')
  cacheLabel.classList = 'form-check-label'
  cacheLabel.innerHTML = `
  Disable cache
  <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="Force the media to reload every time. Choose this option only if the media will change. Please respect usage limits for linked media." style="font-size: 0.55em;">?</span>
  `
  cacheGroup.appendChild(cacheLabel)

  const modifyPane = document.createElement('div')
  modifyPane.classList = 'col-12 col-md-6'
  cardBody.appendChild(modifyPane)

  const modifyRow = document.createElement('div')
  modifyRow.classList = 'row gy-2'
  modifyPane.appendChild(modifyRow)

  // Fill mode
  const fillCol = document.createElement('div')
  fillCol.classList = 'col-12 mt-2 fill-col'
  modifyRow.appendChild(fillCol)

  const fillLabel = document.createElement('label')
  fillLabel.classList = 'form-label'
  fillLabel.innerText = 'Fill mode'
  fillCol.appendChild(fillLabel)

  const fillSelect = document.createElement('select')
  fillSelect.classList = 'form-select'
  fillSelect.appendChild(new Option('Show entire image', 'contain'))
  fillSelect.appendChild(new Option('Fill entire screen', 'cover'))
  fillSelect.addEventListener('change', (ev) => {
    exSetup.updateWorkingDefinition(['content', item.uuid, 'fill_mode'], ev.target.value)
    exSetup.previewDefinition(true)
  })
  fillCol.appendChild(fillSelect)

  if (['image', 'video'].includes(exFiles.guessMimetype(item.filename))) {
    fillCol.style.display = 'block'
  } else {
    fillCol.style.display = 'none'
  }

  // Duration
  const durationCol = document.createElement('div')
  durationCol.classList = 'col-12 col-lg-6 mt-2 duration-col'
  modifyRow.appendChild(durationCol)

  const durationLabel = document.createElement('label')
  durationLabel.classList = 'form-label'
  durationLabel.innerHTML = `
  Duration
  <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="The number of seconds the media should be displayed." style="font-size: 0.55em;">?</span>
  `
  durationCol.appendChild(durationLabel)

  const durationInput = document.createElement('input')
  durationInput.classList = 'form-control'
  durationInput.setAttribute('placeholder', 30)
  durationInput.setAttribute('min', 1)
  durationInput.setAttribute('type', 'number')
  durationInput.value = item.duration
  durationInput.addEventListener('input', (event) => {
    const inputStr = event.target.value
    let durationVal
    if (inputStr.trim() === '') {
      durationVal = 30
    } else {
      durationVal = parseFloat(inputStr)
    }
    exSetup.updateWorkingDefinition(['content', item.uuid, 'duration'], durationVal)
    exSetup.previewDefinition(true)
  })

  durationCol.appendChild(durationInput)
  if (['image', 'model'].includes(exFiles.guessMimetype(item.filename))) {
    durationCol.style.display = 'block'
  } else {
    durationCol.style.display = 'none'
  }

  // Rotation
  const rotationCol = document.createElement('div')
  rotationCol.classList = 'col-12 col-lg-6 mt-2 rotation-col'
  modifyRow.appendChild(rotationCol)

  const rotationLabel = document.createElement('label')
  rotationLabel.classList = 'form-label'
  rotationLabel.innerHTML = `
  Rotations
  <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="The number of rotations of the model to perform." style="font-size: 0.55em;">?</span>
  `
  rotationCol.appendChild(rotationLabel)

  const rotationInput = document.createElement('input')
  rotationInput.classList = 'form-control'
  rotationInput.setAttribute('placeholder', 0)
  rotationInput.setAttribute('min', 0)
  rotationInput.setAttribute('type', 'number')
  rotationInput.value = item.rotations
  rotationInput.addEventListener('input', (event) => {
    const inputStr = event.target.value
    let rotationVal
    if (inputStr.trim() === '') {
      rotationVal = 0
    } else {
      rotationVal = parseFloat(inputStr)
    }
    exSetup.updateWorkingDefinition(['content', item.uuid, 'rotations'], rotationVal)
    exSetup.previewDefinition(true)
  })
  rotationCol.appendChild(rotationInput)
  if (['model'].includes(exFiles.guessMimetype(item.filename))) {
    rotationCol.style.display = 'block'
  } else {
    rotationCol.style.display = 'none'
  }

  // Material
  const materialCol = document.createElement('div')
  materialCol.classList = 'col-12 mt-2 material-col'
  modifyRow.appendChild(materialCol)

  const materialRow = document.createElement('div')
  materialRow.classList = 'row'
  materialCol.appendChild(materialRow)

  const materialInputCol = document.createElement('div')
  materialInputCol.classList = 'col-9 mt-2 pe-1'
  materialRow.appendChild(materialInputCol)

  const materialLabel = document.createElement('label')
  materialLabel.classList = 'form-label'
  materialLabel.innerHTML = `
  Material
  <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="An optional .mtl texture file for the object." style="font-size: 0.55em;">?</span>
  `
  materialInputCol.appendChild(materialLabel)

  const materialInput = document.createElement('button')
  materialInput.classList = 'btn btn-outline-primary w-100'
  if (('material' in item) && (item.material !== '') && (item.material != null)) {
    materialInput.innerHTML = item.material
  } else {
    materialInput.innerHTML = 'Select material'
  }
  materialInputCol.appendChild(materialInput)

  materialInput.addEventListener('click', () => {
    exFileSelect.createFileSelectionModal({
      filetypes: ['mtl'],
      multiple: false
    }).then((files) => {
      const file = files[0]
      exSetup.updateWorkingDefinition(['content', item.uuid, 'material'], file)
      exSetup.previewDefinition(true)
      materialInput.innerHTML = file
    })
  })

  const materialClearCol = document.createElement('div')
  materialClearCol.classList = 'col-3 ps-1 mt-2 d-flex align-items-end'
  materialRow.appendChild(materialClearCol)

  const materialClear = document.createElement('button')
  materialClear.classList = 'btn btn-danger w-100'
  materialClear.innerHTML = '×'
  materialClearCol.appendChild(materialClear)
  materialClear.addEventListener('click', () => {
    exSetup.updateWorkingDefinition(['content', item.uuid, 'material'], '')
    exSetup.previewDefinition(true)
    materialInput.innerHTML = 'Select material'
  })

  if (item.filename.toLowerCase().endsWith('obj')) {
    materialCol.style.display = 'block'
  } else {
    materialCol.style.display = 'none'
  }

  const subtitleCol = document.createElement('div')
  subtitleCol.classList = 'col-12 subtitle-col'
  modifyRow.appendChild(subtitleCol)

  const subtitleButton = document.createElement('button')
  subtitleButton.classList = 'btn btn-primary w-100'
  subtitleButton.setAttribute('id', 'subttileButton_' + item.uuid)
  if ((item?.subtitles?.filename ?? '') !== '') {
    subtitleButton.innerHTML = 'Configure subtitles'
  } else {
    subtitleButton.innerHTML = 'Add subtitles'
  }
  subtitleButton.addEventListener('click', () => {
    showConfigureSubtitlesModal(item.uuid)
  })
  subtitleCol.appendChild(subtitleButton)
  if ((item?.mimetype ?? exFiles.guessMimetype(item.filename)) !== 'video') {
    subtitleCol.style.display = 'none'
  }

  const annotateCol = document.createElement('div')
  annotateCol.classList = 'col-12'
  modifyRow.appendChild(annotateCol)

  const annotateDropdown = document.createElement('div')
  annotateDropdown.classList = 'dropdown w-100'
  annotateCol.appendChild(annotateDropdown)

  const annotatebutton = document.createElement('button')
  annotatebutton.classList = 'btn btn-primary dropdown-toggle w-100 mt-2'
  annotatebutton.setAttribute('type', 'button')
  annotatebutton.setAttribute('data-bs-toggle', 'dropdown')
  annotatebutton.setAttribute('aria-expanded', false)
  annotatebutton.innerHTML = 'Add annotation'
  annotateDropdown.appendChild(annotatebutton)

  const annotateMenu = document.createElement('ul')
  annotateMenu.classList = 'dropdown-menu'
  annotateDropdown.appendChild(annotateMenu)

  const annotateLi1 = document.createElement('li')
  const annotateLi2 = document.createElement('li')
  annotateMenu.appendChild(annotateLi1)
  annotateMenu.appendChild(annotateLi2)

  const annotateTextAction = document.createElement('button')
  annotateTextAction.classList = 'dropdown-item'
  annotateTextAction.innerHTML = 'Enter text'
  annotateTextAction.addEventListener('click', () => {
    addTextAnnotation(item.uuid)
  })
  annotateLi2.appendChild(annotateTextAction)

  const annotateJSONAction = document.createElement('button')
  annotateJSONAction.classList = 'dropdown-item'
  annotateJSONAction.innerHTML = 'From JSON'
  annotateJSONAction.addEventListener('click', () => {
    showAnnotateFromJSONModal(item.uuid)
  })
  annotateLi2.appendChild(annotateJSONAction)

  const annotationsPane = document.createElement('div')
  annotationsPane.classList = 'col-12 mt-2'
  cardBody.appendChild(annotationsPane)

  const annotationsRow = document.createElement('div')
  annotationsRow.classList = 'row gy-2'
  annotationsRow.setAttribute('id', 'annotationRow_' + item.uuid)
  annotationsPane.appendChild(annotationsRow)

  if (item.filename !== '') setItemContent(item.uuid, itemCol, item.filename, item.type)

  document.getElementById('itemList').appendChild(itemCol)

  // Annotations
  for (const key of Object.keys(item?.annotations ?? {})) {
    createAnnoationHTML(item.uuid, item.annotations[key])
  }

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function showConfigureSubtitlesModal (itemUUID) {
  // Prepare and show the modal for setting up video subtitles.

  const modal = document.getElementById('configureSubtitlesModal')
  const selectButton = document.getElementById('configureSubtitlesModalSelectButton')

  modal.setAttribute('data-uuid', itemUUID)

  // Add any existing subtitles
  if (exSetup.config.workingDefinition?.content?.[itemUUID]?.subtitles?.filename) {
    selectButton.innerHTML = exSetup.config.workingDefinition.content[itemUUID].subtitles.filename
  } else {
    selectButton.innerHTML = 'Select subtitles file'
  }

  exUtilities.showModal(modal)
}

function selectSubtitlesFile () {
  // Prompt the user to select a file and configure the subtitle modal based on it.

  const modal = document.getElementById('configureSubtitlesModal')

  exFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['vtt'] })
    .then((files) => {
      if (files.length === 0) return

      document.getElementById('configureSubtitlesModalSelectButton').innerText = files[0]
      modal.dataset.filename = files[0]
    })
}

function submitSubtitlesFromModal () {
  // Gather subtitle information and update the definition.

  const modal = document.getElementById('configureSubtitlesModal')
  const itemUUID = modal.dataset.uuid
  const filename = modal.dataset.filename

  exSetup.updateWorkingDefinition(['content', itemUUID, 'subtitles', 'filename'], filename)
  exSetup.previewDefinition(true)
  exUtilities.hideModal(modal)
}

function showAnnotateFromJSONModal (itemUUID, annotationUUID = null) {
  // Prepare and show the modal for creating an annotation from JSON.

  const urlInput = document.getElementById('annotateFromJSONModalURLInput')
  const path = document.getElementById('annotateFromJSONModalPath')
  const title = document.getElementById('annotateFromJSONModalTitle')
  const button = document.getElementById('annotateFromJSONModalSubmitButton')
  document.getElementById('annotateFromJSONModalTreeView').innerText = ''
  path.setAttribute('data-itemUUID', itemUUID)

  if (annotationUUID != null) {
    // We are editing rather than creating new

    const details = exSetup.config.workingDefinition.content[itemUUID].annotations[annotationUUID]
    title.innerText = 'Update a JSON annotation'
    button.innerText = 'Update'
    path.value = details.path.join(' > ')
    if (details.type === 'url') {
      urlInput.value = details.file
    }

    path.setAttribute('data-annotationUUID', annotationUUID)
    populateAnnotateFromJSONModal(details.file, details.type)
  } else {
    // We are creating a new annotation
    title.innerHTML = 'Create an annotation from JSON'
    button.innerHTML = 'Create'
    urlInput.value = ''
    path.value = ''
    path.setAttribute('data-annotationUUID', '')
  }

  exUtilities.showModal('#annotateFromJSONModal')
}

function populateAnnotateFromJSONModal (file, type = 'file') {
  // Retrieve the given JSON file and parse it into a tree.
  // 'type' should be one of [file | url]

  // Store the file for later use.
  const el = document.getElementById('annotateFromJSONModalPath')
  el.dataset.file = file
  el.dataset.type = type

  const parent = document.getElementById('annotateFromJSONModalTreeView')
  parent.innerHTML = ''

  if (type === 'file') {
    exCommon.makeHelperRequest({
      method: 'GET',
      api: '',
      endpoint: '/content/' + file,
      noCache: true
    })
      .then((text) => {
        createTreeSubEntries(parent, text)
      })
  } else if (type === 'url') {
    fetch(file)
      .then(response => {
        if (!response.ok) {
          throw new Error(response.statusText || 'Fetch error')
        }
        return response.json()
      })
      .then(text => {
        createTreeSubEntries(parent, text)
      })
      .catch(error => {
        console.log(error)
        if (error.message === 'Not Found') {
          parent.innerHTML = 'The entered URL is unreachable.'
        } else if (error.message === 'Unexpected token' || error instanceof SyntaxError) {
          parent.innerHTML = 'The entered URL does not return valid JSON.'
        } else {
          parent.innerHTML = 'An unknown error has occurred. This often occurs because a CORS request has been blocked. Make sure the server you are accessing allows cross-origin requests.'
        }
      })
  }
}

function createTreeSubEntries (parent, dict, path = []) {
  // Take the keys of the given dict and turn them into <li> elements,
  // creating sub-trees with recursive calls.
  // 'path' gives the hierarchy of keys to reach 'dict'

  for (const key of Object.keys(dict)) {
    const li = document.createElement('li')
    if (typeof dict[key] === 'object') {
      // A nested dict
      const name = document.createElement('span')
      name.classList = 'caret'
      name.innerHTML = key
      li.appendChild(name)
      const ul = document.createElement('ul')
      ul.classList = 'nested'
      name.addEventListener('click', function () {
        ul.classList.toggle('active')
        this.classList.toggle('caret-down')
      })
      li.appendChild(ul)
      createTreeSubEntries(ul, dict[key], [...path, key])
    } else {
      const span = document.createElement('span')
      span.innerHTML = `<u>${key}</u>: ${dict[key]}`
      span.style.cursor = 'pointer'
      span.addEventListener('click', () => {
        selectAnnotationJSONPath([...path, key])
      })
      li.appendChild(span)
    }
    parent.appendChild(li)
  }
}

function selectAnnotationJSONPath (path) {
  // Called when a field is clicked in the JSON tree view

  const el = document.getElementById('annotateFromJSONModalPath')
  el.value = path.join(' > ')
  el.dataset.path = JSON.stringify(path)
}

function addTextAnnotation (itemUUID) {
  // Create a blank text annotation

  const annotationUUID = exUtilities.uuid()
  const annotation = {
    uuid: annotationUUID,
    text: '',
    type: 'text'
  }
  createAnnoationHTML(itemUUID, annotation)

  const annotations = exSetup.config.workingDefinition?.content?.[itemUUID]?.annotations ?? {}
  annotations[annotationUUID] = annotation

  exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations'], annotations)
  exSetup.previewDefinition(true)
}

function addAnnotationFromModal () {
  // Collect the needed information and add the annotation.

  const workingDefinition = exSetup.config.workingDefinition

  const el = document.getElementById('annotateFromJSONModalPath')
  const itemUUID = el.getAttribute('data-itemUUID')
  const path = JSON.parse(el.getAttribute('data-path'))
  const file = el.dataset.file
  const type = el.dataset.type
  let annotationUUID = el.getAttribute('data-annotationUUID')
  let annotation

  if ((annotationUUID == null) || (annotationUUID === '')) {
    // We are creating a new annotation.
    annotationUUID = exUtilities.uuid()
    annotation = {
      uuid: annotationUUID,
      path,
      file,
      type
    }
    createAnnoationHTML(itemUUID, annotation)
  } else {
    // We are editing an existing annotation.
    annotation = workingDefinition.content[itemUUID].annotations[annotationUUID]
    annotation.path = path
    annotation.file = file
    annotation.type = type
    document.getElementById('Annotation' + annotation.uuid + 'Title').innerHTML = '<b>Annotation: </b>' + path.slice(-1)
  }

  const annotations = workingDefinition?.content?.[itemUUID]?.annotations ?? {}
  annotations[annotationUUID] = annotation

  exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations'], annotations)
  exSetup.previewDefinition(true)
  document.getElementById('annotateFromJSONModalTreeView').innerText = ''
  exUtilities.hideModal('#annotateFromJSONModal')
}

async function createAnnoationHTML (itemUUID, details) {
  // Create the HTML represetnation of an annotation and add it to the item.

  const col = document.createElement('div')
  col.classList = 'col-12 border rounded py-2'
  col.setAttribute('id', 'Annotation' + details.uuid)

  const row = document.createElement('div')
  row.classList = 'row gy-2'
  col.appendChild(row)

  const title = document.createElement('div')
  title.classList = 'col-10 offset-1 text-center'
  title.setAttribute('id', 'Annotation' + details.uuid + 'Title')
  let titleText
  if (details.type === 'text') {
    titleText = '<b>Text Annotation: </b>' + exMarkdown.formatText(details.text, { removeParagraph: true, string: true })
  } else titleText = '<b>JSON Annotation: </b>' + details.path.slice(-1)
  title.innerHTML = titleText
  row.appendChild(title)

  const actionCol = document.createElement('div')
  actionCol.classList = 'col-1 ps-0 pe-1'
  row.appendChild(actionCol)

  const actionDropdown = document.createElement('div')
  actionDropdown.classList = 'dropdown w-100'
  actionCol.appendChild(actionDropdown)

  const actionButton = document.createElement('button')
  actionButton.classList = 'btn px-0 py-0 btn-outline-secondary btn-sm dropdown-toggle w-100'
  actionButton.setAttribute('type', 'button')
  actionButton.setAttribute('data-bs-toggle', 'dropdown')
  actionButton.setAttribute('aria-expanded', false)
  actionDropdown.appendChild(actionButton)

  const actionMenu = document.createElement('ul')
  actionMenu.classList = 'dropdown-menu'
  actionDropdown.appendChild(actionMenu)

  const li1 = document.createElement('li')
  const li2 = document.createElement('li')
  actionMenu.appendChild(li1)
  actionMenu.appendChild(li2)

  if (['file', 'url'].includes(details.type)) {
    const editAction = document.createElement('a')
    editAction.classList = 'dropdown-item text-info'
    editAction.innerHTML = 'Edit JSON field'
    editAction.style.cursor = 'pointer'
    editAction.addEventListener('click', () => {
      showAnnotateFromJSONModal(itemUUID, details.uuid)
    })
    li1.appendChild(editAction)
  }

  const deleteAction = document.createElement('a')
  deleteAction.classList = 'dropdown-item text-danger'
  deleteAction.innerText = 'Delete'
  deleteAction.style.cursor = 'pointer'
  deleteAction.addEventListener('click', () => {
    document.getElementById('deleteAnnotationModal').setAttribute('data-annotationUUID', details.uuid)
    document.getElementById('deleteAnnotationModal').setAttribute('data-itemUUID', itemUUID)
    exUtilities.showModal('#deleteAnnotationModal')
  })
  li1.appendChild(deleteAction)

  if (details.type === 'text') {
    const textCol = document.createElement('div')
    textCol.classList = 'col-12 col-lg-8'
    row.appendChild(textCol)

    const textLabel = document.createElement('label')
    textLabel.classList = 'form-label'
    textLabel.innerText = 'Text'
    textCol.appendChild(textLabel)

    const textCommandBar = document.createElement('div')
    textCol.appendChild(textCommandBar)

    const textInput = document.createElement('div')
    textCol.appendChild(textInput)

    const textEditor = new exMarkdown.ExhibiteraMarkdownEditor({
      content: details?.text ?? '',
      editorDiv: textInput,
      commandDiv: textCommandBar,
      commands: ['basic'],
      callback: (content) => {
        exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'text'], content)
        exSetup.previewDefinition(true)
        title.innerHTML = '<b>Text Annotation: </b>' + exMarkdown.formatText(content, { removeParagraph: true, string: true })
      }
    })
  }

  const alignCol = document.createElement('div')
  alignCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(alignCol)

  const alignDiv = document.createElement('div')
  alignDiv.classList = 'w-100'
  alignCol.appendChild(alignDiv)

  const alignLabel = document.createElement('label')
  alignLabel.classList = 'form-label'
  alignLabel.innerText = 'Text alignment'
  alignLabel.setAttribute('for', 'alignSelect' + details.uuid)
  alignDiv.appendChild(alignLabel)

  const alignSelect = document.createElement('select')
  alignSelect.classList = 'form-select'
  alignSelect.appendChild(new Option('Left', 'left'))
  alignSelect.appendChild(new Option('Center', 'center'))
  alignSelect.appendChild(new Option('Right', 'right'))
  alignSelect.value = details?.align ?? 'left'

  alignSelect.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'align'], event.target.value)
    exSetup.previewDefinition(true)
  })
  alignDiv.appendChild(alignSelect)

  const xPosCol = document.createElement('div')
  xPosCol.classList = 'col-12 col-md-6 col-lg-4 d-flex align-items-end'
  row.appendChild(xPosCol)

  const xPosInput = document.createElement('div')
  xPosInput.classList = 'advanced-slider'
  xPosInput.dataset.name = 'Horizontal position'
  xPosInput.dataset.path = `content>${itemUUID}>annotations>${details.uuid}>x_position`
  xPosInput.dataset.min = '0'
  xPosInput.dataset.max = '100'
  xPosInput.dataset.start = '50'
  xPosInput.dataset.step = '1'
  xPosInput.dataset.unit = '%'
  xPosCol.appendChild(xPosInput)

  const yPosCol = document.createElement('div')
  yPosCol.classList = 'col-12 col-md-6 col-lg-4 d-flex align-items-end'
  row.appendChild(yPosCol)

  const yPosInput = document.createElement('div')
  yPosInput.classList = 'advanced-slider'
  yPosInput.dataset.name = 'Vertical position'
  yPosInput.dataset.path = `content>${itemUUID}>annotations>${details.uuid}>y_position`
  yPosInput.dataset.min = '0'
  yPosInput.dataset.max = '100'
  yPosInput.dataset.start = '50'
  yPosInput.dataset.step = '1'
  yPosInput.dataset.unit = '%'
  yPosCol.appendChild(yPosInput)

  const fontSizeCol = document.createElement('div')
  fontSizeCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(fontSizeCol)

  const fontSizeDiv = document.createElement('div')
  fontSizeCol.appendChild(fontSizeDiv)

  const fontSizeLabel = document.createElement('label')
  fontSizeLabel.classList = 'form-label'
  fontSizeLabel.innerText = 'Text size'
  fontSizeLabel.setAttribute('for', 'fontSizeInput' + details.uuid)
  fontSizeDiv.appendChild(fontSizeLabel)

  const fontSizeInput = document.createElement('input')
  fontSizeInput.classList = 'form-control'
  fontSizeInput.setAttribute('type', 'number')
  fontSizeInput.setAttribute('id', 'fontSizeInput' + details.uuid)
  fontSizeInput.setAttribute('min', '1')
  fontSizeInput.setAttribute('step', '1')
  fontSizeInput.value = details?.font_size ?? 20

  fontSizeInput.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'font_size'], event.target.value)
    exSetup.previewDefinition(true)
  })
  fontSizeDiv.appendChild(fontSizeInput)

  const fontColorCol = document.createElement('div')
  fontColorCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(fontColorCol)

  const fontColorDiv = document.createElement('div')
  fontColorCol.appendChild(fontColorDiv)

  const fontColorLabel = document.createElement('label')
  fontColorLabel.classList = 'form-label'
  fontColorLabel.innerText = 'Text color'
  fontColorLabel.setAttribute('for', 'fontColorInput' + details.uuid)
  fontColorDiv.appendChild(fontColorLabel)

  const fontColorInput = document.createElement('input')
  fontColorInput.classList = 'coloris'
  fontColorInput.style.height = '35px'
  fontColorInput.setAttribute('id', 'fontColorInput' + details.uuid)
  fontColorInput.value = details?.color ?? 'black'

  fontColorInput.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'color'], event.target.value)
    exSetup.previewDefinition(true)
  })
  fontColorDiv.appendChild(fontColorInput)
  // setTimeout(exSetup.setUpColorPickers, 2000)

  const fontFaceCol = document.createElement('div')
  fontFaceCol.classList = 'col-12 col-md-6'
  row.appendChild(fontFaceCol)

  document.getElementById('annotationRow_' + itemUUID).appendChild(col)

  // Must be after we had the main element to the DOM
  exSetup.createAdvancedSlider(xPosInput)
  exSetup.createAdvancedSlider(yPosInput)
  exSetup.setUpColorPickers()

  exSetup.createAdvancedFontPicker({
    parent: fontFaceCol,
    name: 'Font',
    path: `content>${itemUUID}>annotations>${details.uuid}>font`,
    default: 'OpenSans-Regular.ttf'
  })
  const font = details.font
  await exSetup.refreshAdvancedFontPickers()
  if (font) {
    exSetup.updateAdvancedFontPickers({ font }, `content>${itemUUID}>annotations>${details.uuid}`)
  }
}

function showChooseURLModal (uuid) {
  // Prepare and show the modal for choosing content from a URL.

  document.getElementById('chooseURLModal').setAttribute('data-uuid', uuid)
  document.getElementById('chooseURLModalInput').value = ''
  document.getElementById('chooseURLModalPreviewVideo').style.display = 'none'
  document.getElementById('chooseURLModalPreviewImage').style.display = 'none'
  document.getElementById('chooseURLModalPreviewAudio').style.display = 'none'
  document.getElementById('chooseURLModalError').style.display = 'none'

  exUtilities.showModal('#chooseURLModal')
}

async function fetchContentFromURL () {
  // From the chooseContentModal, fetch the given link and show a preview.

  const url = document.getElementById('chooseURLModalInput').value.trim()
  const video = document.getElementById('chooseURLModalPreviewVideo')
  const image = document.getElementById('chooseURLModalPreviewImage')
  const audio = document.getElementById('chooseURLModalPreviewAudio')
  const modal = document.getElementById('chooseURLModal')
  const error = document.getElementById('chooseURLModalError')

  const mimetype = exFiles.guessMimetype(url)
  modal.dataset.mimetype = mimetype

  if (mimetype === 'video') {
    video.src = url
    error.style.display = 'none'
    video.style.display = 'block'
    image.style.display = 'none'
    audio.style.display = 'none'
    audio.pause()
  } else if (mimetype === 'image') {
    image.src = url
    error.style.display = 'none'
    video.style.display = 'none'
    image.style.display = 'block'
    audio.style.display = 'none'
    audio.pause()
    video.pause()
  } else if (mimetype === 'audio') {
    audio.src = url
    error.style.display = 'none'
    video.style.display = 'none'
    image.style.display = 'none'
    audio.style.display = 'block'
    video.pause()
  } else {
    modal.setAttribute('data-mimetype', '')
    error.style.display = 'block'
    video.style.display = 'none'
    image.style.display = 'none'
    audio.style.display = 'none'
    audio.pause()
    video.pause()
  }
}

function setContentFromURLModal () {
  // Set the currently selected file as the item's content.

  const url = document.getElementById('chooseURLModalInput').value.trim()
  const uuid = document.getElementById('chooseURLModal').dataset.uuid
  const itemEl = document.getElementById('Item_' + uuid)
  setItemContent(uuid, itemEl, url, 'url')

  exUtilities.hideModal('#chooseURLModal')
}

function setItemContent (uuid, itemEl, file, type = 'file') {
  // Populate the given element, item, with content.

  const mimetype = exFiles.guessMimetype(file)
  exSetup.updateWorkingDefinition(['content', uuid, 'filename'], file)
  exSetup.updateWorkingDefinition(['content', uuid, 'type'], type)
  exSetup.updateWorkingDefinition(['content', uuid, 'mimetype'], mimetype)
  exSetup.previewDefinition(true)

  const image = itemEl.querySelector('.image-preview')
  const video = itemEl.querySelector('.video-preview')
  const fileField = itemEl.querySelector('.file-field')

  itemEl.setAttribute('data-filename', file)
  itemEl.setAttribute('data-type', type)

  fileField.innerHTML = file
  if (mimetype === 'audio') {
    image.src = exFileSelect.getDefaultAudioIcon()
    image.style.display = 'block'
    video.style.display = 'none'
    // Hide the duration input
    itemEl.querySelector('.duration-col').style.display = 'none'
    // Hide the fill mode input
    itemEl.querySelector('.fill-col').style.display = 'none'
    // Hide the rotation input
    itemEl.querySelector('.rotation-col').style.display = 'none'
    // Hide the material input
    itemEl.querySelector('.material-col').style.display = 'none'
    // Hide the subtitle input
    itemEl.querySelector('.subtitle-col').style.display = 'none'
    exSetup.updateWorkingDefinition(['content', uuid, 'subtitles'], {})
  } else if (mimetype === 'image') {
    if (type === 'file') {
      image.src = exCommon.config.helperAddress + exConfig.api + '/files/' + file + '/thumbnail'
    } else if (type === 'url') {
      image.src = file
    }
    image.style.display = 'block'
    video.style.display = 'none'
    // Show the duration input
    itemEl.querySelector('.duration-col').style.display = 'block'
    // Show the fill mode input
    itemEl.querySelector('.fill-col').style.display = 'block'
    // Hide the rotation input
    itemEl.querySelector('.rotation-col').style.display = 'none'
    // Hide the material input
    itemEl.querySelector('.material-col').style.display = 'none'
    // Hide the subtitle input
    itemEl.querySelector('.subtitle-col').style.display = 'none'
    exSetup.updateWorkingDefinition(['content', uuid, 'subtitles'], {})
  } else if (mimetype === 'model') {
    image.src = exFileSelect.getDefaultModelIcon()
    image.style.display = 'block'
    video.style.display = 'none'
    // Hide the subtitle input
    itemEl.querySelector('.subtitle-col').style.display = 'none'
    exSetup.updateWorkingDefinition(['content', uuid, 'subtitles'], {})
    // Show the duration input
    itemEl.querySelector('.duration-col').style.display = 'block'
    // Hide the fill mode input
    itemEl.querySelector('.fill-col').style.display = 'none'
    // Show the rotation input
    itemEl.querySelector('.rotation-col').style.display = 'block'
    if (file.toLowerCase().endsWith('obj')) {
      itemEl.querySelector('.material-col').style.display = 'block'
    } else itemEl.querySelector('.material-col').style.display = 'none'
  } else if (mimetype === 'video') {
    if (type === 'file') {
      video.src = exCommon.config.helperAddress + exConfig.api + '/files/' + file + '/thumbnail'
    } else if (type === 'url') {
      video.src = file
    }
    video.style.display = 'block'
    image.style.display = 'none'
    // Hide the duration input
    itemEl.querySelector('.duration-col').style.display = 'none'
    // Show the fill mode input
    itemEl.querySelector('.fill-col').style.display = 'block'
    // Hide the rotation input
    itemEl.querySelector('.rotation-col').style.display = 'none'
    // Hide the material input
    itemEl.querySelector('.material-col').style.display = 'none'
    // Show the subtitle input
    itemEl.querySelector('.subtitle-col').style.display = 'block'
  }
}

function deleteitem (uuid) {
  // Remove this item from the working defintion and destroy its GUI representation.

  const workingDefinition = exSetup.config.workingDefinition

  delete workingDefinition.content[uuid]
  workingDefinition.content_order = workingDefinition.content_order.filter(item => item !== uuid)
  rebuildItemList()
  exSetup.previewDefinition(true)
}

function changeItemOrder (uuid, dir) {
  // Move the location of the given item.

  const workingDefinition = exSetup.config.workingDefinition

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

  const workingDefinition = exSetup.config.workingDefinition

  // Clear any existing items
  document.getElementById('itemList').innerHTML = ''

  let num = 1
  workingDefinition.content_order.forEach((uuid) => {
    const item = workingDefinition.content[uuid]
    createItemHTML(item, num)
    num += 1
  })
}

function onWatermarkFileChange () {
  // Called when a new image is selected.

  const file = document.getElementById('watermarkSelect').getAttribute('data-filename')
  exSetup.updateWorkingDefinition(['watermark', 'file'], file)

  exSetup.previewDefinition(true)
}

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// Activate tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

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
document.getElementById('wizardAddContentBUtton').addEventListener('click', () => {
  exFileSelect.createFileSelectionModal({
    filetypes: ['audio', 'image', 'video', 'glb', 'mtl', 'obj']
  })
    .then((files) => {
      if (files.length > 0) wizardPopulateContent(files)
    })
})

// Main buttons

document.getElementById('manageContentButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ manage: true, filetypes: ['audio', 'image', 'video', 'glb', 'mtl', 'obj'] })
})

// Content
document.getElementById('addItemButton').addEventListener('click', (event) => {
  addItem()
})
document.getElementById('chooseURLModalFetchButton').addEventListener('click', () => {
  fetchContentFromURL()
})
document.getElementById('chooseURLModalSubmitButton').addEventListener('click', setContentFromURLModal)

// Subtitles
document.getElementById('configureSubtitlesModalSelectButton').addEventListener('click', selectSubtitlesFile)
document.getElementById('configureSubtitlesModalSubmitButton').addEventListener('click', submitSubtitlesFromModal)
document.getElementById('configureSubtitlesModalDeleteButton').addEventListener('click', (ev) => {
  const modal = document.getElementById('configureSubtitlesModal')
  const itemUUID = modal.getAttribute('data-uuid')
  document.getElementById('subttileButton_' + itemUUID).innerHTML = 'Add subtitles'
  exSetup.updateWorkingDefinition(['content', itemUUID, 'subtitles'], {})
  exUtilities.hideModal(modal)
  exSetup.previewDefinition(true)
})

// Annotations
document.getElementById('annotateFromJSONModalFileSelect').addEventListener('click', () => {
  exFileSelect.createFileSelectionModal({ filetypes: ['json'] })
    .then((result) => {
      if (result.length === 1) {
        populateAnnotateFromJSONModal(result)
      }
    })
})
document.getElementById('annotateFromJSONModalSubmitButton').addEventListener('click', addAnnotationFromModal)
document.getElementById('annotateFromJSONModalFetchURLButton').addEventListener('click', () => {
  const url = document.getElementById('annotateFromJSONModalURLInput').value
  populateAnnotateFromJSONModal(url, 'url')
})
document.getElementById('deleteAnnotationModalSubmitButton').addEventListener('click', () => {
  const modal = document.getElementById('deleteAnnotationModal')
  const itemUUID = modal.getAttribute('data-itemUUID')
  const annotationUUID = modal.getAttribute('data-annotationUUID')
  const annotations = exSetup.config.workingDefinition.content[itemUUID].annotations
  delete annotations[annotationUUID]

  exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations'], annotations)
  exSetup.previewDefinition(true)
  document.getElementById('Annotation' + annotationUUID).remove()
  exUtilities.hideModal(modal)
})
document.getElementById('annotateFromJSONModalCloseButton').addEventListener('click', () => {
  // When we close the annotate from JSON modal, clear the tree, as complex JSON structures can limit performance.
  document.getElementById('annotateFromJSONModalTreeView').innerHTML = ''
})

// Watermark
document.getElementById('watermarkSelect').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['image'], multiple: false })
    .then((files) => {
      if (files.length === 1) {
        event.target.innerHTML = files[0]
        event.target.setAttribute('data-filename', files[0])
        onWatermarkFileChange()
      }
    })
})
document.getElementById('watermarkSelectClear').addEventListener('click', (event) => {
  const attractorSelect = document.getElementById('watermarkSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')
  onWatermarkFileChange()
})
Array.from(document.querySelectorAll('.watermark-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const field = event.target.getAttribute('data-field')
    exSetup.updateWorkingDefinition(['watermark', field], event.target.value)
    exSetup.previewDefinition(true)
  })
})

// Style fields
document.getElementById('showProgressCheckbox').addEventListener('change', (ev) => {
  const posCol = document.getElementById('progressIndicatorPosCol')
  const sizeCol = document.getElementById('progressIndicatorSizeCol')
  exSetup.updateWorkingDefinition(['behavior', 'progress_indicator', 'visible'], ev.target.checked)
  if (ev.target.checked) {
    posCol.style.display = 'block'
    sizeCol.style.display = 'block'
  } else {
    posCol.style.display = 'none'
    sizeCol.style.display = 'none'
  }
  exSetup.previewDefinition(true)
})
document.getElementById('progressIndicatorPosSelect').addEventListener('change', (ev) => {
  exSetup.updateWorkingDefinition(['behavior', 'progress_indicator', 'position'], ev.target.value)
  exSetup.previewDefinition(true)
})
document.getElementById('progressIndicatorSizeSelect').addEventListener('change', (ev) => {
  exSetup.updateWorkingDefinition(['behavior', 'progress_indicator', 'size'], ev.target.value)
  exSetup.previewDefinition(true)
})

document.querySelectorAll('.coloris').forEach((element) => {
  element.addEventListener('change', function () {
    const value = this.value.trim()
    const property = this.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['style', 'color', property], value)
    exSetup.previewDefinition(true)
  })
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

clearDefinitionInput()

exSetup.configure({
  app: 'media_player',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  onDefinitionSave: createThumbnail,
  blankDefinition: {
    content: {},
    content_order: [],
    style: {
      background: {
        mode: 'color',
        color: '#000'
      }
    },
    watermark: {}
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
