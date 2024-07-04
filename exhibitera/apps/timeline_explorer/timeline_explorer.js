/* global showdown textFit */

import * as exCommon from '../js/exhibitera_app_common.js'

function updateFunc (update) {
  // Read updates for media player-specific actions and act on them

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    exCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (def) {
  // Helper function to manage setting up the interface.

  // Tag the document with the defintion for later reference
  $(document).data('timelineDefinition', def)

  const root = document.querySelector(':root')

  // Modify the style

  // Color

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--backgroundColor', '#719abf')
  root.style.setProperty('--headerColor', '#22222E')
  root.style.setProperty('--footerColor', '#22222E')
  root.style.setProperty('--itemColor', '#393A5A')
  root.style.setProperty('--lineColor', 'white')
  root.style.setProperty('--textColor', 'white')
  root.style.setProperty('--toolbarButtonColor', '#393A5A')

  // Then, apply the definition settings
  Object.keys(def.style.color).forEach((key) => {
    // Fix for change from backgroundColor to background-color in v4
    if (key === 'backgroundColor') key = 'background-color'
    document.documentElement.style.setProperty('--' + key, def.style.color[key])
  })

  if ('headerColor' in def.style.color) {
    // Configure the status bar for PWAs
    document.querySelector('meta[name="theme-color"]').setAttribute('content', def.style.color.headerColor)
    document.querySelector('meta[name="msapplication-TileColor"]').setAttribute('content', def.style.color.headerColor)
  } else {
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#000')
    document.querySelector('meta[name="msapplication-TileColor"]').setAttribute('content', '#000')
  }

  // Backgorund settings
  if ('background' in def.style) {
    exCommon.setBackground(def.style.background, root, '#719abf')
  }

  // Font

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--Header-font', 'Header-default')
  root.style.setProperty('--Title-font', 'Title-default')
  root.style.setProperty('--Time-font', 'Time-default')
  root.style.setProperty('--Body-font', 'Body-default')

  // Then, apply the definition settings
  Object.keys(def.style.font).forEach((key) => {
    const font = new FontFace(key, 'url(' + encodeURI(def.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  })

  const langs = Object.keys(def.languages)
  if (langs.length === 0) return

  exCommon.createLanguageSwitcher(def, localize)

  // Find the default language
  Object.keys(def.languages).forEach((lang) => {
    if (def.languages[lang].default === true) defaultLang = lang
  })

  // Load the CSV file containing the timeline data and use it to build the timeline entries.
  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + def.spreadsheet,
    rawResponse: true,
    noCache: true
  })
    .then((response) => {
      $('#timelineContainer').empty()
      const csvAsJSON = exCommon.csvToJSON(response).json
      $(document).data('spreadsheet', csvAsJSON)
      localize(defaultLang)
    })

  // Set up the attractor
  inactivityTimeout = def.inactivity_timeout || 30
  if ('attractor' in def && def.attractor.trim() !== '') {
    const fileType = exCommon.guessMimetype(def.attractor)
    if (['image', 'video'].includes(fileType)) {
      setAttractor(def.attractor, fileType)
    }
  } else {
    setAttractor('', '')
  }

  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(def.uuid + '.png'), 100)
}

function adjustFontSize (increment) {
  // Adjust the font multiplier by the given amount

  const root = document.querySelector(':root')
  let fontModifierStr = root.style.getPropertyValue('--fontModifier')
  if (fontModifierStr === '') {
    fontModifierStr = '1'
  }
  let fontModifier = parseFloat(fontModifierStr)

  fontModifier += increment
  if (fontModifier < 1) {
    fontModifier = 1
  }
  root.style.setProperty('--fontModifier', fontModifier)
}

function localize (lang) {
  // Use the spreadhseet and defintion to set the content to the given language

  const spreadsheet = $(document).data('spreadsheet')
  const definition = $(document).data('timelineDefinition')

  $('#timelineContainer').empty()
  spreadsheet.forEach((entry) => {
    createTimelineEntry(entry, lang)
  })
  $('#headerText').html(definition.languages[lang].header_text || '')
  textFit($('#headerText'))
}

function createTimelineEntry (entry, langCode) {
  // Take the provided object and turn it into a set of HTML elements representing the entry.

  const langDef = $(document).data('timelineDefinition').languages[langCode]

  // Initialize the Markdown converter
  const converter = new showdown.Converter({ parseImgDimensions: true })

  const li = document.createElement('li')

  const container = document.createElement('div')
  container.classList = 'timeline-element'
  li.appendChild(container)

  // Text
  const flex1 = document.createElement('div')
  flex1.style.flexBasis = '0'
  flex1.style.flexGrow = '1'
  container.appendChild(flex1)

  const timeEl = document.createElement('time')
  timeEl.innerHTML = converter.makeHtml(entry[langDef.time_key])
  flex1.appendChild(timeEl)

  const title = document.createElement('div')
  if (parseInt(entry.Level) < 1) {
    title.classList = 'size1'
  } else if (parseInt(entry.Level) > 4) {
    title.classList = 'size4'
  } else {
    title.classList = 'size' + parseInt(entry[langDef.level_key])
  }
  title.classList.add('timeline-item-header')
  title.innerHTML = converter.makeHtml(entry[langDef.title_key])
  flex1.appendChild(title)

  const bodyEl = document.createElement('p')
  bodyEl.classList = 'timeline-body'
  bodyEl.innerHTML = converter.makeHtml(entry[langDef.short_text_key])
  flex1.appendChild(bodyEl)

  // Image
  const imageName = entry[langDef.image_key]
  if (imageName != null && imageName.trim() !== '') {
    // Make the timeline element wider to accomdate the image
    container.classList.add('with-image')

    const flex2 = document.createElement('div')
    flex2.style.flexBasis = '0'
    flex2.style.flexGrow = '1'
    flex2.style.alignSelf = 'center'
    container.appendChild(flex2)

    const image = document.createElement('img')
    image.style.width = '100%'
    image.src = 'thumbnails/' + imageName
    flex2.appendChild(image)
  }

  $('#timelineContainer').append(li)
  configureVisibleElements()
}

// check if an element is in viewport
// http://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport
function isElementInViewport (el) {
  const rect = el.getBoundingClientRect()
  return (
    rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

function configureVisibleElements () {
  // Iterate the timeline elements and make them visible if they are in view (trigger the animation).

  const items = document.querySelectorAll('.timeline li')

  for (let i = 0; i < items.length; i++) {
    if (isElementInViewport(items[i])) {
      items[i].classList.add('in-view')
    } else {
      items[i].classList.remove('in-view')
    }
  }
}

function setAttractor (filename, fileType) {
  attractorAvailable = true
  if (fileType === 'video') {
    document.getElementById('attractorVideo').src = 'content/' + filename
    document.getElementById('attractorImage').style.display = 'none'
    document.getElementById('attractorVideo').style.display = 'block'
  } else if (fileType === 'image') {
    document.getElementById('attractorImage').src = 'content/' + filename
    document.getElementById('attractorImage').style.display = 'block'
    document.getElementById('attractorVideo').style.display = 'none'
  } else {
    attractorAvailable = false
  }
}

function resetInactivityTimer () {
  // Cancel any existing timer and restart it.

  clearTimeout(attractorTimer)
  attractorTimer = setTimeout(showAttractor, inactivityTimeout * 1000) // sec -> ms
  exCommon.config.currentInteraction = true
}

function hideAttractor () {
  // Hide the attractor and begin a timer to reinstate it.

  document.getElementById('attractorOverlay').style.display = 'none'
  document.getElementById('attractorVideo').pause()

  resetInactivityTimer()
}

function showAttractor () {
  // Show the attractor and reset the timeline.

  if (attractorAvailable) {
    document.getElementById('attractorVideo').play()
    document.getElementById('attractorOverlay').style.display = 'block'
  } else {
    document.getElementById('attractorOverlay').style.display = 'none'
  }
  adjustFontSize(-100)
  localize(defaultLang)

  exCommon.config.currentInteraction = false
}

// Add event listeners
window.addEventListener('load', configureVisibleElements)
window.addEventListener('resize', configureVisibleElements)
document.getElementById('timeline-pane').addEventListener('scroll', configureVisibleElements)
$('#fontSizeDecreaseButton').click(function () {
  adjustFontSize(-0.1)
})
$('#fontSizeIncreaseButton').click(function () {
  adjustFontSize(0.1)
})
document.getElementById('attractorOverlay').addEventListener('click', hideAttractor)
document.addEventListener('touchstart', resetInactivityTimer)
document.addEventListener('click', resetInactivityTimer)

// Attractor
let attractorAvailable = false
let attractorTimer = null
let inactivityTimeout = 30

// Language
let defaultLang

// Exhibitera stuff
exCommon.configureApp({
  name: 'timeline_explorer',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

let currentDefintion = ''

adjustFontSize(-100) // Make sure the font modifier is at 1 to start
hideAttractor()
