/* global bootstrap textFit */

import exConfig from '../../common/config.js'
import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exMarkdown from '../js/exhibitera_app_markdown.js'

function changePage (direction) {
  // Display a new page of results

  const numItems = exCommon.config.definition.content_order.length

  if (direction === 'forward') {
    currentPage += 1
    if (currentPage * cardsPerPage >= numItems) {
      if ((exCommon.config.definition?.behavior?.loop_results ?? true) === false) {
        currentPage -= 1
      } else {
        // If there are not more cards to show, go page to the first page.
        currentPage = 0
      }
    }
  } else {
    currentPage -= 1
    if (currentPage < 0) {
      if ((exCommon.config.definition?.behavior?.loop_results ?? true) === false) {
        currentPage = 0
      } else {
        // Loop back to last page
        currentPage = Math.floor(((numItems - 1) / cardsPerPage))
      }
    }
  }
  populateResultsRow()
}

function clear () {
  currentPage = 0
  // document.getElementById('searchInput').value = ''
  // keyboard.input.default = ''
  // keyboard.input.searchInput = ''
  Array.from(document.getElementsByClassName('filter-entry')).forEach((el) => {
    el.value = ''
  })
  // Close the filter dropdown
  new bootstrap.Dropdown(document.getElementById('filterDropdown')).hide()

  localize(defaultLang)
}

function createCard (obj) {
  // Take a JSON object and turn it into a card in the resultsRow

  const def = exCommon.config.definition

  // Get a thumbnail
  let thumbName
  if (obj.custom_thumbnail !== '') {
    // Use a user-supplied thumbnail
    thumbName = obj.custom_thumbnail
  } else {
    // Pull the default thumbnail
    thumbName = obj.filename
  }

  const numCols = def?.layout?.num_columns ?? 3
  const iconWidth = String(Math.round(window.innerWidth / numCols))

  const thumb = exCommon.config.helperAddress + exConfig.api + '/files/' + thumbName + '/thumbnail/' + iconWidth + '?force_image=true'

  const title = exMarkdown.formatText(def.languages?.[currentLang]?.content?.[obj.uuid]?.title ?? '', { string: true, removeParagraph: true })

  const col = document.createElement('div')
  col.classList = 'cardCol col align-items-center justify-content-center d-flex'
  col.style.height = String(0.975 * window.innerHeight / numRows) + 'px'

  const card = document.createElement('div')
  card.classList = 'resultCard row w-100 d-flex align-content-center'
  card.addEventListener('click', function () {
    displayMedia(obj.uuid)
  })
  col.appendChild(card)

  const imgCol = document.createElement('div')
  imgCol.classList = 'col col-12 d-flex justify-content-center align-items-end'
  imgCol.style.height = String(def?.style?.layout?.image_height ?? 70) + '%'
  card.appendChild(imgCol)

  const img = document.createElement('img')
  img.classList = 'resultImg'
  img.src = thumb
  img.setAttribute('id', 'Entry_' + obj.uuid)

  img.style.borderRadius = String(def?.style?.layout?.corner_radius ?? 0) + '%'

  const thumbShape = def.style.layout.thumbnail_shape
  if (thumbShape) {
    if (thumbShape === 'orignal') {
      img.style.aspectRatio = ''
    } else if (thumbShape === 'square') {
      img.style.aspectRatio = 1
    } else if (thumbShape === 'viewport') {
      const height = window.innerHeight
      const width = window.innerWidth
      if (width >= height) {
        img.style.aspectRatio = String(width / height)
      } else {
        img.style.aspectRatio = String(height / width)
      }
    } else if (thumbShape === 'anti-viewport') {
      const height = window.innerHeight
      const width = window.innerWidth
      if (width >= height) {
        img.style.aspectRatio = String(height / width)
      } else {
        img.style.aspectRatio = String(width / height)
      }
    }
  } else {
    img.style.aspectRatio = ''
  }

  imgCol.appendChild(img)

  let titleSpan
  if ((def.style.layout.image_height && def.style.layout.image_height < 100) || !def.style.layout.image_height) {
    const titleCol = document.createElement('div')
    titleCol.classList = 'col col-12 text-center cardTitleContainer'

    const imageHeight = def?.style?.layout?.image_height ?? 70

    if (def?.style?.layout?.title_height) {
      titleCol.style.height = String(Math.round((100 - imageHeight) * def.style.layout.title_height / 100)) + '%'
    } else {
      titleCol.style.height = '50%'
    }
    card.appendChild(titleCol)

    titleSpan = document.createElement('div')
    titleSpan.classList = 'cardTitle'
    titleSpan.innerHTML = title
    titleCol.appendChild(titleSpan)
  }

  document.getElementById('resultsRow').appendChild(col)
}

function hideMediaLightBox () {
  // Fade out the lightbox, and then hide it so it doesn't steal touches

  const video = document.getElementById('mediaLightboxVideo')
  video.pause()
  videoPlaying = false

  const audio = document.getElementById('mediaLightboxAudio')
  audio.pause()
  videoPlaying = false

  const mediaLightbox = document.getElementById('mediaLightbox')
  mediaLightbox.style.opacity = 0
  setTimeout(() => { mediaLightbox.style.display = 'none' }, 500)
}

function onFilterOptionChange () {
  currentPage = 0
  populateResultsRow()
}

function populateFilterOptions (order, filters) {
  // Read the filters and create a dropdown for each

  const filterOptionsEl = document.getElementById('filterOptions')
  filterOptionsEl.innerHTML = ''

  for (const uuid of order) {
    const details = filters[uuid]

    const li = document.createElement('li')
    filterOptionsEl.appendChild(li)

    const div = document.createElement('div')
    div.classList = 'dropdown-item'
    li.appendChild(div)

    const label = document.createElement('label')
    label.classList = 'form-label filter-label'
    label.innerHTML = details.display_name
    label.setAttribute('for', 'filterSelect_' + uuid)
    div.appendChild(label)

    const select = document.createElement('select')
    select.classList = 'form-select filter-entry'
    select.dataset.uuid = details.uuid
    select.id = 'filterSelect_' + uuid
    select.addEventListener('change', onFilterOptionChange)
    div.appendChild(select)

    const options = _getFilterOptions(details.uuid)

    const blank = new Option('-', '')
    select.append(blank)

    for (const entry of options) {
      const option = new Option(entry, entry)
      select.appendChild(option)
    }
  }

  // Finally, add an option that clears all the filter selections
  const li = document.createElement('li')
  filterOptionsEl.appendChild(li)

  const div = document.createElement('div')
  div.classList = 'd-flex justify-content-center w-100'
  li.appendChild(div)

  const clearButton = document.createElement('button')
  clearButton.classList = 'btn btn-danger btn-lg mt-2'
  clearButton.innerHTML = '✕'
  clearButton.addEventListener('click', clearFilters)
  div.appendChild(clearButton)
}

function _getFilterOptions (filterUUID) {
  // For a given filter, get a list of the unique options for the select.

  const uniqueValues = new Set()
  // Iterate through all content items
  for (const itemUuid in exCommon.config.definition.content) {
    const item = exCommon.config.definition.content[itemUuid]

    // Check if this item has filter_data and the specific filter
    if (item.filter_data && item.filter_data[filterUUID]) {
      uniqueValues.add(item.filter_data[filterUUID].value)
    }
  }

  return exUtilities.sortAlphabetically(Array.from(uniqueValues))
}

function clearFilters () {
  // Clear any filters

  Array.from(document.getElementsByClassName('filter-entry')).forEach((el) => {
    el.value = ''
  })
  onFilterOptionChange()
}

function _populateResultsRow (currentKey) {
  // Empty and repopulate the results row based on the given filters
  // currentKey accounts for the key being pressed right now, which is not
  // yet part of the input value

  document.getElementById('resultsRow').innerHTML = ''

  // Filter on filter options
  const filters = Array.from(document.getElementsByClassName('filter-entry'))
  const filteredData = []
  let selectedValue, filterMathces

  // Iterate through the data and make sure it matches at least one filtered value.
  for (const itemUUID of exCommon.config.definition.content_order) {
    const item = exCommon.config.definition.content[itemUUID]

    filterMathces = {}
    for (const filter of filters) {
      const filterUUID = filter.dataset.uuid
      filterMathces[filterUUID] = 0 // This will be set to 1 if the filter matches

      selectedValue = filter.value // Can only select one for now
      if (selectedValue != null && selectedValue !== '') {
        if (item?.filter_data?.[filterUUID]?.value === selectedValue) {
          filterMathces[filterUUID] = 1
        }
      } else {
        // If no values are selected for this filter, pass all matches through
        filterMathces[filterUUID] = 1
      }
    }

    // Iterate through the matches to make sure we've matched on every filter
    let totalMathces = 0
    for (const [matchKey, matchValue] of Object.entries(filterMathces)) {
      if (matchValue === 1) totalMathces += 1
    }
    if (totalMathces === filters.length) filteredData.push(item)
  }

  // Sort by the number of matches, so better results rise to the top.
  filteredData.sort((a, b) => b.matchCount - a.matchCount)

  // If there are fewer matches than the max allowed per page, hide the arrows.
  if (filteredData.length <= cardsPerPage) {
    document.getElementById('previousPageButton').style.display = 'none'
    document.getElementById('nextPageButton').style.display = 'none'
  } else {
    document.getElementById('previousPageButton').style.display = 'block'
    document.getElementById('nextPageButton').style.display = 'block'
  }

  // Make sure we have the correct number of results to display
  const displayedResults = filteredData.slice(cardsPerPage * currentPage, cardsPerPage * (currentPage + 1))

  // Create a card for each item and add it to the display
  for (const item of displayedResults) {
    createCard(item)
  }

  // Adjust card title font size to avoid overflows
  // Don't allow text to get larger than wha the user has set.
  const resultsRow = document.getElementById('resultsRow')
  const titles = document.getElementsByClassName('cardTitle')
  if (titles.length > 0) {
    const fontSize = parseFloat(window.getComputedStyle(titles[0], null).getPropertyValue('font-size'))
    resultsRow.style.opacity = 1
    try {
      textFit(titles, { maxFontSize: fontSize })
      // Sometimes need to run twice on first load
      setTimeout(() => {
        textFit(titles, { maxFontSize: fontSize })
      }, 10)
    } catch {

    }
  } else {
    resultsRow.style.opacity = 1
  }
}

function populateResultsRow (currentKey = '') {
  // Stub function to do the fade, then call the helper function

  document.getElementById('resultsRow').style.opacity = 0
  setTimeout(() => { _populateResultsRow(currentKey) }, 300)
}

function displayMedia (uuid) {
  // Take the given uuid and display the media in the overlay.

  const def = exCommon.config.definition
  const obj = def.content[uuid]
  console.log(obj)

  const title = exMarkdown.formatText(def.languages?.[currentLang].content?.[uuid]?.title ?? '', { string: true, removeParagraph: true })

  const caption = exMarkdown.formatText(def.languages?.[currentLang].content?.[uuid]?.caption ?? '', { string: true, removeParagraph: true })
  const credit = exMarkdown.formatText(def.languages?.[currentLang].content?.[uuid]?.credit ?? '', { string: true, removeParagraph: true })

  const media = String(obj.filename)
  showMediaInLightbox(media, title, caption, credit)
}

function updateParser (update) {
  // Read updates specific to the media browser

  if (update?.permissions?.audio) {
    document.getElementById('mediaLightboxVideo').muted = !update.permissions.audio
    document.getElementById('mediaLightboxAudio').muted = !update.permissions.audio
  }
}

function loadDefinition (def) {
  // Take an object parsed from an INI string and use it to load a new set of contet

  exCommon.config.definition = def

  const root = document.querySelector(':root')

  const langs = Object.keys(def.languages)
  if (langs.length === 0) return

  exCommon.createLanguageSwitcher(def, localize)

  // Configure the attractor
  inactivityTimeout = (def?.inactivity_timeout ?? 30) * 1000

  if ('attractor' in def && def.attractor.trim() !== '') {
    if (exFiles.guessMimetype(def.attractor) === 'video') {
      attractorType = 'video'

      document.getElementById('attractorVideo').src = '/content/' + def.attractor
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

      document.getElementById('attractorImage').src = 'content/' + def.attractor
      document.getElementById('attractorImage').style.display = 'block'
      document.getElementById('attractorVideo').style.display = 'none'
    }

    attractorAvailable = true
  } else {
    hideAttractor()
    attractorAvailable = false
  }

  if (def.style.layout.num_columns) {
    document.getElementById('resultsRow').classList = 'h-100 row row-cols-' + String(def.style.layout.num_columns)
    numCols = def.style.layout.num_columns
  } else {
    document.getElementById('resultsRow').classList = 'h-100 row row-cols-3'
    numCols = 3
  }
  cardsPerPage = parseInt(def?.style?.layout?.items_per_page ?? 6)
  numRows = Math.ceil(cardsPerPage / numCols)

  document.getElementById('mediaLightboxTitle').style.height = String(def?.style?.layout?.lightbox_title_height ?? 9) + '%'
  document.getElementById('mediaLightboxCaption').style.height = String(def?.style?.layout?.lightbox_caption_height ?? 15) + '%'
  document.getElementById('mediaLightboxCredit').style.height = String(def?.style?.layout?.lightbox_credit_height ?? 6) + '%'

  if (def.style.layout.lightbox_image_height) {
    document.getElementById('mediaLightboxImage').style.height = String(def.style.layout.lightbox_image_height) + '%'
    document.getElementById('mediaLightboxVideo').style.height = String(def.style.layout.lightbox_image_height) + '%'
  } else {
    document.getElementById('mediaLightboxVideo').style.height = '70%'
  }

  // Modify the style

  // Color
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', 'white')
  root.style.setProperty('--titleColor', 'black')
  root.style.setProperty('--filterBackgroundColor', 'white')
  root.style.setProperty('--filterLabelColor', 'black')
  root.style.setProperty('--filterTextColor', 'black')

  // Then, apply the definition settings
  for (let key of Object.keys(def.style.color)) {
    // Fix for change from backgroundColor to background-color in v4
    if (key === 'backgroundColor') key = 'background-color'
    document.documentElement.style.setProperty('--' + key, def.style.color[key])
  }

  // Backgorund settings
  exCommon.setBackground(def?.style?.background, root, '#fff', true)

  // Set icon colors based on the background color.
  let backgroundClassification = 'dark'
  try {
    const backgroundColor = exCommon.getColorAsRGBA(document.body, 'background')
    backgroundClassification = exCommon.classifyColor(backgroundColor)
  } catch (e) {

  }

  if (backgroundClassification === 'light') {
    document.getElementById('langSwitchDropdownIcon').src = '../_static/icons/translation-icon_black.svg'
    document.getElementById('filterDropdownIcon').src = '../_static/icons/filter_black.svg'
  } else {
    document.getElementById('langSwitchDropdownIcon').src = '../_static/icons/translation-icon_white.svg'
    document.getElementById('filterDropdownIcon').src = '../_static/icons/filter_white.svg'
  }

  // Font

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--Header-font', 'Header-default')
  root.style.setProperty('--Title-font', 'Title-default')
  root.style.setProperty('--Lightbox_title-font', 'Lightbox_title-default')
  root.style.setProperty('--Lightbox_caption-font', 'Lightbox_caption-default')
  root.style.setProperty('--Lightbox_credit-font', 'Lightbox_credit-default')
  root.style.setProperty('--filter_label-font', 'filter_label-default')
  root.style.setProperty('--filter_text-font', 'filter_text-default')

  // Then, apply the definition settings
  for (const key of Object.keys(def.style.font)) {
    const font = new FontFace(key, 'url(' + encodeURI(def.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  }

  // Text size settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--Header-font-adjust', 0)
  root.style.setProperty('--Title-font-adjust', 0)
  root.style.setProperty('--Lightbox_title-font-adjust', 0)
  root.style.setProperty('--Lightbox_caption-font-adjust', 0)
  root.style.setProperty('--Lightbox_credit-font-adjust', 0)
  root.style.setProperty('--filter_label-font-adjust', 0)
  root.style.setProperty('--filter_text-font-adjust', 0)

  // Then, apply the definition settings
  for (const key of Object.keys(def.style.text_size)) {
    const value = def.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  }

  // Find the default language
  defaultLang = def.language_order[0]

  localize(defaultLang)

  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(def.uuid + '.png'), 500)
}

function localize (lang) {
  // Set the content to the given language

  exCommon.configureLanguage(lang)
  currentLang = lang

  const definition = exCommon.config.definition

  if ((definition?.languages?.[lang]?.filter_order?.length ?? 0) > 0) {
    // Show the filter icon
    document.getElementById('filterDropdown').style.display = 'block'
    populateFilterOptions(definition.languages[lang].filter_order, definition.languages[lang].filters)
  } else {
    // Delete any filter elements
    document.getElementById('filterOptions').innerHTML = ''
    // Hide the filter icon
    document.getElementById('filterDropdown').style.display = 'none'
  }

  populateResultsRow()
}

function showAttractor () {
  // Make the attractor layer visible

  // Don't show the attractor if a video is playing
  if (videoPlaying === true) {
    resetActivityTimer()
    return
  }

  const attractorOverlay = document.getElementById('attractorOverlay')

  exCommon.config.currentInteraction = false
  if (attractorAvailable) {
    if (attractorType === 'video') {
      document.getElementById('attractorVideo').play()
        .then(() => {
          attractorOverlay.style.display = 'flex'
          setTimeout(() => { attractorOverlay.style.opacity = 1 }, 0)
          hideMediaLightBox()
          clear()
        })
    } else {
      attractorOverlay.style.display = 'flex'
      setTimeout(() => { attractorOverlay.style.opacity = 1 }, 0)
      hideMediaLightBox()
      clear()
    }
  } else {
    hideMediaLightBox()
    clear()
  }
}

function hideAttractor () {
  // Make the attractor layer invisible

  document.getElementById('attractorOverlay').style.opacity = 0
  setTimeout(() => {
    if (attractorType === 'video') {
      document.getElementById('attractorVideo').pause()
    }
    exCommon.config.currentInteraction = true
    resetActivityTimer()
  }, 400)
}

function resetActivityTimer () {
  // Cancel the existing activity timer and set a new one

  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, inactivityTimeout)
}

function showMediaInLightbox (media, title = '', caption = '', credit = '') {
  // Set the img or video source to the provided media, set the caption, and reveal the light box.

  // Hide elements until image is loaded
  document.querySelectorAll('.lightboxMedia').forEach((el) => {
    el.style.display = 'none'
  })

  document.querySelectorAll('.lightbox-text').forEach((el) => {
    el.style.opacity = 0
  })

  const lightbox = document.getElementById('mediaLightbox')
  const audioEl = document.getElementById('mediaLightboxAudio')
  const imageEl = document.getElementById('mediaLightboxImage')
  const videoEl = document.getElementById('mediaLightboxVideo')
  const titleDiv = document.getElementById('mediaLightboxTitle')
  const captionDiv = document.getElementById('mediaLightboxCaption')
  const creditDiv = document.getElementById('mediaLightboxCredit')
  titleDiv.innerHTML = title

  captionDiv.innerHTML = caption
  creditDiv.innerHTML = credit

  // Load the media with a callback to fade it in when it is loaded
  const mimetype = exFiles.guessMimetype(media)
  if (mimetype === 'audio') {
    videoPlaying = true
    audioEl.src = '/content/' + media
    audioEl.load()
    audioEl.play()
    document.querySelectorAll('.lightbox-text').forEach((el) => {
      el.style.opacity = 1
    })
    // Make the image element active but invisible to claim vertical space
    imageEl.style.display = 'block'
    imageEl.style.opacity = 0
  } else if (mimetype === 'image') {
    imageEl.src = '/content/' + media
    imageEl.style.opacity = 1
  } else if (mimetype === 'video') {
    videoPlaying = true
    videoEl.src = '/content/' + media
    videoEl.load()
    videoEl.play()
    document.querySelectorAll('.lightbox-text').forEach((el) => {
      el.style.opacity = 1
    })
    videoEl.style.display = 'block'
  }

  lightbox.style.display = 'flex'
  setTimeout(() => {
    // Make sure the display mode is already set
    lightbox.style.opacity = 1
    fixLightboxTextSize(titleDiv, creditDiv)
  }, 0)
}

function fixLightboxTextSize (titleDiv, creditDiv) {
  // Fit the lightbox title and credit text
  // (caption is allowed to overflow for scroll)

  const def = exCommon.config.definition

  const titleFontSize = parseFloat(window.getComputedStyle(titleDiv, null).getPropertyValue('font-size'))
  const creditFontSize = parseFloat(window.getComputedStyle(creditDiv, null).getPropertyValue('font-size'))
  titleDiv.style.whiteSpace = 'normal'
  creditDiv.style.whiteSpace = 'normal'

  if (def.style.layout) {
    if ((def?.style?.layout?.lightbox_title_height ?? 0) > 0) {
      try {
        textFit(titleDiv, { maxFontSize: titleFontSize })
      } catch {
        // Ignore a failed resize
      }
    }
    if ((def?.style?.layout?.lightbox_credit_height ?? 0) > 0) {
      try {
        textFit(creditDiv, { maxFontSize: creditFontSize })
      } catch {
        // Ignore a failed resieze
      }
    }
  }
}

// const Keyboard = window.SimpleKeyboard.default

// // Add a listener to each input so we direct keyboard input to the right one
// document.querySelectorAll('.input').forEach(input => {
//   input.addEventListener('focus', onInputFocus)
// })
// function onInputFocus (event) {
//   keyboard.setOptions({
//     inputName: event.target.id
//   })
// }
// function onInputChange (event) {
//   keyboard.setInput(event.target.value, event.target.id)
// }
// function onKeyPress (button) {
//   if (button === '{lock}' || button === '{shift}') handleShiftButton()
//   currentPage = 0
//   populateResultsRow(button)
// }
// document.querySelector('.input').addEventListener('input', event => {
//   keyboard.setInput(event.target.value)
// })
// function onChange (input) {
//   document.querySelector('#searchInput').value = input
// }

// const keyboard = new Keyboard({
//   onChange: input => onChange(input),
//   onKeyPress: button => onKeyPress(button),
//   layout: {
//     default: [
//       'Q W E R T Y U I O P',
//       'A S D F G H J K L',
//       'Z X C V B N M {bksp}',
//       '{space}'
//     ]
//   }
// })

let currentPage = 0
let cardsPerPage, numCols, numRows
let defaultLang = ''

exCommon.configureApp({
  name: 'media_browser',
  debug: true,
  loadDefinition,
  parseUpdate: updateParser
})

let currentLang = ''

let inactivityTimer = null
let inactivityTimeout = 30000
let attractorAvailable = false
let attractorType = 'image'
let videoPlaying = false

// Attach event listeners
document.getElementById('previousPageButton').addEventListener('click', () => {
  changePage('backward')
})
document.getElementById('nextPageButton').addEventListener('click', () => {
  changePage('forward')
})
document.body.addEventListener('click', resetActivityTimer)
document.getElementById('attractorOverlay').addEventListener('click', hideAttractor)
document.querySelectorAll('.hideLightboxTrigger').forEach((el) => {
  el.addEventListener('click', hideMediaLightBox)
})
document.getElementById('mediaLightboxVideo').addEventListener('ended', (event) => {
  resetActivityTimer()
  videoPlaying = false
})
document.getElementById('mediaLightboxAudio').addEventListener('ended', (event) => {
  resetActivityTimer()
  videoPlaying = false
})
document.getElementById('attractorOverlay').addEventListener('transitionend', (ev) => {
  if (parseInt(ev.target.style.opacity) === 0) {
    ev.target.style.display = 'none'
  }
})
document.getElementById('mediaLightboxImage').addEventListener('load', (ev) => {
  document.querySelectorAll('.lightbox-text').forEach((el) => {
    el.style.opacity = '1'
  })
  ev.target.style.display = 'block'
})
