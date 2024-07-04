import * as exCommon from '../js/exhibitera_app_common.js'

function buildLayout (definition) {
  // Take a layout defition in the form of a dictionary of dictionaries and
  // create cards for each element

  const buttons = definition.option_order
  const cardRow = document.getElementById('cardRow')

  // Clear the exisiting layout
  cardRow.innerHTML = ''

  let nCols
  if ('num_columns' in definition.style.layout) {
    if (definition.style.layout.num_columns !== 'auto') {
      nCols = parseInt(definition.style.layout.num_columns)
    } else {
      nCols = calculateButtonRows(buttons)
    }
  } else {
    nCols = calculateButtonRows(buttons)
  }

  const nRows = Math.ceil(buttons.length / nCols)
  const rowClass = 'row-cols-' + String(nCols)

  // Clear any old row layout and then add the new one
  Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).forEach((i) => { cardRow.classList.remove('row-cols-' + String(i)) })
  cardRow.classList.add(rowClass)

  // Iterate through the buttons and build their HTML
  buttons.forEach((item) => {
    const buttonDef = definition.options[item]
    let value
    if (buttonDef.value != null && buttonDef.value.trim() !== '') {
      value = buttonDef.value
    } else if (buttonDef.label != null && buttonDef.label.trim() !== '') {
      value = buttonDef.label
    } else {
      value = item
    }
    voteCounts[value] = 0

    const div = document.createElement('div')
    div.classList = 'button-col mx-0 px-1 col'
    div.addEventListener('click', function () { buttonTouched(div, value) })
    cardRow.appendChild(div)

    const card = document.createElement('div')
    card.classList = 'card card-inactive mb-0 h-100 justify-content-center'
    div.appendChild(card)

    if ('icon' in buttonDef && buttonDef.icon.trim() !== '') {
      const img = document.createElement('img')
      if (buttonDef.icon === 'user') {
        img.src = getIcon(buttonDef.icon_user_file)
      } else {
        // The user has selected one of the provided icons
        img.src = getIcon(buttonDef.icon)
      }
      img.classList = 'card-img-top'
      card.appendChild(img)
    }

    if ('label' in buttonDef && buttonDef.label.trim() !== '') {
      const text = document.createElement('div')
      text.classList = 'd-flex align-items-center justify-content-center'
      card.appendChild(text)

      const title = document.createElement('div')
      title.classList = 'card-title my-0 noselect'

      title.innerHTML = buttonDef.label
      text.append(title)
    }
  })

  // Make sure all the buttons are the same height
  const height = Math.floor((100 - nRows) / nRows)
  $('.button-col').each(function () {
    $(this).height(String(height) + '%')
  })
}

function getIcon (name) {
  // If the given name is a shortcut, return the full filepath.
  // Otherwise, assume the file is user-supplied and return the name as passed.

  if (['1-star_black', '2-star_black', '3-star_black', '4-star_black', '5-star_black', '1-star_white', '2-star_white', '3-star_white', '4-star_white', '5-star_white'].includes(name)) {
    return '_static/icons/' + name + '.png'
  } else if (['thumbs-down_black', 'thumbs-down_red', 'thumbs-down_white', 'thumbs-up_black', 'thumbs-up_green', 'thumbs-up_white'].includes(name)) {
    return '_static/icons/' + name + '.svg'
  } else {
    return 'content/' + name
  }
}

function calculateButtonRows (buttons) {
  // Choose a sensible number of buttons for the given orientation and button count

  if (window.innerHeight <= window.innerWidth) {
    if (buttons.length <= 6) {
      return buttons.length
    } else {
      return 4
    }
  } else {
    if (buttons.length <= 6) {
      return 1
    } else {
      return 2
    }
  }
}

function buttonTouched (button, name) {
  // Respond to the touch of a button by changing color and logging the vote

  setActive()

  $(button).find('.card').removeClass('card-inactive').addClass('card-active')
  setTimeout(function () {
    $(button).find('.card').removeClass('card-active').addClass('card-inactive')
  }, 500)
  showSuccessMessage()
  logVote(name, 1)
}

function logVote (name, numVotes) {
  // Record one or more votes for the given option

  if (blockTouches === false) {
    voteCounts[name] += numVotes
  }
  clearTimeout(touchBlocker)
  blockTouches = true
  touchBlocker = setTimeout(function () { blockTouches = false }, touchCooldown * 1000)
}

function setActive () {
  exCommon.config.currentInteraction = true
  const reset = function () {
    exCommon.config.currentInteraction = false
  }
  setTimeout(reset, 10000)
}

function checkConnection () {
  // Send a message to the server checking that the connection is stable.

  if (exCommon.config.standalone === true) {
    badConnection = false
    return
  }

  exCommon.makeServerRequest(
    {
      method: 'GET',
      endpoint: '/system/checkConnection'
    })
    .then(() => {
      $('#connectionWarning').hide()
      badConnection = false
    })
    .catch(() => {
      if (exCommon.config.debug) {
        $('#connectionWarning').show()
      }
      badConnection = true
    })
}

function updateFunc (update) {
  // Read updates for voting kiosk-specific actions and act on them

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    exCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (definition) {
  // Clean up the old survey, then create the new one.

  // If there are votes left for the old survey, make sure they are recorded
  sendData()

  configurationName = definition.name

  // Clear the vote categories
  voteCounts = {}

  // Parse the settings and make the appropriate changes

  // Text settings
  if ('header' in definition.text && definition.text.header.trim() !== '') {
    document.getElementById('header').innerHTML = definition.text.header
    document.getElementById('headerCol').style.display = 'block'
  } else {
    document.getElementById('header').innerHTML = ''
    document.getElementById('headerCol').style.display = 'none'
  }
  if ('subheader' in definition.text && definition.text.subheader.trim() !== '') {
    document.getElementById('subheader').innerHTML = definition.text.subheader
    document.getElementById('subheaderCol').style.display = 'block'
  } else {
    document.getElementById('subheader').innerHTML = ''
    document.getElementById('subheaderCol').style.display = 'none'
  }
  if ('footer' in definition.text && definition.text.footer.trim() !== '') {
    document.getElementById('footer').innerHTML = definition.text.footer
    document.getElementById('footerCol').style.display = 'block'
  } else {
    document.getElementById('footer').innerHTML = ''
    document.getElementById('footerCol').style.display = 'none'
  }
  if ('subfooter' in definition.text && definition.text.subfooter.trim() !== '') {
    document.getElementById('subfooter').innerHTML = definition.text.subfooter
    document.getElementById('subfooterCol').style.display = 'block'
  } else {
    document.getElementById('subfooter').innerHTML = ''
    document.getElementById('subfooterCol').style.display = 'none'
  }
  if ('success_message' in definition.text && definition.text.success_message.trim() !== '') {
    document.getElementById('successMessageBody').innerHTML = definition.text.success_message
  } else {
    document.getElementById('successMessageBody').innerHTML = 'Thank you!'
  }

  // Color settings
  const root = document.querySelector(':root')

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', '#22222E')
  root.style.setProperty('--button-color', '#393A5A')
  root.style.setProperty('--button-touched-color', '#706F8E')
  root.style.setProperty('--success-message-color', '#528e54')
  root.style.setProperty('--header-color', 'white')
  root.style.setProperty('--subheader-color', 'white')
  root.style.setProperty('--footer-color', 'white')
  root.style.setProperty('--subfooter-color', 'white')
  root.style.setProperty('--button-text-color', 'white')

  // Then, apply the definition settings

  // Color settings
  Object.keys(definition.style.color).forEach((key) => {
    const value = definition.style.color[key]
    root.style.setProperty('--' + key, value)
  })

  // Backgorund settings
  if ('background' in definition.style) {
    exCommon.setBackground(definition.style.background, root, '#22222E', true)
  }

  // Font settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--header-font', 'header-default')
  root.style.setProperty('--subheader-font', 'subheader-default')
  root.style.setProperty('--footer-font', 'footer-default')
  root.style.setProperty('--subfooter-font', 'subfooter-default')
  root.style.setProperty('--button-font', 'button-default')

  // Then, apply the definition settings
  Object.keys(definition.style.font).forEach((key) => {
    const font = new FontFace(key, 'url(' + encodeURI(definition.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  })

  // Text size settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--header-font-adjust', 0)
  root.style.setProperty('--subheader-font-adjust', 0)
  root.style.setProperty('--footer-font-adjust', 0)
  root.style.setProperty('--subfooter-font-adjust', 0)
  root.style.setProperty('--button-font-adjust', 0)

  // Then, apply the definition settings
  Object.keys(definition.style.text_size).forEach((key) => {
    const value = definition.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  })

  // Behavior settings
  if ('recording_interval' in definition.behavior) {
    clearInterval(voteCounter)
    recordingInterval = parseFloat(definition.behavior.recording_interval)
    voteCounter = setInterval(sendData, recordingInterval * 1000)
  } else {
    clearInterval(voteCounter)
    recordingInterval = 60
    voteCounter = setInterval(sendData, recordingInterval * 1000)
  }
  if ('touch_cooldown' in definition.behavior) {
    touchCooldown = parseFloat(definition.behavior.touch_cooldown)
  } else {
    touchCooldown = 2
  }

  if ('top_height' in definition.style.layout) {
    document.getElementById('topRow').style.height = definition.style.layout.top_height + 'vh'
  } else {
    document.getElementById('topRow').style.height = '20vh'
  }
  if ('header_padding' in definition.style.layout) {
    document.getElementById('topRow').style.paddingTop = definition.style.layout.header_padding + 'vh'
  } else {
    document.getElementById('topRow').style.top_padding = '5vh'
  }
  if ('button_height' in definition.style.layout) {
    document.getElementById('cardRow').style.height = definition.style.layout.button_height + 'vh'
  } else {
    document.getElementById('cardRow').style.height = '60vh'
  }
  if ('button_padding' in definition.style.layout) {
    document.getElementById('cardRow').style.paddingTop = definition.style.layout.button_padding / 2 + 'vh'
    document.getElementById('cardRow').style.paddingBottom = definition.style.layout.button_padding / 2 + 'vh'
  } else {
    document.getElementById('cardRow').style.paddingTop = '5vh'
    document.getElementById('cardRow').style.paddingBottom = '5vh'
  }
  if ('bottom_height' in definition.style.layout) {
    document.getElementById('bottomRow').style.height = definition.style.layout.bottom_height + 'vh'
  } else {
    document.getElementById('bottomRow').style.height = '20vh'
  }
  if ('footer_padding' in definition.style.layout) {
    document.getElementById('bottomRow').style.paddingBottom = definition.style.layout.footer_padding + 'vh'
  } else {
    document.getElementById('bottomRow').style.paddingBottom = '5vh'
  }
  if ('image_height' in definition.style.layout) {
    const value = definition.style.layout.image_height
    root.style.setProperty('--image-height', value)
  } else {
    root.style.setProperty('--image-height', '90')
  }

  buildLayout(definition)

  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 100)
}

function sendData () {
  // Collect the current value from each card, build a dictionary, and
  // send it for storage.

  if (exCommon.config.debug) {
    console.log('Sending data...')
  }
  if (badConnection) {
    if (exCommon.config.debug) {
      console.log('Error: bad connection. Will not attempt to send data.')
    }
    return
  }
  const resultDict = {}

  // Append the date and time of this recording
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  const dateStr = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1)
  resultDict.Date = dateStr

  let totalVotes = 0
  Object.keys(voteCounts).forEach((entry) => {
    resultDict[entry] = voteCounts[entry]
    totalVotes += voteCounts[entry]

    // Reset votes
    voteCounts[entry] = 0
  })

  // If there are no votes to record, bail out.
  if (totalVotes === 0) {
    return
  }

  const requestDict = {
    data: resultDict,
    name: configurationName
  }

  // Submit the data to Hub or the helper, depending on if we're standalone
  if (exCommon.config.standalone === true) {
    exCommon.makeHelperRequest(
      {
        method: 'POST',
        endpoint: '/data/write',
        params: requestDict
      })
  } else {
    exCommon.makeServerRequest(
      {
        method: 'POST',
        endpoint: '/tracker/flexible-tracker/submitData',
        params: requestDict
      })
  }
}

function showSuccessMessage () {
  // Animate the success message to briefly appear

  $('#successMessage').css({ display: 'flex' })
    .animate({ opacity: 1 }, 100)
    .delay(100)
    .animate({ opacity: 0 }, { duration: 1000, complete: function () { $('#successMessage').css({ display: 'none' }) } })
}

// Disable pinch-to-zoom for browsers the ignore the viewport setting
document.addEventListener('touchmove', e => {
  console.log('here')
  if (e.touches.length > 1) {
    e.preventDefault()
  }
}, { passive: false })

document.addEventListener('wheel', function (e) {
  if (e.ctrlKey) {
    e.preventDefault()
  }
}, { passive: false })

exCommon.configureApp({
  name: 'voting_kiosk',
  debug: true,
  checkConnection,
  loadDefinition,
  parseUpdate: updateFunc
})

let badConnection = false

let configurationName = 'default'
let currentDefintion = ''
let voteCounts = {}
let recordingInterval = 60 // Send votes every this many minutes
let voteCounter = setInterval(sendData, recordingInterval * 1000)
let blockTouches = false
let touchBlocker = null // Will hold id for the setTimeout() that resets blockTouches
let touchCooldown = 2 // seconds before blockTouches is reset

setInterval(exCommon.checkForHelperUpdates, 1000)
