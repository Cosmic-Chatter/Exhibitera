/* global showdown textFit */

import exConfig from '../../common/config.js'
import * as exFiles from '../../common/files.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exMarkdown from '../js/exhibitera_app_markdown.js'

function updateFunc (update) {
  // Read updates for timeline explorer-specific actions and act on them

}

function loadDefinition (def) {
  // Helper function to manage setting up the interface.

  exCommon.config.definition = def
  const root = document.querySelector(':root')

  // Modify the style

  // Color

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--backgroundColor', '#1a2b3c')
  root.style.setProperty('--headerColor', '#0f1419')
  root.style.setProperty('--footerColor', '#0f1419')
  root.style.setProperty('--itemColor', '#2f3e4f')
  root.style.setProperty('--lineColor', '#6b7280')
  root.style.setProperty('--textColor', '#e6e6e2')

  // Then, apply the definition settings
  for (const key of Object.keys(def?.style?.color ?? {})) {
    document.documentElement.style.setProperty('--' + key, def.style.color[key])
  }

  if ('headerColor' in def.style.color) {
    // Configure the status bar for PWAs
    document.querySelector('meta[name="theme-color"]').setAttribute('content', def.style.color.headerColor)
    document.querySelector('meta[name="msapplication-TileColor"]').setAttribute('content', def.style.color.headerColor)
  } else {
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0f1419')
    document.querySelector('meta[name="msapplication-TileColor"]').setAttribute('content', '#0f1419')
  }

  // Backgorund settings
  if ('background' in def.style) {
    exCommon.setBackground(def.style.background, root, '#1a2b3c')
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

  // Text size settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--title-font-adjust', 0)
  root.style.setProperty('--time-font-adjust', 0)
  root.style.setProperty('--body-font-adjust', 0)

  // Then, apply the definition settings
  Object.keys(def.style?.text_size ?? {}).forEach((key) => {
    const value = def.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  })

  const langs = Object.keys(def.languages)
  if (langs.length === 0) return

  exCommon.createLanguageSwitcher(def, localize)

  // Find the default language
  defaultLang = def.language_order[0]

  // Set up the attractor
  inactivityTimeout = parseInt(def?.inactivity_timeout ?? 30)
  if ('attractor' in def && def.attractor.trim() !== '') {
    const fileType = exFiles.guessMimetype(def.attractor)
    if (['image', 'video'].includes(fileType)) {
      setAttractor(def.attractor, fileType)
    }
  } else {
    setAttractor('', '')
  }

  localize(defaultLang)
  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(def.uuid + '.png'), 100)
  resetInactivityTimer()
}

function adjustFontSize (increment) {
  // Adjust the font multiplier by the given amount

  const root = document.querySelector(':root')
  let fontModifierStr = root.style.getPropertyValue('--fontModifier')
  if (fontModifierStr === '') fontModifierStr = '1'
  let fontModifier = parseFloat(fontModifierStr)

  fontModifier += increment
  if (fontModifier < 1) {
    fontModifier = 1
  }

  root.style.setProperty('--fontModifier', fontModifier)
}

function localize (lang) {
  // Set the content to the given language

  exCommon.configureLanguage(lang)

  const definition = exCommon.config.definition

  const header = document.getElementById('headerText')
  const root = document.querySelector(':root')

  document.getElementById('timelineContainer').innerHTML = ''

  for (const itemUUID of definition.content_order) {
    createTimelineEntry(itemUUID, lang)
  }

  const headerText = exMarkdown.formatText(definition?.languages?.[lang]?.header_text ?? '', { string: true, removeParagraph: true })

  header.innerHTML = headerText
  if (headerText !== '') {
    root.style.setProperty('--header-height', '7.5vmax')
    textFit(header)
  } else {
    root.style.setProperty('--header-height', '0vmax')
  }
}

function createTimelineEntry (itemUUID, langCode) {
  // Build an HTML element for the given timeline item

  const item = exCommon.config.definition.content[itemUUID]
  const localization = exCommon.config.definition.languages[langCode]?.content?.[itemUUID]

  const li = document.createElement('li')

  const container = document.createElement('div')
  container.classList = 'timeline-element row m-0'
  li.appendChild(container)

  // Text
  const textCol = document.createElement('div')
  textCol.classList = 'col text-col'
  container.appendChild(textCol)

  const timeEl = document.createElement('time')
  timeEl.innerHTML = exMarkdown.formatText(localization?.time ?? '', { string: true, removeParagraph: true })
  textCol.appendChild(timeEl)

  const title = document.createElement('div')
  if (parseInt(item.Level) < 1) {
    title.classList = 'size1'
  } else if (parseInt(item.Level) > 4) {
    title.classList = 'size4'
  } else {
    title.classList = 'size' + String(item?.level ?? 4)
  }
  title.classList.add('timeline-item-header')
  title.innerHTML = exMarkdown.formatText(localization?.title ?? '', { string: true, removeParagraph: true })
  textCol.appendChild(title)

  const bodyEl = document.createElement('p')
  bodyEl.classList = 'timeline-body'
  bodyEl.innerHTML = exMarkdown.formatText(localization?.description ?? '', { string: true, removeParagraph: true })
  textCol.appendChild(bodyEl)

  // Media
  if (item.filename != null && item.filename.trim() !== '') {
    // Make the timeline element wider to accomdate the media
    container.classList.add('with-media')

    const mediaCol = document.createElement('div')
    mediaCol.classList = 'col px-0 media-col'
    container.appendChild(mediaCol)

    const mimetype = exFiles.guessMimetype(item.filename)
    if (mimetype === 'image') {
      const image = document.createElement('img')
      image.style.width = '100%'
      image.style.height = '100%'
      image.style.objectFit = item?.fill_mode ?? 'cover'
      if ((item?.fill_mode ?? 'cover') === 'contain') {
        image.classList.add('media-contain')
      }
      // Calculate size of image
      const width = window.innerWidth * window.devicePixelRatio
      const height = window.innerHeight * window.devicePixelRatio
      let thumbRes
      if (width > height) {
        thumbRes = Math.round(width * 0.25)
      } else {
        thumbRes = Math.round(width * 0.5)
      }
      image.src = exCommon.config.helperAddress + exConfig.api + '/files/' + item.filename + '/thumbnail/' + String(thumbRes)
      mediaCol.appendChild(image)
    } else if (mimetype === 'video') {
      const video = document.createElement('video')
      video.style.width = '100%'
      video.style.height = '100%'
      video.className = 'card-img-top'
      video.style.objectFit = item?.fill_mode ?? 'cover'
      if ((item?.fill_mode ?? 'cover') === 'contain') {
        video.classList.add('media-contain')
      }
      video.src = '/content/' + item.filename

      video.muted = true
      video.loop = true
      video.autoplay = true
      video.playsInline = true
      video.setAttribute('webkit-playsinline', true)
      video.setAttribute('disablePictureInPicture', true)
      mediaCol.appendChild(video)
    }
  }

  document.getElementById('timelineContainer').appendChild(li)
  configureVisibleElements()
}

// check if an element is in viewport
function isElementInViewport (el) {
  const rect = el.getBoundingClientRect()
  return (
    // Horizontal Check
    rect.right >= 0 &&
    rect.left <= (window.innerWidth || document.documentElement.clientWidth) &&
    // Vertical Check
    rect.bottom >= 0 &&
    rect.top <= (window.innerHeight || document.documentElement.clientHeight)
  )
}

function configureVisibleElements () {
  // Iterate the timeline elements and make them visible if they are in view (trigger the animation).

  const items = document.querySelectorAll('.timeline li')

  for (let i = 0; i < items.length; i++) {
    const video = items[i].querySelector('video')
    if (isElementInViewport(items[i])) {
      items[i].classList.add('in-view')
      if (video) video.play()
    } else {
      items[i].classList.remove('in-view')
      if (video) video.pause()
    }
  }
}

function setAttractor (filename, fileType) {
  attractorAvailable = true
  if (fileType === 'video') {
    document.getElementById('attractorVideo').src = '/content/' + filename
    document.getElementById('attractorImage').style.display = 'none'
    document.getElementById('attractorVideo').style.display = 'block'
  } else if (fileType === 'image') {
    document.getElementById('attractorImage').src = '/content/' + filename
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
document.getElementById('fontSizeDecreaseButton').addEventListener('click', () => {
  adjustFontSize(-0.1)
})
document.getElementById('fontSizeIncreaseButton').addEventListener('click', () => {
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

const currentDefintion = ''

adjustFontSize(-100) // Make sure the font modifier is at 1 to start
hideAttractor()
