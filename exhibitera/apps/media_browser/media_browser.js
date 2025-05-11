/* global bootstrap textFit */

import exConfig from '../../common/config.js'
import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exMarkdown from '../js/exhibitera_app_markdown.js'

function changePage (val) {
  switch (val) {
    case 0:
      currentPage = 0
      break
    case 1:
      currentPage += 1
      if (currentPage * cardsPerPage >= spreadsheet.length) {
        if (('behavior' in exCommon.config.definition) && ('loop_results' in exCommon.config.definition.behavior) && (exCommon.config.definition.behavior.loop_results === false)) {
          currentPage -= 1
        } else {
          // If there are not more cards to show, go page to the first page.
          currentPage = 0
        }
      }
      break
    case -1:
      currentPage -= 1
      if (currentPage < 0) {
        if (('behavior' in exCommon.config.definition) && ('loop_results' in exCommon.config.definition.behavior) && (exCommon.config.definition.behavior.loop_results === false)) {
          currentPage = 0
        } else {
          // Loop back to last page
          currentPage = Math.floor((spreadsheet.length - 1 / cardsPerPage))
        }
      }
      break
    default:
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
  let thumb

  if (thumbnailKey != null && thumbnailKey !== '' && String(obj[thumbnailKey]).trim() !== '') {
    // Use a user-supplied thumbnail
    thumb = exCommon.config.helperAddress + '/thumbnails/' + String(obj[thumbnailKey])
  } else {
    // Pull the default thumbnail

    const numCols = def?.layout?.num_columns ?? 3
    const iconWidth = String(Math.round(window.innerWidth / numCols))
    const thumbName = String(obj[mediaKey])
    thumb = exCommon.config.helperAddress + exConfig.api + '/files/' + thumbName + '/thumbnail/' + iconWidth
  }

  let title = ''
  if (titleKey != null && titleKey !== '') {
    title = exMarkdown.formatText(obj[titleKey] ?? '', { string: true, removeParagraph: true })
  }

  const id = String(Math.round(Date.now() * Math.random()))

  obj.uniqueMediaBrowserID = id

  const col = document.createElement('div')
  col.classList = 'cardCol col align-items-center justify-content-center d-flex'
  col.style.height = String(0.975 * window.innerHeight / numRows) + 'px'

  const card = document.createElement('div')
  card.classList = 'resultCard row w-100 d-flex align-content-center'
  card.addEventListener('click', function () {
    displayMedia(id)
  })
  col.appendChild(card)

  const imgCol = document.createElement('div')
  imgCol.classList = 'col col-12 d-flex justify-content-center align-items-end'

  if ('image_height' in def.style.layout) {
    imgCol.style.height = String(def.style.layout.image_height) + '%'
  } else {
    imgCol.style.height = '70%'
  }
  card.appendChild(imgCol)

  const img = document.createElement('img')
  img.classList = 'resultImg'
  img.src = thumb
  img.setAttribute('id', 'Entry_' + id)

  if ('corner_radius' in def.style.layout) {
    img.style.borderRadius = String(def.style.layout.corner_radius) + '%'
  } else {
    img.style.borderRadius = '0%'
  }
  if ('thumbnail_shape' in def.style.layout) {
    if (def.style.layout.thumbnail_shape === 'orignal') {
      img.style.aspectRatio = ''
    } else if (def.style.layout.thumbnail_shape === 'square') {
      img.style.aspectRatio = 1
    } else if (def.style.layout.thumbnail_shape === 'viewport') {
      const height = window.innerHeight
      const width = window.innerWidth
      if (width >= height) {
        img.style.aspectRatio = String(width / height)
      } else {
        img.style.aspectRatio = String(height / width)
      }
    } else if (def.style.layout.thumbnail_shape === 'anti-viewport') {
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
  if (('image_height' in def.style.layout && def.style.layout.image_height < 100) || !('image_height' in def.style.layout)) {
    const titleCol = document.createElement('div')
    titleCol.classList = 'col col-12 text-center cardTitleContainer'

    let imageHeight = 70
    if ('image_height' in def.style.layout) imageHeight = def.style.layout.image_height

    if ('title_height' in def.style.layout) {
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
    select.setAttribute('id', 'filterSelect_' + uuid)
    select.setAttribute('data-key', details.key)
    select.addEventListener('change', onFilterOptionChange)
    div.appendChild(select)

    const options = _getFilterOptions(details.key)

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

function _getFilterOptions (key) {
  // For a given spreadsheet key, get a list of the unique options for the select.

  const resultDict = {} // Will hold unique entries without duplicates

  for (const row of spreadsheet) {
    if (key in row) resultDict[row[key]] = 1
  }
  return exUtilities.sortAlphabetically(Object.keys(resultDict))
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

  // const input = document.getElementById('searchInput').value
  // // Filter on search terms
  // const searchTerms = (input).split(' ')
  // const searchedData = []
  // spreadsheet.forEach((item, i) => {
  //   let matchCount = 0
  //   searchTerms.forEach((term, i) => {
  //     if (term !== '' || (term === '' && searchTerms.length === 1)) {
  //       // Strip out non-letters, since the keyboard doesn't allow them
  //       if (item.searchData.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z\s]/ig, '').toLowerCase().includes(term.replace(/[^A-Za-z]/ig, '').toLowerCase())) {
  //         matchCount += 1
  //       }
  //     }
  //   })
  //   if (matchCount > 0) {
  //     item.matchCount = matchCount
  //     searchedData.push(item)
  //   }
  // })

  // Filter on filter options
  const filters = Array.from(document.getElementsByClassName('filter-entry'))
  const filteredData = []
  let thisKey, selectedValue, filterMathces

  // Iterate through the remaining data and make sure it matches at least
  // one filtered value.
  spreadsheet.forEach((item) => {
    filterMathces = {}
    filters.forEach((filter) => {
      thisKey = filter.getAttribute('data-key')
      filterMathces[thisKey] = 0

      selectedValue = filter.value // Can only select one for now

      if (selectedValue != null && selectedValue !== '') {
        if (selectedValue.includes(item[thisKey])) {
          filterMathces[thisKey] = 1
        }
      } else {
        // If no values are selected for this filter, pass all matches through
        filterMathces[thisKey] = 1
      }
    })

    // Iterate through the matches to make sure we've matched on every filter
    let totalMathces = 0
    for (const [matchKey, matchValue] of Object.entries(filterMathces)) {
      if (matchValue === 1) {
        totalMathces += 1
      }
    }
    if (totalMathces === filters.length) {
      filteredData.push(item)
    }
  })

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
  displayedResults.forEach((item, i) => {
    createCard(item)
  })

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

function displayMedia (id) {
  // Take the given id and display the media in the overlay.

  const obj = spreadsheet.filter(function (item) {
    return item.uniqueMediaBrowserID === id
  })[0]

  const title = exMarkdown.formatText(obj[titleKey] ?? '', { string: true, removeParagraph: true })
  const caption = exMarkdown.formatText(obj[captionKey] ?? '', { string: true, removeParagraph: true })
  const credit = exMarkdown.formatText(obj[creditKey] ?? '', { string: true, removeParagraph: true })

  const media = String(obj[mediaKey])
  showMediaInLightbox(media, title, caption, credit)
}

function updateParser (update) {
  // Read updates specific to the media browser

  if ('definition' in update && update.definition !== currentDefinition) {
    currentDefinition = update.definition
    exCommon.loadDefinition(currentDefinition)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }

  if ('permissions' in update && 'audio' in update.permissions) {
    document.getElementById('mediaLightboxVideo').muted = !update.permissions.audio
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
  if ('inactivity_timeout' in def) {
    inactivityTimeout = def.inactivity_timeout * 1000
  }
  if ('attractor' in def && def.attractor.trim() !== '') {
    if (exFiles.guessMimetype(def.attractor) === 'video') {
      attractorType = 'video'

      document.getElementById('attractorVideo').src = 'content/' + def.attractor
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
  console.log(def)
  if ('num_columns' in def.style.layout) {
    document.getElementById('resultsRow').classList = 'h-100 row row-cols-' + String(def.style.layout.num_columns)
    numCols = def.style.layout.num_columns
  } else {
    document.getElementById('resultsRow').classList = 'h-100 row row-cols-3'
    numCols = 3
  }
  if ('items_per_page' in def.style.layout) {
    cardsPerPage = parseInt(def.style.layout.items_per_page)
  } else {
    cardsPerPage = 6
  }
  numRows = Math.ceil(cardsPerPage / numCols)

  if ('lightbox_title_height' in def.style.layout) {
    document.getElementById('mediaLightboxTitle').style.height = String(def.style.layout.lightbox_title_height) + '%'
  } else {
    document.getElementById('mediaLightboxTitle').style.height = '9%'
  }
  if ('lightbox_caption_height' in def.style.layout) {
    document.getElementById('mediaLightboxCaption').style.height = String(def.style.layout.lightbox_caption_height) + '%'
  } else {
    document.getElementById('mediaLightboxCaption').style.height = '15%'
  }
  if ('lightbox_credit_height' in def.style.layout) {
    document.getElementById('mediaLightboxCredit').style.height = String(def.style.layout.lightbox_credit_height) + '%'
  } else {
    document.getElementById('mediaLightboxCredit').style.height = '6%'
  }
  if ('lightbox_image_height' in def.style.layout) {
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
  Object.keys(def.style.color).forEach((key) => {
    // Fix for change from backgroundColor to background-color in v4
    if (key === 'backgroundColor') key = 'background-color'

    document.documentElement.style.setProperty('--' + key, def.style.color[key])
  })

  // Backgorund settings
  if ('background' in def.style) {
    exCommon.setBackground(def.style.background, root, '#fff', true)
  }

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
  Object.keys(def.style.font).forEach((key) => {
    const font = new FontFace(key, 'url(' + encodeURI(def.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  })

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
  Object.keys(def.style.text_size).forEach((key) => {
    const value = def.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  })

  // Find the default language
  if ('language_order' in def) {
    defaultLang = def.language_order[0]
  } else {
    // Deprecated in Ex5.3
    Object.keys(def.languages).forEach((lang) => {
      if (def.languages[lang].default === true) defaultLang = lang
    })
  }

  // Load the CSV file containing the items ad build the results row
  exCommon.makeHelperRequest({
    api: '',
    method: 'GET',
    endpoint: '/content/' + def.spreadsheet,
    rawResponse: true,
    noCache: true
  })
    .then((response) => {
      const csvAsJSON = exFiles.csvToJSON(response)
      spreadsheet = csvAsJSON.json // Global property
      localize(defaultLang)

      // Send a thumbnail to the helper
      setTimeout(() => exCommon.saveScreenshotAsThumbnail(def.uuid + '.png'), 500)
    })
}

function localize (lang) {
  // Use the spreadsheet and definition to set the content to the given language

  const definition = exCommon.config.definition

  if ('media_key' in definition.languages[lang]) {
    mediaKey = definition.languages[lang].media_key
  } else {
    mediaKey = null
  }
  if ('thumbnail_key' in definition.languages[lang]) {
    thumbnailKey = definition.languages[lang].thumbnail_key
  } else {
    thumbnailKey = null
  }
  if ('title_key' in definition.languages[lang]) {
    titleKey = definition.languages[lang].title_key
  } else {
    titleKey = null
  }
  if ('caption_key' in definition.languages[lang]) {
    captionKey = definition.languages[lang].caption_key
  } else {
    captionKey = null
  }
  if ('credit_key' in definition.languages[lang]) {
    creditKey = definition.languages[lang].credit_key
  } else {
    creditKey = null
  }

  if ('filter_order' in definition.languages[lang] && definition.languages[lang].filter_order.length > 0) {
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
  const imageEl = document.getElementById('mediaLightboxImage')
  const videoEl = document.getElementById('mediaLightboxVideo')
  const titleDiv = document.getElementById('mediaLightboxTitle')
  const captionDiv = document.getElementById('mediaLightboxCaption')
  const creditDiv = document.getElementById('mediaLightboxCredit')
  titleDiv.innerHTML = title

  captionDiv.innerHTML = caption

  if (credit !== '' && credit != null) {
    creditDiv.innerHTML = 'Credit: ' + credit
  } else {
    creditDiv.innerHTML = ''
  }

  // Load the media with a callback to fade it in when it is loaded
  const mimetype = exFiles.guessMimetype(media)
  if (mimetype === 'image') {
    imageEl.src = '/content/' + media
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

  if ('layout' in def.style) {
    if ('lightbox_title_height' in def.style.layout && def.style.layout.lightbox_title_height > 0) {
      try {
        textFit(titleDiv, { maxFontSize: titleFontSize })
      } catch {
        // Ignore a failed resize
      }
    }
    if ('lightbox_credit_height' in def.style.layout && def.style.layout.lightbox_credit_height > 0) {
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

let spreadsheet, mediaKey, thumbnailKey, titleKey, captionKey, creditKey
let currentPage = 0
let cardsPerPage, numCols, numRows
let defaultLang = ''

exCommon.configureApp({
  name: 'media_browser',
  debug: true,
  loadDefinition,
  parseUpdate: updateParser
})

let currentDefinition = ''

let inactivityTimer = null
let inactivityTimeout = 30000
let attractorAvailable = false
let attractorType = 'image'
let videoPlaying = false

// Attach event listeners
document.getElementById('previousPageButton').addEventListener('click', () => {
  changePage(-1)
})
document.getElementById('nextPageButton').addEventListener('click', () => {
  changePage(1)
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
