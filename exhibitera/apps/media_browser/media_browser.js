/* global bootstrap */

import * as exCommon from '../js/exhibitera_app_common.js'

function changePage (val) {
  switch (val) {
    case 0:
      currentPage = 0
      break
    case 1:
      currentPage += 1
      if (currentPage * cardsPerPage > spreadsheet.length) {
        currentPage -= 1
      }
      break
    case -1:
      currentPage -= 1
      if (currentPage < 0) {
        currentPage = 0
      }
      break
    default:
  }
  populateResultsRow()
}

function clear () {
  currentPage = 0
  // $('#searchInput').val('')
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

  const def = $(document).data('browserDefinition')
  let thumb

  if (thumbnailKey != null && thumbnailKey !== '' && String(obj[thumbnailKey]).trim() !== '') {
    console.log('here')
    thumb = 'thumbnails/' + String(obj[thumbnailKey])
  } else {
    // Change the file extension to .jpg, since that is the default for Exhibitera
    let thumbName = String(obj[mediaKey])
    const dotIndex = thumbName.lastIndexOf('.')
    thumbName = thumbName.substring(0, dotIndex < 0 ? thumbName.length : dotIndex) + '.jpg'
    thumb = 'thumbnails/' + thumbName
  }

  let title = ''
  if (titleKey != null && titleKey !== '') {
    title = obj[titleKey]
  }

  const id = String(Math.round(Date.now() * Math.random()))

  obj.uniqueMediaBrowserID = id

  const col = document.createElement('div')
  col.classList = 'cardCol col align-items-center justify-content-center d-flex'
  // Calculate the height of the card based on the number of rows

  if ('show_search_and_filter' in def.style.layout && def.style.layout.show_search_and_filter === true) {
    col.style.height = String(Math.round(60 / numRows)) + 'vh'
  } else {
    col.style.height = String(Math.round(95 / numRows)) + 'vh'
  }

  const card = document.createElement('div')
  card.classList = 'resultCard row w-100'
  card.addEventListener('click', function () {
    displayMedia(id)
  })
  col.appendChild(card)

  const imgCol = document.createElement('div')
  imgCol.classList = 'col col-12'

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

  imgCol.appendChild(img)

  if (('imageHeight' in def.style.layout && def.style.layout.image_height < 100) || !('imageHeight' in def.style.layout)) {
    const titleCol = document.createElement('div')
    titleCol.classList = 'col col-12 text-center'
    card.appendChild(titleCol)

    const titleSpan = document.createElement('span')
    titleSpan.classList = 'cardTitle'
    titleSpan.innerHTML = title
    titleCol.appendChild(titleSpan)
  }

  $('#resultsRow').append(col)
}

function hideMediaLightBox () {
  // Fade out the lightbox, and then hide it so it doesn't steal touches

  const video = document.getElementById('mediaLightboxVideo')
  video.pause()

  const temp = function () { $('#mediaLightbox').css('display', 'none') }
  $('#mediaLightbox').animate({ opacity: 0, queue: false }, { complete: temp, duration: 100 })
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
}

function _getFilterOptions (key) {
  // For a given spreadsheet key, get a list of the unique options for the select.

  const resultDict = {} // Will hold unique entries without duplicates

  for (const row of spreadsheet) {
    if (key in row) resultDict[row[key]] = 1
  }
  return exCommon.sortAlphabetically(Object.keys(resultDict))
}

function _populateResultsRow (currentKey) {
  // Empty and repopulate the results row based on the given filters
  // currentKey accounts for the key being pressed right now, which is not
  // yet part of the input value

  $('#resultsRow').empty()

  // const input = $('#searchInput').val()
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

  // Make sure we have the correct number of results to display
  const displayedResults = filteredData.slice(cardsPerPage * currentPage, cardsPerPage * (currentPage + 1))
  // Create a card for each item and add it to the display
  displayedResults.forEach((item, i) => {
    createCard(item)
  })
  $('#resultsRow').fadeIn(200)
}

function populateResultsRow (currentKey = '') {
  // Stub function to do the fade, then call the helper function

  $('#resultsRow').fadeOut(200, function () { _populateResultsRow(currentKey) })
}

function displayMedia (id) {
  // Take the given id and display the media in the overlay.

  const obj = spreadsheet.filter(function (item) {
    return item.uniqueMediaBrowserID === id
  })[0]

  let title = ''
  if (titleKey !== undefined && titleKey !== '') {
    title = obj[titleKey]
  }

  let caption = ''
  if (captionKey != null && captionKey !== '') {
    caption = obj[captionKey]
  }
  let credit = ''
  if (creditKey != null && creditKey !== '') {
    credit = obj[creditKey]
  }
  const media = String(obj[mediaKey])
  showMediaInLightbox(media, title, caption, credit)
}

function updateParser (update) {
  // Read updates specific to the media browser

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    exCommon.loadDefinition(currentDefintion)
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

  // Tag the document with the defintion for later reference
  $(document).data('browserDefinition', def)

  const root = document.querySelector(':root')

  const langs = Object.keys(def.languages)
  if (langs.length === 0) return

  exCommon.createLanguageSwitcher(def, localize)

  // Configure the attractor
  if ('inactivity_timeout' in def) {
    inactivityTimeout = def.inactivity_timeout * 1000
  }
  if ('attractor' in def && def.attractor.trim() !== '') {
    if (exCommon.guessMimetype(def.attractor) === 'video') {
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
  if ('num_columns' in def.style.layout) {
    document.getElementById('resultsRow').classList = 'h-100 row row-cols-' + String(def.style.layout.num_columns)
    numCols = def.style.layout.num_columns
  } else {
    document.getElementById('resultsRow').classList = 'h-100 row row-cols-6'
    numCols = 6
  }
  if ('items_per_page' in def.style.layout) {
    cardsPerPage = parseInt(def.style.layout.items_per_page)
  } else {
    cardsPerPage = 12
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
  } else {
    document.getElementById('mediaLightboxImage').style.height = '70%'
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
    exCommon.setBackground(def.style.background, root, '#fff')
  }

  // Set icon colors based on the background color.
  const backgroundColor = exCommon.getColorAsRGBA(document.body, 'background')
  const backgroundClassification = exCommon.classifyColor(backgroundColor)
  if (backgroundClassification === 'light') {
    document.getElementById('langSwitchDropdownIcon').src = '_static/icons/translation-icon_black.svg'
    document.getElementById('filterDropdownIcon').src = '_static/icons/filter_black.svg'
  } else {
    document.getElementById('langSwitchDropdownIcon').src = '_static/icons/translation-icon_white.svg'
    document.getElementById('filterDropdownIcon').src = '_static/icons/filter_white.svg'
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
  Object.keys(def.languages).forEach((lang) => {
    if (def.languages[lang].default === true) defaultLang = lang
  })

  // Load the CSV file containing the items ad build the results row
  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + def.spreadsheet,
    rawResponse: true,
    noCache: true
  })
    .then((response) => {
      const csvAsJSON = exCommon.csvToJSON(response)
      spreadsheet = csvAsJSON.json // Global property
      localize(defaultLang)

      // Send a thumbnail to the helper
      setTimeout(() => exCommon.saveScreenshotAsThumbnail(def.uuid + '.png'), 500)
    })
}

function localize (lang) {
  // Use the spreadsheet and defintion to set the content to the given language

  const definition = $(document).data('browserDefinition')

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
    // Clear any filters
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

  exCommon.config.currentInteraction = false
  if (attractorAvailable) {
    if (attractorType === 'video') {
      document.getElementById('attractorVideo').play()
        .then(result => {
          $('#attractorOverlay').fadeIn()
          hideMediaLightBox()
          clear()
        })
    } else {
      $('#attractorOverlay').fadeIn()
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

  $('#attractorOverlay').fadeOut(result => {
    if (attractorType === 'video') {
      document.getElementById('attractorVideo').pause()
    }
    exCommon.config.currentInteraction = true
    resetActivityTimer()
  })
}

function resetActivityTimer () {
  // Cancel the existing activity timer and set a new one

  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, inactivityTimeout)
}

function showMediaInLightbox (media, title = '', caption = '', credit = '') {
  // Set the img or video source to the provided media, set the caption, and reveal
  // the light box.

  // Hide elements until image is loaded
  $('#mediaLightboxImage, #mediaLightboxVideo, #mediaLightboxTitle, #mediaLightboxCaption, #mediaLightboxCredit').hide()

  document.getElementById('mediaLightboxTitle').innerHTML = title
  document.getElementById('mediaLightboxCaption').innerHTML = caption

  if (credit !== '' && credit != null) {
    document.getElementById('mediaLightboxCredit').innerHTML = 'Credit: ' + credit
  } else {
    document.getElementById('mediaLightboxCredit').innerHTML = ''
  }

  // Load the media with a callback to fade it in when it is loaded
  const mimetype = exCommon.guessMimetype(media)
  if (mimetype === 'image') {
    $('#mediaLightboxImage').one('load', function () {
      $('#mediaLightboxImage, #mediaLightboxTitle, #mediaLightboxCredit, #mediaLightboxCaption').fadeIn()
    }).attr('src', 'content/' + media)
  } else if (mimetype === 'video') {
    videoPlaying = true
    const video = document.getElementById('mediaLightboxVideo')
    video.src = 'content/' + media
    video.load()
    video.play()
    $('#mediaLightboxVideo, #mediaLightboxTitle, #mediaLightboxCredit, #mediaLightboxCaption').fadeIn()
  }

  $('#mediaLightbox').css('display', 'flex').animate({ opacity: 1, queue: false }, 100)
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

let currentDefintion = ''

let inactivityTimer = null
let inactivityTimeout = 30000
let attractorAvailable = false
let attractorType = 'image'
let videoPlaying = false

// Attach event listeners
$('#previousPageButton').click(function () {
  changePage(-1)
})
$('#nextPageButton').click(function () {
  changePage(1)
})
$('body').click(resetActivityTimer)
$('#attractorOverlay').click(hideAttractor)
$('.hideLightboxTrigger').click(hideMediaLightBox)
document.getElementById('mediaLightboxVideo').addEventListener('ended', (event) => {
  resetActivityTimer()
  videoPlaying = false
})
