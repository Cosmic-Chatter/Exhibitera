/* global bootstrap, showdown */

import * as exCommon from './exhibitera_app_common.js'
import * as exFileSelect from './exhibitera_file_select_modal.js'

$.fn.visibleHeight = function () {
  // JQuery function to calculate the visible height of an element
  // From https://stackoverflow.com/a/29944927

  const scrollTop = $(window).scrollTop()
  const scrollBot = scrollTop + $(window).height()
  const elTop = this.offset().top
  const elBottom = elTop + this.outerHeight()
  const visibleTop = elTop < scrollTop ? scrollTop : elTop
  const visibleBottom = elBottom > scrollBot ? scrollBot : elBottom
  return Math.max(visibleBottom - visibleTop, 0)
}

export const config = {
  availableDefinitions: {},
  clearDefinition: null,
  loadDefinition: null,
  saveDefinition: null,
  fontCache: {}, // Keys with any value indicate that font has already been made
  languages: [
    { code: 'ar-dz', name: 'عربي', name_en: 'Arabic (Algeria)' },
    { code: 'ar-eg', name: 'عربي', name_en: 'Arabic (Egypt)' },
    { code: 'ar-iq', name: 'عربي', name_en: 'Arabic (Iraq)' },
    { code: 'ar-sa', name: 'عربي', name_en: 'Arabic (Saudi Arabia)' },
    { code: 'ar-ae', name: 'عربي', name_en: 'Arabic (U.A.E.)' },
    { code: 'bn', name: 'বাংলা', name_en: 'Bengali' },
    { code: 'zh', name: '中国人', name_en: 'Chinese (China)' },
    { code: 'zh-tw', name: '中国人', name_en: 'Chinese (Taiwan)' },
    { code: 'en-au', name: 'English', name_en: 'English (Australia)' },
    { code: 'en-nz', name: 'English', name_en: 'English (New Zealand)' },
    { code: 'en-gb', name: 'English', name_en: 'English (U.K.)' },
    { code: 'en-us', name: 'English', name_en: 'English (U.S.)' },
    { code: 'fr', name: 'Français', name_en: 'French' },
    { code: 'de', name: 'Deutsch', name_en: 'German' },
    { code: 'hi', name: 'हिंदी', name_en: 'Hindi' },
    { code: 'id', name: 'bahasa Indonesia', name_en: 'Indonesian' },
    { code: 'it', name: 'Italiano', name_en: 'Italian' },
    { code: 'jp', name: '日本語', name_en: 'Japanese' },
    { code: 'kr', name: '한국인', name_en: 'Korean' },
    { code: 'pt', name: 'Português', name_en: 'Portuguese (Portugal)' },
    { code: 'pt-br', name: 'Português', name_en: 'Portuguese (Brazil)' },
    { code: 'ru', name: 'Русский', name_en: 'Russian' },
    { code: 'es-mx', name: 'Español', name_en: 'Spanish (Mexico)' },
    { code: 'es', name: 'Español', name_en: 'Spanish (Spain)' },
    { code: 'ur', name: 'اردو', name_en: 'Urdu' }
  ]
}

export async function configure (options) {
  // Set up the common fields for the setup app.

  const defaults = {
    app: null,
    clearDefinition: null,
    initializeDefinition: null,
    loadDefinition: null,
    saveDefinition: null
  }

  options = { ...defaults, ...options } // Merge in user-supplied options

  // Make sure we have the options we need
  if (options.app == null) throw new Error("The options must include the 'app' field.")
  if (options.initializeDefinition == null) throw new Error("The options must include the 'initializeDefinition' field referencing the appropriate function.")
  if (options.loadDefinition == null) throw new Error("The options must include the 'loadDefinition' field referencing the appropriate function.")
  if (options.saveDefinition == null) throw new Error("The options must include the 'saveDefinition' field referencing the appropriate function.")

  config.app = options.app
  config.clearDefinition = options.clearDefinition
  config.initializeDefinition = options.initializeDefinition
  config.loadDefinition = options.loadDefinition
  config.saveDefinition = options.saveDefinition

  await config.initializeDefinition()
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

  const endpointStems = {
    dmx_control: '/dmx_control/',
    infostation: '/InfoStation/',
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
    endpoint: endpointStems[app] + 'README.md',
    rawResponse: true
  })
    .then((result) => {
      const formattedText = markdownConverter.makeHtml(result)
      // Add the formatted text
      $('#helpTextDiv').html(formattedText)
      // Then, search the children for images and fix the links with the right endpoints
      $('#helpTextDiv').find('img').each((i, img) => {
        // Strip off the http://localhost:8000/ porition
        const src = img.src.split('/').slice(3).join('/')
        // Rebuild the correct path
        img.src = exCommon.config.helperAddress + endpointStems[app] + '/' + src
        img.style.maxWidth = '100%'
      })
      $('#helpTextDiv').parent().parent().scrollTop(0)
    })

  $('#appHelpModal').modal('show')
}

export function populateAvailableDefinitions (definitions) {
  // Take a list of definitions and add them to the select.

  document.getElementById('availableDefinitionSelect').innerHTML = ''
  config.availableDefinitions = definitions
  const keys = Object.keys(definitions).sort((a, b) => {
    const aName = definitions[a].name.toLowerCase()
    const bName = definitions[b].name.toLowerCase()
    if (aName > bName) return 1
    if (bName > aName) return -1
    return 0
  })

  keys.forEach((uuid) => {
    if ((uuid.slice(0, 9) === '__preview') || uuid.trim() === '') return
    const definition = definitions[uuid]
    const option = document.createElement('option')
    option.value = uuid
    option.innerHTML = definition.name

    $('#availableDefinitionSelect').append(option)
  })
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

function showSetupWizard () {
  // Show the modal for the setup wizard
  $('#setupWizardModal').modal('show')
}

export function addWizardLanguage () {
  // Create HTML for a new wizard language selector

  const col = document.createElement('div')
  col.classList = 'col'

  const row = document.createElement('div')
  row.classList = 'row gy-2'
  col.appendChild(row)

  const selectCol = document.createElement('col')
  selectCol.classList = 'col col-12'
  row.appendChild(selectCol)

  const select = document.createElement('select')
  select.classList = 'form-select'
  selectCol.appendChild(select)

  for (const lang of config.languages) {
    const option = new Option(lang.name_en, lang.code)
    select.appendChild(option)
  }
  select.value = 'en-gb'

  document.getElementById('wizardLanguages').append(col)
}

function deleteDefinition () {
  // Delete the definition currently listed in the select.

  const definition = $('#availableDefinitionSelect').val()

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
  // 'property' should be an array of subproperties, e.g., ["style", "color", 'headerColor']
  // for definition.style.color.headerColor

  if (property && property[0].length <= 1) {
    // occasionally the color library is providing a poperty with a large amount of single entries that clog up the definition json
    console.log(`skipping ${property}`)
    return
  }
  exCommon.setObjectProperty($('#definitionSaveButton').data('workingDefinition'), property, value)
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
  // document.getElementById('showWizardButton').addEventListener('click', showSetupWizard)
  // document.getElementById('wizardAddLanguageButton').addEventListener('click', addWizardLanguage)

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
    config.saveDefinition()
  })

  // Preview definition button
  document.getElementById('previewRefreshButton').addEventListener('click', () => {
    previewDefinition(false)
  })

  // configure preview options
  document.getElementById('previewAspect16x9').addEventListener('click', () => {
    configurePreview('16x9')
  })
  document.getElementById('previewAspect9x16').addEventListener('click', () => {
    configurePreview('9x16')
  })
  document.getElementById('previewAspect16x10').addEventListener('click', () => {
    configurePreview('16x10')
  })
  document.getElementById('previewAspect10x16').addEventListener('click', () => {
    configurePreview('10x16')
  })
  document.getElementById('previewAspect4x3').addEventListener('click', () => {
    configurePreview('4x3')
  })
  document.getElementById('previewAspect3x4').addEventListener('click', () => {
    configurePreview('3x4')
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
  $(document).on('click', '#DefinitionDeletePopover', function () {
    deleteDefinition()
  })
  deleteDefinitionButton.addEventListener('click', function () { deleteDefinitionButton.focus() })
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl)
  })
}

function configurePreview (ratio) {
  // Toggle the preview between various aspect ratios and orientations.

  const previewFrame = document.getElementById('previewFrame')
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

function resizePreview () {
  // Resize the preview so that it always fits the view.

  // Size of things above view area
  const headerHeight = $('#setupHeader').visibleHeight()
  const toolsHeight = $('#setupTools').visibleHeight()
  const viewportHeight = window.innerHeight

  // First, set the height of the area available for the preview
  $('#previewPane').css('height', viewportHeight - headerHeight - toolsHeight)

  // Size of available area
  const paneWidth = $('#previewPane').width()
  const paneHeight = $('#previewPane').height()

  // Size of frame (this will be 1920 on the long axis)
  const frameWidth = $('#previewFrame').width()
  const frameHeight = $('#previewFrame').height()
  const frameAspect = frameWidth / frameHeight

  let transformRatio
  if (frameAspect <= 1) {
    // Handle portrait (constraint should be height)
    transformRatio = 0.95 * paneHeight / frameHeight
  } else {
    // Handle landscape (constraint should be width)
    transformRatio = 1.0 * paneWidth / frameWidth
  }

  $('#previewFrame').css('transform', 'scale(' + transformRatio + ')')
}

export function previewDefinition (automatic = false) {
  // Save the definition to a temporary file and load it into the preview frame.
  // If automatic == true, we've called this function beceause a definition field
  // has been updated. Only preview if the 'Refresh on change' checkbox is checked

  if ((automatic === true) && $('#refreshOnChangeCheckbox').prop('checked') === false) {
    return
  }

  const def = $('#definitionSaveButton').data('workingDefinition')
  // Set the uuid to a temp one
  def.uuid = '__preview_' + config.app
  exCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        if (config.app !== 'other') {
          document.getElementById('previewFrame').src = '../' + config.app + '.html?standalone=true&definition=' + '__preview_' + config.app
        } else {
          if (def.path === '') return
          document.getElementById('previewFrame').src = '../' + def.path + '?standalone=true&definition=' + '__preview_other'
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

  const html = `
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
              <input id="ACPAnglePicker_${id}" class="form-control constACP-angle" type="number" min="0", max="359" value="0">
            </div>
          </div>
        </div>
        <div id="ACPImageCol_${id}" class="col-6 d-none">
          <button id="ACPImage_${id}" class="btn btn-outline-primary w-100 text-break constACP-image">Select image</button>
        </div>
        
      </div>
    </div>
  `
  el.innerHTML = html

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

export function updateAdvancedColorPicker (path, details) {
  // Update the color picker defined by path using the values in details.

  const el = document.querySelector(`.advanced-color-picker[data-constACP-path="${path}"]`)
  if (el.childNodes.length === 0) return

  if ('mode' in details) {
    el.querySelector('.constACP-mode').value = details.mode
  }
  if ('color' in details) {
    const solidColorPicker = el.querySelector('.constACP-color')
    solidColorPicker.value = details.color
    solidColorPicker.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if ('gradient_color_1' in details) {
    const gradientPicker1 = el.querySelector('.constACP-gradient1')
    gradientPicker1.value = details.gradient_color_1
    gradientPicker1.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if ('gradient_color_2' in details) {
    const gradientPicker2 = el.querySelector('.constACP-gradient2')
    gradientPicker2.value = details.gradient_color_2
    gradientPicker2.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if ('gradient_angle' in details) {
    el.querySelector('.constACP-angle').value = details.gradient_angle
  }
  if ('image' in details) {
    el.querySelector('.constACP-image').innerHTML = details.image
  }

  const id = el.getAttribute('data-constACP-id')
  _onAdvancedColorPickerModeChange(id, path, details.mode)
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

  const id = exCommon.uuid()
  details.parent.setAttribute('data-constAFP-id', id)

  const html = `
  <label for="AFPSelect_${id}" class="form-label">${details.name}</label>
    <select id="AFPSelect_${id}" class="form-select AFP-select" data-default="${details.default}"></select>
  `

  details.parent.innerHTML = html
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
      endpoint: '/getAvailableContent'
    })
      .then((result) => {
        const availableFonts = []
        result.all_exhibits.forEach((item) => {
          if (exCommon.guessMimetype(item) === 'font') {
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
      picker.value = '../_fonts/' + picker.getAttribute('data-default')
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
    _createAdvancedFontOption(parent, 'Default', '../_fonts/' + defaultFont)

    // Then, add the user fonts
    if (userFonts.length > 0) {
      const user = new Option('User-provided')
      user.setAttribute('disabled', true)
      parent.appendChild(user)

      userFonts.forEach((font) => {
        _createAdvancedFontOption(parent, font, '../content/' + font)
      })
    }

    // Finally, add the built-in font list
    const builtInLabel = new Option('Built-in')
    builtInLabel.setAttribute('disabled', true)
    parent.appendChild(builtInLabel)
    builtInFonts.forEach((font) => {
      _createAdvancedFontOption(parent, font.name, '../_fonts/' + font.path)
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
  if ((safeName in config.fontCache) === false) {
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

export function setAdvancedFontPicker (el, value) {
  // Set the given advanced font picker to the specified font.

  el.value = value
  _onAdvancedFontPickerChange(el)
}

export function resetAdvancedFontPickers () {
  // Find and reset all advanced font pickers to their default values.
  Array.from(document.querySelectorAll('.AFP-select')).forEach((el) => {
    const defaultFont = '../_fonts/' + el.getAttribute('data-default')
    setAdvancedFontPicker(el, defaultFont)
  })
}

export function loginFromDropdown () {
  // Collect the username and password and attempt to log in the user.

  const username = document.getElementById('loginDropdownUsername').value.trim().toLowerCase()
  const password = document.getElementById('loginDropdownPassword').value

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

  $('#passwordChangeModal').modal('show')
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
        $('changePasswordModal').modal('hide')
        logoutUser()
      }
    })
}

const markdownConverter = new showdown.Converter()
markdownConverter.setFlavor('github')
