/* global bootstrap */

// Helpful functions shared between Hub and Apps

import exConfig from './config.js'

const exhibiteraAppIdDisplayNames = {
  dmx_control: 'DMX Control',
  image_compare: 'Image Compare',
  infostation: 'InfoStation',
  media_browser: 'Media Browser',
  media_player: 'Media Player',
  none: 'Exhibitera Component', // For Ex Apps before a definition is selected
  other: 'Custom App', // For apps set up with Custom App
  projector: 'Projector',
  static_component: 'Static Component',
  survey_kiosk: 'Survey Kiosk',
  third_party: '3rd Party App', // For apps using the Core API
  timelapse_viewer: 'Timelapse Viewer',
  timeline_explorer: 'Timeline Explorer',
  voting_kiosk: 'Voting Kiosk',
  wol_only: 'Wake on LAN',
  word_cloud_input: 'Word Cloud Input',
  word_cloud_viewer: 'Word Cloud Viewer'
}

export function makeRequest (opt) {
  // Make a request to a server and return a Promise with the result
  // 'opt' should be an object with all the necessry options

  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest()
    xhr.timeout = opt.timeout ?? 2000 // ms
    if (opt?.withCredentials === true) xhr.withCredentials = true

    let apiVersion = opt?.api ?? exConfig.api
    if ((apiVersion !== '') && (apiVersion[0] !== '/')) apiVersion = '/' + apiVersion

    const path = opt.url + apiVersion + opt.endpoint
    if (opt?.noCache ?? false) {
      xhr.open(opt.method, path + (/\?/.test(path) ? '&' : '?') + new Date().getTime(), true)
    } else {
      xhr.open(opt.method, path, true)
    }
    for (const [name, value] of Object.entries(opt?.headers ?? {})) {
      xhr.setRequestHeader(name, value)
    }

    // Every outcome must resolve or reject, so callers can retry or report the failure
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (opt?.rawResponse ?? false) {
          resolve(xhr.responseText)
          return
        }
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error(`Response to ${opt.method} ${path} is not JSON`))
        }
      } else {
        console.log('Submitted data: ', opt.params)
        console.log('Response: ', xhr.response)
        reject(new Error(`Unable to complete ${opt.method} to ${path} with the above data`))
      }
    }
    xhr.onerror = function () {
      console.log('Submitted data: ', opt.params)
      reject(new Error(`Unable to complete ${opt.method} to ${path} with the above data`))
    }
    // Browsers don't call onerror for a timeout
    xhr.ontimeout = function () {
      reject(new Error(`${opt.method} to ${path} timed out after ${xhr.timeout} ms`))
    }
    let paramText = null
    if (opt.params != null) {
      xhr.setRequestHeader('Content-Type', 'application/json')
      paramText = JSON.stringify(opt.params)
    }
    xhr.send(paramText)
  })
}

export function appNameToDisplayName (appName) {
  // Convert an app name to a formatted display name

  return exhibiteraAppIdDisplayNames?.[appName] ?? 'Unknown Component'
}

export function uuid () {
  // Generate a new UUID v4.
  // crypto.randomUUID() needs HTTPS, which we may not have, but crypto.getRandomValues() works everywhere.
  // Format: 8-4-4-4-12

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 1

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function showModal (modal) {
  // Show the given Bootstrap modal
  // Modal can either be a string starting with # (e.g., '#myID') or a DOM element

  const myModal = bootstrap.Modal.getOrCreateInstance(modal)
  myModal.show()
}

export function hideModal (modal) {
  // Hide the given Bootstrap modal
  // Modal can either be a string starting with # (e.g., '#myID') or a DOM element

  const myModal = bootstrap.Modal.getOrCreateInstance(modal)
  myModal.hide()
}

export function stringToBool (str) {
  // Parse a given string and return an appropriate bool

  if (typeof str === 'boolean') {
    return str
  }

  return ['True', 'true', 'TRUE', '1', 'yes', 'Yes', 'YES'].includes(str)
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

export function formatDateTimeDifference (dt1, dt2) {
  // Convert the difference between two times into English
  // dt1 and dt2 should be datetimes or milliseconds

  const diff = (dt1 - dt2)

  const sec = Math.round(diff / 1000) // seconds
  if (sec < 0 && sec > -60) {
    return String(Math.abs(sec)) + ' seconds from now'
  }
  if (sec < 60 && sec >= 0) {
    return String(sec) + ' seconds ago'
  }
  const min = Math.round(diff / 1000 / 60) // minutes
  if (min < 0 && min > -60) {
    return String(Math.abs(min)) + ' minutes from now'
  }
  if (min < 60 && min >= 0) {
    return String(min) + ' minutes ago'
  }
  const hour = Math.round(diff / 1000 / 3600) // hours
  if (min < 0 && min > -24) {
    return String(Math.abs(hour)) + ' hours from now'
  }
  if (hour < 24 && hour >= 0) {
    return String(hour) + ' hours ago'
  }
  const day = Math.round(diff / 1000 / 3600 / 24) // days
  if (day < 0) {
    return String(Math.abs(day)) + ' days from now'
  }
  return String(day) + ' days ago'
}

export function formatSemanticVersion (obj) {
  // Take an object representing a semantic version and format it as a string

  return (String(obj?.major) ?? '?') + '.' + (String(obj?.minor) ?? '?') + '.' + (String(obj?.patch) ?? '?')
}

export function semanticVersionLessThan (inputVer, referenceVer) {
  // Return true if the input version is less than the reference version
  // Supports both strings and dicts

  const input = { major: 0, minor: 0, patch: 0 }
  if (typeof (inputVer) === 'string') {
    const split = inputVer.split('.')
    input.major = parseInt(split[0])
    if (split.length > 1) input.minor = parseInt(split[1])
    if (split.length > 2) input.patch = parseInt(split[2])
  } else Object.assign(input, inputVer)

  const reference = { major: 0, minor: 0, patch: 0 }
  if (typeof (referenceVer) === 'string') {
    const split = referenceVer.split('.')
    reference.major = parseInt(split[0])
    if (split.length > 1) reference.minor = parseInt(split[1])
    if (split.length > 2) reference.patch = parseInt(split[2])
  } else Object.assign(reference, referenceVer)

  // Now compare them
  if (input.major < reference.major) return true
  if (input.major > reference.major) return false

  // major is equal, so compare minor
  if (input.minor < reference.minor) return true
  if (input.minor > reference.minor) return false

  // minor is equal, so compare patch
  if (input.patch < reference.patch) return true
  return false
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
}

export function getObjectProperty (obj, keys) {
  // Return the value of the location given by keys, or undefined
  // if that location does not exist
  // E.g., keys = ['prop1', 'prop2', 'prop3'] gets obj.prop1.prop2.prop3

  return keys.reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return acc[key]
    } else {
      return undefined
    }
  }, obj)
}

export function sortAlphabetically (array, property = null) {
  // Sort the given array alphabetically

  return [...array].sort((a, b) => {
    try {
      if (property) {
        a = a[property]
        b = b[property]
      }
      return a.toLowerCase().localeCompare(b.toLowerCase())
    } catch {
      return 0
    }
  })
}

export function getDefinitionThumbnail (helperAddress, uuid, api) {
  // Return a DOM element for the definition thumbnail.
  // The element will be a div containing an img that may convert to a video
  // `api` is the API prefix of the component at helperAddress, such as from component.getHelperAPI()

  const div = document.createElement('div')

  const thumbUrl =
    helperAddress +
    api +
    '/definitions/' +
    uuid +
    '/thumbnail?' +
    Date.now()

  // Final fallback: static missing document image
  function loadMissingImage () {
    const missing = new Image()
    if (document.querySelector('html').getAttribute('data-bs-theme') === 'dark') {
      missing.src = '/_static/icons/document_missing.svg'
    } else {
      missing.src = '/_static/icons/document_missing_black.svg'
    }
    missing.style.height = '100px'
    missing.style.width = '100%'
    missing.style.objectFit = 'contain'
    div.innerHTML = ''
    div.appendChild(missing)
  }

  // First attempt: image
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    img.style.height = '100px'
    img.style.width = '100%'
    img.style.objectFit = 'contain'
    div.innerHTML = ''
    div.appendChild(img)
  }

  img.onerror = () => {
    // Second attempt: video
    const video = document.createElement('video')
    video.style.height = '100px'
    video.style.width = '100%'
    video.style.objectFit = 'contain'
    video.autoplay = true
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.setAttribute('disablePictureInPicture', 'true')

    video.onerror = () => {
      loadMissingImage()
    }

    video.src = thumbUrl
    div.innerHTML = ''
    div.appendChild(video)
  }

  img.src = thumbUrl
  return div
}
