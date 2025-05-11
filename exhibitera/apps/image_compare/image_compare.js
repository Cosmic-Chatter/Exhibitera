import exConfig from '../../common/config.js'
import * as exUtilities from '../../common/utilities.js'
import * as exFiles from '../../common/files.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exMarkdown from '../js/exhibitera_app_markdown.js'

const overlay = document.getElementById('overlayDiv')
const base = document.getElementById('baseDiv')

let homeScreenDisabled = false
let currentDefintion = ''
let clicked = 0
let currentLang = null
let inactivityTimer = 0 // Reference to setTimeout for reseting the view
let inactivityTimeout = 30000
let attractorAvailable = false
let attractorType = 'image'
resetActivityTimer()

/* Get the width and height of the img element */
const w = overlay.offsetWidth
const h = overlay.offsetHeight
const overlayImg = document.getElementById('overlayImg')

/* Position the slider in the middle: */
const slider = document.getElementById('slider')
slider.style.top = (h / 2) - (slider.offsetHeight / 2) + 'px'
slider.style.left = (w / 2) - (slider.offsetWidth / 2) + 'px'

// Reset the timer
document.body.addEventListener('click', resetActivityTimer)

// Listen for click/tap and start the sliding
slider.addEventListener('mousedown', slideReady)
slider.addEventListener('touchstart', slideReady)
overlay.addEventListener('mousedown', slideReady)
overlay.addEventListener('touchstart', slideReady)
base.addEventListener('mousedown', slideReady)
base.addEventListener('touchstart', slideReady)

// Listen for the slide
overlay.addEventListener('mousemove', slideMove)
base.addEventListener('mousemove', slideMove)
overlay.addEventListener('touchmove', slideMove)
base.addEventListener('touchmove', slideMove)

// Listen for click/touch end and stop sliding.
overlay.addEventListener('mouseup', slideFinish)
overlay.addEventListener('touchend', slideFinish)
base.addEventListener('mouseup', slideFinish)
base.addEventListener('touchend', slideFinish)

// Buttons
document.getElementById('homeButton').addEventListener('click', () => {
  document.getElementById('mainMenu').style.display = 'block'
})

function slideReady (e) {
  /* Prevent any other actions that may occur when moving over the image: */
  e.preventDefault()
  slide(getCursorPos(e))
  /* The slider is now clicked and ready to move: */
  clicked = 1
  resetActivityTimer()
  document.getElementById('slidingHandContainer').style.display = 'none'
}

function slideFinish () {
  /* The slider is no longer clicked: */
  clicked = 0
}

function slideMove (e) {
  /* If the slider is no longer clicked, exit this function: */
  if (clicked === 0) return false
  /* Get the cursor's x position: */
  let pos = getCursorPos(e)
  /* Prevent the slider from being positioned outside the image: */
  if (pos < 0) pos = 0
  if (pos > w) pos = w
  /* Execute a function that will resize the overlay image according to the cursor: */
  slide(pos)
  resetActivityTimer()
}

function getCursorPos (e) {
  let x = 0
  e = (e.changedTouches) ? e.changedTouches[0] : e
  /* Get the x positions of the image: */
  const a = overlay.getBoundingClientRect()
  /* Calculate the cursor's x coordinate, relative to the image: */
  x = e.pageX - a.left
  /* Consider any page scrolling: */
  x = x - window.scrollX
  return x
}

function slide (x) {
  // Adjust the view based on the current input position

  const xPercent = 100 * x / w
  const xPercentStr = String(xPercent) + '%'

  // Move overlay image mask
  overlayImg.style.clipPath = 'polygon(0% 0%, ' + xPercentStr + ' 0%, ' + xPercentStr + ' 100%, 0% 100%)'

  // Move slider icon
  slider.style.left = (x) - (slider.offsetWidth / 2) + 'px'

  // Hide the labels as needed
  if (xPercent < 12) {
    document.getElementById('image2Label').style.display = 'none'
  } else {
    document.getElementById('image2Label').style.display = 'block'
  }
  if (xPercent > 88) {
    document.getElementById('image1Label').style.display = 'none'
  } else {
    document.getElementById('image1Label').style.display = 'block'
  }
}

function loadImages (item) {
  // Load the images corresponding to the given object

  if (homeScreenDisabled === false) {
    document.getElementById('pulsingHandContainer').style.display = 'none'
  }

  const overlayImg = document.getElementById('overlayImg')
  const baseImg = document.getElementById('baseImg')

  overlayImg.src = exCommon.config.helperAddress + '/content/' + item.image2
  baseImg.src = exCommon.config.helperAddress + '/content/' + item.image1

  // Configure whether the images should be shown fullscreen
  if ('show_fullscreen' in item && item.show_fullscreen === false) {
    overlayImg.classList.add('comp-image-contain')
    baseImg.classList.add('comp-image-contain')
  } else {
    overlayImg.classList.remove('comp-image-contain')
    baseImg.classList.remove('comp-image-contain')
  }

  // Reset the slider to the middle
  slide(w / 2)

  // Configure the text areas
  const image1Label = document.getElementById('image1Label')
  const image2Label = document.getElementById('image2Label')
  const aboutButton = document.getElementById('aboutButton')
  if (item?.localization?.[currentLang]?.image1_name) {
    image1Label.innerHTML = exMarkdown.formatText(item?.localization?.[currentLang]?.image1_name || '', { removeParagraph: true, string: true })
    image1Label.classList.remove('hidden')
  } else {
    image1Label.classList.add('hidden')
  }
  if (item?.localization?.[currentLang]?.image2_name) {
    image2Label.innerHTML = exMarkdown.formatText(item?.localization?.[currentLang]?.image2_name || '', { removeParagraph: true, string: true })
    image2Label.classList.remove('hidden')
  } else {
    image2Label.classList.add('hidden')
  }

  if (item?.localization?.[currentLang]?.info_text) {
    const infoTitle = document.getElementById('aboutModalTitle')
    const infoBody = document.getElementById('aboutModalBody')

    const html = exMarkdown.formatText(item?.localization?.[currentLang]?.info_text || '')
    const formattedHTML = exMarkdown.formatMarkdownImages(html)

    infoTitle.innerHTML = exMarkdown.formatText(item?.localization?.[currentLang]?.info_title || '', { removeParagraph: true, string: true })

    infoBody.innerHTML = ''
    infoBody.appendChild(formattedHTML)

    aboutButton.style.display = 'flex'
  } else {
    aboutButton.style.display = 'none'
  }

  // Hide the menu
  document.getElementById('mainMenu').style.display = 'none'
}

function loadDefinition (definition) {
  // A function to configure content based on the provided configuration.

  exCommon.config.definition = definition

  const root = document.querySelector(':root')

  // Configure the attractor
  inactivityTimeout = definition?.inactivity_timeout * 1000 || 30000

  if ((definition?.attractor ?? '') !== '') {
    if (exFiles.guessMimetype(definition.attractor) === 'video') {
      attractorType = 'video'

      document.getElementById('attractorVideo').src = '../content/' + definition.attractor
      document.getElementById('attractorVideo').style.display = 'block'
      document.getElementById('attractorImage').style.display = 'none'
      document.getElementById('attractorVideo').play()
    } else {
      attractorType = 'image'
      try {
        document.getElementById('attractorVideo').stop()
      } catch {
        // Ignore the error that arises if we're pausing a video that doesn't exist.
      }

      document.getElementById('attractorImage').src = '../content/' + definition.attractor
      document.getElementById('attractorImage').style.display = 'block'
      document.getElementById('attractorVideo').style.display = 'none'
    }

    attractorAvailable = true
  } else {
    hideAttractor()
    attractorAvailable = false
  }

  exCommon.createLanguageSwitcher(definition, localize)
  currentLang = definition?.language_order[0] ?? null
  document.getElementById('homeButton').style.display = 'block'

  // Configure the number of columns
  const numItems = definition.content_order.length

  root.style.setProperty('--itemList-width-landscape', 10)
  root.style.setProperty('--itemList-width-portrait', 10)

  if (numItems === 1) {
    // With only one image pair, don't use the home screen
    homeScreenDisabled = true
    document.getElementById('homeButton').style.display = 'none'
  } else if (numItems < 3) {
    root.style.setProperty('--col-count-landscape', 2)
    root.style.setProperty('--col-count-portrait', 1)
  } else if (numItems === 3) {
    root.style.setProperty('--col-count-landscape', 3)
    root.style.setProperty('--col-count-portrait', 1)
    root.style.setProperty('--itemList-width-portrait', 8)
  } else if (numItems === 4) {
    root.style.setProperty('--col-count-landscape', 2)
    root.style.setProperty('--col-count-portrait', 1)
    root.style.setProperty('--itemList-width-landscape', 7)
    root.style.setProperty('--itemList-width-portrait', 6)
  } else if (numItems < 7) {
    root.style.setProperty('--col-count-landscape', 3)
    root.style.setProperty('--col-count-portrait', 2)
  } else {
    root.style.setProperty('--col-count-landscape', 4)
    root.style.setProperty('--col-count-portrait', 2)
  }

  // Color
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', 'black')
  root.style.setProperty('--titleColor', 'white')
  root.style.setProperty('--subtitleColor', 'white')
  root.style.setProperty('--itemNameColor', 'white')
  root.style.setProperty('--buttonBackgroundColor', '#393a5acc')
  root.style.setProperty('--buttonTextColor', 'white')
  root.style.setProperty('--buttonOutlineColor', 'white')
  root.style.setProperty('--sliderBackgroundColor', '#719bbfb3')
  root.style.setProperty('--sliderIconColor', 'black')
  root.style.setProperty('--labelBackgroundColor', '#00000080')
  root.style.setProperty('--labelTextColor', 'white')
  root.style.setProperty('--infoTitleColor', 'white')
  root.style.setProperty('--infoBodyColor', 'white')

  // Then, apply the definition settings
  for (const key of Object.keys(definition?.style?.color ?? {})) {
    document.documentElement.style.setProperty('--' + key, definition.style.color[key])
  }

  // Backgorund settings
  if (definition?.style?.background) {
    exCommon.setBackground(definition.style.background, root, '#fff', true)
  }

  setTimeout(() => {
    // Set language switch icon color based on its background color.
    // Make sure a render frame has happened so the colors are right.
    let backgroundClassification = 'dark'
    const langSwitchDropdownIcon = document.getElementById('langSwitchDropdownIcon')
    try {
      const el = document.getElementById('langSwitchDropdownButton')
      const backgroundColor = exCommon.getColorAsRGBA(el, 'background')
      backgroundClassification = exCommon.classifyColor(backgroundColor)
    } catch (e) {

    }

    if (backgroundClassification === 'light') {
      langSwitchDropdownIcon.src = '../_static/icons/translation-icon_black.svg'
    } else {
      langSwitchDropdownIcon.src = '../_static/icons/translation-icon_white.svg'
    }
  }, 100)

  // Font
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--title-font', 'Title-default')
  root.style.setProperty('--subtitle-font', 'Subtitle-default')
  root.style.setProperty('--item_name-font', 'Item_name-default')
  root.style.setProperty('--label-font', 'Label-default')
  root.style.setProperty('--info_pane_title-font', 'Info_pane_title-default')
  root.style.setProperty('--info_pane_body-font', 'Info_pane_body-default')

  // Then, apply the definition settings
  for (const key of Object.keys(definition?.style?.font ?? {})) {
    const font = new FontFace(key, 'url(' + encodeURI(definition.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  }

  // Text size settings
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--title-font-adjust', 0)
  root.style.setProperty('--subtitle-font-adjust', 0)
  root.style.setProperty('--item_name-font-adjust', 0)
  root.style.setProperty('--label-font-adjust', 0)
  root.style.setProperty('--info_pane_title-font-adjust', 0)
  root.style.setProperty('--info_pane_body-font-adjust', 0)

  // Then, apply the definition settings
  for (const key of Object.keys(definition?.style?.text_size ?? {})) {
    const value = definition.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  }

  localize(currentLang)

  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 500)
}

function populateItemList (def) {
  // Using the details in the defintion, build an icon for each image pair.

  const itemRow = document.getElementById('itemList')
  itemRow.innerHTML = ''

  // Calculate the rough width of the thumbnails
  const numFiles = def.content_order.length
  let thumbWidth
  if (window.innerWidth >= window.innerHeight) {
    // We're in landscape
    if (numFiles < 4) {
      thumbWidth = window.innerWidth / numFiles
    } else if (numFiles === 4) {
      thumbWidth = window.innerWidth / 2
    } else if (numFiles < 7) {
      thumbWidth = window.innerWidth / 3
    } else thumbWidth = window.innerWidth / 4
  } else {
    // We're in portrait

    if (numFiles < 5) {
      thumbWidth = window.innerWidth
    } else {
      thumbWidth = window.innerWidth / 2
    }
  }
  thumbWidth = String(Math.round(thumbWidth))

  let first = true
  for (const uuid of def.content_order) {
    const item = def.content[uuid]

    const col = document.createElement('div')
    col.classList = 'col'
    col.addEventListener('click', () => {
      loadImages(item)
    })
    itemRow.appendChild(col)

    const iconContainer = document.createElement('div')
    iconContainer.classList = 'icon-container'
    col.appendChild(iconContainer)

    const img1 = document.createElement('img')
    img1.classList = 'w-100 icon-image icon-image-top'
    img1.src = exCommon.config.helperAddress + exConfig.api + '/files/' + item.image1 + '/thumbnail/' + thumbWidth
    iconContainer.appendChild(img1)

    const img2 = document.createElement('img')
    img2.classList = 'w-100 icon-image icon-image-bottom'
    img2.src = exCommon.config.helperAddress + exConfig.api + '/files/' + item.image2 + '/thumbnail/' + thumbWidth
    img2.style.position = 'absolute'
    img2.style.top = 0
    img2.style.left = 0
    iconContainer.appendChild(img2)

    const label = document.createElement('div')
    label.classList = 'button-label'
    label.innerHTML = exMarkdown.formatText(item?.localization?.[currentLang]?.name || '', { removeParagraph: true, string: true })

    col.appendChild(label)

    if (first) {
      // Add the pulsing hand graphic

      const div = document.createElement('div')
      div.setAttribute('id', 'pulsingHandContainer')
      iconContainer.appendChild(div)

      const hand = document.createElement('img')
      hand.setAttribute('id', 'pulsingHand')
      hand.src = '../_static/icons/hand.svg'
      div.appendChild(hand)

      first = false
    }
  }
}

function localize (lang) {
  // Use the localization to switch to the given language

  currentLang = lang
  console.log(exCommon.config)
  if (homeScreenDisabled) {
    loadImages(exCommon.config.definition.content[exCommon.config.definition.content_order[0]])
    document.getElementById('mainMenu').style.display = 'none'
  } else {
    populateItemList(exCommon.config.definition)
    document.getElementById('mainMenu').style.display = 'block'

    // Home screen text
    document.getElementById('title').innerHTML = exMarkdown.formatText(exCommon.config.definition?.misc_text?.title?.localization?.[currentLang] || '', { removeParagraph: true, string: true }
    )

    document.getElementById('subtitle').innerHTML = exMarkdown.formatText(exCommon.config.definition?.misc_text?.subtitle?.localization?.[currentLang] || '', { string: true })
  }
}

function resetActivityTimer () {
  // Reset the timer for resetting the view

  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, inactivityTimeout)
}

function resetView () {
  localize(exCommon.config.definition?.language_order[0] || 'en-uk')
  exUtilities.hideModal('#aboutModal')
  document.getElementById('slidingHandContainer').style.display = 'block'

  if (homeScreenDisabled === false) {
    document.getElementById('mainMenu').style.display = 'block'
    document.getElementById('pulsingHandContainer').style.display = 'block'
  }
}

function showAttractor () {
  // Make the attractor layer visible

  const attractorOverlay = document.getElementById('attractorOverlay')

  exCommon.config.currentInteraction = false
  if (attractorAvailable) {
    if (attractorType === 'video') {
      document.getElementById('attractorVideo').play()
        .then(() => {
          attractorOverlay.style.display = 'flex'
          setTimeout(() => { attractorOverlay.style.opacity = 1 }, 0)
          resetView()
        })
    } else {
      attractorOverlay.style.display = 'flex'
      setTimeout(() => {
        attractorOverlay.style.opacity = 1
        resetView()
      }, 0)
    }
  } else {
    resetView()
  }
}

function hideAttractor () {
  // Make the attractor layer invisible

  const attractorOverlay = document.getElementById('attractorOverlay')
  attractorOverlay.style.opacity = 0
  setTimeout(() => {
    if (attractorType === 'video') {
      document.getElementById('attractorVideo').pause()
    }
    exCommon.config.currentInteraction = true
    resetActivityTimer()
    attractorOverlay.style.display = 'none'
  }, 400)
}

function parseUpdate (update) {
  // A function to respond to commands from Control Server.

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    exCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

// Bind event handlers
document.getElementById('attractorOverlay').addEventListener('click', hideAttractor)

exCommon.configureApp({
  name: 'image_compare',
  loadDefinition,
  parseUpdate
})
