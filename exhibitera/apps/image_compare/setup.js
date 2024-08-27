/* global bootstrap, Coloris */

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
          content: {},
          content_order: [],
          style: {
            background: {
              mode: 'color',
              color: '#000'
            }
          },
          watermark: {}
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          content: {},
          content_order: [],
          style: {
            background: {
              mode: 'color',
              color: '#000'
            }
          },
          watermark: {}
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

  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#000',
    gradient_color_1: '#000',
    gradient_color_2: '#000'
  })

  document.getElementById('itemList').innerHTML = ''
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)

  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)
  rebuildItemList()

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

  // Set the appropriate values for any advanced color pickers
  if ('background' in def.style) {
    exSetup.updateAdvancedColorPicker('style>background', def.style.background)
  }

  // Set the appropriate values for the watermark
  if ('watermark' in def && 'file' in def.watermark && def.watermark.file !== '') {
    const watermarkSelect = document.getElementById('watermarkSelect')
    watermarkSelect.innerHTML = def.watermark.file
    watermarkSelect.setAttribute('data-filename', def.watermark.file)
  }
  if ('watermark' in def && 'x_position' in def.watermark) {
    document.getElementById('watermarkXPos').value = def.watermark.x_position
  }
  if ('watermark' in def && 'y_position' in def.watermark) {
    document.getElementById('watermarkYPos').value = def.watermark.y_position
  }
  if ('watermark' in def && 'size' in def.watermark) {
    document.getElementById('watermarkSize').value = def.watermark.size
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../image_compare.html?standalone=true&definition=' + def.uuid
}

function saveDefinition () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'image_compare'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  exCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Create a thumbnail
        createThumbnail()

        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        exCommon.getAvailableDefinitions('image_compare')
          .then((response) => {
            if ('success' in response && response.success === true) {
              exSetup.populateAvailableDefinitions(response.definitions)
            }
          })
      }
    })
}

function addItem () {
  // Add an item to the working defintiion

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const item = {
    uuid: exCommon.uuid(),
    image1: '',
    image2: ''
  }
  workingDefinition.content[item.uuid] = item
  workingDefinition.content_order.push(item.uuid)

  createItemHTML(item, workingDefinition.content_order.length)
  console.log($('#definitionSaveButton').data('workingDefinition'))
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
  cardBody.classList = 'card-body row gy-2'
  card.appendChild(cardBody)

  const numberCol = document.createElement('div')
  numberCol.classList = 'col-12'
  cardBody.appendChild(numberCol)

  const number = document.createElement('div')
  number.classList = 'w-100 fw-bold h4 mb-3 text-center'
  number.innerHTML = num
  numberCol.appendChild(number)

  const image1Pane = document.createElement('div')
  image1Pane.classList = 'col-12 col-md-6 d-flex flex-column justify-content-end'
  cardBody.appendChild(image1Pane)

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
  image2Pane.classList = 'col-12 col-md-6 d-flex flex-column justify-content-end'
  cardBody.appendChild(image2Pane)

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
  cardBody.appendChild(modifyPane)

  const modifyRow = document.createElement('div')
  modifyRow.classList = 'row gy-2'
  modifyPane.appendChild(modifyRow)

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
    deleteitem(item.uuid)
  })
  deleteCol.appendChild(deleteButton)

  // if (item.filename !== '') setItemContent(item.uuid, itemCol, item.filename, item.type)

  document.getElementById('itemList').appendChild(itemCol)

  // Annotations
  if ('annotations' in item) {
    for (const key of Object.keys(item.annotations)) {
      createAnnoationHTML(item.uuid, item.annotations[key])
    }
  }

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function showAnnotateFromJSONModal (itemUUID, annotationUUID = null) {
  // Prepare and show the modal for creating an annotation from JSON.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const urlInput = document.getElementById('annotateFromJSONModalURLInput')
  const path = document.getElementById('annotateFromJSONModalPath')
  const title = document.getElementById('annotateFromJSONModalTitle')
  const button = document.getElementById('annotateFromJSONModalSubmitButton')
  document.getElementById('annotateFromJSONModalTreeView').innerHTML = ''
  path.setAttribute('data-itemUUID', itemUUID)

  if (annotationUUID != null) {
    // We are editing rather than creating new

    const details = workingDefinition.content[itemUUID].annotations[annotationUUID]
    title.innerHTML = 'Update a JSON annotation'
    button.innerHTML = 'Update'
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

  $('#annotateFromJSONModal').modal('show')
}

function populateAnnotateFromJSONModal (file, type = 'file') {
  // Retrieve the given JSON file and parse it into a tree.
  // 'type' should be one of [file | url]

  // Store the file for later use.
  const el = document.getElementById('annotateFromJSONModalPath')
  el.setAttribute('data-file', file)
  el.setAttribute('data-type', type)

  const parent = document.getElementById('annotateFromJSONModalTreeView')
  parent.innerHTML = ''

  if (type === 'file') {
    exCommon.makeServerRequest({
      method: 'GET',
      endpoint: '/content/' + file,
      noCache: true
    })
      .then((text) => {
        createTreeSubEntries(parent, text)
      })
  } else if (type === 'url') {
    $.getJSON(file, function (text) {
      createTreeSubEntries(parent, text)
    })
      .fail((error) => {
        console.log(error)
        if (error.statusText === 'Not Found') {
          parent.innerHTML = 'The entered URL is unreachable.'
        } else if (error.statusText === 'parsererror') {
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
  el.setAttribute('data-path', JSON.stringify(path))
}

function addAnnotationFromModal () {
  // Collect the needed information and add the annotation.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const el = document.getElementById('annotateFromJSONModalPath')
  const itemUUID = el.getAttribute('data-itemUUID')
  const path = JSON.parse(el.getAttribute('data-path'))
  const file = el.getAttribute('data-file')
  const type = el.getAttribute('data-type')
  let annotationUUID = el.getAttribute('data-annotationUUID')
  let annotation

  if ((annotationUUID == null) || (annotationUUID === '')) {
    // We are creating a new annotation.
    annotationUUID = exCommon.uuid()
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

  let annotations
  if ('annotations' in workingDefinition.content[itemUUID]) {
    annotations = workingDefinition.content[itemUUID].annotations
    annotations[annotationUUID] = annotation
  } else {
    annotations = {}
    annotations[annotationUUID] = annotation
  }
  exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations'], annotations)
  exSetup.previewDefinition(true)
  document.getElementById('annotateFromJSONModalTreeView').innerHTML = ''
  $('#annotateFromJSONModal').modal('hide')
}

function createAnnoationHTML (itemUUID, details) {
  // Create the HTML represetnation of an annotation and add it to the item.

  const col = document.createElement('div')
  col.classList = 'col-12 border rounded py-2'
  col.setAttribute('id', 'Annotation' + details.uuid)

  const row = document.createElement('div')
  row.classList = 'row gy-2'
  col.appendChild(row)

  const title = document.createElement('div')
  title.classList = 'col-12 text-center'
  title.setAttribute('id', 'Annotation' + details.uuid + 'Title')
  title.innerHTML = '<b>Annotation: </b>' + details.path.slice(-1)
  row.appendChild(title)

  const xPosCol = document.createElement('div')
  xPosCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(xPosCol)

  const xPosDiv = document.createElement('div')
  xPosDiv.classList = 'w-100'
  xPosCol.appendChild(xPosDiv)

  const xPosLabel = document.createElement('label')
  xPosLabel.classList = 'form-label'
  xPosLabel.innerHTML = 'Horizontal position'
  xPosLabel.setAttribute('for', 'xPosInput' + details.uuid)
  xPosDiv.appendChild(xPosLabel)

  const xPosInput = document.createElement('input')
  xPosInput.classList = 'form-control'
  xPosInput.setAttribute('type', 'number')
  xPosInput.setAttribute('id', 'xPosInput' + details.uuid)
  xPosInput.setAttribute('min', '0')
  xPosInput.setAttribute('max', '100')
  xPosInput.setAttribute('step', '1')
  if ('x_position' in details) {
    xPosInput.value = details.x_position
  } else {
    xPosInput.value = 50
  }
  xPosInput.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'x_position'], event.target.value)
    exSetup.previewDefinition(true)
  })
  xPosDiv.appendChild(xPosInput)

  const yPosCol = document.createElement('div')
  yPosCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(yPosCol)

  const yPosDiv = document.createElement('div')
  yPosDiv.classList = 'w-100'
  yPosCol.appendChild(yPosDiv)

  const yPosLabel = document.createElement('label')
  yPosLabel.classList = 'form-label'
  yPosLabel.innerHTML = 'Vertical position'
  yPosLabel.setAttribute('for', 'yPosInput' + details.uuid)
  yPosDiv.appendChild(yPosLabel)

  const yPosInput = document.createElement('input')
  yPosInput.classList = 'form-control'
  yPosInput.setAttribute('type', 'number')
  yPosInput.setAttribute('id', 'yPosInput' + details.uuid)
  yPosInput.setAttribute('min', '0')
  yPosInput.setAttribute('max', '100')
  yPosInput.setAttribute('step', '1')
  if ('y_position' in details) {
    yPosInput.value = details.y_position
  } else {
    yPosInput.value = 50
  }
  yPosInput.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'y_position'], event.target.value)
    exSetup.previewDefinition(true)
  })
  yPosDiv.appendChild(yPosInput)

  const alignCol = document.createElement('div')
  alignCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(alignCol)

  const alignDiv = document.createElement('div')
  alignDiv.classList = 'w-100'
  alignCol.appendChild(alignDiv)

  const alignLabel = document.createElement('label')
  alignLabel.classList = 'form-label'
  alignLabel.innerHTML = 'Text alignment'
  alignLabel.setAttribute('for', 'alignSelect' + details.uuid)
  alignDiv.appendChild(alignLabel)

  const alignSelect = document.createElement('select')
  alignSelect.classList = 'form-select'
  alignSelect.appendChild(new Option('Left', 'left'))
  alignSelect.appendChild(new Option('Center', 'center'))
  alignSelect.appendChild(new Option('Right', 'right'))
  if ('align' in details) {
    alignSelect.value = details.align
  }
  alignSelect.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'align'], event.target.value)
    exSetup.previewDefinition(true)
  })
  alignDiv.appendChild(alignSelect)

  const fontSizeCol = document.createElement('div')
  fontSizeCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(fontSizeCol)

  const fontSizeDiv = document.createElement('div')
  fontSizeCol.appendChild(fontSizeDiv)

  const fontSizeLabel = document.createElement('label')
  fontSizeLabel.classList = 'form-label'
  fontSizeLabel.innerHTML = 'Text size'
  fontSizeLabel.setAttribute('for', 'fontSizeInput' + details.uuid)
  fontSizeDiv.appendChild(fontSizeLabel)

  const fontSizeInput = document.createElement('input')
  fontSizeInput.classList = 'form-control'
  fontSizeInput.setAttribute('type', 'number')
  fontSizeInput.setAttribute('id', 'fontSizeInput' + details.uuid)
  fontSizeInput.setAttribute('min', '1')
  fontSizeInput.setAttribute('step', '1')
  if ('font_size' in details) {
    fontSizeInput.value = details.font_size
  } else {
    fontSizeInput.value = 20
  }
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
  fontColorLabel.innerHTML = 'Text color'
  fontColorLabel.setAttribute('for', 'fontColorInput' + details.uuid)
  fontColorDiv.appendChild(fontColorLabel)

  const fontColorInput = document.createElement('input')
  fontColorInput.classList = 'coloris'
  fontColorInput.style.height = '35px'
  fontColorInput.setAttribute('id', 'fontColorInput' + details.uuid)
  if ('color' in details) {
    fontColorInput.value = details.color
  } else {
    fontColorInput.value = 'black'
  }
  fontColorInput.addEventListener('change', (event) => {
    exSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'color'], event.target.value)
    exSetup.previewDefinition(true)
  })
  fontColorDiv.appendChild(fontColorInput)
  setTimeout(setUpColorPickers, 100)

  const fontFaceCol = document.createElement('div')
  fontFaceCol.classList = 'col-12 col-md-6'
  row.appendChild(fontFaceCol)

  const actionCol = document.createElement('div')
  actionCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(actionCol)

  const actionDropdown = document.createElement('div')
  actionDropdown.classList = 'dropdown w-100'
  actionCol.appendChild(actionDropdown)

  const actionButton = document.createElement('button')
  actionButton.classList = 'btn btn-primary dropdown-toggle w-100'
  actionButton.setAttribute('type', 'button')
  actionButton.setAttribute('data-bs-toggle', 'dropdown')
  actionButton.setAttribute('aria-expanded', false)
  actionButton.innerHTML = 'Action'
  actionDropdown.appendChild(actionButton)

  const actionMenu = document.createElement('ul')
  actionMenu.classList = 'dropdown-menu'
  actionDropdown.appendChild(actionMenu)

  const li1 = document.createElement('li')
  const li2 = document.createElement('li')
  actionMenu.appendChild(li1)
  actionMenu.appendChild(li2)

  const editAction = document.createElement('a')
  editAction.classList = 'dropdown-item text-info'
  editAction.innerHTML = 'Edit JSON field'
  editAction.style.cursor = 'pointer'
  editAction.addEventListener('click', () => {
    showAnnotateFromJSONModal(itemUUID, details.uuid)
  })
  li1.appendChild(editAction)

  const deleteAction = document.createElement('a')
  deleteAction.classList = 'dropdown-item text-danger'
  deleteAction.innerHTML = 'Delete'
  deleteAction.style.cursor = 'pointer'
  deleteAction.addEventListener('click', () => {
    document.getElementById('deleteAnnotationModal').setAttribute('data-annotationUUID', details.uuid)
    document.getElementById('deleteAnnotationModal').setAttribute('data-itemUUID', itemUUID)
    $('#deleteAnnotationModal').modal('show')
  })
  li1.appendChild(deleteAction)

  document.getElementById('annotationRow_' + itemUUID).appendChild(col)

  // Must be after we had the main element to the DOM

  exSetup.createAdvancedFontPicker({
    parent: fontFaceCol,
    name: 'Font',
    path: `content>${itemUUID}>annotations>${details.uuid}>font`,
    default: 'OpenSans-Regular.ttf'
  })
  exSetup.refreshAdvancedFontPickers()
}

function showChooseURLModal (uuid) {
  // Prepare and show the modal for choosing content from a URL.

  document.getElementById('chooseURLModal').setAttribute('data-uuid', uuid)
  document.getElementById('chooseURLModalInput').value = ''
  document.getElementById('chooseURLModalPreviewVideo').style.display = 'none'
  document.getElementById('chooseURLModalPreviewImage').style.display = 'none'
  document.getElementById('chooseURLModalPreviewAudio').style.display = 'none'
  document.getElementById('chooseURLModalError').style.display = 'none'

  $('#chooseURLModal').modal('show')
}

async function fetchContentFromURL () {
  // From the chooseContentModal, fetch the given link and show a preview.

  const url = document.getElementById('chooseURLModalInput').value.trim()
  const video = document.getElementById('chooseURLModalPreviewVideo')
  const image = document.getElementById('chooseURLModalPreviewImage')
  const audio = document.getElementById('chooseURLModalPreviewAudio')
  const modal = document.getElementById('chooseURLModal')
  const error = document.getElementById('chooseURLModalError')

  const mimetype = exCommon.guessMimetype(url)
  modal.setAttribute('data-mimetype', mimetype)
  console.log(mimetype)
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
  const uuid = document.getElementById('chooseURLModal').getAttribute('data-uuid')
  const itemEl = document.getElementById('Item_' + uuid)
  setItemContent(uuid, itemEl, url, 'url')

  $('#chooseURLModal').modal('hide')
}

function setItemContent (uuid, itemEl, file, type = 'file') {
  // Populate the given element, item, with content.

  exSetup.updateWorkingDefinition(['content', uuid, 'filename'], file)
  exSetup.updateWorkingDefinition(['content', uuid, 'type'], type)
  exSetup.previewDefinition(true)

  const image = itemEl.querySelector('.image-preview')
  const video = itemEl.querySelector('.video-preview')
  const fileField = itemEl.querySelector('.file-field')

  itemEl.setAttribute('data-filename', file)
  itemEl.setAttribute('data-type', type)
  const mimetype = exCommon.guessMimetype(file)
  fileField.innerHTML = file
  if (mimetype === 'audio') {
    image.src = exFileSelect.getDefaultAudioIcon()
    image.style.display = 'block'
    video.style.display = 'none'
    // Hide the duration input
    itemEl.querySelector('.duration-col').style.display = 'none'
  } else if (mimetype === 'image') {
    if (type === 'file') {
      image.src = '/thumbnails/' + exCommon.withExtension(file, 'jpg')
    } else if (type === 'url') {
      image.src = file
    }
    image.style.display = 'block'
    video.style.display = 'none'
    // Show the duration input
    itemEl.querySelector('.duration-col').style.display = 'block'
  } else if (mimetype === 'video') {
    if (type === 'file') {
      video.src = '/thumbnails/' + exCommon.withExtension(file, 'mp4')
    } else if (type === 'url') {
      video.src = file
    }
    video.style.display = 'block'
    image.style.display = 'none'
    // Hide the duration input
    itemEl.querySelector('.duration-col').style.display = 'none'
  }
}

function deleteitem (uuid) {
  // Remove this item from the working defintion and destroy its GUI representation.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  delete workingDefinition.content[uuid]
  workingDefinition.content_order = workingDefinition.content_order.filter(item => item !== uuid)
  rebuildItemList()
  console.log(workingDefinition)
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
  document.getElementById('itemList').innerHTML = ''

  let num = 1
  workingDefinition.content_order.forEach((uuid) => {
    const item = workingDefinition.content[uuid]
    createItemHTML(item, num)
    num += 1
  })
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

// Add event listeners
// -------------------------------------------------------------

// Main buttons

// Content
document.getElementById('addItemButton').addEventListener('click', (event) => {
  addItem()
})

// Set helper address for use with exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

clearDefinitionInput()

exSetup.configure({
  app: 'image_compare',
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
