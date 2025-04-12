/* global showdown, bootstrap */

import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import exConfig from '../config.js'

export function makeRequest (opt) {
  // Function to make a request to a server and return a Promise with the result
  // 'opt' should be an object with all the necessry options

  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest()
    xhr.open(opt.method, opt.url + opt.endpoint, true)
    xhr.timeout = opt.timeout ?? 2000 // ms
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        if ('rawResponse' in opt && opt.rawResponse === true) {
          resolve(xhr.responseText)
        } else {
          resolve(JSON.parse(xhr.responseText))
        }
      } else {
        console.log('Submitted data: ', opt.params)
        console.log('Response: ', JSON.parse(xhr.response))
        reject(new Error(`Unable to complete ${opt.method} to ${opt.url + opt.endpoint} with the above data`))
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

export function makeServerRequest (opt) {
  // Shortcut for making a server request and returning a Promise

  opt.url = exConfig.serverAddress
  return makeRequest(opt)
}

export function extractIPAddress (address) {
  // Extract just the IP address from a web address

  if (address == null) {
    return null
  }
  // Remove the prefix
  address = address.replace('http://', '')
  address = address.replace('https://', '')
  // Find and remove the port
  const colon = address.indexOf(':')
  address = address.slice(0, colon)
  return address
}

export function openMediaInNewTab (filenames, fileTypes) {
  // Open the media files given by filename in a new browser tab

  console.log('Opening files in new tab:', filenames)

  let margin
  if (filenames.length > 1) {
    margin = '1vmax'
  } else {
    margin = 'auto'
  }
  let html = `
  <html>
    <head>
      <style>
        @media (orientation: landscape) {
          .zoomedOut{
            display: block;
            height: 100%;
            margin: ${margin};
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
            cursor: zoom-in;
            -webkit-user-select: none;
          }
        }
        @media (orientation: portrait) {
          .zoomedOut{
            display: block;
            width: 100%;
            margin: ${margin};
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
            cursor: zoom-in;
            -webkit-user-select: none;
          }
        }

        .zoomedIn{
          display: block;
          margin: ${margin};
          padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
          cursor: zoom-out;
          -webkit-user-select: none;
        }
      </style>
      <title>Exhibitera Hub Media Viewer</title>
    </head>
    <body style="margin: 0px">
  `

  for (let i = 0; i < filenames.length; i++) {
    let fileType
    if (fileTypes == null) {
      fileType = exFiles.guessMimetype(filenames[i])
    } else {
      fileType = fileTypes[i]
    }

    if (fileType === 'image') {
      html += `<img id="image${String(i)}" class='zoomedOut' src="${filenames[i]}" onclick="toggleZoom(${String(i)})">`
    } else if (fileType === 'video') {
      html += `<video class='zoomedOut' controls loop>
      <source src="${filenames[i]}">
      This file is not playing.
    </video>`
    }
  }

  html += `
    </body>
      <script>

        function toggleZoom(val) {
          document.getElementById("image" + val).classList.toggle('zoomedIn');
          document.getElementById("image" + val).classList.toggle('zoomedOut');
        }
      </script>
    </html>
  `

  const imageWindow = window.open('', '_blank')
  imageWindow.document.write(html)
}

async function showUpdateInfoModal (id, kind, details) {
  // Populate the model with details about the update and show it.

  if (kind !== 'control_server' && kind !== 'apps') {
    console.log('Error showing update info modal. Unexpected update kind: ', kind)
    return
  }

  document.getElementById('updateInfoModalTitleID').textContent = id
  document.getElementById('updateInfoModalCurrentVersion').textContent = exUtilities.formatSemanticVersion(details.current_version)
  document.getElementById('updateInfoModalLatestVersion').textContent = exUtilities.formatSemanticVersion(details.available_version)
  document.getElementById('updateInfoModalDownloadButton').href = 'https://exhibitera.org/download/'

  // Get the changelog
  const changelog = await makeRequest({
    method: 'GET',
    url: 'https://raw.githubusercontent.com/Cosmic-Chatter/Exhibitera/main/exhibitera/changelog.md',
    endpoint: '',
    rawResponse: true
  })

  const markdownConverter = new showdown.Converter({ headerLevelStart: 4.0 })
  markdownConverter.setFlavor('github')

  const formattedText = markdownConverter.makeHtml(changelog)
  document.getElementById('updateInfoModalChangelogContainer').innerHTML = formattedText

  const appsInstructions = document.getElementById('updateInfoModalAppsInstructions')
  const hubInstructions = document.getElementById('updateInfoModalHubInstructions')
  if (kind === 'control_server') {
    appsInstructions.style.display = 'none'
    hubInstructions.style.display = 'block'
  } else {
    appsInstructions.style.display = 'block'
    hubInstructions.style.display = 'none'
  }

  exUtilities.showModal('#updateInfoModal')
}

export function rebuildNotificationList () {
  // Function to use the exConfig.errorDict to build a set of buttons indicating
  // that there is a notification from a component.

  const notificationsCol = document.getElementById('notificationsDropdownCol')
  const dropdownButton = document.getElementById('notificationsDropdownButton')
  const notificationDisplayRow = document.getElementById('notificationDisplayRow')
  const errorKeys = Object.keys(exConfig.errorDict)

  dropdownButton.classList.add('btn-info')
  dropdownButton.classList.remove('btn-danger')

  // Clear the existing buttons
  document.getElementById('notificationDisplayRow').innerHTML = ''

  // Iterate through the items in the exConfig.errorDict. Each item should correspond
  // to one component with an notification.
  let notificationCount = 0

  for (const item of errorKeys) {
    // Then, iterate through the notifications on that given item
    for (const itemError of Object.keys(exConfig.errorDict[item])) {
      let notification
      if (itemError === 'software_update') {
        if (item === '__control_server') {
          const labelName = 'Hub: Software update available'
          notification = createNotificationHTML(labelName, 'update')
          notification.addEventListener('click', notification.addEventListener('click', () => { showUpdateInfoModal('Hub', 'control_server', exConfig.errorDict[item].software_update) }))
          notificationCount += 1
        } else {
          const labelName = item + ': Software update available'
          notification = createNotificationHTML(labelName, 'update')
          notification.addEventListener('click', notification.addEventListener('click', () => { showUpdateInfoModal(item, 'apps', exConfig.errorDict[item].software_update) }))
          notificationCount += 1
        }
      } else if (itemError === 'outdated_os') {
        let labelName
        if (item === '__control_server') {
          labelName = 'Hub: This OS may not be supported in the next version of Exhibitera.'
        } else {
          labelName = item + ': This OS may not be supported in the next version of Exhibitera.'
        }

        notification = createNotificationHTML(labelName, 'outdated_os')
        notificationCount += 1
      } else {
        const itemErrorMsg = (exConfig.errorDict[item])[itemError]
        if (itemErrorMsg.length > 0) {
          notificationCount += 1
          const labelName = item + ': ' + itemError + ': ' + itemErrorMsg
          // Create and add the button
          notification = createNotificationHTML(labelName, 'error')

          // Recolor the dropdown to red to indicate an error
          dropdownButton.classList.remove('btn-info')
          dropdownButton.classList.add('btn-danger')
        }
      }
      notificationDisplayRow.appendChild(notification)
    }
  }

  if (notificationCount > 0) {
    notificationsCol.style.display = 'block'
  } else {
    notificationsCol.style.display = 'none'
  }
}

function createNotificationHTML (name, kind) {
  // Create and return a DOM element representing a notification.

  const colorClass = {
    error: 'btn-danger',
    update: 'btn-info',
    outdated_os: 'btn-warning'
  }[kind] ?? 'btn-info'

  const li = document.createElement('li')
  li.classList = 'dropdown-item'
  li.innerHTML = `<button class="btn btn-block ${colorClass}">${name}</button>`

  return li
}

export function getGroupName (uuid) {
  // Return the name of a group given its UUID.

  for (const group of exConfig.groups) {
    if (group.uuid === uuid) return group.name
  }
  return uuid
}

export function sortComponentsByGroup () {
  // Return an object where the keys are group names and values are the list
  // of components matching that group

  const result = {}

  for (const component of exConfig.exhibitComponents) {
    for (const group of component.groups) {
      if (group in result) {
        result[group].push(component)
      } else {
        result[group] = [component]
      }
    }
  }

  return result
}

export function sortGroups (method) {
  // Return the componentGroups sorted in the given way.

  if (method === 'alphabetical') {
    exConfig.componentGroups.sort((a, b) => {
      const aName = getGroupName(a.group).toLowerCase()
      const bName = getGroupName(b.group).toLowerCase()
      return aName.localeCompare(bName)
    })
  } else if (method === 'status') {
    exConfig.componentGroups.sort((a, b) => {
      const aName = getGroupName(a.group).toLowerCase()
      const bName = getGroupName(b.group).toLowerCase()
      const aStatus = a.getStatus().value
      const bStatus = b.getStatus().value
      if (aStatus > bStatus) return -1
      if (bStatus > aStatus) return 1

      // Fall back to alphabetical if they are the same
      return aName.localeCompare(bName)
    })
  }

  // Move the Default group to the front if it exists
  const index = exConfig.componentGroups.findIndex(obj => obj.group === 'Default')
  if (index > -1) {
    const [item] = exConfig.componentGroups.splice(index, 1)
    exConfig.componentGroups.unshift(item)
  }
}

export function sortDefinitionsByApp (defDict, dropPreview = true) {
  // Take a dictionary of app definitions with their UUIDs as keys and return a
  // dictionary sorted by app name.
  // set dropPreview == false to include the __previewXXX definitions used by the
  // app config wizards.

  const result = {}

  for (const def of Object.values(defDict)) {
    if (def?.uuid?.startsWith('__preview') && dropPreview === true) continue

    if (def.app in result) {
      result[def.app].push(def)
    } else {
      result[def.app] = [def]
    }
  }

  // Sort the arrays
  Object.keys(result).forEach((key) => {
    result[key] = result[key].sort((a, b) => {
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()
      if (aName > bName) return 1
      if (bName > aName) return -1
      return 0
    })
  })

  return result
}

export function sortExhibitComponentsByID () {
  // Take the list of components and return an array sorted
  // alphabetically by their ID

  return exConfig.exhibitComponents.sort(
    function (a, b) {
      const aID = a.id.toLowerCase()
      const bID = b.id.toLowerCase()
      if (aID > bID) {
        return 1
      } else if (bID > aID) {
        return -1
      }
      return 0
    }
  )
}

export function checkPermission (action, neededLevel, group = null) {
  // Check that the user has permission for the requested action

  if (Object.keys(exConfig.user).length === 0) return false

  if (action !== 'components') {
    if (neededLevel === 'none') return true
    if (action in exConfig.user.permissions === false) return false

    const allowedLevel = exConfig.user.permissions[action]
    if (neededLevel === 'edit') {
      if (allowedLevel === 'edit') return true
      return false
    }
    if (neededLevel === 'view') {
      if (allowedLevel === 'edit' || allowedLevel === 'view') return true
      return false
    }
  } else {
    // Components
    if (neededLevel === 'edit') {
      if (exConfig.user.permissions.components.edit.includes('__all')) return true
      if ((group != null) && exConfig.user.permissions.components.edit.includes(group)) return true
      return false
    }
    if (neededLevel === 'view') {
      if (exConfig.user.permissions.components.edit.includes('__all')) return true
      if (exConfig.user.permissions.components.view.includes('__all')) return true
      if ((group != null) && (exConfig.user.permissions.components.edit.includes(group) || (exConfig.user.permissions.components.view.includes(group)))) return true
      return false
    }
  }
  return false
}

export function getUserDisplayName (uuid) {
  // Return the display name for a user or the uuid if the name cannot be resolved.

  return new Promise(function (resolve, reject) {
  // First, check the cache
    if (exConfig.usersDisplayNameCache[uuid] !== undefined) {
      resolve(exConfig.usersDisplayNameCache[uuid])
    }
    makeServerRequest({
      method: 'GET',
      endpoint: `/user/${uuid}/displayName`
    })
      .then((response) => {
        if (response.success === true) {
          exConfig.usersDisplayNameCache[uuid] = response.display_name
          resolve(response.display_name)
        } else {
          resolve(uuid)
        }
      })
  })
}

export function getExhibitComponentGroup (group) {
  // Function to search the componentGroups list for a given group id

  const result = exConfig.componentGroups.find(obj => {
    return obj.group === group
  })
  return result
}

export function getGroup (uuid) {
  // Search the groups list for a given uuid and return the corresponding group.

  const result = exConfig.groups.find(obj => {
    return obj.uuid === uuid
  })
  return result
}

export function getExhibit (uuid) {
  // Search the exhibit list for a given uuid and return the corresponding exhibit.

  const result = exConfig.availableExhibits.find(obj => {
    return obj.uuid === uuid
  })
  return result
}

export function getExhibitName (uuid) {
  // Return the name of the specified exhibit, if it exists.
  const exhibit = getExhibit(uuid)
  if (exhibit == null) return 'Invalid exhibit'
  return exhibit.name
}
