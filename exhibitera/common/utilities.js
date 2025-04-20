/* global bootstrap */

// Helpful functions shared between Hub and Apps

import exConfig from './config.js'

const exhibiteraAppIdDisplayNames = {
  dmx_control: 'DMX Control',
  heartbeat: 'Heartbeat',
  image_compare: 'Image Compare',
  infostation: 'InfoStation',
  media_browser: 'Media Browser',
  media_player: 'Media Player',
  media_player_kiosk: 'Media Player Kiosk',
  projector: 'Projector',
  sos_kiosk: 'SOS Kiosk',
  sos_screen_player: 'SOS Screen Player',
  static_component: 'Static component',
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
    if ('withCredentials' in opt && opt.withCredentials === true) xhr.withCredentials = true

    let apiVersion = opt?.api ?? exConfig.api
    if ((apiVersion !== '') && (apiVersion[0] !== '/')) apiVersion = '/' + apiVersion

    const path = opt.url + apiVersion + opt.endpoint
    if (opt?.noCache ?? false) {
      xhr.open(opt.method, path + (/\?/.test(path) ? '&' : '?') + new Date().getTime(), true)
    } else {
      xhr.open(opt.method, path, true)
    }

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (opt?.rawResponse ?? false) {
          resolve(xhr.responseText)
        } else {
          resolve(JSON.parse(xhr.responseText))
        }
      } else {
        console.log('Submitted data: ', opt.params)
        console.log('Response: ', JSON.parse(xhr.response))
        reject(new Error(`Unable to complete ${opt.method} to ${path} with the above data`))
      }
    }
    xhr.onerror = function () {
      console.log('Submitted data: ', opt.params)
      reject(new Error(`Unable to complete ${opt.method} to ${opt.url + opt.endpoint} with the above data`))
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

export function showModal (modal) {
  // Show the given Bootstrap modal
  // Modal can either be a string starting with # (e.g., '#myID') or a DOM element

  const myModal = new bootstrap.Modal(modal)
  myModal.show()
}

export function hideModal (modal) {
  // Hide the given Bootstrap modal
  // Modal can either be a string starting with # (e.g., '#myID') or a DOM element

  const myModal = bootstrap.Modal.getInstance(modal)
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

export function sortAlphabetically (array) {
  // Sort the given array alphabetically

  return array.sort((a, b) => {
    try {
      return a.toLowerCase().localeCompare(b.toLowerCase())
    } catch {
      return 0
    }
  })
}
