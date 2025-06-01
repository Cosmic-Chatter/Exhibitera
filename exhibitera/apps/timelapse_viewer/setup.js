/* global bootstrap */

import exConfig from '../../common/config.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exFileSelect from '../js/exhibitera_file_select_modal.js'
import * as exSetup from '../js/exhibitera_setup_common.js'

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
  document.getElementById('behaviorInput_animation_duration').value = 15

  // Content details
  document.getElementById('filePatternInput').value = ''
  document.getElementById('filenamePatternMatches').value = null

  // Attractor details
  document.getElementById('attractorInput_attractor_timeout').value = 30
  document.getElementById('attractorCheck_use_attractor').checked = false
  disableAttractorOptions(true)
  document.getElementById('attractorCheck_use_finger_animation').checked = true

  document.getElementById('attractorInput_text').value = ''
  document.getElementById('attractorInput_font_adjust').value = 0
  document.getElementById('attractorInput_attractor_background').value = 'rgba(0, 0, 0, 0.2)'
  document.querySelector('#attractorInput_attractor_background').dispatchEvent(new Event('input', { bubbles: true }))
  document.getElementById('attractorInput_text_color').value = '#fff'
  document.querySelector('#attractorInput_text_color').dispatchEvent(new Event('input', { bubbles: true }))
  exSetup.resetAdvancedFontPickers()
  exSetup.createAdvancedSliders()

  // Appearance details
  exSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#22222E',
    gradient_color_1: '#22222E',
    gradient_color_2: '#22222E'
  })
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = exSetup.getDefinitionByUUID(uuid)
  exSetup.config.initialDefinition = structuredClone(def)
  exSetup.config.workingDefinition = structuredClone(def)

  document.getElementById('definitionNameInput').value = def.name
  document.getElementById('filePatternInput').value = def.files
  retrieveMatchingFilesCount()

  // Set the appropriate values for the behavior fields
  for (const key of Object.keys(def.behavior ?? {})) {
    const el = document.getElementById('behaviorInput_' + key)
    if (el != null) el.value = def.behavior[key]
  }

  // Set the appropriate values for the attractor fields
  for (const key of Object.keys(def.attractor)) {
    let el
    if (['use_attractor', 'use_finger_animation'].includes(key)) {
      el = document.getElementById('attractorCheck_' + key)
      if (el != null) el.checked = def.attractor[key]

      // If this is the Show Attractor checkbox, set the approprate state for the rest of the options
      if (key === 'use_attractor') {
        if (def.attractor[key] === true) {
          disableAttractorOptions(false)
        } else {
          disableAttractorOptions(true)
        }
      }
    } else if (key === 'font') {
      const picker = document.querySelector('.AFP-select[data-path="attractor>font"')
      if (picker != null) exSetup.setAdvancedFontPicker(picker, def.attractor.font)
    } else {
      el = document.getElementById('attractorInput_' + key)
      if (el != null) el.value = def.attractor[key]
    }

    if (['text_color'].includes(key)) {
      // Send a special event to the color picker to trigger the change
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  exSetup.updateAdvancedColorPicker('style>background', def?.style?.background, { mode: 'color', color: '#22222E' })

  // Configure the preview frame
  document.getElementById('previewFrame').src = 'index.html?standalone=true&definition=' + def.uuid
  exSetup.previewDefinition()
}

function disableAttractorOptions (disable) {
  // Set the disabled property for the attractor options

  const attractorRow = document.getElementById('attractorRow')

  if (disable) {
    attractorRow.style.display = 'none'
  } else {
    attractorRow.style.display = 'flex'
  }
}

function guessFilenamePattern () {
  // Use two given filenames to guess a wildcard (*) pattern to select the range

  const first = document.getElementById('selectFirstImageButton').getAttribute('data-filename')
  const last = document.getElementById('selectLastImageButton').getAttribute('data-filename')

  if (first == null || last == null) return

  const firstSplit = first.split('.')
  const firstExt = firstSplit.pop()
  const firstNoExt = firstSplit.join('.')

  const lastSplit = last.split('.')
  const lastNoExt = lastSplit.join('.')

  // Find common prefix
  let prefix = ''
  for (let i = 0; i < firstNoExt.length; i++) {
    if (firstNoExt[i] === lastNoExt[i]) {
      prefix += firstNoExt[i]
    } else break
  }
  const pattern = prefix + '*.' + firstExt
  exSetup.updateWorkingDefinition(['files'], pattern)
  document.getElementById('filePatternInput').value = pattern

  retrieveMatchingFilesCount()
}

function retrieveMatchingFilesCount () {
  // Check the number of files in content that match the given filename wildcard pattern.

  const pattern = document.getElementById('filePatternInput').value
  const split = pattern.split('*.')

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/files/availableContent'
  }).then((result) => {
    const content = result.content
    matchedFiles = content.filter((item) => {
      return item.startsWith(split[0]) && item.endsWith(split[1])
    })
    document.getElementById('filenamePatternMatches').value = matchedFiles.length
  })
}

async function convertVideo () {
  // Ask the helper to convert the video to frames and track the progress.

  const filename = document.getElementById('selectConversionVideoButton').dataset.filename
  if (filename == null || filename.trim() === '') {
    return
  }
  const button = document.getElementById('videoConversionModalSubmitButton')
  button.innerText = 'Working...'
  button.classList.add('btn-info')
  button.classList.remove('btn-primary')
  document.getElementById('conversionProgressBarDiv').style.display = 'flex'

  const numFilesToCreate = parseInt(document.getElementById('outputFileCountField').value)
  const response = await exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/files/availableContent'
  })
  const numFilesCurrent = response.content.length

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/files/' + filename + '/convertVideoToFrames',
    params: {
      file_type: 'jpg'
    },
    timeout: 3.6e6 // 1 hr
  })
  trackConversionProgress(numFilesToCreate, numFilesCurrent)
}

function trackConversionProgress (total, starting) {
  // Track the progress of the video conversion.
  // total is the estimated number of frames to be converted
  // starting is the number of files when the conversion started
  // The number completed = current total - now

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/files/availableContent'
  }).then((result) => {
    const numComplete = result.content.length - starting
    const percent = Math.round(100 * (numComplete / total))
    document.getElementById('conversionProgressBarDiv').setAttribute('aria-valuenow', percent)
    document.getElementById('conversionProgressBar').style.width = String(percent) + '%'
    if (numComplete < total - 5) {
      // Add a little slop (5) in case the estimated number of files is wrong.
      setTimeout(() => {
        trackConversionProgress(total, starting)
      }, 1000)
    } else {
      videoConversionModal.hide()
    }
  })
}

// Set helperAddress for calls to exCommon.makeHelperRequest
exCommon.config.helperAddress = window.location.origin

let matchedFiles = []

// Add event listeners
// -------------------------------------------------------------

// Behavior fields
Array.from(document.querySelectorAll('.behavior-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const key = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['behavior', key], event.target.value)
    exSetup.previewDefinition(true)
  })
})

// Video conversion
const videoConversionModal = new bootstrap.Modal('#videoConversionModal')
document.getElementById('showConvertVideoModal').addEventListener('click', (event) => {
  const convertButton = document.getElementById('videoConversionModalSubmitButton')
  document.getElementById('selectConversionVideoButton').innerHTML = 'Select video'
  document.getElementById('selectConversionVideoButton').setAttribute('data-filename', null)
  document.getElementById('fileConversionVideoPreview').src = null
  document.getElementById('outputFileCountField').value = null
  document.getElementById('conversionProgressBarDiv').style.display = 'none'
  document.getElementById('conversionProgressBarDiv').setAttribute('aria-valuenow', 0)
  document.getElementById('conversionProgressBar').style.width = '0%'

  convertButton.innerHTML = 'Convert'
  convertButton.classList.remove('btn-info')
  convertButton.classList.add('btn-primary')

  videoConversionModal.show()
})
document.getElementById('selectConversionVideoButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['video'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
        document.getElementById('fileConversionVideoPreview').src = exCommon.config.helperAddress + exConfig.api + '/files/' + result[0] + '/thumbnail'

        exCommon.makeHelperRequest({
          method: 'GET',
          endpoint: '/files/' + result[0] + '/videoDetails'
        })
          .then((response) => {
            if ('success' in response && response.success === true) {
              const frames = Math.round(response.details.duration * response.details.fps)
              document.getElementById('outputFileCountField').value = frames
            }
          })
      }
    })
})

document.getElementById('videoConversionModalSubmitButton').addEventListener('click', (event) => {
  convertVideo()
})

// Pattern generation
document.getElementById('filePatternInput').addEventListener('change', (event) => {
  exSetup.updateWorkingDefinition(['files'], event.target.value)
  retrieveMatchingFilesCount()
  exSetup.previewDefinition(true)
})
document.getElementById('selectFirstImageButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
      }
    })
})
document.getElementById('selectLastImageButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
      }
    })
})
const PatternGeneratorModal = new bootstrap.Modal('#patternGeneratorModal')
document.getElementById('showPatternGeneratorModal').addEventListener('click', (event) => {
  document.getElementById('patternGeneratorModalMissingFilenameWarning').style.display = 'none'
  document.getElementById('selectFirstImageButton').innerHTML = 'Select file'
  document.getElementById('selectFirstImageButton').setAttribute('data-filename', null)
  document.getElementById('selectLastImageButton').innerHTML = 'Select file'
  document.getElementById('selectLastImageButton').setAttribute('data-filename', null)
  PatternGeneratorModal.show()
})
document.getElementById('patternGeneratorModalSubmitButton').addEventListener('click', (event) => {
  const first = document.getElementById('selectFirstImageButton').getAttribute('data-filename')
  const last = document.getElementById('selectLastImageButton').getAttribute('data-filename')

  if (first == null || last == null) {
    document.getElementById('patternGeneratorModalMissingFilenameWarning').style.display = 'block'
  } else {
    guessFilenamePattern()
    PatternGeneratorModal.hide()
    exSetup.previewDefinition(true)
  }
})

// Attractor
for (const el of document.getElementsByClassName('attractor-input')) {
  el.addEventListener('change', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['attractor', property], event.target.value)
    exSetup.previewDefinition(true)
  })
}

Array.from(document.getElementsByClassName('attractor-check')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['attractor', property], event.target.checked)
    // If we aren't using the attractor, disable the options
    if (event.target.getAttribute('id') === 'attractorCheck_use_attractor') {
      if (event.target.checked) {
        disableAttractorOptions(false)
      } else {
        disableAttractorOptions(true)
      }
    }
    exSetup.previewDefinition(true)
  })
})

// Font upload
document.getElementById('manageFontsButton').addEventListener('click', (event) => {
  exFileSelect.createFileSelectionModal({ filetypes: ['otf', 'ttf', 'woff', 'woff2'], manage: true })
    .then(exSetup.refreshAdvancedFontPickers)
})

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    exSetup.updateWorkingDefinition(['attractor', property], event.target.value)
    exSetup.previewDefinition(true)
  })
})

exSetup.configure({
  app: 'timelapse_viewer',
  clearDefinition: clearDefinitionInput,
  initializeWizard,
  loadDefinition: editDefinition,
  blankDefinition: {
    attractor: {},
    behavior: {},
    style: {
      background: {
        mode: 'color',
        color: '#22222E'
      }
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
