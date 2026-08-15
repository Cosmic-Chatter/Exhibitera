import * as exUtilities from '../../../common/utilities.js'
import * as hubTools from '../tools.js'
import hubConfig from '../../config.js'

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

export function clearNotification (componentUUID, notificaitonUUID) {
  // Clear the given notification

  delete hubConfig.notifications[componentUUID][notificaitonUUID]
  rebuildNotificationList()
}

export function clearNotifications () {
  // Clear all stored notifications

  hubConfig.notifications = { hub: {} }
  rebuildNotificationList()
}

export function clearComponentNotifications (componentUUID) {
  // Clear all stored notifications for the given component

  delete hubConfig.notifications[componentUUID]
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

    const component = hubTools.getExhibitComponent(componentUUID)
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
          notificationEl.addEventListener('click', () => { hubTools.showUpdateInfoModal('Hub', 'hub', hubConfig.notifications.hub.software_update) })
        } else {
          const labelName = 'Software update available'
          notificationEl = createNotificationHTML({
            message: labelName,
            type: 'info'
          }, componentName)
          notificationEl.addEventListener('click', () => { hubTools.showUpdateInfoModal(componentName, 'apps', hubConfig.notifications[componentUUID].software_update) })
        }
      } else if (notificationUUID === 'outdated_os') {
        if (hubConfig.notifications[componentUUID].outdated_os === false) {
          notificationCount -= 1
          continue
        }

        if (worstType === 'info') worstType = 'warning'

        notificationEl = createNotificationHTML({
          message: 'This OS may not be supported in the next version of Exhibitera.',
          type: 'warning'
        }, componentName)
      } else if (notificationUUID === 'wake_on_lan_privilege') {
        if (worstType === 'info') worstType = 'warning'
        const labelName = 'Hub needs administrator priviliges for full functionality.'

        notificationEl = createNotificationHTML({
          message: labelName,
          type: 'warning'
        }, 'Hub')
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
    document.getElementById('notificationsCount').innerText = notificationCount
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
