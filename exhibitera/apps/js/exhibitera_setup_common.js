/* global bootstrap, Coloris, showdown */

import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from './exhibitera_app_common.js'
import * as exFileSelect from './exhibitera_file_select_modal.js'

HTMLElement.prototype.visibleHeight = function () {
  // Calculate the visible height of an element

  const scrollTop = window.scrollY // Top of the visible area
  const scrollBot = scrollTop + window.innerHeight // Bottom of the visible area
  const elTop = this.getBoundingClientRect().top + scrollTop // Top of the element (absolute position)
  const elBottom = elTop + this.offsetHeight // Bottom of the element (absolute position)
  const visibleTop = Math.max(elTop, scrollTop) // The visible top of the element
  const visibleBottom = Math.min(elBottom, scrollBot) // The visible bottom of the element

  return Math.max(visibleBottom - visibleTop, 0) // The visible height of the element
}

export const config = {
  availableDefinitions: {},
  clearDefinition: null,
  initialDefinition: null,
  loadDefinition: null,
  onDefinitionSave: null,
  fontCache: {}, // Keys with any value indicate that font has already been made
  workingDefinition: null,
  languages: [
    { code: 'af', name: 'Afrikaans', name_en: 'Afrikaans' },
    { code: 'sq', name: 'Shqip', name_en: 'Albanian' },
    { code: 'ar-dz', name: 'عربي', name_en: 'Arabic (Algeria)' },
    { code: 'ar-eg', name: 'عربي', name_en: 'Arabic (Egypt)' },
    { code: 'ar-iq', name: 'عربي', name_en: 'Arabic (Iraq)' },
    { code: 'ar-sa', name: 'عربي', name_en: 'Arabic (Saudi Arabia)' },
    { code: 'ar-ae', name: 'عربي', name_en: 'Arabic (U.A.E.)' },
    { code: 'bn', name: 'বাংলা', name_en: 'Bengali' },
    { code: 'bg', name: 'български език', name_en: 'Bulgarian' },
    { code: 'ca', name: 'Català', name_en: 'Catalan' },
    { code: 'zh', name: '中国人', name_en: 'Chinese (China)' },
    { code: 'zh-tw', name: '中国人', name_en: 'Chinese (Taiwan)' },
    { code: 'hr', name: 'Hrvatski', name_en: 'Croatian' },
    { code: 'cs', name: 'Čeština', name_en: 'Czech' },
    { code: 'da', name: 'Dansk', name_en: 'Danish' },
    { code: 'nl', name: 'Nederlands', name_en: 'Dutch' },
    { code: 'en-au', name: 'English', name_en: 'English (Australia)' },
    { code: 'en-nz', name: 'English', name_en: 'English (New Zealand)' },
    { code: 'en-gb', name: 'English', name_en: 'English (U.K.)' },
    { code: 'en-us', name: 'English', name_en: 'English (U.S.)' },
    { code: 'et', name: 'Eesti keel', name_en: 'Estonian' },
    { code: 'fi', name: 'Suomi', name_en: 'Finnish' },
    { code: 'fr', name: 'Français', name_en: 'French' },
    { code: 'de', name: 'Deutsch', name_en: 'German' },
    { code: 'el', name: 'Ελληνικά', name_en: 'Greek' },
    { code: 'he', name: 'עִברִית', name_en: 'Hebrew' },
    { code: 'hi', name: 'हिंदी', name_en: 'Hindi' },
    { code: 'hu', name: 'Magyar nyelv', name_en: 'Hungarian' },
    { code: 'is', name: 'Íslenskur', name_en: 'Icelandic' },
    { code: 'id', name: 'Bahasa Indonesia', name_en: 'Indonesian' },
    { code: 'ga', name: 'Gaeilge', name_en: 'Irish' },
    { code: 'gd', name: 'Gàidhlig', name_en: 'Scottish Gaelic' },
    { code: 'it', name: 'Italiano', name_en: 'Italian' },
    { code: 'jp', name: '日本語', name_en: 'Japanese' },
    { code: 'kr', name: '한국인', name_en: 'Korean' },
    { code: 'lv', name: 'Latviešu valoda', name_en: 'Latvian' },
    { code: 'lt', name: 'Lietuvių kalba', name_en: 'Lithuanian' },
    { code: 'ms', name: 'بهاس ملايو', name_en: 'Malay' },
    { code: 'mt', name: 'Malti', name_en: 'Maltese' },
    { code: 'no', name: 'Norsk', name_en: 'Norwegian' },
    { code: 'fa', name: 'فارسی', name_en: 'Persian' },
    { code: 'pl', name: 'Polski', name_en: 'Polish' },
    { code: 'pt', name: 'Português', name_en: 'Portuguese (Portugal)' },
    { code: 'pt-br', name: 'Português', name_en: 'Portuguese (Brazil)' },
    { code: 'pa', name: 'Português', name_en: 'Punjabi' },
    { code: 'ro', name: 'Limba română', name_en: 'Romanian' },
    { code: 'ru', name: 'Русский', name_en: 'Russian' },
    { code: 'sr', name: 'Cрпски језик', name_en: 'Serbian' },
    { code: 'sk', name: 'Slovenčina', name_en: 'Slovak' },
    { code: 'sl', name: 'Slovenščina', name_en: 'Slovene' },
    { code: 'es-mx', name: 'Español', name_en: 'Spanish (Mexico)' },
    { code: 'es', name: 'Español', name_en: 'Spanish (Spain)' },
    { code: 'sv', name: 'Svenska', name_en: 'Swedish' },
    { code: 'th', name: 'ภาษาไทย', name_en: 'Thai' },
    { code: 'ts', name: 'Xitsonga', name_en: 'Tsonga' },
    { code: 'tn', name: 'Setswana', name_en: 'Tswana' },
    { code: 'tr', name: 'Türkçe', name_en: 'Turkish' },
    { code: 'uk', name: 'українська мова', name_en: 'Ukrainian' },
    { code: 'ur', name: 'اردو', name_en: 'Urdu' },
    { code: 'vi', name: 'Tiếng Việt', name_en: 'Vietnamese' },
    { code: 'cy', name: 'Cymraeg', name_en: 'Welsh' },
    { code: 'xh', name: 'IsiXhosa', name_en: 'Xhosa' },
    { code: 'zu', name: 'IsiXhosa', name_en: 'Zulu' }
  ]
}

export async function configure (options) {
  // Set up the common fields for the setup app.

  // Set color mode ASAP to minimize any flash
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.querySelector('html').setAttribute('data-bs-theme', 'dark')
  } else {
    document.querySelector('html').setAttribute('data-bs-theme', 'light')
  }

  const defaults = {
    app: null,
    blankDefinition: {},
    clearDefinition: null,
    initializeWizard: null,
    loadDefinition: null,
    onDefinitionSave: null
  }

  options = { ...defaults, ...options } // Merge in user-supplied options

  // Make sure we have the options we need
  if (options.app == null) throw new Error("The options must include the 'app' field.")
  if (options.blankDefinition == null) throw new Error("The options must include the 'blankDefinition' field containing a blank definition object.")
  if (options.initializeWizard == null) throw new Error("The options must include the 'initializeWizard' field referencing the appropriate function.")
  if (options.loadDefinition == null) throw new Error("The options must include the 'loadDefinition' field referencing the appropriate function.")

  config.app = options.app
  config.clearDefinition = options.clearDefinition
  config.blankDefinition = options.blankDefinition
  config.initializeWizard = options.initializeWizard
  config.loadDefinition = options.loadDefinition
  if (options.onDefinitionSave != null) config.onDefinitionSave = options.onDefinitionSave

  initializeDefinition()
  const userFonts = await getUserFonts()

  createAdvancedColorPickers()
  createAdvancedFontPickers(userFonts)
  createDefinitionDeletePopup()
  createLoginEventListeners()
  createEventListeners()
  resizePreview()

  exCommon.getAvailableDefinitions(options.app)
    .then((response) => {
      if ('success' in response && response.success === true) {
        populateAvailableDefinitions(response.definitions)
      }
    })
    .then(() => {
      configureFromQueryString()
    })

  // Set up the color pickers
  function setUpColorPickers () {
    try {
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
    } catch {
    // Will fail if we aren't using any color pickers
    }
  }
  // Call with a slight delay to make sure the elements are loaded
  setTimeout(setUpColorPickers, 100)
}

function configureGUIForUser (user) {
  // Configure the interface for the permissions of the given user

  // Check whether the user has permission to edit this component
  exCommon.makeServerRequest({
    method: 'GET',
    endpoint: '/component/' + exCommon.config.uuid + '/groups'
  })
    .then((response) => {
      let groups = []
      if ('success' in response) {
        groups = response.groups
      }

      let allowed = false

      if (user.permissions.components.edit.includes('__all') || user.permissions.components.edit_content.includes('__all')) {
        allowed = true
      } else {
        for (const group of groups) {
          if (user.permissions.components.edit.includes(group) || user.permissions.components.edit_content.includes(group)) {
            allowed = true
          }
        }
      }
      if (allowed) {
        document.getElementById('helpInsufficientPermissionstMessage').style.display = 'none'
      } else {
        if (config.loggedIn === true) {
          document.getElementById('helpInsufficientPermissionstMessage').style.display = 'block'
          try {
            document.getElementById('setupTools').style.display = 'none'
            document.getElementById('editPane').style.display = 'none'
            document.getElementById('previewPane').style.display = 'none'
          } catch {
            // Doesn't exist for the settings page
          }
        }
      }
    })
}

export function showAppHelpModal (app) {
  // Ask the helper to send the relavent README.md file and display it in the modal

  const helpTextDiv = document.getElementById('helpTextDiv')

  const endpointStems = {
    dmx_control: '/dmx_control/',
    image_compare: '/image_compare/',
    infostation: '/infostation/',
    media_browser: '/media_browser/',
    media_player: '/media_player/',
    other: '/other/',
    timelapse_viewer: '/timelapse_viewer/',
    timeline_explorer: '/timeline_explorer/',
    voting_kiosk: '/voting_kiosk/',
    word_cloud: '/word_cloud/',
    word_cloud_input: '/word_cloud/',
    word_cloud_viewer: '/word_cloud/'
  }

  exCommon.makeHelperRequest({
    method: 'GET',
    api: '',
    endpoint: endpointStems[app] + 'README.md',
    rawResponse: true
  })
    .then((result) => {
      const formattedText = markdownConverter.makeHtml(result)
      // Add the formatted text
      helpTextDiv.innerHTML = formattedText

      // Set the max-width of all images inside the #helpTextDiv element
      document.querySelectorAll('#helpTextDiv img').forEach((img) => {
        img.style.maxWidth = '100%'
      })

      // Scroll the grandparent element of #helpTextDiv to the top
      const grandParent = helpTextDiv.parentElement?.parentElement
      if (grandParent) {
        grandParent.scrollTop = 0
      }
    })

  exUtilities.showModal('#appHelpModal')
}

export function populateAvailableDefinitions (definitions) {
  // Take a list of definitions and add them to the select.

  const availableDefinitionSelect = document.getElementById('availableDefinitionSelect')
  availableDefinitionSelect.innerHTML = ''
  config.availableDefinitions = definitions
  const keys = Object.keys(definitions).sort((a, b) => {
    const aName = definitions[a].name.toLowerCase()
    const bName = definitions[b].name.toLowerCase()
    if (aName > bName) return 1
    if (bName > aName) return -1
    return 0
  })

  for (const uuid of keys) {
    if (uuid.startsWith('__preview') || uuid.trim() === '') continue

    const option = new Option(definitions[uuid].name, uuid)
    availableDefinitionSelect.appendChild(option)
  }
}

export function configureFromQueryString () {
  // Use the query string to configure the setup app.

  const queryString = decodeURIComponent(window.location.search)
  const searchParams = new URLSearchParams(queryString)

  if (searchParams.get('definition') != null) {
    config.loadDefinition(searchParams.get('definition'))
    document.getElementById('availableDefinitionSelect').value = searchParams.get('definition')
  } else {
    if (config.clearDefinition != null) config.clearDefinition()
    if (config.loggedIn) {
      const modal = document.getElementById('appWelcomeModal')
      if (modal) exUtilities.showModal()
    }
  }
}

export function getDefinitionByUUID (uuid = '') {
  // Return the definition with this UUID

  if (uuid === '') {
    uuid = document.getElementById('availableDefinitionSelect').value
  }
  let matchedDef = null
  Object.keys(config.availableDefinitions).forEach((key) => {
    const def = config.availableDefinitions[key]
    if (def.uuid === uuid) {
      matchedDef = def
    }
  })
  return matchedDef
}

export function prepareWizard () {
  // Perform some common setup actions to prepare the wizard

  initializeDefinition()

  // Hide all but the welcome screen
  for (const el of document.querySelectorAll('.wizard-pane') ?? []) {
    el.style.display = 'none'
  }
  document.getElementById('wizardPane_Welcome').style.display = 'block'
}

async function showSetupWizard () {
  // Show the modal for the setup wizard

  await config.initializeWizard()
  exUtilities.showModal('#setupWizardModal')
}

export function addWizardLanguage () {
  // Create HTML for a new wizard language selector. This is a simplified version
  // of the main language picker

  const col = document.createElement('div')
  col.classList = 'col'

  const row = document.createElement('div')
  row.classList = 'row gy-2'
  col.appendChild(row)

  const selectCol = document.createElement('div')
  selectCol.classList = 'col-9 pe-1'
  row.appendChild(selectCol)

  const select = document.createElement('select')
  select.classList = 'form-select'
  selectCol.appendChild(select)

  for (const lang of config.languages) {
    const option = new Option(lang.name_en, lang.code)
    select.appendChild(option)
  }
  select.value = 'en-gb'

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-3 ps-1'
  row.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger w-100'
  deleteButton.innerHTML = '×'
  deleteCol.appendChild(deleteButton)
  deleteButton.addEventListener('click', () => {
    col.remove()
  })

  document.getElementById('wizardLanguages').append(col)
}

export function initializeDefinition () {
  // Create a blank definition at save it to workingDefinition.

  const temp = structuredClone(config.blankDefinition)
  if (temp == null) return
  temp.uuid = exUtilities.uuid()
  config.initialDefinition = temp
  config.workingDefinition = temp
  previewDefinition(false)
}

function deleteDefinition () {
  // Delete the definition currently listed in the select.

  const definition = document.getElementById('availableDefinitionSelect').value

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/definitions/' + definition + '/delete'
  })
    .then(() => {
      exCommon.getAvailableDefinitions(config.app)
        .then((response) => {
          if ('success' in response && response.success === true) {
            populateAvailableDefinitions(response.definitions)
          }
        })
    })
}

function cloneDefinition () {
  // Clone the definition currently in the select and make it active.

  const uuidToClone = document.getElementById('availableDefinitionSelect').value
  if (uuidToClone === '') return

  const defToClone = structuredClone(getDefinitionByUUID(uuidToClone))

  defToClone.uuid = '' // Will be replaced with a new UUID on saving
  defToClone.name += ' 2'

  exCommon.writeDefinition(defToClone)
    .then((result) => {
      if ('success' in result && result.success === true) {
        exCommon.getAvailableDefinitions(config.app)
          .then((response) => {
            if ('success' in response && response.success === true) {
              populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = result.uuid
              config.loadDefinition(result.uuid)
            }
          })
      }
    })
}

export function updateWorkingDefinition (property, value) {
  // Update a field in the working defintion.
  // 'property' should be an array of subproperties, e.g., ["style", "color", 'header']
  // for definition.style.color.header

  if (property && property[0].length <= 1) {
    // occasionally the color library is providing a property with a large amount of single entries that clog up the definition json
    console.log(`skipping ${property}`)
    return
  }
  exUtilities.setObjectProperty(config.workingDefinition, property, value)
}

export async function saveDefinition (name = '') {
  // Collect inputted information to save the definition

  const definition = config.workingDefinition
  const initialDefinition = config.initialDefinition
  definition.app = config.app
  if (name === '') definition.name = document.getElementById('definitionNameInput').value
  definition.uuid = initialDefinition.uuid

  return exCommon.writeDefinition(definition)
    .then((result) => {
      if (result?.success === true) {
        // Update the UUID in case we have created a new definition
        config.initialDefinition = structuredClone(definition)

        // If we have a completion handler, call it with the definition
        if (config.onDefinitionSave != null) config.onDefinitionSave(config.workingDefinition)
        exCommon.getAvailableDefinitions(config.app)
          .then((response) => {
            if ('success' in response && response.success === true) {
              populateAvailableDefinitions(response.definitions)
            }
          })
      }
    })
}

export function createLoginEventListeners () {
  // Bind event listeners for login elements

  // Login
  document.getElementById('loginSubmitButton').addEventListener('click', loginFromDropdown)
  document.getElementById('logoutButton').addEventListener('click', logoutUser)

  document.getElementById('changePasswordButton').addEventListener('click', showPasswordChangeModal)
  document.getElementById('passwordChangeModalSubmitButton').addEventListener('click', submitUserPasswordChange)
}

function createEventListeners () {
  // Bind various event listeners to their elements.

  // Wizard
  try {
    document.getElementById('wizardAddLanguageButton').addEventListener('click', addWizardLanguage)
  } catch {
  }
  try {
    document.getElementById('showWizardButton').addEventListener('click', showSetupWizard)
  } catch {
  }
  try {
    document.getElementById('appWelcomeModalWizardButton').addEventListener('click', () => {
      exUtilities.hideModal('#appWelcomeModal')
      showSetupWizard()
    })
  } catch {
  }

  // New definition buttons
  document.getElementById('newDefinitionButton').addEventListener('click', () => {
    config.clearDefinition()
  })
  document.getElementById('cloneDefinitionButton').addEventListener('click', cloneDefinition)

  // Edit definition button
  document.getElementById('editDefinitionButton').addEventListener('click', () => {
    config.loadDefinition()
  })

  // Save definition button
  document.getElementById('definitionSaveButton').addEventListener('click', () => {
    saveDefinition()
  })

  // Preview definition button
  document.getElementById('previewRefreshButton').addEventListener('click', () => {
    previewDefinition(false)
  })

  // configure preview options
  const refreshOnChangeCheckbox = document.getElementById('refreshOnChangeCheckbox')

  document.getElementById('previewAspect16x9').addEventListener('click', () => {
    configurePreview('16x9', refreshOnChangeCheckbox.checked)
  })
  document.getElementById('previewAspect9x16').addEventListener('click', () => {
    configurePreview('9x16', refreshOnChangeCheckbox.checked)
  })
  document.getElementById('previewAspect16x10').addEventListener('click', () => {
    configurePreview('16x10', refreshOnChangeCheckbox.checked)
  })
  document.getElementById('previewAspect10x16').addEventListener('click', () => {
    configurePreview('10x16', refreshOnChangeCheckbox.checked)
  })
  document.getElementById('previewAspect4x3').addEventListener('click', () => {
    configurePreview('4x3', refreshOnChangeCheckbox.checked)
  })
  document.getElementById('previewAspect3x4').addEventListener('click', () => {
    configurePreview('3x4', refreshOnChangeCheckbox.checked)
  })

  document.getElementById('refreshOnChangeCheckbox').addEventListener('change', () => {
    let previewRatio = '16x9'
    const autoRefresh = refreshOnChangeCheckbox.checked
    if (config.workingDefinition?.setup) previewRatio = config.workingDefinition.setup.preview_ratio
    if (autoRefresh === true) configurePreview(previewRatio, autoRefresh)
  })

  // Help button
  document.getElementById('helpButton').addEventListener('click', () => {
    showAppHelpModal(config.app)
  })

  // Preview frame
  window.addEventListener('load', resizePreview)
  window.addEventListener('resize', resizePreview)
  window.addEventListener('scroll', resizePreview)

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function createDefinitionDeletePopup () {
  // Create the popup that occurs when clicking the definition delete button.

  const deleteDefinitionButton = document.getElementById('deleteDefinitionButton')
  deleteDefinitionButton.setAttribute('data-bs-toggle', 'popover')
  deleteDefinitionButton.setAttribute('title', 'Are you sure?')
  deleteDefinitionButton.setAttribute('data-bs-content', '<a id="DefinitionDeletePopover" class="btn btn-danger w-100">Confirm</a>')
  deleteDefinitionButton.setAttribute('data-bs-trigger', 'focus')
  deleteDefinitionButton.setAttribute('data-bs-html', 'true')
  document.addEventListener('click', function (event) {
    if (event.target && event.target.id === 'DefinitionDeletePopover') {
      deleteDefinition()
    }
  })

  deleteDefinitionButton.addEventListener('click', function () { deleteDefinitionButton.focus() })
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl)
  })
}

export function configurePreview (ratio, autoRefresh) {
  // Toggle the preview between various aspect ratios and orientations.

  updateWorkingDefinition(['setup', 'preview_ratio'], ratio)
  updateWorkingDefinition(['setup', 'auto_refresh'], autoRefresh)

  const previewFrame = document.getElementById('previewFrame')
  document.getElementById('refreshOnChangeCheckbox').checked = autoRefresh

  // First, remove all ratio classes
  previewFrame.classList.remove('preview-16x9')
  previewFrame.classList.remove('preview-9x16')
  previewFrame.classList.remove('preview-16x10')
  previewFrame.classList.remove('preview-10x16')
  previewFrame.classList.remove('preview-4x3')
  previewFrame.classList.remove('preview-3x4')

  previewFrame.classList.add('preview-' + ratio)

  resizePreview()
  previewDefinition()
}

export function configurePreviewFromDefinition (def) {
  // Use the setup section of def to configur the preview behavior

  const behavior = {
    preview_ratio: '16x9',
    auto_refresh: true
  }

  if ('setup' in def) {
    if ('preview_ratio' in def.setup) behavior.preview_ratio = def.setup.preview_ratio
    if ('auto_refresh' in def.setup) behavior.auto_refresh = def.setup.auto_refresh
  }
  configurePreview(behavior.preview_ratio, behavior.auto_refresh)
}

function resizePreview () {
  // Resize the preview so that it always fits the view.

  const previewPane = document.getElementById('previewPane')
  const previewFrame = document.getElementById('previewFrame')
  // Size of things above view area
  const headerHeight = document.getElementById('setupHeader').visibleHeight()
  const toolsHeight = document.getElementById('setupTools').visibleHeight()
  const viewportHeight = window.innerHeight

  // First, set the height of the area available for the preview
  previewPane.style.height = String(viewportHeight - headerHeight - toolsHeight) + 'px'

  // Size of available area
  const paneWidth = previewPane.offsetWidth
  const paneHeight = previewPane.offsetHeight

  // Size of frame (this will be 1920 on the long axis)
  const frameWidth = previewFrame.offsetWidth
  const frameHeight = previewFrame.offsetHeight
  const frameAspect = frameWidth / frameHeight

  let transformRatio
  if (frameAspect <= 1) {
    // Handle portrait (constraint should be height)
    transformRatio = 0.95 * paneHeight / frameHeight
  } else {
    // Handle landscape (constraint should be width)
    transformRatio = 1.0 * paneWidth / frameWidth
  }

  previewFrame.style.transform = 'scale(' + transformRatio + ')'
}

export function previewDefinition (automatic = false) {
  // Save the definition to a temporary file and load it into the preview frame.
  // If automatic == true, we've called this function beceause a definition field
  // has been updated. Only preview if the 'Refresh on change' checkbox is checked

  if ((automatic === true) && document.getElementById('refreshOnChangeCheckbox').checked === false) {
    return
  }

  const def = structuredClone(config.workingDefinition)

  // Set the uuid to a temp one
  def.uuid = '__preview_' + config.app
  exCommon.writeDefinition(def)
    .then((result) => {
      if (result.success && result.success === true) {
        // Configure the preview frame
        if (config.app === 'word_cloud_input') {
          document.getElementById('previewFrame').src = '/word_cloud/input?standalone=true&definition=' + '__preview_' + config.app
        } else if (config.app === 'word_cloud_viewer') {
          document.getElementById('previewFrame').src = '/word_cloud/viewer?standalone=true&definition=' + '__preview_' + config.app
        } else {
          document.getElementById('previewFrame').src = '/' + config.app + '?standalone=true&definition=' + '__preview_' + config.app
        }
      }
    })
}

function createAdvancedColorPickers () {
  // Look for advanced-color-picker elements and fill them with the combo widget.

  Array.from(document.querySelectorAll('.advanced-color-picker')).forEach((el) => {
    const name = el.getAttribute('data-constACP-name')
    const path = el.getAttribute('data-constACP-path').split('>')
    _createAdvancedColorPicker(el, name, path)
  })
}

function _createAdvancedColorPicker (el, name, path) {
  // Create the GUI for an advanced color picker
  // 'name' is the name of the picker to be displayed in the label
  // 'path' is the definition path to be prepended to the elements.

  const id = String(Math.round(Math.random() * 1e10))
  el.setAttribute('data-constACP-id', id)

  el.innerHTML = `
    <div class="border rounded px-2 py-2">
      <label class="form-label">${name}</label>
      <div class="row">
        <div class="col-6">
          <select id="ACPModeSelect_${id}" class="form-select constACP-mode">
            <option value="color">Solid color</option>
            <option value="gradient">Color gradient</option>
            <option value="image">Image</option>
          </select>
        </div>
        <div id="ACPColorCol_${id}" class="col-6">
          <input id="ACPColor_${id}" type="text" class="coloris form-control constACP-color" value="#22222E">
        </div>
        <div id="ACPGradientCol_${id}" class="col-6 d-none">
          <div class="row gy-1">
            <div class="col-6">
              <input id="ACPGradient_gradient1_${id}" type="text" class="coloris form-control constACP-gradient1" value="#22222E">
              <input id="ACPGradient_gradient2_${id}" type="text" class="coloris form-control constACP-gradient2" value="#22222E">
            </div>
            <div class="col-6">
              <label for="ACPAnglePicker_${id}" class="form-label">Angle</label>
              <input id="ACPAnglePicker_${id}" class="form-control constACP-angle" type="number" min="0" max="359" value="0">
            </div>
          </div>
        </div>
        <div id="ACPImageCol_${id}" class="col-6 d-none">
          <button id="ACPImage_${id}" class="btn btn-outline-primary w-100 text-break constACP-image">Select image</button>
        </div>
        
      </div>
    </div>
  `

  // Add event listeners
  document.getElementById(`ACPModeSelect_${id}`).addEventListener('change', (event) => {
    _onAdvancedColorPickerModeChange(id, path, event.target.value)
  })

  document.getElementById(`ACPColor_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'color'], event.target.value)
    previewDefinition(true)
  })

  document.getElementById(`ACPImage_${id}`).addEventListener('click', (event) => {
    exFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
      .then((result) => {
        if (result != null && result.length > 0) {
          updateWorkingDefinition([...path, 'image'], result[0])
          event.target.innerHTML = result[0]
          previewDefinition(true)
        }
      })
  })
  document.getElementById(`ACPGradient_gradient1_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_color_1'], event.target.value)
    previewDefinition(true)
  })
  document.getElementById(`ACPGradient_gradient2_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_color_2'], event.target.value)
    previewDefinition(true)
  })
  document.getElementById(`ACPAnglePicker_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_angle'], event.target.value % 360)
    previewDefinition(true)
  })
}

function _onAdvancedColorPickerModeChange (id, path, value) {
  // Configure the GUI based on the selected value

  const colorCol = document.getElementById(`ACPColorCol_${id}`)
  const gradCol = document.getElementById(`ACPGradientCol_${id}`)
  const imageCol = document.getElementById(`ACPImageCol_${id}`)

  if (value === 'color') {
    colorCol.classList.remove('d-none')
    gradCol.classList.add('d-none')
    imageCol.classList.add('d-none')
  } else if (value === 'gradient') {
    colorCol.classList.add('d-none')
    gradCol.classList.remove('d-none')
    imageCol.classList.add('d-none')
  } else if (value === 'image') {
    colorCol.classList.add('d-none')
    gradCol.classList.add('d-none')
    imageCol.classList.remove('d-none')
  }
  updateWorkingDefinition([...path, 'mode'], value)
  previewDefinition(true)
}

export function updateAdvancedColorPicker (path,
  details,
  defaults = { mode: 'color', color: '#fff' }) {
  // Update the color picker defined by path using the values in details.

  const el = document.querySelector(`.advanced-color-picker[data-constACP-path="${path}"]`)
  if (el == null) return
  if (el.childNodes.length === 0) return

  el.querySelector('.constACP-mode').value = details?.mode ?? defaults?.mode

  const solidColorPicker = el.querySelector('.constACP-color')
  solidColorPicker.value = details?.color ?? defaults?.color
  solidColorPicker.dispatchEvent(new Event('input', { bubbles: true }))

  const gradientPicker1 = el.querySelector('.constACP-gradient1')
  gradientPicker1.value = details?.gradient_color_1 ?? defaults?.gradient_color_1
  gradientPicker1.dispatchEvent(new Event('input', { bubbles: true }))

  const gradientPicker2 = el.querySelector('.constACP-gradient2')
  gradientPicker2.value = details?.gradient_color_2 ?? defaults?.gradient_color_2
  gradientPicker2.dispatchEvent(new Event('input', { bubbles: true }))

  el.querySelector('.constACP-angle').value = details?.gradient_angle ?? defaults?.gradient_angle

  el.querySelector('.constACP-image').innerHTML = details?.image ?? defaults?.image

  const id = el.getAttribute('data-constACP-id')
  _onAdvancedColorPickerModeChange(id, path, details?.mode ?? defaults.mode)
}

export function updateColorPickers (colors) {
  // Take a dictionary of colors and update the corresponding color pickers

  for (const key of Object.keys(colors)) {
    const el = document.getElementById('colorPicker_' + key)
    if (el == null) continue
    el.value = colors[key]
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function createAdvancedFontPickers (userFonts) {
  // Automatically create advanced font pickers for all marked elements

  Array.from(document.querySelectorAll('.advanced-font-picker')).forEach((el) => {
    const name = el.getAttribute('data-constAFP-name')
    const path = el.getAttribute('data-constAFP-path')
    const defaultFont = el.getAttribute('data-default')
    createAdvancedFontPicker({ parent: el, name, path, default: defaultFont })
  })

  populateAdvancedFontPickers(userFonts)
}

export function createAdvancedFontPicker (details) {
  // Create an advanced font select

  const id = exUtilities.uuid()
  details.parent.setAttribute('data-constAFP-id', id)

  details.parent.innerHTML = `
    <label for="AFPSelect_${id}" class="form-label">${details.name}</label>
    <select id="AFPSelect_${id}" class="form-select AFP-select" data-default="${details.default}"></select>
  `
  const el = document.getElementById(`AFPSelect_${id}`)
  el.setAttribute('data-path', details.path)
  // Add event listeners
  el.addEventListener('change', (event) => {
    _onAdvancedFontPickerChange(event.target)
  })
}

function getUserFonts () {
  // Query the app for any uploaded user fonts.

  return new Promise(function (resolve, reject) {
    exCommon.makeHelperRequest({
      method: 'GET',
      endpoint: '/files/availableContent'
    })
      .then((result) => {
        const availableFonts = []
        result.content.forEach((item) => {
          if (exFiles.guessMimetype(item) === 'font') {
            availableFonts.push(item)
          }
        })
        resolve(availableFonts)
      })
  })
}

export async function refreshAdvancedFontPickers () {
  // Retrive any new fonts and update the pickers

  const userFonts = await getUserFonts()

  // Cache the current values
  const currentDict = {}
  Array.from(document.querySelectorAll('.AFP-select')).forEach((el) => {
    currentDict[el.getAttribute('id')] = el.value
  })
  populateAdvancedFontPickers(userFonts)
  for (const id of Object.keys(currentDict)) {
    const picker = document.getElementById(id)
    // Check if option still exists (font may have been deleted)
    if (Array.from(picker.options).map(o => o.value).includes(currentDict[id]) === false) {
      picker.value = '/_fonts/' + picker.getAttribute('data-default')
    } else {
      picker.value = currentDict[id]
    }
    _onAdvancedFontPickerChange(picker)
  }
}

function populateAdvancedFontPickers (userFonts) {
  // Add user and default fonts

  const builtInFonts = [
    { name: 'Open Sans Light', path: 'OpenSans-Light.ttf' },
    { name: 'Open Sans Light Italic', path: 'OpenSans-LightItalic.ttf' },
    { name: 'Open Sans Regular', path: 'OpenSans-Regular.ttf' },
    { name: 'Open Sans Italic', path: 'OpenSans-Italic.ttf' },
    { name: 'Open Sans Medium', path: 'OpenSans-Medium.ttf' },
    { name: 'Open Sans Medium Italic', path: 'OpenSans-MediumItalic.ttf' },
    { name: 'Open Sans Semibold', path: 'OpenSans-SemiBold.ttf' },
    { name: 'Open Sans Semibold Italic', path: 'OpenSans-SemiBoldItalic.ttf' },
    { name: 'Open Sans Bold', path: 'OpenSans-Bold.ttf' },
    { name: 'Open Sans Bold Italic', path: 'OpenSans-BoldItalic.ttf' },
    { name: 'Open Sans Extra Bold', path: 'OpenSans-ExtraBold.ttf' },
    { name: 'Open Sans Extra Bold Italic', path: 'OpenSans-ExtraBoldItalic.ttf' }
  ]

  Array.from(document.querySelectorAll('.AFP-select')).forEach((parent) => {
    parent.innerHTML = ''

    // First, add the detault
    const defaultFont = parent.getAttribute('data-default')
    _createAdvancedFontOption(parent, 'Default', '/_fonts/' + defaultFont)

    // Then, add the user fonts
    if (userFonts.length > 0) {
      const user = new Option('User-provided')
      user.setAttribute('disabled', true)
      parent.appendChild(user)

      userFonts.forEach((font) => {
        _createAdvancedFontOption(parent, font, '/content/' + font)
      })
    }

    // Finally, add the built-in font list
    const builtInLabel = new Option('Built-in')
    builtInLabel.setAttribute('disabled', true)
    parent.appendChild(builtInLabel)
    builtInFonts.forEach((font) => {
      _createAdvancedFontOption(parent, font.name, '/_fonts/' + font.path)
    })

    _onAdvancedFontPickerChange(parent, false)
  })
}

function _createAdvancedFontOption (parent, name, path) {
  // Create a stylized option to represent the font and add it to the parent select.

  let safeName = name.replaceAll(' ', '').replaceAll('.', '').replaceAll('/', '').replaceAll('\\', '')
  if (safeName === 'Default') {
    safeName += parent.getAttribute('id').slice(10)
  }

  const option = new Option(name, path)

  // Check if font already exists
  if (!(safeName in config.fontCache)) {
    const fontDef = new FontFace(safeName, 'url(' + encodeURI(path) + ')')
    document.fonts.add(fontDef)
    config.fontCache[safeName] = true
  }
  option.style.fontFamily = safeName
  option.setAttribute('data-safeName', safeName)

  parent.appendChild(option)
}

function _onAdvancedFontPickerChange (el, saveChange = true) {
  // Respond to a change in an advanced font select.
  // Set writeChange = false when first setting up the element

  if (el.selectedIndex < 0) return

  const path = el.getAttribute('data-path').split('>')

  if (saveChange) {
  // Save the change
    updateWorkingDefinition([...path], el.value)
    previewDefinition(true)
  }

  // Change the select font to match this font
  let safeName = el.options[el.selectedIndex].getAttribute('data-safeName')
  if (safeName === 'Default') {
    safeName += el.getAttribute('id').slice(10)
  }
  el.style.fontFamily = safeName
}

export function updateAdvancedFontPickers (fonts) {
  // Take a dictionary of fonts and update the corresponding font pickers

  for (const key of Object.keys(fonts)) {
    const picker = document.querySelector(`.AFP-select[data-path="style>font>${key}"`)
    if (picker != null) setAdvancedFontPicker(picker, fonts[key])
  }
}

export function setAdvancedFontPicker (el, value) {
  // Set the given advanced font picker to the specified font.

  el.value = value
  _onAdvancedFontPickerChange(el)
}

export function updateTextSizeSliders (sizes) {
  // Take a dictionary of text sizes and update the matching sliders

  for (const key of Object.keys(sizes)) {
    const el = document.getElementById(key + 'TextSizeSlider')
    if (el != null) el.value = sizes[key]
  }
}

export function resetAdvancedFontPickers () {
  // Find and reset all advanced font pickers to their default values.
  Array.from(document.querySelectorAll('.AFP-select')).forEach((el) => {
    const defaultFont = '/_fonts/' + el.getAttribute('data-default')
    setAdvancedFontPicker(el, defaultFont)
  })
}

export function loginFromDropdown () {
  // Collect the username and password and attempt to log in the user.

  const username = document.getElementById('loginDropdownUsername').value.trim().toLowerCase()
  const password = document.getElementById('loginDropdownPassword').value

  // Clear existing login token
  document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC;'

  exCommon.makeServerRequest({
    method: 'POST',
    endpoint: '/user/login',
    params: {
      credentials: [username, password]
    }
  })
    .then((response) => {
      if ('authToken' in response) {
        // Set a cookie
        document.cookie = 'authToken="' + response.authToken + '"; max-age=31536000; path=/'
      }
      if (response.success === true) {
        // Reload the page now that the authentication cookie is set.
        location.reload()
      }
    })
}

export function logoutUser () {
  // Remove the user and delete the cookie.

  document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
  location.reload()
}

export function authenticateUser () {
  // If authToken exists in the cookie, use it to log in

  let token = ''
  document.cookie.split(';').forEach((item) => {
    item = item.trim()
    if (item.startsWith('authToken="')) {
      token = item.slice(11, -1)
    }
  })

  if (token === '') {
    token = 'This will fail' // Token cannot be an empty string
    configureUser({}, false)
  }

  return exCommon.makeServerRequest({
    method: 'POST',
    endpoint: '/user/login',
    params: { token }
  })
    .then((response) => {
      if (response.success === true) {
        configureUser(response.user)
      }
    })
}

function configureUser (userDict, login = true) {
  // Take a dictionary of user details and set up Exhibitera to reflect it.
  // set login=false to set up a logged out user

  if (Object.keys(userDict).length === 0) {
    // Configure minimal permissions
    userDict.permissions = {
      analytics: 'none',
      components: {
        edit: [],
        edit_content: [],
        view: []
      },
      exhibits: 'none',
      maintenance: 'none',
      schedule: 'none',
      settings: 'none',
      users: 'none'
    }
  }
  config.user = userDict
  config.loggedIn = login

  if (login === true) {
    document.getElementById('helpNewAccountMessage').style.display = 'none'
    document.getElementById('loginMenu').style.display = 'none'
    document.getElementById('userMenu').style.display = 'block'

    // Set the name of the account
    document.getElementById('userMenuUserDisplayName').innerHTML = userDict.display_name
    let initials = ''
    userDict.display_name.split(' ').forEach((word) => {
      initials += word.slice(0, 1)
    })
    document.getElementById('userMenuUserShortName').innerHTML = initials
  } else {
    document.getElementById('helpNewAccountMessage').style.display = 'block'
    document.getElementById('loginMenu').style.display = 'block'
    document.getElementById('userMenu').style.display = 'none'
    try {
      document.getElementById('setupTools').style.display = 'none'
      document.getElementById('editPane').style.display = 'none'
      document.getElementById('previewPane').style.display = 'none'
    } catch {
      // Doesn't exist for the settings page
    }
  }
  configureGUIForUser(userDict)
}

export function showPasswordChangeModal () {
  // Prepare the modal for changing the current user's password and show it.

  // Hide warnings and clear fields
  document.getElementById('passwordChangeModalCurrentPassword').value = ''
  document.getElementById('passwordChangeModalNewPassword1').value = ''
  document.getElementById('passwordChangeModalNewPassword2').value = ''

  document.getElementById('passwordChangeModalNoCurrentPassWarning').style.display = 'none'
  document.getElementById('passwordChangeModalNoBlankPassWarning').style.display = 'none'
  document.getElementById('passwordChangeModalPassMismatchWarning').style.display = 'none'
  document.getElementById('passwordChangeModalBadCurrentPassWarning').style.display = 'none'

  exUtilities.showModal('#passwordChangeModal')
}

export function submitUserPasswordChange () {
  // Collect the relevant details from the password change modal and submit it

  const currentPass = document.getElementById('passwordChangeModalCurrentPassword').value
  const newPass1 = document.getElementById('passwordChangeModalNewPassword1').value
  const newPass2 = document.getElementById('passwordChangeModalNewPassword2').value
  if (currentPass === '') {
    document.getElementById('passwordChangeModalNoCurrentPassWarning').style.display = 'block'
    return
  } else {
    document.getElementById('passwordChangeModalNoCurrentPassWarning').style.display = 'none'
  }
  if (newPass1 === '') {
    document.getElementById('passwordChangeModalNoBlankPassWarning').style.display = 'block'
    return
  } else {
    document.getElementById('passwordChangeModalNoBlankPassWarning').style.display = 'none'
  }
  if (newPass1 !== newPass2) {
    document.getElementById('passwordChangeModalPassMismatchWarning').style.display = 'block'
    return
  } else {
    document.getElementById('passwordChangeModalPassMismatchWarning').style.display = 'none'
  }

  exCommon.makeServerRequest({
    method: 'POST',
    endpoint: '/user/' + config.user.uuid + '/changePassword',
    params: {
      current_password: currentPass,
      new_password: newPass1
    }
  })
    .then((response) => {
      if (response.success === false) {
        if (response.reason === 'authentication_failed') {
          document.getElementById('passwordChangeModalBadCurrentPassWarning').style.display = 'block'
        }
      } else {
        exUtilities.hideModal('#changePasswordModal')
        logoutUser()
      }
    })
}

const markdownConverter = new showdown.Converter()
markdownConverter.setFlavor('github')
