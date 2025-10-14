/* global showdown */

import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import hubConfig from '../config.js'

export function makeServerRequest (opt) {
  // Shortcut for making a server request and returning a Promise

  opt.url = hubConfig.serverAddress
  return exUtilities.makeRequest(opt)
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

  if (kind !== 'hub' && kind !== 'apps') {
    console.log('Error showing update info modal. Unexpected update kind: ', kind)
    return
  }

  document.getElementById('updateInfoModalTitleID').textContent = id
  document.getElementById('updateInfoModalCurrentVersion').textContent = exUtilities.formatSemanticVersion(details.current_version)
  document.getElementById('updateInfoModalLatestVersion').textContent = exUtilities.formatSemanticVersion(details.available_version)
  document.getElementById('updateInfoModalDownloadButton').href = 'https://exhibitera.org/download/'

  // Get the changelog
  const changelog = await exUtilities.makeRequest({
    method: 'GET',
    url: 'https://raw.githubusercontent.com/Cosmic-Chatter/Exhibitera/main/exhibitera/changelog.md',
    endpoint: '',
    api: '',
    rawResponse: true
  })

  const markdownConverter = new showdown.Converter({ headerLevelStart: 4.0 })
  markdownConverter.setFlavor('github')

  const formattedText = markdownConverter.makeHtml(changelog)
  document.getElementById('updateInfoModalChangelogContainer').innerHTML = formattedText

  const appsInstructions = document.getElementById('updateInfoModalAppsInstructions')
  const hubInstructions = document.getElementById('updateInfoModalHubInstructions')
  if (kind === 'hub') {
    appsInstructions.style.display = 'none'
    hubInstructions.style.display = 'block'
  } else {
    appsInstructions.style.display = 'block'
    hubInstructions.style.display = 'none'
  }

  exUtilities.showModal('#updateInfoModal')
}

export function createNotification (componentUUID, message, type = 'info', notificaitonUUID = null) {
  // Create a notificaiton and add it to hubConfig.notifications
  // `type` should be one of ['error', 'warning', 'info']

  if (!notificaitonUUID) notificaitonUUID = exUtilities.uuid()

  const notificaiton = {
    message,
    type,
    uuid: notificaitonUUID
  }
  const componentNotifications = hubConfig.notifications?.[componentUUID] ?? {}
  componentNotifications[notificaitonUUID] = notificaiton
  hubConfig.notifications[componentUUID] = componentNotifications
}

export function clearNotifications () {
  // Clear all stored notifications

  hubConfig.notifications = {}
  rebuildNotificationList()
}

export function clearComponentNotifications (componentUUID) {
  // Clear all stored notifications for the given component

  delete hubConfig.notifications[componentUUID]
  rebuildNotificationList()
}

export function clearNotification (componentUUID, notificaitonUUID) {
  // Clear the given notification

  delete hubConfig.notifications[componentUUID][notificaitonUUID]
  rebuildNotificationList()
}

export function rebuildNotificationList () {
  // Use hubConfig.notifications to build a set of buttons indicating
  // that there is a notification from a component.

  const notificationsCol = document.getElementById('notificationsDropdownCol')
  const dropdownButton = document.getElementById('notificationsDropdownButton')
  const notificationDisplayRow = document.getElementById('notificationDisplayRow')
  const componentsWithNotifications = Object.keys(hubConfig.notifications)

  // Clear the existing buttons
  document.getElementById('notificationDisplayRow').innerHTML = ''

  let notificationCount = 0
  let worstType = 'info'

  for (const componentUUID of componentsWithNotifications) {
    // Iterate through the items in the hubConfig.notifications. Each item should correspond
    // to one component with an notification.

    const component = getExhibitComponent(componentUUID)
    const componentName = component?.id ?? 'Hub'

    for (const notificationUUID of Object.keys(hubConfig.notifications[componentUUID])) {
      // Then, iterate through the notifications on the component

      notificationCount += 1
      let notificationEl

      if (notificationUUID === 'software_update') {
        if (componentUUID === 'hub') {
          notificationEl = createNotificationHTML({
            message: 'Software update available',
            type: 'info'
          }, 'Hub')
          notificationEl.addEventListener('click', () => { showUpdateInfoModal('Hub', 'hub', hubConfig.notifications.hub.software_update) })
        } else {
          const labelName = 'Software update available'
          notificationEl = createNotificationHTML({
            message: labelName,
            type: 'info'
          }, componentName)
          notificationEl.addEventListener('click', () => { showUpdateInfoModal(componentName, 'apps', hubConfig.notifications[componentUUID].software_update) })
        }
      } else if (notificationUUID === 'outdated_os') {
        if (worstType === 'info') worstType = 'warning'
        let labelName

        if (componentUUID === 'hub') {
          labelName = 'This OS may not be supported in the next version of Exhibitera.'
        } else {
          labelName = 'This OS may not be supported in the next version of Exhibitera.'
        }

        notificationEl = createNotificationHTML({
          message: labelName,
          type: 'warning'
        }, componentName)
      } else {
        // Create and add the button

        const notification = (hubConfig.notifications[componentUUID])[notificationUUID]
        notificationEl = createNotificationHTML(notification, componentName)

        if (notification.type === 'error') {
          worstType = 'error'
        } else if ((notification.type === 'warning') && (worstType === 'info')) {
          worstType = 'warning'
        }
      }
      notificationDisplayRow.appendChild(notificationEl)
    }
  }

  // Recolor the dropdown to red to indicate the worst notification type
  if (worstType === 'error') {
    dropdownButton.classList.remove('btn-info')
    dropdownButton.classList.remove('btn-warning')
    dropdownButton.classList.add('btn-danger')
  } else if (worstType === 'warning') {
    dropdownButton.classList.remove('btn-info')
    dropdownButton.classList.remove('btn-danger')
    dropdownButton.classList.add('btn-warning')
  } else {
    dropdownButton.classList.add('btn-info')
    dropdownButton.classList.remove('btn-danger')
    dropdownButton.classList.remove('btn-warning')
  }

  // Show/hide the dropdown
  if (notificationCount > 0) {
    notificationsCol.style.display = 'block'
  } else {
    notificationsCol.style.display = 'none'
  }
}

function createNotificationHTML (notificaiton, componentName) {
  // Create and return a DOM element representing a notification.

  const colorClass = {
    error: 'btn-danger',
    info: 'btn-info',
    warning: 'btn-warning'
  }[notificaiton.type] ?? 'btn-info'

  const li = document.createElement('li')
  li.classList = 'dropdown-item'
  li.innerHTML = `<button class="btn btn-block ${colorClass}">${componentName}: ${notificaiton.message}</button>`

  return li
}

export function getGroupName (uuid) {
  // Return the name of a group given its UUID.

  for (const group of hubConfig.groups) {
    if (group.uuid === uuid) return group.name
  }
  return uuid
}

export function sortComponentsByGroup () {
  // Return an object where the keys are group names and values are the list
  // of components matching that group

  const result = {}

  for (const component of hubConfig.exhibitComponents) {
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
    hubConfig.componentGroups.sort((a, b) => {
      const aName = getGroupName(a.group).toLowerCase()
      const bName = getGroupName(b.group).toLowerCase()
      return aName.localeCompare(bName)
    })
  } else if (method === 'status') {
    hubConfig.componentGroups.sort((a, b) => {
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
  const index = hubConfig.componentGroups.findIndex(obj => obj.group === 'Default')
  if (index > -1) {
    const [item] = hubConfig.componentGroups.splice(index, 1)
    hubConfig.componentGroups.unshift(item)
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

  return hubConfig.exhibitComponents.sort(
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

  if (Object.keys(hubConfig.user).length === 0) return false

  if (action !== 'components') {
    if (neededLevel === 'none') return true
    if (action in hubConfig.user.permissions === false) return false

    const allowedLevel = hubConfig.user.permissions[action]
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
      if (hubConfig.user.permissions.components.edit.includes('__all')) return true
      if ((group != null) && hubConfig.user.permissions.components.edit.includes(group)) return true
      return false
    }
    if (neededLevel === 'view') {
      if (hubConfig.user.permissions.components.edit.includes('__all')) return true
      if (hubConfig.user.permissions.components.view.includes('__all')) return true
      if ((group != null) && (hubConfig.user.permissions.components.edit.includes(group) || (hubConfig.user.permissions.components.view.includes(group)))) return true
      return false
    }
  }
  return false
}

export function getUserDisplayName (uuid) {
  // Return the display name for a user or the uuid if the name cannot be resolved.

  return new Promise(function (resolve, reject) {
  // First, check the cache
    if (hubConfig.usersDisplayNameCache[uuid] !== undefined) {
      resolve(hubConfig.usersDisplayNameCache[uuid])
    }
    makeServerRequest({
      method: 'GET',
      endpoint: `/user/${uuid}/displayName`
    })
      .then((response) => {
        if (response.success === true) {
          hubConfig.usersDisplayNameCache[uuid] = response.display_name
          resolve(response.display_name)
        } else {
          resolve(uuid)
        }
      })
  })
}

export function getExhibitComponent (uuid) {
  // Search the exhibitComponents list for a given uuid and return the component

  const result = hubConfig.exhibitComponents.find(obj => {
    return obj.uuid === uuid
  })
  return result
}

export function getExhibitComponentGroup (group) {
  // Function to search the componentGroups list for a given group id

  const result = hubConfig.componentGroups.find(obj => {
    return obj.group === group
  })
  return result
}

export function getGroup (uuid) {
  // Search the groups list for a given uuid and return the corresponding group.

  const result = hubConfig.groups.find(obj => {
    return obj.uuid === uuid
  })
  return result
}

export function getExhibit (uuid) {
  // Search the exhibit list for a given uuid and return the corresponding exhibit.

  const result = hubConfig.availableExhibits.find(obj => {
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
