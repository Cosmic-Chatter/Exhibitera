import * as exCommon from '../js/exhibitera_app_common.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'

async function initializeWizard () {
  // Set up the wizard

  exSetup.prepareWizard()

  // Reset fields
  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) exSetup.initializeDefinition()

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('definitionModeInput').value = 'basic'
  document.getElementById('appFileSelect').innerText = 'Select file'
  document.getElementById('keyList').innerText = ''
  document.getElementById('appURLInput').value = ''

  configureOptions()
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)
  exSetup.config.initialDefinition = structuredClone(def)
  exSetup.config.workingDefinition = structuredClone(def)
  console.log(def)
  document.getElementById('definitionNameInput').value = def.name
  document.getElementById('definitionModeInput').value = def?.mode ?? 'basic'
  document.getElementById('appURLInput').value = def?.url ?? ''

  document.getElementById('appFileSelect').innerText = def?.path ?? 'Select file'

  // Configure the preview frame
  if (def.path !== '') {
    document.getElementById('previewFrame').src = '../' + def.path + '?standalone=true&definition=' + def.uuid
    document.getElementById('previewFrame').style.display = 'block'
  } else {
    document.getElementById('previewFrame').style.display = 'none'
  }
  configureOptions()
  exSetup.previewDefinition()
}

function createKeyValueHTML (key = '', value = '') {
  // Create a new HTML represetnation of a key-value pair

  const keyList = document.getElementById('keyList')

  const uuid = String(new Date().getTime() * Math.random() * 1e6)

  const html = `
  <div id="keyValue_${uuid}" data-uuid="${uuid}" class="keyValuePair col-12">
    <div class="row align-items-center">
      <div class="col-12 col-md-5">
        <div class="form-floating mb-3">
          <input id="key_${uuid}" type="text" class="form-control keyValueInput" placeholder="" value="${key}">
          <label for="key_${uuid}">Key</label>
        </div>
      </div>
      <div class="col-12 col-md-5">
        <div class="form-floating mb-3">
          <input id="value_${uuid}" type="text" class="form-control keyValueInput" placeholder="" value="${value}">
          <label for="value_${uuid}">Value</label>
        </div>
      </div>
      <div class="col-12 col-md-2 col-xxl-1">
        <button id="deleteButton_${uuid}" data-uuid="${uuid}"  class="btn btn-danger w-100 mb-3 keyValue-delete">X</button>
      </div>
    </div>
  </div>
  `
  keyList.innerHTML += html
  document.getElementById('key_' + uuid).addEventListener('change', rebuildPropertyDict)
  document.getElementById('value_' + uuid).addEventListener('change', rebuildPropertyDict)
}

function rebuildPropertyDict () {
  // Build a dictionary of all the keyValue pairs and add it to the definition.

  const dict = {}
  Array.from(document.querySelectorAll('.keyValuePair')).forEach((keyValue) => {
    const uuid = keyValue.getAttribute('data-uuid')
    const key = document.getElementById('key_' + uuid).value
    if (key.trim() === '') return
    dict[key] = document.getElementById('value_' + uuid).value
  })
  exSetup.updateWorkingDefinition(['properties'], dict)
}

function configureOptions () {
  // Configure which inputs to show based on the mode we are in.

  const mode = document.getElementById('definitionModeInput').value

  const appFileSelectGroup = document.getElementById('appFileSelectGroup')
  const keyListGroup = document.getElementById('keyListGroup')
  const appURLGroup = document.getElementById('appURLGroup')
  const appFileSelectHint = document.getElementById('appFileSelectHint')
  const appAPIHint = document.getElementById('appAPIHint')

  if (mode === 'basic') {
    appFileSelectGroup.style.display = 'block'
    appFileSelectHint.style.display = 'block'
    appURLGroup.style.display = 'none'
    keyListGroup.style.display = 'none'
    appAPIHint.style.display = 'none'
  } else if (mode === 'advanced') {
    appFileSelectGroup.style.display = 'block'
    appFileSelectHint.style.display = 'block'
    appURLGroup.style.display = 'none'
    keyListGroup.style.display = 'block'
    appAPIHint.style.display = 'block'
  } else if (mode === 'url') {
    appFileSelectGroup.style.display = 'none'
    appFileSelectHint.style.display = 'none'
    appURLGroup.style.display = 'block'
    keyListGroup.style.display = 'none'
    appAPIHint.style.display = 'none'
  }
}

// Set helperAddress for calls to exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

// Add event listeners
// -------------------------------------------------------------

// Settings
document.getElementById('definitionModeInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['mode'], event.target.value)
  configureOptions()
  exSetup.previewDefinition()
})
document.getElementById('appURLInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['url'], event.target.value)
  exSetup.previewDefinition()
})
document.getElementById('appFileSelect').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ directory: 'static', filetypes: ['html'], multiple: false, upload_any: true })
    .then((result) => {
      if (result.length > 0) {
        event.target.innerHTML = result[0]
        exSetup.updateWorkingDefinition(['path'], 'static/' + result[0])
        exSetup.previewDefinition()
      }
    })
})
document.getElementById('addKeyButton').addEventListener('click', (event) => {
  createKeyValueHTML()
})

document.addEventListener('click', (event) => {
  if (event.target.classList.contains('keyValue-delete') === false) return
  const uuid = event.target.getAttribute('data-uuid')
  document.getElementById('keyValue_' + uuid).remove()
  rebuildPropertyDict()
})

clearDefinitionInput()

exSetup.configure({
  app: 'other',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    mode: 'basic',
    path: '',
    properties: {}
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
