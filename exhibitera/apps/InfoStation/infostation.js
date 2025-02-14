/* global showdown textFit */

import * as exCommon from '../js/exhibitera_app_common.js'

function loadDefinition (definition) {
  // Parse the current definition and build the interface correspondingly.

  const root = document.querySelector(':root')

  exCommon.config.definition = definition

  // Clear the existing content
  fontSizeReset()
  document.getElementById('nav-tabContent').innerHTML = ''
  document.getElementById('buttonRow').innerHTML = ''
  textTabs = []

  // Set up the available languages
  exCommon.createLanguageSwitcher(definition, localize)

  // Configure the attractor
  attractorAvailable = false
  if ('attractor' in definition) {
    const fileType = exCommon.guessMimetype(definition.attractor)
    if (['image', 'video'].includes(fileType)) {
      setAttractor(definition.attractor, fileType)
    }
  }
  if ('inactivity_timeout' in definition) {
    timeoutDuration = parseFloat(definition.inactivity_timeout) * 1000
  } else {
    timeoutDuration = 30000
  }

  // Modify the style
  // Layout
  root.style.setProperty('--button-size', definition?.style?.layout?.button_size || 30)
  root.style.setProperty('--header-height', definition?.style?.layout?.header_height || 10)

  if (parseInt(definition?.style?.layout?.header_height || 10) === 0) {
    document.getElementById('mastheadDiv').style.display = 'none'
  } else {
    document.getElementById('mastheadDiv').style.display = 'block'
  }

  // Color

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', '#719abf')
  root.style.setProperty('--header-color', '#706F8E')
  root.style.setProperty('--footer-color', '#706F8E')
  root.style.setProperty('--section-header-color', 'white')
  root.style.setProperty('--section-background-color', '#393A5A')
  root.style.setProperty('--section-border-color', '#E9E9E9')
  root.style.setProperty('--section-shadow-color', 'RGBA(34,34,46, .5)')
  root.style.setProperty('--text-color', 'white')
  root.style.setProperty('--toolbarButton-color', '#393A5A')
  root.style.setProperty('--header-font', 'header-default')
  root.style.setProperty('--body-font', 'body-default')
  root.style.setProperty('--section-header-font', 'section-header-default')
  root.style.setProperty('--header-font-size-adjust', '0')
  root.style.setProperty('--section-header-font-size-adjust', '0')
  root.style.setProperty('--body-font-size-adjust', '0')
  root.style.setProperty('--tab-button-font-size-adjust', '0')

  // Then, apply the definition settings
  Object.keys(definition.style.color).forEach((key) => {
    document.documentElement.style.setProperty('--' + key + '-color', definition.style.color[key])
  })

  if ('header' in definition.style.color) {
    // Configure the status bar for PWAs
    document.querySelector('meta[name="theme-color"]').setAttribute('content', definition.style.color.header)
    document.querySelector('meta[name="msapplication-TileColor"]').setAttribute('content', definition.style.color.header)
  } else {
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#000')
    document.querySelector('meta[name="msapplication-TileColor"]').setAttribute('content', '#000')
  }

  // Backgorund settings
  if ('background' in definition.style) {
    exCommon.setBackground(definition.style.background, root, '#719abf')
  }

  Object.keys(definition.style.font).forEach((key) => {
    const font = new FontFace(key, 'url(' + encodeURI(definition.style.font[key]) + ')')
    document.fonts.add(font)
    document.documentElement.style.setProperty('--' + key + '-font', key)
  })

  Object.keys(definition.style.text_size).forEach((key) => {
    document.documentElement.style.setProperty('--' + key + '-font-size-adjust', definition.style.text_size[key])
  })

  // Find the default language
  Object.keys(definition.languages).forEach((lang) => {
    if (definition.languages[lang].default === true) defaultLang = lang
  })
  if (defaultLang !== '') localize(defaultLang)

  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 100)
}

function localize (lang) {
  // Use the given language code to build the GUI

  const fullDefinition = exCommon.config.definition
  const definition = fullDefinition.languages[lang]

  document.getElementById('buttonRow').innerHTML = ''
  document.getElementById('nav-tabContent').innerHTML = ''

  if (definition.header != null) {
    document.getElementById('masthead').innerHTML = definition.header
    // textFit(document.getElementById('masthead'))
  } else {
    document.getElementById('masthead').innerHTML = ''
  }

  // Create the tabs
  definition.tab_order.forEach((uuid, i) => {
    const tabDef = definition.tabs[uuid]
    const tabId = createTextTab(tabDef, i === 0)
    if (i === 0) {
      firstTab = tabId
    }
  })
  gotoTab(firstTab)

  // Hide tab row if we only have one tab
  const root = document.querySelector(':root')
  if (definition.tab_order.length === 1) {
    root.style.setProperty('--button-rows', 0)
  } else {
    root.style.setProperty('--button-rows', 1)
  }
}

function createButton (title, id) {
  // Create a button in the bottom bar that shows the pane with the given id

  const buttonRow = document.getElementById('buttonRow')

  // Create a new button
  const col = document.createElement('div')
  col.setAttribute('class', 'col tabButtonCol')
  col.setAttribute('id', id + 'ButtonCol')
  buttonRow.appendChild(col)

  const button = document.createElement('button')
  button.setAttribute('class', 'btn btn-secondary tabButton w-100 h-100')
  button.addEventListener('click', () => {
    gotoTab(id)
  })

  button.setAttribute('id', id + 'Button')
  button.innerHTML = title
  col.append(button)

  // Adjust the number of columns based on the number of buttons that have been added
  const nButtons = buttonRow.childElementCount
  let rowClass

  if (nButtons === 1) {
    rowClass = '1'
  } else if (nButtons < 4) {
    rowClass = String(nButtons)
  } else {
    rowClass = '4'
  }

  buttonRow.classList = 'row pt-3 pb-1 mx-1 gx-2 row-cols-' + rowClass
}

function createTextTab (definition, first = false) {
  // Create a pane that displays Markdown-formatted text and images

  // First, create the pane
  const tabId = 'textTab_' + String(definition.uuid)
  const pane = document.createElement('div')
  pane.setAttribute('id', tabId)
  let classString = 'tab-pane fade show'
  if (first) classString += ' active'
  pane.setAttribute('class', classString)
  document.getElementById('nav-tabContent').appendChild(pane)

  const row = document.createElement('div')
  row.setAttribute('class', 'row mx-1 align-items-center')
  pane.appendChild(row)

  const col = document.createElement('div')
  col.setAttribute('class', 'col-12 textCol mt-3')
  col.setAttribute('id', tabId + 'Content')
  row.append(col)

  _createTextTabContent(tabId, definition.text)

  // Create button for this tab
  createButton(definition.button_text, tabId)

  textTabs.push(tabId)

  return tabId
}

function _createTextTabContent (tabId, content) {
  // Helper function that actually creates and formats the tab content.

  const col = document.getElementById(tabId + 'Content')

  const converter = new showdown.Converter({ parseImgDimensions: true })
  const html = converter.makeHtml(content)

  const el = exCommon.formatMarkdownImages(html)

  // Group the elements by H1 elements. We will enclose each set in a box
  const boxes = []
  let curBox = []
  Array.from(el.children).forEach(function (tag, i) {
    if (tag.tagName === 'H1') {
      if (curBox.length > 0) {
        boxes.push(curBox)
      }
      curBox = []
      curBox.push(tag)
    } else {
      curBox.push(tag)
    }
  })
  if (curBox.length > 0) {
    boxes.push(curBox)
  }
  boxes.forEach(function (divList) {
    const box = document.createElement('div')
    box.setAttribute('class', 'box')
    divList.forEach(function (div) {
      box.append(div)
    })
    col.append(box)
  })
}

function fontSizeDecrease () {
  // Decrease the CSS --font-size-adjust variable

  const root = document.querySelector(':root')
  const currentSize = parseFloat(getComputedStyle(root).getPropertyValue('--font-size-adjust'))
  root.style.setProperty('--font-size-adjust', String(Math.max(currentSize - 0.1, 1)))
}

function fontSizeReset () {
  const root = document.querySelector(':root')
  root.style.setProperty('--font-size-adjust', '1')
}

function fontSizeIncrease () {
  // Increase the CSS --font-size-adjust variable

  const root = document.querySelector(':root')
  const currentSize = parseFloat(getComputedStyle(root).getPropertyValue('--font-size-adjust'))
  root.style.setProperty('--font-size-adjust', String(Math.min(currentSize + 0.1, 1.5)))
}

function gotoTab (id) {
  // Swap the active tab

  if (id === '') return

  // Make sure the tab is scrolled to the top
  document.getElementById('nav-tabContent').scrollTop = 0
  document.querySelector('.tab-pane.active').classList.remove('active')
  document.getElementById(id).classList.add('active')

  // Chance button color
  document.querySelectorAll('.tabButton').forEach(el => {
    el.classList.remove('btn-primary')
    el.classList.add('btn-secondary')
  })
  const activeBUtton = document.getElementById(id + 'Button')
  activeBUtton.classList.remove('btn-secondary')
  activeBUtton.classList.add('btn-primary')
}

function hideAttractor () {
  // Make the attractor layer invisible

  exCommon.config.currentInteraction = true
  const attractorOverlay = document.getElementById('attractorOverlay')
  attractorOverlay.style.opacity = 0
  setTimeout(() => {
    if (document.getElementById('attractorVideo').style.display === 'block') {
      // The attractor is a video, so pause it
      document.getElementById('attractorVideo').pause()
    }
    attractorOverlay.style.display = 'none'
    resetActivityTimer()
  }, 500)
}

function updateFunc (update) {
  // Function to read a message from the server and take action based
  // on the contents

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    exCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function resetActivityTimer () {
  // Cancel the existing activity timer and set a new one

  exCommon.config.currentInteraction = true
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, timeoutDuration)
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

function showAttractor () {
  // Make the attractor layer visible

  exCommon.config.currentInteraction = false

  const attractorOverlay = document.getElementById('attractorOverlay')
  const navTabContent = document.getElementById('nav-tabContent')

  if (attractorAvailable) {
    attractorOverlay.style.display = 'block'
    // Wait 1 ms to make sure an animation frame passes
    setTimeout(() => {
      if (document.getElementById('attractorVideo').style.display === 'block') {
        // The attractor is a video, so play the video
        document.getElementById('attractorVideo').play()
          .then(result => {
            attractorOverlay.style.opacity = 1
          })
      } else {
        attractorOverlay.style.opacity = 1
      }
    }, 1)
    setTimeout(() => {
      fontSizeReset()
      localize(defaultLang)
      gotoTab(firstTab)
      navTabContent.scrollTop = 0
    }, 500)
  } else {
    fontSizeReset()
    localize(defaultLang)
    navTabContent.scrollTop = 0
  }
}

let inactivityTimer = 0
let attractorAvailable = false
let timeoutDuration = 30000 // ms of no activity before the attractor is shown.
let defaultLang = ''
let textTabs = [] // Holds ids of textTabs.
let firstTab = ''
let currentDefintion = ''

document.addEventListener('touchstart', resetActivityTimer)
document.addEventListener('click', resetActivityTimer)
document.getElementById('fontSizeDecreaseButton').addEventListener('click', fontSizeDecrease)
document.getElementById('fontSizeIncreaseButton').addEventListener('click', fontSizeIncrease)
document.getElementById('attractorOverlay').addEventListener('click', hideAttractor)

// Exhibitera stuff
exCommon.configureApp({
  name: 'infostation',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

hideAttractor()
