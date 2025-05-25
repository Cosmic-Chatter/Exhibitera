import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exSetup from '../js/exhibitera_setup_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'

async function initializeWizard () {
  // Set up the wizard

  exSetup.prepareWizard()

  // Reset fields
  document.getElementById('wizardDefinitionNameInput').value = ''
  document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
  document.getElementById('wizardCORSErrorAlert').style.display = 'none'
  document.getElementById('wizardURLBlankErrorAlert').style.display = 'none'
  document.getElementById('wizardPathBlankErrorAlert').style.display = 'none'
  document.getElementById('wizardSourceAppFileSelect').innerText = 'Upload and select'
  document.getElementById('wizardAppURLInput').value = ''
  document.getElementById('wizardAppModeBasic').checked = true
}

async function wizardForward (currentPage) {
  // Check if the wizard is ready to advance and perform the move

  if (currentPage === 'Welcome') {
    const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
    if (defName !== '') {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'none'
      exSetup.wizardGoTo('Mode')
    } else {
      document.getElementById('wizardDefinitionNameBlankWarning').style.display = 'block'
    }
  } else if (currentPage === 'Mode') {
    const header = document.getElementById('wizardSourceHeader')
    const filesGroup = document.getElementById('wizardSourceFilesGroup')
    const urlGroup = document.getElementById('wizardSourceAppURLGroup')
    if (document.getElementById('wizardAppModeURL').checked) {
      header.innerText = 'What URL do you want to load?'
      filesGroup.style.display = 'none'
      urlGroup.style.display = 'block'
    } else {
      header.innerText = 'Upload your app files'
      filesGroup.style.display = 'block'
      urlGroup.style.display = 'none'
    }
    exSetup.wizardGoTo('Source')
  } else if (currentPage === 'Source') {
    const mode = document.querySelector('input[name="wizardAppMode"]:checked').value

    if (mode === 'url') {
      const url = document.getElementById('wizardAppURLInput').value.trim()
      if (url === '') {
        document.getElementById('wizardURLBlankErrorAlert').style.display = 'block'
        return
      }
      if (checkCORS(url, true) === false) return
    } else {
      if (!exSetup.config.workingDefinition?.path) {
        document.getElementById('wizardPathBlankErrorAlert').style.display = 'block'
        return
      }
    }

    wizardCreateDefinition()
  }
}

function wizardBack (currentPage) {
  // Move the wizard back one page

  if (currentPage === 'Mode') {
    exSetup.wizardGoTo('Welcome')
  } else if (currentPage === 'Source') {
    exSetup.wizardGoTo('Mode')
  }
}

async function wizardCreateDefinition () {
  // Collect details from the wizard and build the definition.

  // Definition name
  const defName = document.getElementById('wizardDefinitionNameInput').value.trim()
  exSetup.updateWorkingDefinition(['name'], defName)

  const mode = document.querySelector('input[name="wizardAppMode"]:checked').value
  exSetup.updateWorkingDefinition(['mode'], mode)

  if (mode === 'url') {
    exSetup.updateWorkingDefinition(['url'], document.getElementById('wizardAppURLInput').value.trim())
  }

  const uuid = exSetup.config.workingDefinition.uuid

  await exSetup.saveDefinition(defName)
  const result = await exCommon.getAvailableDefinitions('other')
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
  document.getElementById('definitionModeInput').value = 'basic'
  document.getElementById('appFileSelect').innerText = 'Select file'
  document.getElementById('keyList').innerText = ''
  document.getElementById('appURLInput').value = ''

  document.getElementById('CORSErrorAlert').style.display = 'none'

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
  checkCORS(def?.url ?? '')

  document.getElementById('appFileSelect').innerText = def?.path ?? 'Select file'

  for (const key of Object.keys(def?.properties ?? {})) {
    const value = def.properties[key]
    createKeyValueHTML(key, value)
  }

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

async function checkCORS (url, wizard = false) {
  // Check if the given URL can be loaded and raise a warning if not.

  let CORSErrorAlert = document.getElementById('CORSErrorAlert')
  if (wizard) CORSErrorAlert = document.getElementById('wizardCORSErrorAlert')

  if (url.trim() === '') {
    CORSErrorAlert.style.display = 'none'
    return false
  }

  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }

  let success = false
  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      mode: 'cors'
    })
    if (response.ok) {
      success = true
    }
  } catch {
  }

  if (success) {
    CORSErrorAlert.style.display = 'none'
  } else {
    CORSErrorAlert.style.display = 'block'
  }

  return success
}

// Set helperAddress for calls to exCommon.makeHelperRequest
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

document.getElementById('wizardAppURLInput').addEventListener('change', (event) => {
  document.getElementById('wizardURLBlankErrorAlert').style.display = 'none'
  checkCORS(event.target.value, true)
})
document.getElementById('wizardSourceAppFileSelect').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ directory: 'static', filetypes: ['html'], multiple: false, upload_any: true })
    .then((result) => {
      if (result.length > 0) {
        event.target.innerText = result[0]
        console.log(result[0])
        exSetup.updateWorkingDefinition(['path'], 'static/' + result[0])
      }
    })
})

// Settings
document.getElementById('definitionModeInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['mode'], event.target.value)
  configureOptions()
  exSetup.previewDefinition()
})
document.getElementById('appURLInput').addEventListener('change', (event) => {
  checkCORS(event.target.value)
  exSetup.updateWorkingDefinition(['url'], event.target.value)
  exSetup.previewDefinition()
})
document.getElementById('appFileSelect').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ directory: 'static', filetypes: ['html'], multiple: false, upload_any: true })
    .then((result) => {
      if (result.length > 0) {
        event.target.innerText = result[0]
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
