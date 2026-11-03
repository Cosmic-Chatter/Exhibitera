/* global bootstrap */

import * as exUtilities from '../../../common/utilities.js'
import * as exTools from '../tools.js'

export async function getAvailableTemplates () {
  // Ask Hub to send a list of availble definition files
  // Pass a function and it will be called with the list as the
  // only parameter

  return await exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/tracker/templates/list'
  })
}

export function getAvailableTrackerData (complete) {
  // Ask Hub to send a list of the collected data. Pass a function and it will be called
  // with the response, which lists datasets by ID and files stored by name.

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/datasets/list'
  })
    .then((response) => {
      if (!response?.success) {
        console.log('Error retrieving tracker data list:', response?.reason)
        return
      }
      if (typeof complete === 'function') {
        complete(response)
      }
    })
}

function selectedTrackerData () {
  // Return the details of the data chosen in the trackerDataSelect, or null if none is chosen

  const option = document.getElementById('trackerDataSelect').selectedOptions[0]
  if (option == null) return null
  return { kind: option.dataset.kind, id: option.dataset.id, name: option.dataset.name }
}

function trackerDataEndpoint (data) {
  // Datasets are found by ID. Files stored by name, such as those from the Core API, by name.

  if (data.kind === 'file') return '/data/' + encodeURIComponent(data.name)
  return '/datasets/' + data.kind + '/' + encodeURIComponent(data.id)
}

export async function loadTemplate (uuid) {
  // Ask Hub to send a JSON dict with the template

  const response = await exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/tracker/template/' + uuid
  })
  return response.template
}

export function downloadTrackerData () {
  // Ask the server to send the selected data as a CSV and initiate a download.
  // Hub names the file, so it doesn't include characters that aren't allowed.

  const data = selectedTrackerData()
  if (data == null) return

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: trackerDataEndpoint(data) + '/csv'
  })
    .then((result) => {
      if (result?.success) {
        // Convert the text to a file and initiate download
        const fileBlob = new Blob([result.csv], {
          type: 'text/plain'
        })
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(fileBlob)
        a.download = result.filename ?? data.name + '.csv'
        a.click()
      }
    })
}

function populateWidgetProperties (widgetDef) {
  // Create HTML representation of widget properties to aid editing from the modal.

  const propsToEdit = ['name', 'label']

  // Counters, sliders, and timers always have a value, so only the other widgets can be required
  if (widgetDef.type === 'counter') {
    propsToEdit.push('counter_max')
  } else if (widgetDef.type === 'dropdown') {
    propsToEdit.push('multiple', 'options', 'required')
  } else if (widgetDef.type === 'number') {
    propsToEdit.push('number_limits', 'required')
  } else if (widgetDef.type === 'slider') {
    propsToEdit.push('slider', 'slider_labels')
  } else if (widgetDef.type === 'text') {
    propsToEdit.push('lines', 'required')
  } else if (widgetDef.type === 'timer') {
    propsToEdit.push('exclusive', 'record_start_time')
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
      label.classList = 'form-label'
      label.innerHTML = 'Options'
      propsDiv.appendChild(label)

      // One row per option, so options can contain commas, and can be moved and removed
      const list = document.createElement('div')
      list.setAttribute('id', 'editTrackerTemplateOptions_' + widgetDef.uuid)
      propsDiv.appendChild(list)
      for (const option of widgetDef?.options ?? []) {
        list.appendChild(createOptionRow(widgetDef.uuid, list, option))
      }
      updateOptionButtons(list)

      const addButton = document.createElement('button')
      addButton.classList = 'btn btn-info btn-sm w-100 mb-2'
      addButton.setAttribute('id', 'editTrackerTemplateAddOption_' + widgetDef.uuid)
      addButton.textContent = 'Add option'
      addButton.addEventListener('click', () => {
        addOptionRow(widgetDef.uuid, list)
      })
      propsDiv.appendChild(addButton)
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
        label.textContent = field
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
    } else if (prop === 'slider_labels') {
      const row = document.createElement('div')
      row.classList = 'row mt-2 mb-2'
      propsDiv.appendChild(row)

      // Optional text shown under each end of the slider, such as "Not at all" and "Very much"
      for (const [field, key, text] of [['MinLabel', 'min_label', 'Low end label'], ['MaxLabel', 'max_label', 'High end label']]) {
        const col = document.createElement('div')
        col.classList = 'col-6'
        row.appendChild(col)

        const label = document.createElement('label')
        label.setAttribute('for', 'editTrackerTemplateSlider' + field + widgetDef.uuid)
        label.textContent = text
        col.appendChild(label)

        const input = document.createElement('input')
        input.classList = 'form-control'
        input.setAttribute('id', 'editTrackerTemplateSlider' + field + widgetDef.uuid)
        input.value = widgetDef?.[key] ?? ''
        input.addEventListener('change', (ev) => {
          editTrackerTemplateUpdateProperty(widgetDef.uuid, key, ev.target.value)
        })
        col.appendChild(input)
      }
    } else if (prop === 'counter_max') {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.setAttribute('for', 'editTrackerTemplateCounterMax' + widgetDef.uuid)
      label.innerHTML = `
      Maximum
      <span class="badge bg-info ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="The counter can't go above this. Leave it blank for no maximum." style="font-size: 0.55em; color: black">?</span>
      `
      propsDiv.appendChild(label)

      const input = document.createElement('input')
      input.classList = 'form-control mb-2'
      input.setAttribute('id', 'editTrackerTemplateCounterMax' + widgetDef.uuid)
      input.setAttribute('type', 'number')
      input.setAttribute('min', 1)
      input.setAttribute('step', 1)
      input.value = widgetDef?.max ?? ''
      input.addEventListener('change', (ev) => {
        // A blank maximum means no maximum
        const value = ev.target.value.trim() === '' ? null : Math.max(1, Math.round(Number(ev.target.value)))
        editTrackerTemplateUpdateProperty(widgetDef.uuid, 'max', value)
      })
      propsDiv.appendChild(input)
    } else if (prop === 'number_limits') {
      const label = document.createElement('label')
      label.classList = 'form-label'
      label.innerHTML = `
      Limits
      <span class="badge bg-info ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="Records with a number outside these limits can't be saved. Leave a limit blank for no limit." style="font-size: 0.55em; color: black">?</span>
      `
      propsDiv.appendChild(label)

      const row = document.createElement('div')
      row.classList = 'row mb-2'
      propsDiv.appendChild(row)

      for (const [field, key] of [['Min', 'min'], ['Max', 'max']]) {
        const col = document.createElement('div')
        col.classList = 'col-6'
        row.appendChild(col)

        const label = document.createElement('label')
        label.setAttribute('for', 'editTrackerTemplateNumber' + field + widgetDef.uuid)
        label.textContent = field
        col.appendChild(label)

        const input = document.createElement('input')
        input.classList = 'form-control'
        input.setAttribute('id', 'editTrackerTemplateNumber' + field + widgetDef.uuid)
        input.setAttribute('type', 'number')
        input.value = widgetDef?.[key] ?? ''
        input.addEventListener('change', (ev) => {
          // A blank limit means no limit
          const value = ev.target.value.trim() === '' ? null : Number(ev.target.value)
          editTrackerTemplateUpdateProperty(widgetDef.uuid, key, value)
        })
        col.appendChild(input)
      }
    } else if (prop === 'required') {
      const div = document.createElement('div')
      div.classList = 'form-check mb-2'
      propsDiv.appendChild(div)

      const input = document.createElement('input')
      input.classList = 'form-check-input'
      input.setAttribute('id', 'editTrackerTemplateRequired_' + widgetDef.uuid)
      input.setAttribute('type', 'checkbox')
      input.checked = widgetDef?.required === true
      input.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, ev.target.checked)
      })
      div.appendChild(input)

      const label = document.createElement('label')
      label.classList = 'form-check-label'
      label.setAttribute('for', 'editTrackerTemplateRequired_' + widgetDef.uuid)
      label.textContent = 'Required'
      div.appendChild(label)

      const hint = document.createElement('span')
      hint.classList = 'badge bg-info ms-1 align-middle'
      hint.setAttribute('data-bs-toggle', 'tooltip')
      hint.setAttribute('data-bs-placement', 'top')
      hint.setAttribute('title', 'Records can\'t be saved until this is filled in.')
      hint.style.fontSize = '0.55em'
      hint.style.color = 'black'
      hint.textContent = '?'
      label.appendChild(hint)
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
    } else if (prop === 'record_start_time') {
      const div = document.createElement('div')
      div.classList = 'form-check mb-2'
      propsDiv.appendChild(div)

      const input = document.createElement('input')
      input.classList = 'form-check-input'
      input.setAttribute('id', 'editTrackerTemplateRecordStartTime_' + widgetDef.uuid)
      input.setAttribute('type', 'checkbox')
      input.checked = widgetDef?.record_start_time === true
      input.addEventListener('change', (ev) => {
        editTrackerTemplateUpdateProperty(widgetDef.uuid, prop, ev.target.checked)
      })
      div.appendChild(input)

      const label = document.createElement('label')
      label.classList = 'form-check-label'
      label.setAttribute('for', 'editTrackerTemplateRecordStartTime_' + widgetDef.uuid)
      label.textContent = 'Record start time'
      div.appendChild(label)

      const hint = document.createElement('span')
      hint.classList = 'badge bg-info ms-1 align-middle'
      hint.setAttribute('data-bs-toggle', 'tooltip')
      hint.setAttribute('data-bs-placement', 'top')
      hint.setAttribute('title', 'Also record when this timer is first started, as "<timer name> (Start time)". Stopping and restarting the timer doesn\'t change it.')
      hint.style.fontSize = '0.55em'
      hint.style.color = 'black'
      hint.textContent = '?'
      label.appendChild(hint)
    }
  }

  // Enable all tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
  tooltipTriggerList.forEach((el) => bootstrap.Tooltip.getOrCreateInstance(el))
}

function createOptionRow (uuid, list, value = '') {
  // Create a row for editing one dropdown option, with buttons to move and remove it.

  const row = document.createElement('div')
  row.classList = 'tracker-option-row input-group input-group-sm mb-1'

  const input = document.createElement('input')
  input.classList = 'form-control'
  input.setAttribute('aria-label', 'Option')
  input.value = value
  input.addEventListener('change', () => saveOptionRows(uuid, list))
  input.addEventListener('keydown', (ev) => {
    // Enter adds the next option, as in a list
    if (ev.key !== 'Enter') return
    ev.preventDefault()
    saveOptionRows(uuid, list)
    addOptionRow(uuid, list, row)
  })
  row.appendChild(input)

  for (const [action, text, color, label] of [['up', '▲', 'btn-info', 'Move up'], ['down', '▼', 'btn-info', 'Move down'], ['remove', '×', 'btn-danger', 'Remove']]) {
    const button = document.createElement('button')
    button.classList = 'btn ' + color
    button.setAttribute('data-option-action', action)
    button.setAttribute('aria-label', label)
    button.textContent = text
    button.addEventListener('click', () => {
      if (action === 'up' && row.previousElementSibling) row.previousElementSibling.before(row)
      if (action === 'down' && row.nextElementSibling) row.nextElementSibling.after(row)
      if (action === 'remove') row.remove()
      updateOptionButtons(list)
      saveOptionRows(uuid, list)
    })
    row.appendChild(button)
  }
  return row
}

function addOptionRow (uuid, list, after = null) {
  // Add an empty option row, after the given row or at the end, and focus it.

  const row = createOptionRow(uuid, list)
  if (after) after.after(row)
  else list.appendChild(row)
  updateOptionButtons(list)
  row.querySelector('input').focus()
}

function updateOptionButtons (list) {
  // The first option can't move up, and the last can't move down

  const rows = [...list.querySelectorAll('.tracker-option-row')]
  rows.forEach((row, index) => {
    row.querySelector('[data-option-action="up"]').disabled = index === 0
    row.querySelector('[data-option-action="down"]').disabled = index === rows.length - 1
  })
}

function saveOptionRows (uuid, list) {
  // Save the options in the order they're listed. Blank rows aren't saved.

  const options = [...list.querySelectorAll('.tracker-option-row input')]
    .map((input) => input.value.trim())
    .filter(Boolean)
  editTrackerTemplateUpdateProperty(uuid, 'options', options)
}

function editTrackerTemplateUpdateProperty (uuid, property, value) {
  // Update the given property for the widget specified by the uuid.

  const template = getEditedTemplate()
  // null removes the property, such as a number limit left blank
  if (value === null) {
    delete template.widgets[uuid][property]
  } else {
    template.widgets[uuid][property] = value
  }
  setEditedTemplate(template)

  // The list shows each widget's name
  if (property === 'name') rebuildTrackerWidgetList()
}

// Template editor
//
// Templates are edited in the Analytics tab, beside a preview of the tracker that shows unsaved changes.

const WIDGET_TYPE_NAMES = {
  counter: 'Counter',
  dropdown: 'Dropdown',
  number: 'Number',
  slider: 'Slider',
  text: 'Text',
  timer: 'Timer'
}

// The preview is an iPad-sized page in landscape, so the tracker uses its tablet layout
const PREVIEW_SIZE = { width: 1024, height: 768 }

function scaleTrackerPreview () {
  // Scale the iPad-sized preview to fit its column.

  const frame = document.getElementById('trackerTemplatePreviewFrame')
  if (frame.clientWidth === 0) return // Not shown yet
  document.getElementById('trackerTemplatePreview').style.transform = `scale(${frame.clientWidth / PREVIEW_SIZE.width})`
}

function trackerTemplateHasUnsavedChanges () {
  // Return true if the template being edited has changed since it was opened or last saved.

  const editor = document.getElementById('trackerTemplateEditor')
  if (editor.style.display === 'none' || editor.dataset.template == null) return false
  return editor.dataset.template !== editor.dataset.savedTemplate
}

function confirmDiscardTrackerChanges () {
  // Before the template being edited is closed or replaced, ask whether to discard any unsaved changes.
  // Return a Promise that resolves true if there are no unsaved changes or the person discards them.

  if (!trackerTemplateHasUnsavedChanges()) return Promise.resolve(true)

  document.getElementById('trackerUnsavedChangesTemplateName').textContent = getEditedTemplate().name
  const modal = document.getElementById('trackerUnsavedChangesModal')
  const discardButton = document.getElementById('trackerUnsavedChangesDiscardButton')
  const keepButton = document.getElementById('trackerUnsavedChangesKeepButton')

  return new Promise((resolve) => {
    let discard = false
    const onDiscard = () => {
      discard = true
      exUtilities.hideModal(modal)
    }
    const onKeep = () => exUtilities.hideModal(modal)
    discardButton.addEventListener('click', onDiscard)
    keepButton.addEventListener('click', onKeep)

    // Closing the dialog any other way keeps editing
    modal.addEventListener('hidden.bs.modal', () => {
      discardButton.removeEventListener('click', onDiscard)
      keepButton.removeEventListener('click', onKeep)
      resolve(discard)
    }, { once: true })
    exUtilities.showModal(modal)
  })
}

// The tracker page also uses this module, so only set up the editor on the console, where it exists
if (document.getElementById('trackerTemplateEditor') != null) {
  window.addEventListener('resize', scaleTrackerPreview)
  new ResizeObserver(scaleTrackerPreview).observe(document.getElementById('trackerTemplatePreviewFrame'))

  // Ask before leaving the page with unsaved changes. The browser shows its own message.
  window.addEventListener('beforeunload', (event) => {
    if (trackerTemplateHasUnsavedChanges()) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
}

function getEditedTemplate () {
  // Return the template being edited, including unsaved changes.

  return JSON.parse(document.getElementById('trackerTemplateEditor').dataset.template)
}

function setEditedTemplate (template) {
  // Store the template being edited and show the change in the preview.

  document.getElementById('trackerTemplateEditor').dataset.template = JSON.stringify(template)
  updateTrackerPreview()
}

function updateTrackerPreview () {
  // Send the template being edited to the preview, which shows it without saving anything.

  const editor = document.getElementById('trackerTemplateEditor')
  if (editor.dataset.template == null) return

  const preview = document.getElementById('trackerTemplatePreview')
  preview.contentWindow?.postMessage({ type: 'trackerPreview', template: getEditedTemplate() }, window.location.origin)
}

export async function showTrackerTemplateEditor (uuid = '', { askFirst = true } = {}) {
  // Open the given template, or the one chosen in the template list, for editing in the Analytics tab.
  // Set askFirst = false if the person has already been asked about unsaved changes.

  if (uuid === '') uuid = document.getElementById('trackerTemplateSelect').value
  if (uuid === '') return
  if (askFirst && !(await confirmDiscardTrackerChanges())) return

  const template = await loadTemplate(uuid)
  if (template == null) return

  const editor = document.getElementById('trackerTemplateEditor')
  editor.dataset.template = JSON.stringify(template)
  editor.dataset.savedTemplate = editor.dataset.template
  document.getElementById('trackerTemplateEditorNameInput').value = template.name
  document.getElementById('editTrackerTemplateGuestFacingCheckbox').checked = template?.guest_facing === true

  // Load the preview the first time the editor opens, and send it the template once it has loaded
  const preview = document.getElementById('trackerTemplatePreview')
  if (!preview.getAttribute('src')) {
    preview.addEventListener('load', updateTrackerPreview)
    preview.setAttribute('src', 'tracker.html?preview=true')
  }

  editor.style.display = ''
  scaleTrackerPreview()
  selectTrackerWidget(template.widget_order[0] ?? null)
  updateTrackerPreview()
}

export async function closeTrackerTemplateEditor ({ askFirst = true } = {}) {
  // Hide the template editor, first asking whether to discard any unsaved changes.
  // Set askFirst = false to close without asking, such as when the template has been deleted.

  if (askFirst && !(await confirmDiscardTrackerChanges())) return
  document.getElementById('trackerTemplateEditor').style.display = 'none'
}

function rebuildTrackerWidgetList () {
  // Show a button for each widget in the template being edited, highlighting the selected one.

  const template = getEditedTemplate()
  const list = document.getElementById('trackerWidgetList')
  const selected = list.dataset.selected ?? ''
  list.innerHTML = ''

  for (const uuid of template.widget_order) {
    const widget = template.widgets[uuid]

    const col = document.createElement('div')
    col.classList = 'col'
    list.appendChild(col)

    const button = document.createElement('button')
    button.classList = 'btn btn-outline-primary w-100 text-break'
    if (uuid === selected) button.classList.add('active')
    button.textContent = widget.name || WIDGET_TYPE_NAMES[widget.type]
    button.setAttribute('title', WIDGET_TYPE_NAMES[widget.type] ?? '')
    button.addEventListener('click', () => {
      selectTrackerWidget(uuid)
    })
    col.appendChild(button)
  }

  document.getElementById('trackerWidgetListEmpty').style.display = template.widget_order.length === 0 ? 'block' : 'none'
}

function selectTrackerWidget (uuid) {
  // Show the given widget's properties for editing, or hide the properties if uuid is null.

  document.getElementById('trackerWidgetList').dataset.selected = uuid ?? ''
  rebuildTrackerWidgetList()

  const editPane = document.getElementById('trackerWidgetEditPane')
  if (uuid == null) {
    editPane.style.display = 'none'
    document.getElementById('editTrackerTemplatePropertiesDiv').innerHTML = ''
    return
  }
  editPane.style.display = 'block'
  populateWidgetProperties(getEditedTemplate().widgets[uuid])
}

export function addTrackerWidget (type) {
  // Add a new widget of the given type to the end of the template and select it.

  const template = getEditedTemplate()
  const widgetUUID = exUtilities.uuid()

  template.widget_order.push(widgetUUID)
  const widgetDef = {
    label: '',
    name: 'New ' + WIDGET_TYPE_NAMES[type],
    type,
    uuid: widgetUUID
  }
  if (type === 'dropdown') {
    widgetDef.multiple = false
    widgetDef.options = []
  } else if (type === 'slider') {
    widgetDef.min = 1
    widgetDef.max = 5
    widgetDef.step = 1
    widgetDef.start = 3
  } else if (type === 'text') {
    widgetDef.lines = 5
  } else if (type === 'timer') {
    widgetDef.exclusive = false
    widgetDef.record_start_time = false
  }
  template.widgets[widgetUUID] = widgetDef

  setEditedTemplate(template)
  selectTrackerWidget(widgetUUID)
}

export function moveSelectedTrackerWidget (dir) {
  // Move the selected widget the given number of places: -1 for up, 1 for down.

  const uuid = document.getElementById('trackerWidgetList').dataset.selected
  if (!uuid) return

  const template = getEditedTemplate()
  const index = template.widget_order.indexOf(uuid)
  const newIndex = index + dir
  if (index === -1 || newIndex < 0 || newIndex >= template.widget_order.length) return

  template.widget_order[index] = template.widget_order[newIndex]
  template.widget_order[newIndex] = uuid

  setEditedTemplate(template)
  rebuildTrackerWidgetList()
}

export function deleteSelectedTrackerWidget () {
  // Delete the selected widget and select the one after it, or before it if it was last.

  const uuid = document.getElementById('trackerWidgetList').dataset.selected
  if (!uuid) return

  const template = getEditedTemplate()
  const index = template.widget_order.indexOf(uuid)
  template.widget_order = template.widget_order.filter(item => item !== uuid)
  delete template.widgets[uuid]

  setEditedTemplate(template)
  selectTrackerWidget(template.widget_order[index] ?? template.widget_order[index - 1] ?? null)
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

export function renameTrackerTemplate (name) {
  // Change the name of the template being edited. Data are stored by the template's UUID, so they stay
  // together when it's renamed.

  const template = getEditedTemplate()
  template.name = name
  setEditedTemplate(template)
}

export async function saveTrackerTemplate () {
  // Save the template being edited, and show on the Save button whether it worked.

  const template = getEditedTemplate()
  const button = document.getElementById('trackerTemplateEditorSaveButton')

  // Save the name without surrounding spaces
  const nameInput = document.getElementById('trackerTemplateEditorNameInput')
  template.name = template.name.trim()
  if (template.name === '') {
    exUtilities.showModal('#trackerNameRequiredModal')
    return
  }
  nameInput.value = template.name
  setEditedTemplate(template)

  let response
  try {
    response = await exTools.makeServerRequest({
      method: 'POST',
      endpoint: '/tracker/template/create',
      params: { tracker_uuid: template.uuid, template }
    })
  } catch {
    response = null
  }

  if (response?.success === true) {
    document.getElementById('trackerTemplateEditor').dataset.savedTemplate = JSON.stringify(template)

    // Show any new name in the template list
    populateTrackerTemplateSelect(await getAvailableTemplates())
    document.getElementById('trackerTemplateSelect').value = template.uuid
  }
  button.textContent = response?.success === true ? 'Saved' : 'Not saved'
  setTimeout(() => { button.textContent = 'Save' }, 2000)
}

export async function createTrackerTemplate (name = 'New template') {
  // Create a template and open it for editing, ready to be named, as for new exhibitions and programs.

  // The new template opens for editing, replacing any template being edited
  if (!(await confirmDiscardTrackerChanges())) return

  const uuid = exUtilities.uuid()

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
    endpoint: '/tracker/template/create',
    params: requestDict
  })

  if (result.success === true) {
    const templates = await getAvailableTemplates()
    populateTrackerTemplateSelect(templates)
    document.getElementById('trackerTemplateSelect').value = uuid
    await showTrackerTemplateEditor(uuid, { askFirst: false })

    // Ready to type the template's name
    const nameInput = document.getElementById('trackerTemplateEditorNameInput')
    nameInput.focus()
    nameInput.select()
  }
}

export async function cloneTrackerTemplate () {
  // Save a copy of the template chosen in the template list and open it for editing. The copy has its
  // own UUID, so it collects its own data.

  const uuid = document.getElementById('trackerTemplateSelect').value
  if (uuid === '') return

  // The copy opens for editing, replacing any template being edited
  if (!(await confirmDiscardTrackerChanges())) return

  const template = await loadTemplate(uuid)
  if (template == null) return
  const clone = structuredClone(template)
  clone.uuid = exUtilities.uuid()
  clone.name += ' 2'

  const result = await exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/template/create',
    params: { tracker_uuid: clone.uuid, template: clone }
  })

  if (result?.success === true) {
    populateTrackerTemplateSelect(await getAvailableTemplates())
    document.getElementById('trackerTemplateSelect').value = clone.uuid
    showTrackerTemplateEditor(clone.uuid, { askFirst: false })
  }
}

export async function deleteTrackerTemplate (uuid = '') {
  // Ask the server to delete the specified tracker template

  if (uuid === '') {
    uuid = document.getElementById('trackerTemplateSelect').value
  }

  const result = await exTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/tracker/template/' + uuid
  })
  if (result.success) {
    const templates = await getAvailableTemplates()
    populateTrackerTemplateSelect(templates)
    exUtilities.hideModal('#deleteTrackerTemplateModal')

    // Don't leave a deleted template open for editing
    const editor = document.getElementById('trackerTemplateEditor')
    if (editor.dataset.template != null && getEditedTemplate().uuid === uuid) closeTrackerTemplateEditor({ askFirst: false })
  }
}

// The groups in the trackerDataSelect, by the app that collected the data
const TRACKER_DATA_GROUPS = [
  ['flexible_tracker', 'Flexible Tracker'],
  ['survey_kiosk', 'Survey Kiosk'],
  ['voting_kiosk', 'Voting Kiosk'],
  ['word_cloud', 'Word Cloud']
]

export function populateTrackerDataSelect (response) {
  // Take the list of data from Hub and populate the trackerDataSelect, grouped by app

  const trackerDataSelect = document.getElementById('trackerDataSelect')
  trackerDataSelect.innerHTML = ''

  const addGroup = (label, items) => {
    if (items.length === 0) return
    const group = document.createElement('optgroup')
    group.label = label
    for (const item of items) {
      const option = new Option(item.archived ? item.name + ' (archived)' : item.name, item.kind + '/' + item.id)
      option.dataset.kind = item.kind
      option.dataset.id = item.id
      option.dataset.name = item.name
      group.appendChild(option)
    }
    trackerDataSelect.appendChild(group)
  }
  const byName = (items) => items.sort((a, b) => a.name.localeCompare(b.name))

  const datasets = response.datasets ?? []
  for (const [app, label] of TRACKER_DATA_GROUPS) {
    addGroup(label, byName(datasets.filter((item) => item.app === app)))
  }
  const files = (response.files ?? []).map((name) => ({ kind: 'file', id: name, name, archived: false }))
  addGroup('Other files', byName(files))
}

export function showDeleteTrackerDataModal () {
  // Show a modal confirming the request to delete a specific dataset. To be sure
  // populate the modal with data for a test.

  const data = selectedTrackerData()
  if (data == null) return
  document.getElementById('deleteTrackerDataModalDeletedName').innerText = data.name
  document.getElementById('deleteTrackerDataModalDeletedInput').value = ''
  document.getElementById('deleteTrackerDataModalSpellingError').style.display = 'none'
  exUtilities.showModal('#deleteTrackerDataModal')
}

export function deleteTrackerDataFromModal () {
  // Check inputed answer and confirm it is correct. If so, ask for the data to
  // be deleted.

  const name = document.getElementById('deleteTrackerDataModalDeletedName').innerText
  const input = document.getElementById('deleteTrackerDataModalDeletedInput').value

  if (name === input) {
    deleteTrackerData()
  } else {
    document.getElementById('deleteTrackerDataModalSpellingError').style.display = 'block'
  }
}

export function deleteTrackerData () {
  // Send a message to the server asking it to delete the selected data

  const data = selectedTrackerData()
  if (data == null) return

  exTools.makeServerRequest({
    method: 'DELETE',
    endpoint: trackerDataEndpoint(data)
  })
    .then((result) => {
      if (result?.success) {
        exUtilities.hideModal('#deleteTrackerDataModal')
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

export function makeGuestFacing () {
  // Toggle on/off the option of making the template guest-facing

  const template = getEditedTemplate()
  template.guest_facing = document.getElementById('editTrackerTemplateGuestFacingCheckbox').checked
  setEditedTemplate(template)
}
