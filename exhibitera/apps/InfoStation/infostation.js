/* global showdown textFit */

import * as exCommon from '../js/exhibitera_app_common.js'

function loadDefinition (definition) {
  // Parse the current definition and build the interface correspondingly.

  const root = document.querySelector(':root')

  $(document).data('definition', definition)
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
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--button-size', 30)

  // Then, apply the definition settings
  if ('style' in definition && 'layout' in definition.style && 'button_size' in definition.style.layout) {
    root.style.setProperty('--button-size', definition.style.layout.button_size)
  }

  // Color

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  { root.style.setProperty('--background-color', '#719abf') }
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

  const fullDefinition = $(document).data('definition')
  const definition = fullDefinition.languages[lang]

  document.getElementById('buttonRow').innerHTML = ''
  document.getElementById('nav-tabContent').innerHTML = ''

  if (definition.header != null) {
    document.getElementById('masthead').innerHTML = definition.header
    textFit(document.getElementById('masthead'))
  } else {
    document.getElementById('masthead').innerHTML = ''
  }

  // Create the tabs
  definition.tab_order.forEach((uuid, i) => {
    const tabDef = definition.tabs[uuid]
    const tabId = createTextTab(tabDef)
    if (i === 0) {
      firstTab = tabId
    }
  })
  gotoTab(firstTab)
}

function createButton (title, id) {
  // Create a button in the bottom bar that shows the pane with the given id

  // Create a new button
  const col = document.createElement('div')
  col.setAttribute('class', 'col tabButtonCol')
  col.setAttribute('id', id + 'ButtonCol')
  $('#buttonRow').append(col)

  const button = document.createElement('button')
  button.setAttribute('class', 'btn btn-secondary tabButton w-100 h-100')
  $(button).click(function () {
    gotoTab(id)
  })
  button.setAttribute('id', id + 'Button')
  $(button).html(title)
  col.append(button)

  // Adjust the number of columns based on the number of buttons that have been added
  const nButtons = $('#buttonRow').children().length
  let rowClass

  if (nButtons === 1) {
    rowClass = '1'
  } else if (nButtons < 4) {
    rowClass = String(nButtons)
  } else {
    rowClass = '4'
  }

  document.getElementById('buttonRow').classList = 'row pt-3 pb-1 mx-1 gx-2 row-cols-' + rowClass
}

function createTextTab (definition) {
  // Create a pane that displays Markdown-formatted text and images

  // First, create the pane
  const tabId = 'textTab_' + String(definition.uuid)
  const pane = document.createElement('div')
  pane.setAttribute('id', tabId)
  pane.setAttribute('class', 'tab-pane fade show active')
  $(pane).data('user-definition', definition)
  $('#nav-tabContent').append(pane)

  const row = document.createElement('div')
  row.setAttribute('class', 'row mx-1 align-items-center')
  $('#' + tabId).append(row)

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
  // Parse the HTML
  const el = $('<div></div>')
  el.html(html)

  // Find img tags and format them appropriately
  el.children().each(function (i, tag) {
    if (tag.tagName === 'P') {
      $(tag).children().each(function (j, child) {
        if (child.tagName === 'IMG') {
          child.classList += 'image'
          const parent = $(child).parent()
          const div = document.createElement('div')
          div.append(child)
          const caption = document.createElement('div')
          caption.classList = 'caption'
          caption.append(child.title)
          div.append(caption)
          parent.empty()
          parent.append(div)

          // Parse the alt text for a user-indicated formatting preference.
          const format = child.alt.toLowerCase()
          if (format === 'left') {
            div.classList = 'float-left'
          } else if (format === 'right') {
            div.classList = 'float-right'
          } else if (format === 'full') {
            div.classList = 'full'
          } else {
            div.classList = 'full'
          }
        }
      })
    }
  })

  // Group the elements by H1 elements. We will enclose each set in a box
  const boxes = []
  let curBox = []
  el.children().each(function (i, tag) {
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
  $('#nav-tabContent').scrollTop(0)
  $('.tab-pane.active').removeClass('active')
  $('#' + id).addClass('active')

  // Chance button color
  $('.tabButton').removeClass('btn-primary').addClass('btn-secondary')
  $('#' + id + 'Button').removeClass('btn-secondary').addClass('btn-primary')
}

function hideAttractor () {
  // Make the attractor layer invisible

  exCommon.config.currentInteraction = true

  $('#attractorOverlay').fadeOut(100, result => {
    if (document.getElementById('attractorVideo').style.display === 'block') {
      // The attractor is a video, so pause it
      document.getElementById('attractorVideo').pause()
    }
    resetActivityTimer()
  })
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

  const definition = $(document).data('definition')
  exCommon.config.currentInteraction = false

  if (attractorAvailable) {
    if (document.getElementById('attractorVideo').style.display === 'block') {
      // The attractor is a video, so play the video
      document.getElementById('attractorVideo').play()
        .then(result => {
          $('#attractorOverlay').fadeIn(100)
        }).then(result => {
          fontSizeReset()
          localize(defaultLang)
          gotoTab(firstTab)
          $('#nav-tabContent').scrollTop(0)
        })
    } else {
      $('#attractorOverlay').fadeIn(100)
      fontSizeReset()
      localize(defaultLang)
      gotoTab(firstTab)
      $('#nav-tabContent').scrollTop(0)
    }
  } else {
    $('#attractorOverlay').fadeOut(100)
    fontSizeReset()
    localize(defaultLang)
    $('#nav-tabContent').scrollTop(0)
  }
}

let inactivityTimer = 0
let attractorAvailable = false
let timeoutDuration = 30000 // ms of no activity before the attractor is shown.
let defaultLang = ''
let textTabs = [] // Holds ids of textTabs.
let firstTab = ''
let currentDefintion = ''

$(document).bind('touchstart', resetActivityTimer)
$(document).bind('click', resetActivityTimer)
$('#fontSizeDecreaseButton').click(fontSizeDecrease)
$('#fontSizeIncreaseButton').click(fontSizeIncrease)
$('#attractorOverlay').click(hideAttractor)

// Exhibitera stuff
exCommon.configureApp({
  name: 'infostation',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

hideAttractor()
