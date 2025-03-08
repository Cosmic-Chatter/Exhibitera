/* global bootstrap */

import * as exTools from './exhibitera_tools.js'
import * as exConfig from './config.js'

export async function getAvailableTemplates () {
  // Ask Hub to send a list of availble definition files
  // Pass a function and it will be called with the list as the
  // only parameter

  return await exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/tracker/flexible-tracker/getAvailableTemplates'
  })
}

export function getAvailableTrackerData (complete) {
  // Ask Hub to send a list of availble data files
  // Pass a function and it will be called with the list as the
  // only parameter

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/tracker/flexible-tracker/getAvailableData'
  })
    .then((response) => {
      if ('success' in response && response.success === false) {
        console.log('Error retrieving tracker data list:', response.reason)
        return
      }
      if (typeof complete === 'function') {
        complete(response.data)
      }
    })
}

export async function loadTemplate (uuid) {
  // Ask Hub to send a JSON dict with the template

  const response = await exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/tracker/flexible-tracker/' + uuid
  })
  return response.template
}

export function downloadTrackerData (name) {
  // Ask the server to send the data for the currently selected tracker as a CSV
  // and initiate a download.

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/getDataAsCSV',
    params: { name }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Convert the text to a file and initiate download
        const fileBlob = new Blob([result.csv], {
          type: 'text/plain'
        })
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(fileBlob)
        a.download = name + '.csv'
        a.click()
      }
    })
}

function populateWidgetProperties (widgetDef) {
  // Create HTML representation of widget properties to aid editing from the modal.

  // Recolor the widget name to indicate which we are editing
  document.querySelectorAll('.widget-header').forEach((el) => {
    el.classList.remove('text-info')
    el.classList.add('text-light')
  })
  const nameField = document.getElementById('editTrackerWidgetNameField_' + widgetDef.uuid)
  nameField.classList.add('text-info')
  nameField.classList.remove('text-light')

  const propsToEdit = ['name', 'label']

  if (widgetDef.type === 'dropdown') {
    propsToEdit.push('multiple', 'options')
  } else if (widgetDef.type === 'slider') {
    propsToEdit.push('slider')
  } else if (widgetDef.type === 'text') {
    propsToEdit.push('lines')
  } else if (widgetDef.type === 'timer') {
    propsToEdit.push('exclusive')
  }

  const propsDiv = document.getElementById('editTrackerTemplatePropertiesDiv')
  propsDiv.innerHTML = ''

  for (const prop of propsToEdit) {
    if (prop === 'name') {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.innerHTML = 'Name'
      label.setAttribute('for', 'editTrackerTemplateName_' + widgetDef.uuid)
      propsDiv.appendChild(label)

      const input = document.createElement('input')
      input.classList = 'form-control mb-2'
      input.setAttribute('id', 'editTrackerTemplateName_' + widgetDef.uuid)
      input.value = widgetDef?.name ?? ''
      input.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, ev.target.value)
      })
      propsDiv.appendChild(input)
    } else if (prop === 'label') {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.innerHTML = 'Label'
      label.setAttribute('for', 'editTrackerTemplateLabel_' + widgetDef.uuid)
      propsDiv.appendChild(label)

      const input = document.createElement('input')
      input.classList = 'form-control mb-2'
      input.setAttribute('id', 'editTrackerTemplateLabel_' + widgetDef.uuid)
      input.value = widgetDef?.label ?? ''
      input.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, ev.target.value)
      })
      propsDiv.appendChild(input)
    } else if (prop === 'multiple') {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.innerHTML = `
      Multiple
      <span class="badge bg-info ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="Allow more than one option to be selected." style="font-size: 0.55em; color: black">?</span>
      `
      label.setAttribute('for', 'editTrackerTemplateMultiple_' + widgetDef.uuid)
      propsDiv.appendChild(label)

      const outerDiv = document.createElement('div')
      propsDiv.appendChild(outerDiv)

      const div1 = document.createElement('div')
      div1.classList = 'form-check form-check-inline mb-2'
      outerDiv.appendChild(div1)

      const input1 = document.createElement('input')
      input1.classList = 'form-check-input'
      input1.setAttribute('id', 'editTrackerTemplateMultipleTrue_' + widgetDef.uuid)
      input1.setAttribute('type', 'radio')
      input1.setAttribute('name', 'editTrackerTemplateMultiple_' + widgetDef.uuid)
      input1.value = 'true'
      input1.checked = widgetDef?.multiple === true ?? false
      input1.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, true)
      })
      div1.appendChild(input1)

      const label1 = document.createElement('label')
      label1.classList = 'form-label'
      label1.innerHTML = 'True'
      label1.setAttribute('for', 'editTrackerTemplateMultipleTrue_' + widgetDef.uuid)
      div1.appendChild(label1)

      const div2 = document.createElement('div')
      div2.classList = 'form-check form-check-inline mb-2'
      outerDiv.appendChild(div2)

      const input2 = document.createElement('input')
      input2.classList = 'form-check-input'
      input2.setAttribute('id', 'editTrackerTemplateMultipleFalse_' + widgetDef.uuid)
      input2.setAttribute('type', 'radio')
      input2.setAttribute('name', 'editTrackerTemplateMultiple_' + widgetDef.uuid)
      input2.value = 'false'
      input2.checked = widgetDef?.multiple === false ?? true
      input2.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, false)
      })
      div2.appendChild(input2)

      const label2 = document.createElement('label')
      label2.classList = 'form-label'
      label2.innerHTML = 'False'
      label2.setAttribute('for', 'editTrackerTemplateMultipleFalse_' + widgetDef.uuid)
      div2.appendChild(label2)
    } else if (prop === 'options') {
      const label = document.createElement('label')
      label.innerHTML = 'Options'
      label.setAttribute('for', 'editTrackerTemplateOptions_' + widgetDef.uuid)
      propsDiv.appendChild(label)

      const hint = document.createElement('div')
      hint.classList = 'fst-italic mb-2'
      hint.innerHTML = 'Separate each option with a comma.'
      propsDiv.appendChild(hint)

      const input = document.createElement('input')
      input.classList = 'form-control mb-2'
      input.setAttribute('id', 'editTrackerTemplateOptions_' + widgetDef.uuid)
      let optionStr = ''
      for (const option of widgetDef.options) {
        optionStr += option + ', '
      }
      optionStr = optionStr.slice(0, -2) // Remove trailing ', '
      input.value = optionStr
      input.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, ev.target.value)
      })
      propsDiv.appendChild(input)
    } else if (prop === 'slider') {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.innerHTML = 'Slider options'
      propsDiv.appendChild(label)

      const row = document.createElement('div')
      row.classList = 'row'
      propsDiv.appendChild(row)

      for (const field of ['Min', 'Max', 'Step', 'Start']) {
        const col = document.createElement('div')
        col.classList = 'col-6 col-lg-3'
        row.appendChild(col)

        const label = document.createElement('label')
        label.setAttribute('for', 'editTrackerTemplateSlider' + field + widgetDef.uuid)
        label.innerHTML = field
        col.appendChild(label)

        const input = document.createElement('input')
        input.classList = 'form-control'
        input.setAttribute('id', 'editTrackerTemplateSlider' + field + widgetDef.uuid)
        input.setAttribute('type', 'number')
        if (field === 'Min') input.value = widgetDef?.min ?? 1
        if (field === 'Max') input.value = widgetDef?.max ?? 5
        if (field === 'Step') input.value = widgetDef?.step ?? 1
        if (field === 'Start') input.value = widgetDef?.start ?? 3
        input.addEventListener('change', (ev) => {
          editTrackerTemplateUpdateProperty(widgetDef.uuid, field.toLowerCase(), ev.target.value)
        })
        col.appendChild(input)
      }
    } else if (prop === 'lines') {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.innerHTML = `
      Lines
      <span class="badge bg-info ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="Number of lines shown for text input." style="font-size: 0.55em; color: black">?</span>
      `
      label.setAttribute('for', 'editTrackerTemplateLines_' + widgetDef.uuid)
      propsDiv.appendChild(label)

      const input = document.createElement('input')
      input.classList = 'form-control mb-2'
      input.setAttribute('id', 'editTrackerTemplateLines_' + widgetDef.uuid)
      input.setAttribute('type', 'number')
      input.value = widgetDef?.lines ?? 5
      input.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, ev.target.value)
      })
      propsDiv.appendChild(input)
    } else if (prop === 'exclusive') {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.innerHTML = `
      Exclusive
      <span class="badge bg-info ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="Starting an exclusive timer stops other exclusive timers." style="font-size: 0.55em; color: black">?</span>
      `
      label.setAttribute('for', 'editTrackerTemplateExclusive_' + widgetDef.uuid)
      propsDiv.appendChild(label)

      const outerDiv = document.createElement('div')
      propsDiv.appendChild(outerDiv)

      const div1 = document.createElement('div')
      div1.classList = 'form-check form-check-inline mb-2'
      outerDiv.appendChild(div1)

      const input1 = document.createElement('input')
      input1.classList = 'form-check-input'
      input1.setAttribute('id', 'editTrackerTemplateExclusiveTrue_' + widgetDef.uuid)
      input1.setAttribute('type', 'radio')
      input1.setAttribute('name', 'editTrackerTemplateExclusive_' + widgetDef.uuid)
      input1.value = 'true'
      input1.checked = widgetDef?.exclusive === true ?? false
      input1.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, true)
      })
      div1.appendChild(input1)

      const label1 = document.createElement('label')
      label1.classList = 'form-label'
      label1.innerHTML = 'True'
      label1.setAttribute('for', 'editTrackerTemplateExclusiveTrue_' + widgetDef.uuid)
      div1.appendChild(label1)

      const div2 = document.createElement('div')
      div2.classList = 'form-check form-check-inline mb-2'
      outerDiv.appendChild(div2)

      const input2 = document.createElement('input')
      input2.classList = 'form-check-input'
      input2.setAttribute('id', 'editTrackerTemplateExclusiveFalse_' + widgetDef.uuid)
      input2.setAttribute('type', 'radio')
      input2.setAttribute('name', 'editTrackerTemplateExclusive_' + widgetDef.uuid)
      input2.value = 'false'
      input2.checked = widgetDef?.exclusive === false ?? true
      input2.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, false)
      })
      div2.appendChild(input2)

      const label2 = document.createElement('label')
      label2.classList = 'form-label'
      label2.innerHTML = 'False'
      label2.setAttribute('for', 'editTrackerTemplateExclusiveFalse_' + widgetDef.uuid)
      div2.appendChild(label2)
    }
  }

  // Enable all tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
  const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
}

function editTrackerTemplateUpdateProperty (uuid, property, value) {
  // Update the given property for the widget specified by the uuid.

  if (property === 'name') {
    document.getElementById('editTrackerWidgetNameField_' + uuid).innerHTML = value
  }

  const modal = document.getElementById('editTrackerTemplateModal')
  const template = JSON.parse(modal.getAttribute('data-template'))

  template.widgets[uuid][property] = value

  // Update the data attribute with the updated template
  modal.setAttribute('data-template', JSON.stringify(template))
}

export function populateEditTrackerTemplateCurrentLayout (template) {
  // Take the current template dictionary and render a set of buttons

  const modal = document.getElementById('editTrackerTemplateModal')

  const currentLayoutDiv = document.getElementById('editTrackerTemplateModalCurrentLayout')
  currentLayoutDiv.innerHTML = ''

  for (const widgetUUID of template.widget_order) {
    const widgetDef = template.widgets[widgetUUID]

    const col = document.createElement('div')
    col.classList = 'col-12 col-md-6 col-lg-4 mt-2 w-100'

    const widget = document.createElement('div')
    widget.classList = 'mx-1'
    col.appendChild(widget)

    const row1 = document.createElement('div')
    row1.classList = 'row'
    widget.appendChild(row1)

    const nameCol = document.createElement('div')
    nameCol.classList = 'col-12 bg-secondary rounded-top'
    row1.appendChild(nameCol)

    const name = document.createElement('div')
    name.classList = ' text-light w-100 text-center font-weight-bold widget-header'
    name.setAttribute('id', 'editTrackerWidgetNameField_' + widgetDef.uuid)
    name.innerHTML = widgetDef.name
    nameCol.appendChild(name)

    const row2 = document.createElement('div')
    row2.classList = 'row'
    widget.appendChild(row2)

    const editCol = document.createElement('div')
    editCol.classList = 'col-4 mx-0 px-0'
    row2.appendChild(editCol)

    const edit = document.createElement('div')
    edit.classList = 'text-light bg-primary w-100 h-100 justify-content-center d-flex ps-1'
    edit.style.borderBottomLeftRadius = '0.25rem'
    edit.innerHTML = 'Edit'
    edit.style.cursor = 'pointer'
    edit.addEventListener('click', function () {
      // Get the latest template in case of changes
      const newTemplate = JSON.parse(modal.getAttribute('data-template'))

      populateWidgetProperties(newTemplate.widgets[widgetDef.uuid])
    })
    editCol.appendChild(edit)

    const leftCol = document.createElement('div')
    leftCol.classList = 'col-2 mx-0 px-0'
    row2.appendChild(leftCol)

    const left = document.createElement('div')
    left.classList = 'text-light bg-info w-100 h-100 justify-content-center d-flex'
    left.innerHTML = '▲'
    left.style.cursor = 'pointer'

    left.addEventListener('click', function () { editTrackerTemplateModalMoveWidget(widgetDef.uuid, -1) })
    leftCol.appendChild(left)

    const rightCol = document.createElement('div')
    rightCol.classList = 'col-2 mx-0 px-0'
    row2.appendChild(rightCol)

    const right = document.createElement('div')
    right.classList = 'text-light bg-info w-100 h-100 justify-content-center d-flex pe-1'
    right.innerHTML = '▼'
    right.style.cursor = 'pointer'
    right.addEventListener('click', function () { editTrackerTemplateModalMoveWidget(widgetDef.uuid, 1) })
    rightCol.appendChild(right)

    const deleteCol = document.createElement('div')
    deleteCol.classList = 'col-4 mx-0 px-0'
    row2.appendChild(deleteCol)

    const deleteButton = document.createElement('div')
    deleteButton.classList = 'text-light bg-danger w-100 h-100 justify-content-center d-flex pe-1'
    deleteButton.style.borderBottomRightRadius = '0.25rem'
    deleteButton.innerHTML = 'Delete'
    deleteButton.style.cursor = 'pointer'
    deleteButton.addEventListener('click', function () { editTrackerTemplateModalDeleteWidget(widgetDef.uuid) })
    deleteCol.appendChild(deleteButton)

    currentLayoutDiv.appendChild(col)
  }
}

function editTrackerTemplateModalMoveWidget (uuid, dir) {
  // Reorder the dictionary of widgets, moving the given uuid the specified number
  // of places

  const modal = document.getElementById('editTrackerTemplateModal')
  const template = JSON.parse(modal.getAttribute('data-template'))

  const uuidIndex = template.widget_order.indexOf(uuid)
  if (dir === -1 && uuidIndex === 0) return
  if (dir === 1 && uuidIndex === template.widget_order.length - 1) return

  // Save the other value to swap them
  const otherUuid = template.widget_order[uuidIndex + dir]
  template.widget_order[uuidIndex + dir] = uuid
  template.widget_order[uuidIndex] = otherUuid

  // Update the data attribute with the updated template
  modal.setAttribute('data-template', JSON.stringify(template))
  populateEditTrackerTemplateCurrentLayout(template)
}

export function editTrackerTemplateModalAddWidget (name, type) {
  // Create a new widget with the given name and add it to the template.

  const modal = document.getElementById('editTrackerTemplateModal')
  const template = JSON.parse(modal.getAttribute('data-template'))

  const widgetUUID = exTools.uuid()

  template.widget_order.push(widgetUUID)
  const widgetDef = {
    label: '',
    name,
    type,
    uuid: widgetUUID
  }
  if (type === 'dropdown') {
    widgetDef.multiple = false
    widgetDef.options = []
  } else if (type === 'sider') {
    widgetDef.min = 1
    widgetDef.max = 5
    widgetDef.step = 1
    widgetDef.start = 3
  } else if (type === 'text') {
    widgetDef.lines = 5
  } else if (type === 'timer') {
    widgetDef.exclusive = false
  }
  template.widgets[widgetUUID] = widgetDef

  // Update the data attribute with the updated template
  modal.setAttribute('data-template', JSON.stringify(template))
  populateEditTrackerTemplateCurrentLayout(template)
}

function editTrackerTemplateModalDeleteWidget (uuid) {
  // Delete the given widget and shift focus to the neighboring one

  const modal = document.getElementById('editTrackerTemplateModal')
  const template = JSON.parse(modal.getAttribute('data-template'))

  template.widget_order = template.widget_order.filter(item => item !== uuid)
  delete template.widgets[uuid]

  modal.setAttribute('data-template', JSON.stringify(template))

  const newCurrentWidgetUUID = template.widget_order[0]
  populateEditTrackerTemplateCurrentLayout(template)

  populateWidgetProperties(template.widgets[newCurrentWidgetUUID])
}

export function populateTrackerTemplateSelect (templateList) {
  // Get a list of the available tracker layout templates and populate the
  // selector

  const templateSelect = document.getElementById('trackerTemplateSelect')
  templateSelect.innerHTML = ''

  for (const item of templateList) {
    const option = new Option(item.name, item.uuid)
    templateSelect.appendChild(option)
  }
}

export async function showEditTrackerTemplateModal (templateToLoad = '') {
  // Retrieve the currently-selected layout and use it to configure the editTrackerTemplateModal

  if (templateToLoad === '') {
    templateToLoad = document.getElementById('trackerTemplateSelect').value
  }

  const template = await loadTemplate(templateToLoad)
  _showEditTrackerTemplateModal(template)
}

function _showEditTrackerTemplateModal (template) {
  // Set the provided template in the data attributes, reset all the fields,
  // and show the modal

  document.getElementById('editTrackerTemplateModalTitle').innerHTML = 'Edit template: ' + template.name
  document.getElementById('editTrackerTemplatePropertiesDiv').innerHTML = ''

  const modal = document.getElementById('editTrackerTemplateModal')
  modal.setAttribute('data-template', JSON.stringify(template))
  modal.setAttribute('data-uuid', template.uuid)

  populateEditTrackerTemplateCurrentLayout(template)
  $('#editTrackerTemplateModal').modal('show')
}

export function editTrackerTemplateModalSubmitChanges () {
  // Send a message to the server with the updated template

  const modal = document.getElementById('editTrackerTemplateModal')
  const template = JSON.parse(modal.getAttribute('data-template'))

  const requestDict = {
    tracker_uuid: template.uuid,
    template
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/createTemplate',
    params: requestDict
  })
    .then((response) => {
      if (response.success === true) {
        $(modal).modal('hide')
      }
    })
}

export async function createTrackerTemplate (name = '') {
  // Ask the server to create a template with the name provided in the text entry
  // field.

  const createTrackerTemplateName = document.getElementById('createTrackerTemplateName')

  if (name === '') {
    name = createTrackerTemplateName.value.trim()
  }

  // Can't name a template the empty string
  if (name === '') return

  const uuid = exTools.uuid()

  const requestDict = {
    template: {
      name,
      uuid,
      widget_order: [],
      widgets: {}
    },
    tracker_uuid: uuid
  }

  const result = await exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/createTemplate',
    params: requestDict
  })

  if (result.success === true) {
    createTrackerTemplateName.value = ''
    const templates = await getAvailableTemplates()
    console.log(templates)
    populateTrackerTemplateSelect(templates)
    showEditTrackerTemplateModal(uuid)
  }
}

export async function deleteTrackerTemplate (uuid = '') {
  // Ask the server to delete the specified tracker template

  if (uuid === '') {
    uuid = document.getElementById('trackerTemplateSelect').value
  }

  const result = await exTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/tracker/flexible-tracker/' + uuid + '/deleteTemplate'
  })
  if (result.success) {
    const templates = await getAvailableTemplates()
    populateTrackerTemplateSelect(templates)
    $('#deleteTrackerTemplateModal').modal('hide')
  }
}

export function populateTrackerDataSelect (data) {
  // Take a list of data filenames and populate the TrackerDataSelect

  const trackerDataSelect = document.getElementById('trackerDataSelect')
  trackerDataSelect.innerHTML = ''

  const sortedList = data.sort((a, b) => {
    const aVal = a.toLowerCase()
    const bVal = b.toLowerCase()

    if (aVal > bVal) return 1
    if (aVal < bVal) return -1
    return 0
  })
  sortedList.forEach(item => {
    const name = item.split('.').slice(0, -1).join('.')
    trackerDataSelect.appendChild(new Option(name, name))
  })
}

export function showDeleteTrackerDataModal () {
  // Show a modal confirming the request to delete a specific dataset. To be sure
  // populate the modal with data for a test.

  const name = $('#trackerDataSelect').val()
  $('#deleteTrackerDataModalDeletedName').html(name)
  $('#deleteTrackerDataModalDeletedInput').val('')
  $('#deleteTrackerDataModalSpellingError').hide()
  $('#deleteTrackerDataModal').modal('show')
}

export function deleteTrackerDataFromModal () {
  // Check inputed answer and confirm it is correct. If so, ask for the data to
  // be deleted.

  const name = $('#deleteTrackerDataModalDeletedName').html()
  const input = $('#deleteTrackerDataModalDeletedInput').val()

  if (name === input) {
    deleteTrackerData()
  } else {
    $('#deleteTrackerDataModalSpellingError').show()
  }
}

export function deleteTrackerData () {
  // Send a message to the server asking it to delete the data for the currently
  // selected template

  const name = $('#trackerDataSelect').val()

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/deleteData',
    params: { name }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        $('#deleteTrackerDataModal').modal('hide')
        getAvailableTrackerData(populateTrackerDataSelect)
      }
    })
}

export function launchTracker () {
  // Open the tracker in a new tab with the currently selected layout

  const uuid = document.getElementById('trackerTemplateSelect').value

  let url = '/tracker.html'
  if (uuid != null) {
    url += '?layout=' + uuid
  }
  window.open(url, '_blank').focus()
}
