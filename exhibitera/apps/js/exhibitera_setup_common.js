/* global bootstrap, Coloris, showdown */

import opentype from './opentype@1.3.1.js'

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
  fontAxesCache: {}, // Axes data for variable fonts
  fontNameCache: {}, // English names of fonts
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
    { code: 'zh-hk', name: '中国人', name_en: 'Chinese (Hong Kong)' },
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

  await exCommon.askForDefaults(false)
  if (exCommon.config.standalone === false) {
    // We are using Hub, so attempt to log in
    await authenticateUser()
  } else {
    // Hide the login details
    document.getElementById('loginMenu').style.display = 'none'
    document.getElementById('helpNewAccountMessage').style.display = 'none'
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

  createAdvancedColorPickers()
  await createAdvancedFontPickers()
  createAdvancedSliders()
  createDefinitionDeletePopup()
  createLoginEventListeners()
  createEventListeners()
  resizePreview()

  exCommon.getAvailableDefinitions(options.app)
    .then((response) => {
      if (response?.success === true) {
        populateAvailableDefinitions(response.definitions)
      }
    })
    .then(() => {
      configureFromQueryString()
    })

  // Set up the color pickers
  // Call with a slight delay to make sure the elements are loaded
  setTimeout(setUpColorPickers, 100)

  // If we're using Hub, display the component ID
  if (exCommon.config.standalone === false) {
    const idField = document.getElementById('setupComponentID')
    if (idField) {
      setTimeout(() => {
        idField.innerText = exCommon.config?.id ?? ''
      }, 10)
    }
  }
}

export function gotoAppLink (el) {
  // Navigate to the link given by element el, either in the browser or in the webview

  if (exCommon.config.remoteDisplay === true) {
    // Switch webpages in the browser

    const endpoint = el.getAttribute('data-web-link')
    window.open(window.location.origin + endpoint, '_blank').focus()
  } else {
    // Launch the appropriate webview page in the app

    const page = el.getAttribute('data-app-link')
    let reload = false
    if (page === 'app') {
      reload = true
    }
    exCommon.makeHelperRequest({
      method: 'POST',
      api: '',
      endpoint: '/app/showWindow/' + page,
      params: {
        parameters: {},
        reload
      }
    })
  }
}

export function setUpColorPickers () {
  // Find all the color picker divs and apply the Coloris style

  try {
    Coloris({
      el: '.coloris',
      theme: 'pill',
      themeMode: 'dark',
      formatToggle: false,
      clearButton: false,
      swatches: [
        '#0F1419',
        '#1A2B3C',
        '#243447',
        '#2F3E4F',
        '#E6E6E2',
        '#F5F5F0',
        '#4B5563',
        '#6B7280',
        '#C3512F',
        '#E06A47',
        '#3B5C8A',
        '#5A7BA8'
      ]
    })
  } catch {
    // Will fail if we aren't using any color pickers
  }
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
      if (response?.success) {
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
    survey_kiosk: '/survey_kiosk/',
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

  const select = document.getElementById('availableDefinitionSelect')
  select.innerText = ''
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
    select.appendChild(option)
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
    if (exCommon.config.standalone === true || config.loggedIn) {
      const modal = document.getElementById('appWelcomeModal')
      if (modal) exUtilities.showModal(modal)
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

export function wizardGoTo (page) {
  // Navigate to the given wizard page, hiding all other pages.

  for (const el of document.querySelectorAll('.wizard-pane')) {
    el.style.display = 'none'
  }
  document.getElementById('wizardPane_' + page).style.display = 'block'
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
          if (response?.success) {
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
      if (result?.success) {
        exCommon.getAvailableDefinitions(config.app)
          .then((response) => {
            if (response?.success) {
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
      if (result?.success) {
        // Update the UUID in case we have created a new definition
        config.initialDefinition = structuredClone(definition)

        // If we have a completion handler, call it with the definition
        if (config.onDefinitionSave != null) config.onDefinitionSave(config.workingDefinition)
        exCommon.getAvailableDefinitions(config.app)
          .then((response) => {
            if (response?.success) {
              populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = definition.uuid
            }
          })
      }
    })
}

export function createLoginEventListeners () {
  // Bind event listeners for login elements

  // Login
  document.getElementById('loginSubmitButton').addEventListener('click', loginFromDropdown)
  document.getElementById('loginForm').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault() // Prevents form from reloading the page
      document.getElementById('loginSubmitButton').click() // Trigger form submission programmatically
    }
  })
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

  // Activate app links
  Array.from(document.querySelectorAll('.app-link')).forEach((el) => {
    el.addEventListener('click', (event) => {
      gotoAppLink(event.target)
    })
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
    preview_ratio: def?.setup?.preview_ratio ?? '16x9',
    auto_refresh: def?.setup?.auto_refresh ?? true
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

export function createAdvancedColorPickers () {
  // Look for advanced-color-picker elements and fill them with the combo widget.
  // Note that this will replace existing ACPs, resetting them to the detaul values.

  for (const el of document.querySelectorAll('.advanced-color-picker')) {
    const name = el.getAttribute('data-constACP-name')
    const path = el.getAttribute('data-constACP-path').split('>')
    createAdvancedColorPicker(el, name, path)
  }
}

export function createAdvancedColorPicker (el, name, path) {
  // Create the GUI for an advanced color picker
  // 'name' is the name of the picker to be displayed in the label
  // 'path' is the definition path to be prepended to the elements.

  const id = exUtilities.uuid()
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
    const els = getAdvancedColorPickersByPath(path.join('>'))
    for (const el of els) {
      // Make sure all ACPs for this path are updated to stay in sync
      _onAdvancedColorPickerModeChange(el.getAttribute('data-constACP-id'), path, event.target.value)
    }
  })

  document.getElementById(`ACPColor_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'color'], event.target.value)

    // Make sure all ACPs for this path are updated to stay in sync
    updateAdvancedColorPicker(path.join('>'), exUtilities.getObjectProperty(config.workingDefinition, path))
    previewDefinition(true)
  })

  document.getElementById(`ACPImage_${id}`).addEventListener('click', (event) => {
    exFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
      .then((result) => {
        if (result != null && result.length > 0) {
          updateWorkingDefinition([...path, 'image'], result[0])
          const els = getAdvancedColorPickersByPath(path.join('>'))
          for (const el of els) {
            // Make sure all ACPs for this path are updated to stay in sync
            el.querySelector('.constACP-image').innerText = result[0]
          }
          previewDefinition(true)
        }
      })
  })
  document.getElementById(`ACPGradient_gradient1_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_color_1'], event.target.value)
    // Make sure all ACPs for this path are updated to stay in sync
    updateAdvancedColorPicker(path.join('>'), exUtilities.getObjectProperty(config.workingDefinition, path))

    previewDefinition(true)
  })
  document.getElementById(`ACPGradient_gradient2_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_color_2'], event.target.value)
    // Make sure all ACPs for this path are updated to stay in sync
    updateAdvancedColorPicker(path.join('>'), exUtilities.getObjectProperty(config.workingDefinition, path))

    previewDefinition(true)
  })
  document.getElementById(`ACPAnglePicker_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_angle'], event.target.value % 360)
    // Make sure all ACPs for this path are updated to stay in sync
    updateAdvancedColorPicker(path.join('>'), exUtilities.getObjectProperty(config.workingDefinition, path))

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
  userDefaults) {
  // Update the color picker defined by path using the values in details.

  const baseDefaults = {
    mode: 'color',
    color: '#e6e6e2',
    gradient_color_1: '#f5f5f0',
    gradient_color_2: '#e6e6e2',
    image: 'Select file'
  }

  let defaults
  if (typeof userDefaults === 'object') {
    defaults = { ...baseDefaults, ...userDefaults }
  } else defaults = baseDefaults

  // We may have multiple ACPs that coorespond to the same path
  const els = getAdvancedColorPickersByPath(path)
  if (els.length === 0) return

  for (const el of els) {
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
}

function getAdvancedColorPickersByPath (path) {
  // Return a NodeList of ACPs that match the given path

  return document.querySelectorAll(`.advanced-color-picker[data-constACP-path="${path}"]`)
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

async function createAdvancedFontPickers () {
  // Automatically create advanced font pickers for all marked elements

  Array.from(document.querySelectorAll('.advanced-font-picker')).forEach((el) => {
    const name = el.getAttribute('data-constAFP-name')
    const path = el.getAttribute('data-constAFP-path')
    const defaultFont = el.getAttribute('data-default-font')
    const defaultAxes = el.getAttribute('data-default-axes')
    createAdvancedFontPicker({ parent: el, name, path, font: defaultFont, axes: defaultAxes })
  })

  await populateAdvancedFontPickers()
}

export function createAdvancedFontPicker (details) {
  // Create an advanced font select with rich previews

  const id = exUtilities.uuid()
  details.parent.setAttribute('data-constAFP-id', id)

  details.parent.innerHTML = `
    <label class="form-label">${details.name}</label>
    <div class="dropdown w-100">
      <button class="btn btn-outline-secondary dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center AFP-dropdown-toggle text-light" type="button" data-bs-toggle="dropdown" aria-expanded="false" id="AFPBtn_${id}">
        <span class="AFP-btn-text text-truncate pe-2" style="max-width: 90%;">Select Font</span>
      </button>
      <ul class="dropdown-menu AFP-menu shadow p-0" aria-labelledby="AFPBtn_${id}"></ul>
    </div>
    <input type="hidden" id="AFPSelect_${id}" class="AFP-select" data-default-font="${details.font}" data-default-axes="${details.axes}" data-path="${details.path}">
    <div class="AFP-axes-container mt-2" id="AFPAxes_${id}"></div>
  `

  const inputEl = document.getElementById(`AFPSelect_${id}`)
  if (details.value) inputEl.value = details.value

  // Event delegation for the dropdown items
  const menuEl = details.parent.querySelector('.AFP-menu')
  menuEl.addEventListener('click', (event) => {
    const item = event.target.closest('.dropdown-item')
    if (!item) return

    inputEl.value = item.dataset.value
    _onAdvancedFontPickerChange(inputEl, true)
  })

  // Auto-scroll to the selected font when the dropdown opens
  const toggleBtn = details.parent.querySelector('.AFP-dropdown-toggle')
  toggleBtn.addEventListener('shown.bs.dropdown', () => {
    // Target the inner scroll zone we created earlier
    const scrollZone = menuEl.querySelector('.AFP-scroll-zone')

    // Only look for the active item inside the scroll zone
    const activeItem = scrollZone ? scrollZone.querySelector('.active') : null

    if (activeItem && scrollZone) {
      // Scroll the inner zone so the active item is roughly in the middle of the view
      scrollZone.scrollTop = activeItem.offsetTop - (scrollZone.clientHeight / 2) + (activeItem.clientHeight / 2)
    }
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

async function getVariableFontAxes (fontPath) {
  // Query the given font path to determine if it is a variable font and return its axes.

  // Return cached axes configuration if available to optimize low-power devices
  if (config.fontAxesCache && config.fontAxesCache[fontPath]) {
    return config.fontAxesCache[fontPath]
  }

  try {
    const font = await opentype.load(fontPath)

    // Check if the uploaded file contains the font variations (fvar) table
    if (font.tables && font.tables.fvar && font.tables.fvar.axes) {
      const axes = font.tables.fvar.axes.map(axis => {
        let axisName = axis.tag
        if (font.names && font.names.fontFamily) {
          axisName = axis.name ? (axis.name.en || axis.name.ja || axis.tag) : axis.tag
        }

        const min = parseFloat(axis.minValue.toFixed(2))
        const max = parseFloat(axis.maxValue.toFixed(2))
        const range = max - min

        let step = 1

        if (range > 0) {
          const idealStep = range / 8

          if (idealStep >= 75) {
            step = 100 // Standard 100-step weights (e.g., range 100-900 -> step 100)
          } else if (idealStep >= 35) {
            step = 50 // Half-steps for smaller weight spans
          } else if (idealStep >= 7.5) {
            step = 10 // Good for optical sizes or width ranges
          } else {
            // For fractional widths, slants, or custom axes, divide the range
            // into exactly 10 clean parts, rounded to 2 decimal places.
            step = parseFloat((range / 10).toFixed(2))
          }
        }

        return {
          tag: axis.tag,
          name: axisName,
          min,
          max,
          default: axis.defaultValue,
          step
        }
      })

      // Commit to runtime cache configuration
      if (!config.fontAxesCache) config.fontAxesCache = {}
      config.fontAxesCache[fontPath] = axes

      return axes
    }
  } catch (err) {
    console.error(`Opentype module failed to parse font variations at: ${fontPath}`, err)
  }

  return null // static font
}

async function getFontHumanName (fontPath) {
  // Use opentype to look up the English name of the given font path

  // Try cache first
  if (config.fontNameCache && config.fontNameCache[fontPath]) {
    return config.fontNameCache[fontPath]
  }

  try {
    const otInstance = opentype.load ? opentype : opentype.default
    if (otInstance && typeof otInstance.load === 'function') {
      const font = await otInstance.load(fontPath)

      if (font.names) {
        // Try to fetch full font name or family name in English
        let humanName = font.names.fullName?.en ||
                          font.names.fontFamily?.en ||
                          font.names.postScriptName?.en

        if (humanName) {
          // Set custom names for the built-in fonts
          if (humanName === 'Noto Sans Regular') {
            humanName = 'Sans Serif'
          } else if (humanName === 'Noto Serif Regular') {
            humanName = 'Serif'
          } else if (humanName === 'Noto Sans Mono Regular') {
            humanName = 'Mono'
          }
          if (!config.fontNameCache) config.fontNameCache = {}
          config.fontNameCache[fontPath] = humanName.trim()
          return config.fontNameCache[fontPath]
        }
      }
    }
  } catch (err) {
    console.warn(`Could not extract typographic name for file: ${fontPath}. Falling back to filename.`, err)
  }

  // Fallback: strip the directory track and file extension if parsing fails
  return fontPath.split('/').pop().replace(/\.[^/.]+$/, '')
}

export async function refreshAdvancedFontPickers () {
  // Retrieve any new fonts and update the pickers

  // Cache the current values
  const currentDict = {}
  Array.from(document.querySelectorAll('.AFP-select')).forEach((el) => {
    currentDict[el.getAttribute('id')] = el.value
  })

  await populateAdvancedFontPickers()

  for (const id of Object.keys(currentDict)) {
    const picker = document.getElementById(id)

    // Check if option still exists (font may have been deleted)
    if (picker.options && Array.from(picker.options).map(o => o.value).includes(currentDict[id]) === false) {
      picker.value = '/_fonts/' + picker.getAttribute('data-defaultFont')
    } else {
      picker.value = currentDict[id]
    }
    _onAdvancedFontPickerChange(picker)
  }
}

async function populateAdvancedFontPickers () {
  // Add user and default fonts for all advancedFontPickers

  // Fetch userFonts once for all pickers to improve performance
  const userFonts = await getUserFonts()

  for (const parentDiv of document.querySelectorAll('.advanced-font-picker')) {
    await populateAdvancedFontPicker(parentDiv, userFonts)
  }
}

async function populateAdvancedFontPicker (parentDiv, userFonts = null) {
  // Add the user and default fonts to a single advancedFontPicker

  if (!userFonts) {
    userFonts = await getUserFonts()
  }

  const builtInFonts = [
    { name: 'Sans Serif', path: 'Noto/NotoSans-VariableFont_wdth,wght.ttf' },
    { name: 'Serif', path: 'Noto/NotoSerif-VariableFont_wdth,wght.ttf' },
    { name: 'Monospace', path: 'Noto/NotoSansMono-VariableFont_wdth,wght.ttf' }
  ]

  const menu = parentDiv.querySelector('.AFP-menu')
  const inputEl = parentDiv.querySelector('.AFP-select')

  if (!menu || !inputEl) return
  menu.innerHTML = ''

  // Create a scrollable inner zone for standard fonts
  const scrollableWrapper = document.createElement('li')
  scrollableWrapper.innerHTML = '<ul class="list-unstyled mb-0 py-2 AFP-scroll-zone" style="max-height: 250px; overflow-y: auto; overflow-x: hidden;"></ul>'
  menu.appendChild(scrollableWrapper)

  const scrollZone = scrollableWrapper.querySelector('.AFP-scroll-zone')
  builtInFonts.forEach((font) => {
    _createAdvancedFontOption(scrollZone, font.name, '/_fonts/' + font.path, inputEl)
  })

  // Add User-provided fonts as a sticky footer
  if (userFonts.length > 0) {
    menu.insertAdjacentHTML('beforeend', '<li><hr class="dropdown-divider m-0"></li>')

    // Create the submenu container
    const submenuLi = document.createElement('li')
    submenuLi.classList.add('dropdown-submenu', 'py-1')

    // Create the toggle button for the flyout.
    submenuLi.innerHTML = `
          <button class="dropdown-item d-flex justify-content-between align-items-center w-100 user-font-toggle py-2" type="button">
            <span>User-provided</span>
            <span>▶</span>
          </button>
          <ul class="dropdown-menu shadow user-font-menu" style="max-height: 250px; overflow-y: auto;"></ul>
        `
    menu.appendChild(submenuLi)

    // Prevent closing the main dropdown when interacting with the flyout toggle
    const userFontToggle = submenuLi.querySelector('.user-font-toggle')
    userFontToggle.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      submenuLi.classList.toggle('open')
    })

    // Populate the nested menu
    const submenuMenu = submenuLi.querySelector('.user-font-menu')
    userFonts.forEach((font) => {
      _createAdvancedFontOption(submenuMenu, font, '/content/' + font, inputEl)
    })
  }

  _onAdvancedFontPickerChange(inputEl, false)
}

function _createAdvancedFontOption (menu, name, path, inputEl) {
  // Create a stylized dropdown item to represent the font and add it to the parent menu.

  let safeName = name.replaceAll(' ', '').replaceAll('.', '').replaceAll('/', '').replaceAll('\\', '')
  if (safeName === 'Default') {
    safeName += inputEl.getAttribute('id').slice(10)
  }

  // Check if font already exists
  if (!(safeName in config.fontCache)) {
    const fontDef = new FontFace(safeName, 'url(' + encodeURI(path) + ')')
    document.fonts.add(fontDef)
    config.fontCache[safeName] = true
  }

  const li = document.createElement('li')

  const btn = document.createElement('button')
  btn.classList = 'dropdown-item d-flex flex-column align-items-start py-2'
  btn.type = 'button'
  btn.dataset.value = path
  btn.dataset.safeName = safeName
  btn.dataset.name = name

  // UI readable name
  const nameSpan = document.createElement('span')
  nameSpan.innerText = name
  btn.appendChild(nameSpan)

  // Custom font preview
  const previewSpan = document.createElement('span')
  previewSpan.innerText = 'AaBbCc 123'
  previewSpan.style.fontFamily = safeName
  previewSpan.style.fontSize = '1em'
  previewSpan.classList.add('text-muted', 'mt-1', 'w-100', 'text-truncate')
  btn.appendChild(previewSpan)

  li.appendChild(btn)
  menu.appendChild(li)

  getFontHumanName(path).then((realName) => {
    if (realName && realName !== name) {
      // Update the dropdown option UI elements
      btn.dataset.name = realName
      nameSpan.innerText = realName

      // If this font happens to be the currently active selection for this picker,
      // update the main dropdown button's display text to match immediately.
      const currentSelection = inputEl.value
      let isSelected = false

      if (currentSelection) {
        // Handle both the raw path string (legacy) and the object schema string
        if (currentSelection.startsWith('{')) {
          try {
            const parsed = JSON.parse(currentSelection)
            if (parsed.path === path) isSelected = true
          } catch (e) {}
        } else if (currentSelection === path) {
          isSelected = true
        }
      }

      if (isSelected) {
        const parentDiv = inputEl.closest('.advanced-font-picker')
        if (parentDiv) {
          const mainBtnText = parentDiv.querySelector('.AFP-btn-text')
          if (mainBtnText) {
            mainBtnText.innerText = realName
          }
        }
      }
    }
  }).catch((err) => {
    console.warn('Background font name metadata look up failed for:', path, err)
  })
}

async function _onAdvancedFontPickerChange (el, saveChange = true) {
  // Process the change in an advanced font picker hidden input

  let fontData = el.value
  if (!fontData) return

  // Parse if it's a JSON string
  try {
    if (typeof fontData === 'string' && fontData.startsWith('{')) {
      fontData = JSON.parse(fontData)
    }
  } catch (e) {
    console.error('Failed to parse font data JSON:', e)
  }

  // Guarantee an object with {path, axes}
  const fontDef = exCommon.normalizeFontDefinition(fontData)
  const path = el.getAttribute('data-path').split('>')

  // Save changes to the definition and trigger a preview update
  if (saveChange) {
    updateWorkingDefinition([...path], fontDef)
    previewDefinition(true)
  }

  // Update the font picker GUI
  const parentDiv = el.closest('.advanced-font-picker')
  if (!parentDiv) return

  const btnText = parentDiv.querySelector('.AFP-btn-text')
  const toggleBtn = parentDiv.querySelector('.AFP-dropdown-toggle')
  const axesContainer = parentDiv.querySelector('.AFP-axes-container')

  // Find the selected menu item using the path string
  const menuItem = parentDiv.querySelector(`.dropdown-item[data-value="${fontDef.path}"]`)

  if (menuItem) {
    const allItems = parentDiv.querySelectorAll('.dropdown-item')
    allItems.forEach(item => {
      item.classList.remove('active')
      const preview = item.querySelector('span:nth-child(2)')
      if (preview) preview.classList.add('text-muted')
    })

    menuItem.classList.add('active')
    const activePreview = menuItem.querySelector('span:nth-child(2)')
    if (activePreview) activePreview.classList.remove('text-muted')

    const safeName = menuItem.dataset.safeName || ''
    if (btnText) btnText.innerText = menuItem.dataset.name || 'Select Font'
    if (toggleBtn) toggleBtn.style.fontFamily = safeName

    // Apply axes to the dropdown button text for immediate UI feedback
    if (toggleBtn) {
      const axisString = Object.entries(fontDef.axes || {})
        .map(([axis, val]) => `"${axis}" ${val}`)
        .join(', ')
      toggleBtn.style.fontVariationSettings = axisString || 'normal'
    }
  }

  // Now populate any variable font axes
  if (!axesContainer) return

  axesContainer.innerHTML = '<small class="text-muted">Analyzing font...</small>'

  // Dynamically fetch the axes directly from the selected file
  const availableAxes = await getVariableFontAxes(fontDef.path)

  axesContainer.innerHTML = '' // Clear loading text

  // If the font is variable, generate the sliders
  if (availableAxes && availableAxes.length > 0) {
    availableAxes.forEach(axis => {
      // Determine what to set the slider to:
      //  1: Existing value from the definition
      //  2: If this is a standard font, use the defaults from the element
      //  3: Fallback to the font's native default

      let currentValue
      if (fontDef.axes[axis.tag]) {
        // Option 1
        currentValue = fontDef.axes[axis.tag]
      } else if (fontDef.path.includes('/Noto/')) {
        // Option 2
        if (typeof el.dataset.defaultAxes === 'string' && el.dataset.defaultAxes.startsWith('{')) {
          // Fix the bad JSON (no quotes around the keys) and then parse
          const jsonString = el.dataset.defaultAxes.replace(/([a-zA-Z0-9_]+)(?=\s*:)/g, '"$1"')
          const axes = JSON.parse(jsonString)
          currentValue = axes?.[axis.tag] ?? axis.default
        }
      } else {
        // Option 3
        currentValue = axis.default
      }

      const sliderHTML = `
        <div class="row align-items-center mb-1">
          <div class="col-4 text-end">
            <small class="text-muted" title="${axis.tag}">${axis.name}</small>
          </div>
          <div class="col-8">
            <input type="range" class="form-range font-axis-slider" 
              data-axis="${axis.tag}" 
              min="${axis.min}" max="${axis.max}" 
              step="${axis.step}" value="${currentValue}">
          </div>
        </div>
      `
      axesContainer.insertAdjacentHTML('beforeend', sliderHTML)
    })

    // Bind event listeners to the newly injected sliders
    const sliders = axesContainer.querySelectorAll('.font-axis-slider')
    sliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        // Build updated axes object from all sliders
        const newAxes = {}
        sliders.forEach(s => {
          newAxes[s.dataset.axis] = parseFloat(s.value)
        })

        const updatedFontDef = { path: fontDef.path, axes: newAxes }

        // Update hidden input (stringify so it parses correctly on subsequent calls)
        el.value = JSON.stringify(updatedFontDef)

        // Save and preview changes live
        updateWorkingDefinition([...path], updatedFontDef)
        previewDefinition(true)

        // Live update the dropdown button preview to match the slider movements
        if (toggleBtn) {
          const newAxisString = Object.entries(newAxes)
            .map(([axis, val]) => `"${axis}" ${val}`)
            .join(', ')
          toggleBtn.style.fontVariationSettings = newAxisString || 'normal'
        }
      })
    })
  }
}

export function updateAdvancedFontPickers (fonts, path = 'style>font') {
  // Take a dictionary of fonts and update the corresponding font pickers

  if (fonts == null) return
  for (const key of Object.keys(fonts)) {
    const picker = document.querySelector(`.AFP-select[data-path="${path}>${key}"`)
    if (picker != null) setAdvancedFontPicker(picker, fonts[key])
  }
}

export function setAdvancedFontPicker (el, value) {
  // Set the given advanced font picker to the specified font.

  if (typeof value === 'object' && value !== null) {
    el.value = JSON.stringify(value)
  } else {
    el.value = value
  }

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
    const defaultFont = '/_fonts/' + el.getAttribute('data-default-font')
    setAdvancedFontPicker(el, defaultFont)
  })
}

export function createAdvancedSliders () {
  // Create an Advanced Slider at each marked point

  for (const el of document.querySelectorAll('.advanced-slider')) {
    createAdvancedSlider(el)
  }
}

export function createAdvancedSlider (el, value = null) {
  // Create the HTML for an Advanced Slider based on the data properties of
  // the given element and a possible current value

  if (el == null) return

  // Reset the element in case we're updating an existing slider
  el.innerHTML = ''

  const id = exUtilities.uuid()
  el.dataset.exASID = id

  const path = el.dataset.path.split('>')

  let labelHTML = ''
  let sliderWidth = 8
  let numberWidth = 4
  if (el.dataset?.unit) {
    labelHTML = `<span class="input-group-text exAS_label">${el.dataset.unit}</span>`
    sliderWidth = 7
    numberWidth = 5
  }
  let noteHTML = ''
  if (el.dataset?.note) {
    noteHTML =
    `
    <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="${el.dataset.note}" style="font-size: 0.55em;">?</span>
    `
  }
  el.innerHTML = `
      <label class="form-label">
        ${el.dataset.name}
        ${noteHTML}
      </label>
      <div class="row">
        <div class="col-${String(sliderWidth + 1)} col-sm-${String(sliderWidth)} col-xl-${String(sliderWidth + 1)}  pe-0 d-flex align-items-center">
          <input type="range" id="exAS_slider_${id}" class="form-range w-100 exAS_slider" min="${el.dataset.min}" max="${el.dataset.max}" start="${value ?? el.dataset.start}" step="${el.dataset.step}">
          </input>
        </div>
        <div class="col-${String(numberWidth - 1)} col-sm-${String(numberWidth)} col-xl-${String(numberWidth - 1)} ps-1 d-flex align-items-center">
          <div class='input-group'>
            <input type="number" id="exAS_number_${id}" class="form-control exAS_number" min="${el.dataset.min}" max="${el.dataset.max}" start="${value ?? el.dataset.start}" step="${el.dataset.step}">
            ${labelHTML}
          </div>
          
          </input>
        </div>
      </div>
  `

  const slider = document.getElementById(`exAS_slider_${id}`)
  const number = document.getElementById(`exAS_number_${id}`)

  number.value = value ?? el.dataset.start
  slider.value = value ?? el.dataset.start
  el.value = value ?? el.dataset.start

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })

  // Add event listeners
  slider.addEventListener('input', (event) => {
    if (path[0] !== '') {
      updateWorkingDefinition([...path], event.target.value)
    }
    number.value = event.target.value
    el.value = event.target.value
    previewDefinition(true)
  })
  number.addEventListener('input', (event) => {
    if (path[0] !== '') {
      updateWorkingDefinition([...path], event.target.value)
    }
    slider.value = event.target.value
    el.value = event.target.value
    previewDefinition(true)
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
        exUtilities.hideModal('#passwordChangeModal')
        logoutUser()
      }
    })
}

export function downloadPlaintextFile (plaintext, filename) {
  // Download the given string as a plaintext file.
  // Choose download method depending on whetehr we're using a remote display.
  // `filename` is the name the file should have when downloaded.

  if (exCommon.config.remoteDisplay === false) {
    // Ask the app to create a save dialog
    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/app/saveFile',
      api: '',
      params: {
        data: plaintext,
        filename
      }
    })
  } else {
    // Ask the browser to initiate a download
    const fileBlob = new Blob([plaintext], {
      type: 'text/plain'
    })
    const a = document.createElement('a')
    a.href = window.URL.createObjectURL(fileBlob)
    a.download = filename
    a.click()
  }
}

let markdownConverter
try {
  markdownConverter = new showdown.Converter()
  markdownConverter.setFlavor('github')
} catch {
  console.log('showdown library not loaded')
}
