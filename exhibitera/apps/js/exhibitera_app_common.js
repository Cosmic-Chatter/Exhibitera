/* global platform, html2canvas */

export const config = {
  permissions: {
    audio: true,
    refresh: true,
    restart: false,
    shutdown: false,
    sleep: false
  },
  autoplayAudio: false,
  connectionChecker: null, // A function to check the connection with Hub and act on it
  exhibiteraAppID: '',
  currentDefinition: '',
  currentExhibit: 'Default',
  currentInteraction: false,
  definitionLoader: null, // A function used by loadDefinition() to set up the specific app.
  errorDict: {},
  fontCache: {},
  group: 'Default',
  helperAddress: 'http://localhost:8000',
  id: 'TEMP ' + String(new Date().getTime()),
  platformDetails: {
    operating_system: String(platform.os),
    browser: platform.name + ' ' + platform.version
  },
  remoteDisplay: false, // false == we are using the webview app, true == browser
  serverAddress: '',
  softwareVersion: 5.1,
  standalone: false, // false == we are using Hub
  updateParser: null, // Function used by readUpdate() to parse app-specific updates
  uuid: ''
}

export function configureApp (opt = {}) {
  // Perform basic app setup

  config.helperAddress = window.location.origin

  if ('checkConnection' in opt) config.connectionChecker = opt.checkConnection
  if ('debug' in opt) config.debug = opt.debut
  if ('loadDefinition' in opt) {
    config.definitionLoader = opt.loadDefinition
  } else {
    console.log('exhibitera_app_common: configureApp: you must specify the option loadDefinition')
  }
  if ('name' in opt) config.exhibiteraAppID = opt.name
  if ('parseUpdate' in opt) config.updateParser = opt.parseUpdate

  const searchParams = parseQueryString()
  if (searchParams.has('standalone')) {
  // We are displaying this inside of a setup iframe
    if (searchParams.has('definition')) {
      loadDefinition(searchParams.get('definition'))
        .then((result) => {
          config.definitionLoader(result.definition)
        })
    }
  } else {
  // We are displaying this for real
    askForDefaults()
      .then(() => {
        if (config.standalone === false) {
          // Using Hub
          sendPing()
          setInterval(sendPing, 5000)
          if (config.connectionChecker != null) setInterval(config.connectionChecker, 500)
        } else {
          // Not using Hub
          loadDefinition(config.currentDefinition)
            .then((result) => {
              config.definitionLoader(result.definition)
            })
        }
      })
    // Hide the cursor
    document.body.style.cursor = 'none'
  }
}

export function makeRequest (opt) {
  // Function to make a request to a server and return a Promise with the result
  // 'opt' should be an object with all the necessry options

  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest()
    if ('withCredentials' in opt && opt.withCredentials === true) xhr.withCredentials = true
    const path = opt.url + opt.endpoint
    if ('noCache' in opt && opt.noCache === true) {
      xhr.open(opt.method, path + (/\?/.test(path) ? '&' : '?') + new Date().getTime(), true)
    } else {
      xhr.open(opt.method, path, true)
    }
    xhr.timeout = opt.timeout ?? 2000 // ms
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        if ('rawResponse' in opt && opt.rawResponse === true) {
          resolve(xhr.responseText)
        } else {
          resolve(JSON.parse(xhr.responseText))
        }
      } else {
        console.log(xhr)
        reject(new Error(`Unable to complete ${opt.method} to ${opt.url + opt.endpoint} with data`, opt.params))
      }
    }
    xhr.onerror = function () {
      console.log(xhr)
      reject(new Error(`Unable to complete $opt.{method} to ${opt.url + opt.endpoint} with data`, opt.params))
    }
    let paramText = null
    if (opt.params != null) {
      xhr.setRequestHeader('Content-Type', 'application/json')
      paramText = JSON.stringify(opt.params)
    }
    xhr.send(paramText)
  })
}

export function makeServerRequest (opt) {
  // Shortcut for making a server request and returning a Promise

  opt.url = config.serverAddress
  return makeRequest(opt)
}

export function makeHelperRequest (opt) {
  // Shortcut for making a server request and returning a Promise

  opt.url = config.helperAddress
  return makeRequest(opt)
}

export function parseQueryString () {
  // Read the query string to determine what options to set

  const queryString = decodeURIComponent(window.location.search)
  const searchParams = new URLSearchParams(queryString)

  return searchParams
}

export function sendPing () {
  // Contact Hub and ask for any updates
  if (config.serverAddress === '') {
    console.log('Aborting ping... no config.serverAddress')
    return
  }

  const pingRequest = function () {
    const requestDict = {
      id: config.id,
      uuid: config.uuid,
      exhibiteraAppID: config.exhibiteraAppID,
      helperAddress: config.helperAddress,
      permissions: config.permissions,
      platform_details: config.platformDetails,
      currentInteraction: config.currentInteraction
    }
    // See if there is an error to report
    const errorString = JSON.stringify(config.errorDict)
    if (errorString !== '') {
      requestDict.error = errorString
    }

    makeServerRequest(
      {
        method: 'POST',
        endpoint: '/system/ping',
        params: requestDict
      })
      .then(readServerUpdate)
  }

  // First, check the helper for updates, then send the ping
  checkForHelperUpdates()
    .then(pingRequest)
    .catch(pingRequest)
}

export function wakeDisplay () {
  // Send a message to the local helper process and ask it to sleep the
  // displays

  makeHelperRequest({
    method: 'GET',
    endpoint: '/wakeDisplay'
  })
}

function sleepDisplay () {
  // Send a message to the local helper process and ask it to sleep the
  // displays

  makeHelperRequest({
    method: 'GET',
    endpoint: '/sleepDisplay'
  })
}

export function askForRestart () {
  // Send a message to the local helper and ask for it to restart the PC

  makeHelperRequest({
    method: 'GET',
    endpoint: '/restart'
  })
}

export function askForShutdown () {
  // Send a message to the local helper and ask for it to shutdown the PC

  makeHelperRequest({
    method: 'GET',
    endpoint: '/shutdown'
  })
}

function readServerUpdate (update) {
  // Function to read a message from Hub and take action based on the contents
  // 'update' should be an object

  let sendUpdate = false

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = (update.commands)[i]

      if (cmd === 'restart') {
        askForRestart()
      } else if (cmd === 'shutdown' || cmd === 'power_off') {
        askForShutdown()
      } else if (cmd === 'sleepDisplay') {
        sleepDisplay()
      } else if (cmd === 'wakeDisplay' || cmd === 'power_on') {
        wakeDisplay()
      } else if (cmd === 'refresh_page') {
        if ('refresh' in config.permissions && config.permissions.refresh === true) {
          location.reload()
        }
      } else if (cmd === 'reloadDefaults') {
        askForDefaults()
      } else if (cmd.slice(0, 15) === 'set_dmx_scene__') {
        makeHelperRequest({
          method: 'GET',
          endpoint: '/DMX/setScene/' + cmd.slice(15)
        })
      } else {
        console.log(`Command not recognized: ${cmd}`)
      }
    }
  }
  if ('id' in update) {
    config.id = update.id
  }
  if ('group' in update) {
    config.group = update.group
  }
  if (('server_ip_address' in update) && ('server_port' in update)) {
    config.serverAddress = 'http://' + update.server_ip_address + ':' + update.server_port
  }
  if ('helperAddress' in update) {
    config.helperAddress = update.helperAddress
  }
  if ('current_exhibit' in update) {
    if (update.currentExhibit !== config.currentExhibit) {
      sendUpdate = true
      config.currentExhibit = update.current_exhibit
    }
  }
  if ('missingContentWarnings' in update) {
    config.errorDict.missingContentWarnings = update.missingContentWarnings
  }

  if ('permissions' in update) {
    config.permissions = update.permissions
  }
  if ('software_update' in update) {
    if (update.software_update.update_available === true) { config.errorDict.software_update = update.software_update }
  }
  if (sendUpdate) {
    sendConfigUpdate(update)
  }

  // Check the definition file for a changed app.
  if (config.exhibiteraAppID !== 'dmx_control' && 'definition' in update && update.definition !== config.currentDefinition) {
    config.currentDefinition = update.definition
    makeHelperRequest({
      method: 'GET',
      endpoint: '/definitions/' + update.definition + '/load'
    })
      .then((result) => {
        if ('success' in result && result.success === false) return
        const def = result.definition
        console.log(def)
        if ('app' in def &&
          def.app !== config.exhibiteraAppID &&
          def.app !== '') {
          console.log('Switching to app', def.app)
          let otherPath = ''
          if (def.app === 'other') otherPath = def.path
          gotoApp(def.app, otherPath)
        }
      })
  }

  // Call the updateParser, if provided, to parse actions for the specific app
  if (typeof config.updateParser === 'function') {
    config.updateParser(update)
  }
}

function readHelperUpdate (update, changeApp = true) {
  // Function to read a message from the helper and take action based on the contents
  // 'update' should be an object
  // Set changeApp === false to suppress changing the app if the definition has changed

  const sendUpdate = false

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = (update.commands)[i]

      if (cmd === 'restart') {
        askForRestart()
      } else if (cmd === 'shutdown' || cmd === 'power_off') {
        askForShutdown()
      } else if (cmd === 'sleepDisplay') {
        sleepDisplay()
      } else if (cmd === 'wakeDisplay' || cmd === 'power_on') {
        wakeDisplay()
      } else if (cmd === 'refresh_page') {
        if ('refresh' in config.permissions && config.permissions.refresh === true) {
          location.reload()
        }
      } else if (cmd === 'reloadDefaults') {
        askForDefaults()
      } else if (cmd.slice(0, 15) === 'set_dmx_scene__') {
        makeHelperRequest({
          method: 'GET',
          endpoint: '/DMX/setScene/' + cmd.slice(15)
        })
      } else {
        console.log(`Command not recognized: ${cmd}`)
      }
    }
  }

  // App settings
  if ('app' in update) {
    if ('id' in update.app) config.id = update.app.id
    if ('definition' in update.app) config.definition = update.app.definition
    if ('uuid' in update.app) config.uuid = update.app.uuid
  }
  if ('control_server' in update) {
    if (('ip_address' in update.control_server) && ('port' in update.control_server)) {
      config.serverAddress = 'http://' + update.control_server.ip_address + ':' + update.control_server.port
    }
  }
  if ('permissions' in update) {
    config.permissions = update.permissions
  }
  if ('software_update' in update) {
    if (update.software_update.update_available === true) { config.errorDict.software_update = update.software_update }
  }
  if ('system' in update) {
    if ('remote_display' in update.system) {
      config.remoteDisplay = update.system.remote_display
    }
    if ('standalone' in update.system) {
      config.standalone = update.system.standalone
    }
  }
  if (sendUpdate) {
    sendConfigUpdate(update)
  }

  // After we have saved any updates, see if we should change the app based on the current definition
  if (
    changeApp === true &&
    'app' in update &&
    'definition' in update.app &&
    update.app.definition !== config.currentDefinition &&
    config.standalone === true
  ) {
    config.currentDefinition = update.app.definition
    makeHelperRequest({
      method: 'GET',
      endpoint: '/definitions/' + update.app.definition + '/load'
    })
      .then((result) => {
        if ('success' in result && result.success === false) return
        const def = result.definition
        console.log(def)
        if ('app' in def &&
        def.app !== config.exhibiteraAppID &&
        def.app !== '') {
          console.log('Switching to app', def.app)
          let otherPath = ''
          if (def.app === 'other') otherPath = def.path
          gotoApp(def.app, otherPath)
        }
      })
  }

  // Call the updateParser, if provided, to parse actions for the specific app
  if (typeof config.updateParser === 'function') {
    config.updateParser(update)
  }
}

export function askForDefaults (changeApp = true) {
  // Send a message to the local helper and ask for the latest configuration
  // defaults, then use them.
  // Set changeApp === false to supress changing the app based on the current definition

  const checkAgain = function () {
    $('#helperConnectionWarningAddress').text(config.helperAddress)
    $('#helperConnectionWarning').show()
    console.log('Could not get defaults... checking again')
    setTimeout(askForDefaults, 500)
  }
  return makeHelperRequest({
    method: 'GET',
    endpoint: '/getDefaults'
  })
    .then((update) => {
      readHelperUpdate(update, changeApp)
    }, checkAgain)
}

export function checkForHelperUpdates () {
  // Function to ask the helper for any new updates

  return makeHelperRequest({
    method: 'GET',
    endpoint: '/getUpdate',
    timeout: 500
  })
    .then(readHelperUpdate)
}

export function sendConfigUpdate (update) {
  // Send a message to the helper with the latest configuration to set as
  // the default

  const defaults = { content: update.content, current_exhibit: update.current_exhibit }

  const requestDict = { defaults }

  makeHelperRequest(
    {
      method: 'POST',
      endpoint: '/setDefaults',
      params: requestDict
    })
}

export function arraysEqual (arr1, arr2) {
  // Function to check if two arrays have the same elements in the same order

  if (arr1.length !== arr2.length) {
    return false
  } else {
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false
      }
    }
    return true
  }
}

export function stringToBool (str) {
  // Parse a given string and return an appropriate bool

  if (typeof str === 'boolean') {
    return str
  }

  if (['True', 'true', 'TRUE', '1', 'yes', 'Yes', 'YES'].includes(str)) {
    return true
  } else {
    return false
  }
}

export function sendAnalytics (data) {
  // Take the provided dicitonary of data and send it to Hub

  // Append the date and time of this recording
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  const dateString = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1)
  data.datetime = dateString

  // Append the current exhibit
  data.exhibit = config.current_exhibit

  const requestDict = {
    data,
    name: config.id
  }

  makeServerRequest(
    {
      method: 'POST',
      endpoint: '/tracker/submitAnalytics',
      params: requestDict,
      timeout: 5000
    })
}

export function parseINIString (data) {
  // Take an INI file and return an object with the settings
  // From https://stackoverflow.com/questions/3870019/javascript-parser-for-a-string-which-contains-ini-data

  const regex = {
    section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
    param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/
  }
  const value = {}
  const lines = data.split(/[\r\n]+/)
  let section = null
  lines.forEach(function (line) {
    if (regex.comment.test(line)) {
      // Skip comments
    } else if (regex.param.test(line)) {
      const match = line.match(regex.param)
      if (section) {
        value[section][match[1]] = match[2]
      } else {
        value[match[1]] = match[2]
      }
    } else if (regex.section.test(line)) {
      const match = line.match(regex.section)
      value[match[1]] = {}
      section = match[1]
    } else if (line.length === 0 && section) {
      section = null
    }
  })
  return value
}

export function csvToJSON (csv) {
  // From https://stackoverflow.com/questions/59016562/parse-csv-records-in-to-an-array-of-objects-in-javascript

  const lines = csv.split('\n')
  const result = []
  const headers = lines[0].split(',')

  for (let i = 1; i < lines.length; i++) {
    const obj = {}

    if (lines[i] === undefined || lines[i].trim() === '') {
      continue
    }

    // regex to split on comma, but ignore inside of ""
    const words = splitCsv(lines[i])
    for (let j = 0; j < words.length; j++) {
      // Clean up "" used to escape commas in the CSV
      let word = words[j].trim()
      if (word.slice(0, 1) === '"' && word.slice(-1) === '"') {
        word = word.slice(1, -1)
      }

      word = word.replaceAll('""', '"')
      obj[headers[j].trim()] = word.trim()
    }

    result.push(obj)
  }
  const detectBad = detectBadCSV(result)

  if (detectBad.error === true) {
    return {
      json: result,
      error: true,
      error_index: detectBad.error_index
    }
  }

  return { json: result, error: false }
}

function detectBadCSV (jsonArray) {
  // Take the JSON array from csvToJSON and check if it seems properly formed.

  const lengthCounts = {}
  const lengthList = []
  jsonArray.forEach((el) => {
    // Count the number of fields (which should be the same for each row)
    const length = Object.keys(el).length
    if (length in lengthCounts) {
      lengthCounts[length] += 1
    } else {
      lengthCounts[length] = 1
    }
    lengthList.push(length)
  })

  // Assume that the length that occurs most often is the correct one
  const mostCommon = parseInt(Object.keys(lengthCounts).reduce((a, b) => lengthCounts[a] > lengthCounts[b] ? a : b))
  const badIndices = []
  lengthList.forEach((el, i) => {
    if (el !== mostCommon) badIndices.push(i)
  })
  if (badIndices.length > 0) {
    return { error: true, error_index: badIndices[0] }
  }
  return { error: false }
}

function splitCsv (str) {
  // From https://stackoverflow.com/a/31955570

  return str.split(',').reduce((accum, curr) => {
    if (accum.isConcatting) {
      accum.soFar[accum.soFar.length - 1] += ',' + curr
    } else {
      accum.soFar.push(curr)
    }
    if (curr.split('"').length % 2 === 0) {
      accum.isConcatting = !accum.isConcatting
    }
    return accum
  }, { soFar: [], isConcatting: false }).soFar
}

export function gotoApp (app, other = '') {
  // Change the browser location to point to the given app.
  console.log(app)
  const appLocations = {
    dmx_control: '/dmx_control.html',
    infostation: '/infostation.html',
    media_browser: '/media_browser.html',
    media_player: '/media_player.html',
    // media_player_kiosk: 'Media Player Kiosk',
    // sos_kiosk: 'SOS Kiosk',
    // sos_screen_player: 'SOS Screen Player',
    timelapse_viewer: '/timelapse_viewer.html',
    timeline_explorer: '/timeline_explorer.html',
    voting_kiosk: '/voting_kiosk.html',
    word_cloud_input: '/word_cloud_input.html',
    word_cloud_viewer: '/word_cloud_viewer.html'
  }
  console.log(config, app, other)
  if (other !== '') {
    window.location = config.helperAddress + '/' + other
  } else {
    window.location = config.helperAddress + appLocations[app]
  }
}

export function appNameToDisplayName (appName) {
  const displayNames = {
    dmx_control: 'DMX Control',
    infostation: 'InfoStation',
    media_browser: 'Media Browser',
    media_player: 'Media Player',
    other: 'Other app',
    settings: 'Settings',
    timelapse_viewer: 'Timelapse Viewer',
    timeline_explorer: 'Timeline Explorer',
    voting_kiosk: 'Voting Kiosk',
    web_viewer: 'Web Viewer',
    word_cloud_input: 'Word Cloud Input',
    word_cloud_viewer: 'word Cloud Viewer'
  }
  if (appName in displayNames) {
    return displayNames[appName]
  } else return appName
}

export async function getAvailableDefinitions (appID) {
  // Ask the helper for all the definition files for the given app and return a Promise with the result.

  return makeHelperRequest({
    method: 'GET',
    endpoint: '/definitions/' + appID + '/getAvailable'
  })
}

export async function writeDefinition (definition) {
  // Send the given JSON definition to the helper to write to the content directory.

  // Tag the definition with some useful properties
  definition.exhibitera_version = config.softwareVersion
  definition.lastEditedDate = new Date().toISOString()
  return makeHelperRequest({
    method: 'POST',
    endpoint: '/definitions/write',
    params: { definition }
  })
}

export function setObjectProperty (obj, keys, val) {
  // Set the location given by the keys to val, creating the path if necessary.
  // E.g., keys = ['prop1', 'prop2', 'prop3'] sets obj.prop1.prop2.prop3 to val
  // From https://stackoverflow.com/questions/5484673/javascript-how-to-dynamically-create-nested-objects-using-object-names-given-by

  const lastKey = keys.pop()
  const lastObj = keys.reduce((obj, key) =>
    (obj[key] = obj[key] || {}),
  obj)
  lastObj[lastKey] = val
};

export function guessMimetype (filename) {
  // Use filename's extension to guess the mimetype

  const ext = filename.split('.').slice(-1)[0].toLowerCase()

  if (['mp4', 'mpeg', 'mpg', 'webm', 'mov', 'm4v', 'avi', 'flv'].includes(ext)) {
    return 'video'
  } else if (['jpeg', 'jpg', 'tiff', 'tif', 'png', 'bmp', 'gif', 'webp', 'eps', 'ps', 'svg'].includes(ext)) {
    return 'image'
  } else if (['aac', 'm4a', 'mp3', 'oga', 'ogg', 'wav'].includes(ext)) {
    return 'audio'
  } else if (['otf', 'ttf', 'woff', 'woff2'].includes(ext)) {
    return 'font'
  }
}

export function loadDefinition (defName) {
  // Ask the helper for the given definition and return a promise containing it.

  config.currentDefinition = defName

  return makeHelperRequest({
    method: 'GET',
    endpoint: '/definitions/' + defName + '/load'
  })
}

export function saveScreenshotAsThumbnail (filename) {
  // Use html2canvas to get an approximate screenshoot to use as a thumbnail.

  html2canvas(document.body, {
    allowTaint: true
  }).then((canvas) => {
    canvas.toBlob((img) => {
      const formData = new FormData()
      if (img != null) {
        formData.append('files', img, filename)
        fetch('/files/uploadThumbnail', {
          method: 'POST',
          body: formData
        })
          .catch(error => {
            console.error(error)
          })
      }
    })
  })
}

export function createLanguageSwitcher (def, localize) {
  // Take a definition file and use the language entries to make an appropriate language switcher.
  // localize is the name of a function that handles implementing the change in language
  // based on the provided language code.

  const langs = Object.keys(def.languages)

  if (langs.length === 1) {
    // No switcher necessary
    $('#langSwitchDropdown').hide()
    return
  }

  $('#langSwitchDropdown').show()
  // Cycle the languagse and build an entry for each
  $('#langSwitchOptions').empty()
  langs.forEach((code) => {
    const name = def.languages[code].display_name

    const li = document.createElement('li')

    const button = document.createElement('button')
    button.classList = 'dropdown-item langSwitch-entry'
    button.addEventListener('click', function () {
      localize(code)
    })
    li.appendChild(button)

    const flag = document.createElement('img')
    const customImg = def.languages[code].custom_flag
    if (customImg != null) {
      flag.src = '../content/' + customImg
    } else {
      flag.src = '../_static/flags/' + code + '.svg'
    }
    flag.style.width = '10vmin'
    flag.addEventListener('error', function () {
      this.src = '../_static/icons/translation-icon_black.svg'
    })
    button.appendChild(flag)

    const span = document.createElement('span')
    span.classList = 'ps-2'
    span.style.verticalAlign = 'middle'
    span.innerHTML = name
    button.appendChild(span)

    $('#langSwitchOptions').append(li)
  })
}

export function getColorAsRGBA (el, prop) {
  // Look up the given CSS property on the given element and return an object with the RGBA values.

  if ((typeof el === 'string') && (el[0] !== '#')) el = '#' + el

  const color = $(el).css(prop) // Should be string of form RGBA(R,G,B,A) or RGB(R,G,B)
  const colorSplit = color.split(', ')
  const result = {
    r: parseInt(colorSplit[0].split('(')[1]),
    g: parseInt(colorSplit[1].trim()),
    b: parseInt(colorSplit[2].split(')')[0].trim())
  }

  if (color.slice(0, 4) === 'RGBA') {
    result.a = parseFloat(colorSplit.split(',')[3].split(')')[0].trim())
  }
  return result
}

export function classifyColor (color) {
  // Take an object of the form {r: 134, g: 234, b: 324} and return 'light' or 'dark'
  // Depending on the luminance
  // From https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color

  if ((color.r * 0.299 + color.g * 0.587 + color.b * 0.114) > 186) {
    return 'light'
  }
  return 'dark'
}

export function withExtension (path, ext) {
  // Return the given path with its extension replaced by ext

  return path.split('.').slice(0, -1).join('.') + '.' + ext
}

export function setBackground (details, root, defaultColor = '#22222E', setStatusBar = false) {
  // Take the 'background' section of a definition and use it to configure the background

  if (setStatusBar === true) {
    // Configure the status bar for PWAs to black by default
    if (setStatusBar === true) {
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#000')
      document.querySelector('meta[name="msapplication-TileColor"]').setAttribute('content', '#000')
    }
  }

  if (details.mode === 'color') {
    // Solid colors
    let color = defaultColor
    if ('color' in details) color = details.color
    root.style.setProperty('--background-color', color)

    // Configure the status bar for PWAs to match the background
    if (setStatusBar === true) {
      document.querySelector('meta[name="theme-color"]').setAttribute('content', color)
      document.querySelector('meta[name="msapplication-TileColor"]').setAttribute('content', color)
    }
  } else if (details.mode === 'gradient') {
    // Gradient
    let angle = 0
    if ('gradient_angle' in details) angle = details.gradient_angle
    let color1 = defaultColor
    if ('gradient_color_1' in details) color1 = details.gradient_color_1
    let color2 = defaultColor
    if ('gradient_color_2' in details) color2 = details.gradient_color_2

    const grad = `linear-gradient(${angle}deg, ${color2}, ${color1})`
    root.style.setProperty('--background-color', grad)
  } else if (details.mode === 'image') {
    // Image
    root.style.setProperty('--background-color', `url(../content/${details.image})`)
  }
}

export function uuid () {
  // Generate a new UUID v4 without using the crypto library (we may not be in HTTPS).
  // Format: 8-4-4-4-12

  const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  result += '-'
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  result += '-'
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  result += '-'
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  result += '-'
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  return result
}

export function sortAlphabetically (array) {
  // Sort the given array alphabetically

  return array.sort((a, b) => {
    try {
      const aName = a.toLowerCase()
      const bName = b.toLowerCase()
      if (aName > bName) return 1
      if (aName < bName) return -1
    } catch {

    }
    return 0
  })
}

export function createFont (name, font) {
  // Create the desired font, if it doesn't already exist.

  const safeName = name.replaceAll(' ', '').replaceAll('.', '').replaceAll('/', '').replaceAll('\\', '')

  if ((safeName in config.fontCache) === false) {
    const fontDef = new FontFace(safeName, 'url(' + encodeURI(font) + ')')
    document.fonts.add(fontDef)
    config.fontCache[safeName] = true
  }
  return safeName
}
