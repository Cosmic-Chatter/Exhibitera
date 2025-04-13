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
  definition: {}, // Holds the current definition
  definitionLoader: null, // A function used by loadDefinition() to set up the specific app.
  errorDict: {},
  fontCache: {},
  group: 'Default',
  helperAddress: 'http://localhost:8000',
  id: 'TEMP ' + String(new Date().getTime()),
  remoteDisplay: false, // false == we are using the webview app, true == browser
  serverAddress: '',
  softwareVersion: 5.3,
  standalone: false, // false == we are using Hub
  updateParser: null, // Function used by readUpdate() to parse app-specific updates
  uuid: ''
}

// platform.js might not be included in 3rd-party apps
try {
  config.platformDetails = {
    operating_system: String(platform.os),
    browser: platform.name + ' ' + platform.version
  }
} catch {
  console.log('script platform.js not found. Include this script to send additional details to Hub.')
}

makeHelperRequest({
  method: 'GET',
  endpoint: '/system/getPlatformDetails'
})
  .then((result) => {
    config.platformDetails.outdated = result?.outdated ?? false
  })

// Fix bootstrap modal accessibility issue
document.addEventListener('hidden.bs.modal', function (event) {
  if (document.activeElement) document.activeElement.blur()
})

export function configureApp (opt = {}) {
  // Perform basic app setup

  config.helperAddress = window.location.origin

  if ('checkConnection' in opt) config.connectionChecker = opt.checkConnection
  if ('debug' in opt) config.debug = opt.debug
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
          config.definition = result.definition
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
              config.definition = result.definition
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
  return new URLSearchParams(queryString)
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
    endpoint: '/system/wakeDisplay'
  })
}

function sleepDisplay () {
  // Send a message to the local helper process and ask it to sleep the displays

  makeHelperRequest({
    method: 'GET',
    endpoint: '/system/sleepDisplay'
  })
}

export function askForRestart () {
  // Send a message to the local helper and ask for it to restart the PC

  makeHelperRequest({
    method: 'GET',
    endpoint: '/system/restart'
  })
}

export function askForShutdown () {
  // Send a message to the local helper and ask for it to shutdown the PC

  makeHelperRequest({
    method: 'GET',
    endpoint: '/system/shutdown'
  })
}

function readServerUpdate (update) {
  // Function to read a message from Hub and take action based on the contents
  // 'update' should be an object

  let sendUpdate = false

  for (const cmd of update?.commands ?? []) {
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
  if (update?.software_update?.update_available) {
    config.errorDict.software_update = update.software_update
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
        if ('app' in def && def.app !== '') {
          if (
            (def.app !== config.exhibiteraAppID) ||
          (config.exhibiteraAppID === 'other' && def.path !== location.pathname.slice(1))
          ) {
            let otherPath = ''
            if (def.app === 'other') otherPath = def.path
            gotoApp(def.app, otherPath)
          }
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

  for (const cmd of update?.commands ?? []) {
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

  // App settings
  if (update?.app?.id) config.id = update.app.id
  if (update?.app?.definition) config.definition = update.app.definition
  if (update?.app?.uuid) config.uuid = update.app.uuid

  if ((update?.control_server?.ip_address) && (update?.control_server?.port)) {
    config.serverAddress = 'http://' + update.control_server.ip_address + ':' + update.control_server.port
  }
  if ('permissions' in update) {
    config.permissions = update.permissions
  }
  if ('software_update' in update) {
    if (update.software_update.update_available === true) { config.errorDict.software_update = update.software_update }
  }
  if (update?.system?.remote_display) {
    config.remoteDisplay = update.system.remote_display
  }
  if (update?.system?.standalone) {
    config.standalone = update.system.standalone
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
        if ('app' in def && def.app !== '') {
          if (
            (def.app !== config.exhibiteraAppID) ||
          (config.exhibiteraAppID === 'other' && def.path !== location.pathname.slice(1))
          ) {
            let otherPath = ''
            if (def.app === 'other') otherPath = def.path
            gotoApp(def.app, otherPath)
          }
        }
      })
  }

  // Call the updateParser, if provided, to parse actions for the specific app
  if (typeof config.updateParser === 'function') {
    config.updateParser(update)
  }
}

function checkAgain () {
  try {
    document.getElementById('helperConnectionWarningAddress').innerHTML = config.helperAddress
    document.getElementById('helperConnectionWarning').style.display = 'block'
  } catch {
    // Will fail if these elements don't exist
  }
  console.log('Could not get defaults... checking again')
  setTimeout(askForDefaults, 500)
}

export function askForDefaults (changeApp = true) {
  // Send a message to the local helper and ask for the latest configuration, then use it.
  // Set changeApp === false to supress changing the app based on the current definition

  return makeHelperRequest({
    method: 'GET',
    endpoint: '/system/configuration'
  })
    .then((update) => {
      readHelperUpdate(update, changeApp)
    }, checkAgain)
}

export function checkForHelperUpdates () {
  // Function to ask the helper for any new updates

  return makeHelperRequest({
    method: 'GET',
    endpoint: '/update',
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
      endpoint: '/system/configuration/update',
      params: requestDict
    })
}

export function sendAnalytics (data) {
  // Take the provided dictionary of data and send it to Hub

  // Append the date and time of this recording
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  data.datetime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1)

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

export function gotoApp (app, other = '') {
  // Change the browser location to point to the given app.
  console.log(app)
  const appLocations = {
    dmx_control: '/dmx_control',
    image_compare: '/image_compare',
    infostation: '/infostation',
    media_browser: '/media_browser',
    media_player: '/media_player',
    timelapse_viewer: '/timelapse_viewer',
    timeline_explorer: '/timeline_explorer',
    voting_kiosk: '/voting_kiosk',
    word_cloud_input: '/word_cloud/input',
    word_cloud_viewer: '/word_cloud/viewer'
  }
  console.log(config, app, other)
  if (other !== '') {
    window.location = config.helperAddress + '/' + other
  } else {
    window.location = config.helperAddress + appLocations[app]
  }
}

export async function getAvailableDefinitions (appID = '') {
  // Ask the helper for all the definition files for the given app and return a Promise with the result.

  let endpoint = '/definitions/app/' + appID
  if (appID === '') endpoint = '/definitions'

  return makeHelperRequest({ method: 'GET', endpoint })
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

export function loadDefinition (defName) {
  // Ask the helper for the given definition and return a promise containing it.

  config.currentDefinition = defName

  return makeHelperRequest({
    method: 'GET',
    endpoint: '/definitions/' + defName + '/load'
  })
}

export function saveScreenshotAsThumbnail (filename) {
  // Use html2canvas to get an approximate screenshot to use as a thumbnail.

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

  const langSwitchDropdown = document.getElementById('langSwitchDropdown')
  const langSwitchOptions = document.getElementById('langSwitchOptions')

  if (langs.length < 2) {
    // No switcher necessary
    langSwitchDropdown.style.display = 'none'
    return
  }

  langSwitchDropdown.style.display = 'flex'

  // Cycle the languages and build an entry for each
  const langOrder = def?.language_order || langs
  langSwitchOptions.innerHTML = ''

  langOrder.forEach((code) => {
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

    langSwitchOptions.appendChild(li)
  })
}

export function getColorAsRGBA (el, prop) {
  // Look up the given CSS property on the given element and return an object with the RGBA values.

  // Get the element (assumes el is a DOM element or a selector string)
  const element = typeof el === 'string' ? document.querySelector(el) : el
  if (!element) {
    throw new Error(`Element ${el} not found.`)
  }

  // Get the computed style for the given property
  const color = window.getComputedStyle(element).getPropertyValue(prop)
  const colorSplit = color.split(', ')
  const result = {
    r: parseInt(colorSplit[0].split('(')[1]),
    g: parseInt(colorSplit[1].trim()),
    b: parseInt(colorSplit[2].split(')')[0].trim())
  }

  if (color.slice(0, 4).toLowerCase() === 'rgba') {
    try {
      result.a = parseFloat(colorSplit[3].split(')')[0].trim())
    } catch {
      console.log('getColorAsRGBA: error getting opacity')
    }
  }
  return result
}

export function classifyColor (color) {
  // Take an object of the form {r: 134, g: 234, b: 224} and return 'light' or 'dark'
  // Depending on the luminance
  // From https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color

  if ((color.r * 0.299 + color.g * 0.587 + color.b * 0.114) > 125) {
    return 'light'
  }
  return 'dark'
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
