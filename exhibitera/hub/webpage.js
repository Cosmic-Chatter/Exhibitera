/* global bootstrap, showdown */

import exConfig from './config.js'
import * as exExhibit from './exhibitera_exhibit.js'
import * as exGroup from './exhibitera_group.js'
import * as exIssues from './exhibitera_issues.js'
import * as exMaintenance from './exhibitera_maintenance.js'
import * as exProjector from './exhibitera_projector.js'
import * as exSchedule from './exhibitera_schedule.js'
import * as exTools from './exhibitera_tools.js'
import * as exTracker from './exhibitera_tracker.js'
import * as exUsers from './exhibitera_users.js'

function showManageExhibitsModal () {
  // Configure the manageExhibitsModal and show it.

  document.getElementById('manageExhibitModalExhibitThumbnailCheckbox').checked = true
  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/exhibit/getAvailable'
  })
    .then((result) => {
      populateManageExhibitsExhibitList(result.available_exhibits)
      $('#manageExhibitsModal').modal('show')
    })
}

function populateManageExhibitsExhibitList (exhibits) {
  // Take a list of exhibits and create a GUI representation for each

  const exhibitRow = document.getElementById('manageExhibitsModalExhibitList')
  exhibitRow.innerHTML = ''

  exhibits.forEach((exhibit) => {
    const col = document.createElement('div')
    col.classList = 'col-12 mt-2'
    exhibitRow.appendChild(col)

    const button = document.createElement('button')
    button.classList = 'btn btn-info w-100 manageExhibitListButton'
    button.innerHTML = exhibit
    button.addEventListener('click', (event) => {
      Array.from(exhibitRow.querySelectorAll('.manageExhibitListButton')).forEach((el) => {
        el.classList.replace('btn-success', 'btn-info')
      })
      event.target.classList.replace('btn-info', 'btn-success')
      populateManageExhibitsExhibitContent(exhibit)
    })
    col.appendChild(button)
  })
}

function populateManageExhibitsExhibitContent (exhibit) {
  // Create a GUI representation of the given exhibit that shows the defintion for each component.

  const contentList = document.getElementById('manageExhibitsModalExhibitContentList')
  contentList.innerHTML = ''
  document.getElementById('manageExhibitModalExhibitNameInput').value = exhibit

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibit/getDetails',
    params: { name: exhibit }
  })
    .then((result) => {
      result.exhibit.forEach((component) => {
        const col = document.createElement('div')
        col.classList = 'col-6 mt-2'
        contentList.appendChild(col)

        const row = document.createElement('div')
        row.classList = 'row px-1'
        col.appendChild(row)

        const header = document.createElement('div')
        header.classList = 'col-12 bg-primary rounded-top text-light py-1'
        header.innerHTML = component.id
        row.appendChild(header)

        const body = document.createElement('div')
        body.classList = 'col-12 bg-secondary rounded-bottom py-2'
        row.appendChild(body)

        const bodyRow = document.createElement('div')
        bodyRow.classList = 'row gy-2'
        body.appendChild(bodyRow)

        const componentObj = exExhibit.getExhibitComponent(component.id)

        if (componentObj != null) {
          // This component is active

          const definitionPreviewCol = document.createElement('div')
          definitionPreviewCol.classList = 'col-12 exhibit-thumbnail'
          bodyRow.appendChild(definitionPreviewCol)

          const definitionPreviewImage = document.createElement('img')
          definitionPreviewImage.style.width = '100%'
          definitionPreviewImage.style.height = '100px'
          definitionPreviewImage.style.objectFit = 'contain'
          definitionPreviewCol.appendChild(definitionPreviewImage)

          const definitionPreviewVideo = document.createElement('video')
          definitionPreviewVideo.setAttribute('autoplay', true)
          definitionPreviewVideo.muted = 'true'
          definitionPreviewVideo.setAttribute('loop', 'true')
          definitionPreviewVideo.setAttribute('playsinline', 'true')
          definitionPreviewVideo.setAttribute('webkit-playsinline', 'true')
          definitionPreviewVideo.setAttribute('disablePictureInPicture', 'true')
          definitionPreviewVideo.style.width = '100%'
          definitionPreviewVideo.style.height = '100px'
          definitionPreviewVideo.style.objectFit = 'contain'
          definitionPreviewCol.appendChild(definitionPreviewVideo)

          const definitionSelectCol = document.createElement('div')
          definitionSelectCol.classList = 'col-12'
          bodyRow.appendChild(definitionSelectCol)

          const definitionSelect = document.createElement('select')
          definitionSelect.classList = 'form-select'
          definitionSelectCol.appendChild(definitionSelect)

          exTools.makeRequest({
            method: 'GET',
            url: componentObj.getHelperURL(),
            endpoint: '/getAvailableContent'
          })
            .then((availableContent) => {
              // Build an option for each definition
              const appDict = exTools.sortDefinitionsByApp(availableContent.definitions)
              Object.keys(appDict).sort().forEach((app) => {
                const header = new Option(exExhibit.convertAppIDtoDisplayName(app))
                header.setAttribute('disabled', true)
                definitionSelect.appendChild(header)

                appDict[app].forEach((def) => {
                  const option = new Option(def.name, def.uuid)
                  definitionSelect.appendChild(option)
                })
              })

              const changeThumb = function () {
                if (availableContent.thumbnails.includes(definitionSelect.value + '.mp4')) {
                  definitionPreviewVideo.src = componentObj.getHelperURL() + '/thumbnails/' + definitionSelect.value + '.mp4'
                  definitionPreviewVideo.play()
                  definitionPreviewImage.style.display = 'none'
                  definitionPreviewVideo.style.display = 'block'
                } else if (availableContent.thumbnails.includes(definitionSelect.value + '.jpg')) {
                  definitionPreviewImage.src = componentObj.getHelperURL() + '/thumbnails/' + definitionSelect.value + '.jpg'
                  definitionPreviewVideo.style.display = 'none'
                  definitionPreviewImage.style.display = 'block'
                } else {
                  definitionPreviewVideo.style.display = 'none'
                  definitionPreviewImage.style.display = 'none'
                }
              }

              definitionSelect.addEventListener('change', changeThumb)
              definitionSelect.value = component.definition
              changeThumb()
            })
        } else {
          // This component is inactive

          const badComponentCol = document.createElement('div')
          badComponentCol.classList = 'col-12 text-warning fst-italic text-center'
          badComponentCol.innerHTML = 'Component unavailable'
          bodyRow.appendChild(badComponentCol)
        }
      })
    })
}

function onManageExhibitModalThumbnailCheckboxChange () {
  // Get the value of the checkbox and show/hide the definition
  // tbumbnails as appropriate.

  const checked = document.getElementById('manageExhibitModalExhibitThumbnailCheckbox').checked
  document.querySelectorAll('.exhibit-thumbnail').forEach((el) => {
    if (checked) {
      el.style.display = 'block'
    } else {
      el.style.display = 'none'
    }
  })
}

function setCurrentExhibitName (name) {
  exConfig.currentExhibit = name
  document.getElementById('exhibitNameField').innerHTML = name

  // Don't change the value of the exhibit selector if we're currently
  // looking at the change confirmation modal, as this will result in
  // submitting the incorrect value
  if ($('#changeExhibitModal').hasClass('show') === false) {
    $('#exhibitSelect').val(name)
  }
}

function updateAvailableExhibits (exhibitList) {
  // Rebuild the list of available exhibits on the settings tab

  const exhibitSelect = document.getElementById('exhibitSelect')
  const exhibitDeleteSelect = document.getElementById('exhibitDeleteSelector')

  const sortedExhibitList = exhibitList.sort((a, b) => {
    const aVal = a.toLowerCase()
    const bVal = b.toLowerCase()
    if (aVal > bVal) return 1
    if (aVal < bVal) return -1
    return 0
  })
  if (exTools.arraysEqual(sortedExhibitList, exConfig.availableExhibits) === true) {
    return
  }

  exConfig.availableExhibits = sortedExhibitList
  exhibitSelect.innerHTML = ''
  exhibitDeleteSelect.innerHTML = ''

  sortedExhibitList.forEach((exhibit) => {
    exhibitSelect.appendChild(new Option(exhibit, exhibit))
    exhibitDeleteSelect.appendChild(new Option(exhibit, exhibit))
  })

  exhibitSelect.value = exConfig.currentExhibit
  checkDeleteSelection()
}

function changeExhibit (warningShown) {
  // Send a command to Hub to change the current exhibit

  if (warningShown === false) {
    $('#changeExhibitModal').modal('show')
  } else {
    $('#changeExhibitModal').modal('hide')

    const requestDict = {
      exhibit: {
        name: $('#exhibitSelect').val()
      }
    }

    exTools.makeServerRequest({
      method: 'POST',
      endpoint: '/exhibit/set',
      params: requestDict
    })
    // .then(askForUpdate)
  }
}

function parseUpdate (update) {
  // Take a dictionary of updates from Hub and act on them.

  if ('gallery' in update) {
    setCurrentExhibitName(update.gallery.current_exhibit)
    updateAvailableExhibits(update.gallery.availableExhibits)

    if ('galleryName' in update.gallery) {
      document.getElementById('galleryNameField').innerHTML = update.gallery.galleryName
      document.title = update.gallery.galleryName
    }

    if ('updateAvailable' in update.gallery) {
      if (update.gallery.updateAvailable === 'true') {
        const notification = {
          update_available: true,
          current_version: update.gallery.softwareVersion,
          available_version: update.gallery.softwareVersionAvailable
        }
        exConfig.errorDict.__control_server = {
          software_update: notification
        }
        exTools.rebuildNotificationList()
      }
    }
  }

  if ('groups' in update) {
    // Check if the list of groups has changed.

    const updateDate = new Date(update.groups.last_update_date)
    const currentGroupsDate = new Date(exConfig.groupLastUpdateDate)

    if (updateDate > currentGroupsDate) {
      exConfig.groupLastUpdateDate = update.groups.last_update_date
      exConfig.groups = update.groups.group_list
      exGroup.populateGroupsRow()
    }
  }

  if ('components' in update) {
    let numComps = 0
    let numOnline = 0
    let numStatic = 0

    exExhibit.checkForRemovedComponents(update.components)
    update.components.forEach((component) => {
      numComps += 1
      if ((component.status === exConfig.STATUS.ONLINE.name) || (component.status === exConfig.STATUS.STANDBY.name) || (component.status === exConfig.STATUS['SYSTEM ON'].name) || (component.status === exConfig.STATUS.STATIC.name)) {
        numOnline += 1
      }
      if (component.status === exConfig.STATUS.STATIC.name) {
        numStatic += 1
      }
      exExhibit.updateComponentFromServer(component)
    })

    // Set the favicon to reflect the aggregate status
    if (numOnline === numComps) {
      $("link[rel='icon']").attr('href', 'icon/green.ico')
    } else if (numOnline === 0) {
      $("link[rel='icon']").attr('href', 'icon/red.ico')
    } else {
      $("link[rel='icon']").attr('href', 'icon/yellow.ico')
    }
    // If there are no static components, hide the "SHow STATIC" button
    if (numStatic === 0) {
      $('#componentsTabSettingsShowStatic').parent().parent().hide()
      document.getElementById('componentsTabSettingsShowStaticDivider').parentElement.style.display = 'none'
    } else {
      $('#componentsTabSettingsShowStatic').parent().parent().show()
      document.getElementById('componentsTabSettingsShowStaticDivider').parentElement.style.display = 'block'
    }
  }

  if ('issues' in update) {
    // Check for the time of the most recent update. If it is more
    // recent than our existing date, rebuild the issue list

    const currentLastDate = Math.max.apply(Math, exConfig.issueList.map(function (o) { return new Date(o.lastUpdateDate) }))
    const updatedDate = new Date(update.issues.lastUpdateDate)

    if (updatedDate > currentLastDate) {
      exConfig.issueList = update.issues.issueList
      // exIssues.rebuildIssueList()
      exIssues.upateIssueList()
      exIssues.rebuildIssueFilters()
    }
  }

  // Schedule should be after components
  if ('schedule' in update) {
    if (exConfig.scheduleUpdateTime !== update.schedule.updateTime) {
      exSchedule.populateSchedule(update.schedule)
    }
  }
}

function populateHelpTab () {
  // Ask the server to send the latest README, convert the Markdown to
  // HTML, and add it to the Help tab.

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/getHelpText'
  })
    .then((result) => {
      if (result.success === true) {
        const markdownConverter = new showdown.Converter()
        markdownConverter.setFlavor('github')

        const formattedText = markdownConverter.makeHtml(result.text)
        $('#helpTextDiv').html(formattedText)
      } else {
        $('#helpTextDiv').html('Help text not available.')
      }
    })
}

function createExhibit (name, cloneFrom) {
  // Ask Hub to create a new exhibit with the given name.
  // set cloneFrom = null if we are making a new exhibit from scratch.
  // set cloneFrom to the name of an existing exhibit to copy that exhibit

  const requestDict = {
    exhibit: {
      name
    }
  }

  if (cloneFrom != null && cloneFrom !== '') {
    requestDict.clone_from = cloneFrom
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibit/create',
    params: requestDict
  })
}

function deleteExhibit (name) {
  // Ask Hub to delete the exhibit with the given name.

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibit/delete',
    params: { exhibit: { name } }
  })
}

function checkDeleteSelection () {
  // Make sure the selected option is not hte current one.

  if ($('#exhibitSelect').val() === $('#exhibitDeleteSelector').val()) {
    $('#exhibitDeleteSelectorButton').prop('disabled', true)
    $('#exhibitDeleteSelectorWarning').show()
  } else {
    $('#exhibitDeleteSelectorButton').prop('disabled', false)
    $('#exhibitDeleteSelectorWarning').hide()
  }
}

function showExhibitDeleteModal () {
  $('#deleteExhibitModal').modal('show')
}

function deleteExhibitFromModal () {
  // Take the info from the selector and delete the correct exhibit

  deleteExhibit($('#exhibitDeleteSelector').val())
  $('#deleteExhibitModal').modal('hide')
}

function populateControlServerSettings () {
  // Get the latest system settings from Hub and build out the interface for changing them.

  // Hide warnings and buttons
  document.getElementById('controlServerSettingsIPWarning').style.display = 'none'
  document.getElementById('controlServerSettingsPortWarning').style.display = 'none'
  document.getElementById('controlServerSettingsSaveButton').style.display = 'none'

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/system/getConfiguration'
  })
    .then((result) => {
      const config = result.configuration

      document.getElementById('controlServerSettingsIPAddress').value = config.ip_address
      document.getElementById('controlServerSettingsPort').value = config.port
      document.getElementById('controlServerSettingsGalleryName').value = config.gallery_name
      document.getElementById('controlServerSettingsDebugMode').value = config.debug
    })
}

function updateSystemConfiguration () {
  // Update the system configuration

  const update = {
    ip_address: document.getElementById('controlServerSettingsIPAddress').value.trim(),
    port: parseInt(document.getElementById('controlServerSettingsPort').value),
    gallery_name: document.getElementById('controlServerSettingsGalleryName').value.trim(),
    debug: exTools.stringToBool(document.getElementById('controlServerSettingsDebugMode').value)
  }

  // Check that fields are properly filled out
  if (update.ip_address === '') {
    document.getElementById('controlServerSettingsIPWarning').style.display = 'block'
    return
  } else {
    document.getElementById('controlServerSettingsIPWarning').style.display = 'none'
  }
  if (isNaN(update.port)) {
    document.getElementById('controlServerSettingsPortWarning').style.display = 'block'
    return
  } else {
    document.getElementById('controlServerSettingsPortWarning').style.display = 'none'
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/system/system/updateConfiguration',
    params: {
      configuration: update
    }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        document.getElementById('controlServerSettingsSaveButton').style.display = 'none'
      }
    })
}

function loadVersion () {
  // Load version.txt and update the GUI with the current version

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/version.txt',
    rawResponse: true
  })
    .then((response) => {
      $('#versionSpan').html(response)
    })
}

// Bind event listeners

// Login
document.getElementById('loginSubmitButton').addEventListener('click', exUsers.loginFromDropdown)
document.getElementById('logoutButton').addEventListener('click', exUsers.logoutUser)
document.getElementById('viewUserPreferencesModalButton').addEventListener('click', exUsers.showUserPreferenceModal)
document.getElementById('userPreferencesModalSaveButton').addEventListener('click', exUsers.submitUserPreferencesFromModal)
document.getElementById('changePasswordButton').addEventListener('click', exUsers.showPasswordChangeModal)
document.getElementById('passwordChangeModalSubmitButton').addEventListener('click', exUsers.submitUserPasswordChange)

// Components tab
// =========================
document.getElementById('componentsTabSettingsLayoutSelect').addEventListener('change', () => {
  // Update user preference
  exUsers.updateUserPreferences({ components_layout: document.getElementById('componentsTabSettingsLayoutSelect').value })
    .then(() => {
      // Rebuild the interface with the new option
      exExhibit.rebuildComponentInterface()
    })
})
document.getElementById('componentsTabSettingsSizeSelect').addEventListener('change', () => {
  // Update user preference
  exUsers.updateUserPreferences({ components_size: document.getElementById('componentsTabSettingsSizeSelect').value })
    .then(() => {
      // Rebuild the interface with the new option
      exExhibit.rebuildComponentInterface()
    })
})
document.getElementById('componentsTabSettingsShowStatic').addEventListener('change', () => {
  // Update user preference
  exUsers.updateUserPreferences({ show_static: document.getElementById('componentsTabSettingsShowStatic').checked })
    .then(() => {
      // Rebuild the interface with the new option
      exExhibit.rebuildComponentInterface()
    })
})

Array.from(document.getElementsByClassName('view-mode-radio')).forEach((el) => {
  el.addEventListener('change', () => {
    let mode
    if (document.getElementById('componentStatusModeRealtimeCheckbox').checked === true) {
      // Set real-time mode (default)
      mode = 'realtime'
    } else {
      // Set maintenance status mode
      mode = 'maintenance'
    }
    exUsers.updateUserPreferences({ status_mode: mode })
      .then(exExhibit.rebuildComponentInterface)
  })
})

document.getElementById('showHideGroupsModalShowButton').addEventListener('click', exExhibit.configureVisibleGroups)
document.getElementById('showHideGroupsModalSaveButton').addEventListener('click', exExhibit.updateVisibleGroupsPreference)

document.getElementById('showAddStaticComponentModalButton').addEventListener('click', exExhibit.showAddStaticComponentsModal)
document.getElementById('addStaticComponentModalAddButton').addEventListener('click', exExhibit.submitStaticComponentAdditionFromModal)
document.getElementById('showAddProjetorModalButton').addEventListener('click', exProjector.showAddProjectorModal)
document.getElementById('addProjectorModalAddButton').addEventListener('click', exProjector.submitProjectorAdditionFromModal)
document.getElementById('showAddWakeOnLANModalButton').addEventListener('click', exExhibit.showAddWakeOnLANModal)
document.getElementById('addWakeOnLANModalAddButton').addEventListener('click', exExhibit.submitWakeOnLANAdditionFromModal)

// Component info modal
$('#componentInfoModalRemoveComponentButton').click(exExhibit.removeExhibitComponentFromModal)
$('#componentInfoModalMaintenanceSaveButton').click(function () {
  exMaintenance.submitComponentMaintenanceStatusChange('component')
})
$('#componentInfoModalMaintenanceStatusSelector').change(function () {
  $('#componentInfoModalMaintenanceSaveButton').show()
})
document.getElementById('componentInfoModalBasicSettingsSaveButton').addEventListener('click', exExhibit.submitComponentBasicSettingsChange)
Array.from(document.querySelectorAll('.componentInfoBasicSetting')).forEach((el) => {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalBasicSettingsSaveButton').style.display = 'block'
  })
})
$('.componentInfoSetting').change(function () {
  $('#componentInfoModalSettingsSaveButton').show()
})
$('#componentInfoModalSettingsSaveButton').click(exExhibit.submitComponentSettingsChange)
document.getElementById('definitionTabAppFilterSelect').addEventListener('change', (event) => {
  exExhibit.filterDefinitionListByApp()
})
document.getElementById('definitionTabThumbnailsCheckbox').addEventListener('change', (event) => {
  exExhibit.onDefinitionTabThumbnailsCheckboxChange()
})
document.getElementById('componentInfoModalDefinitionSaveButton').addEventListener('click', exExhibit.submitDefinitionSelectionFromModal)

document.getElementById('componentInfoModalViewScreenshot').addEventListener('click', () => {
  const component = exExhibit.getExhibitComponent(document.getElementById('componentInfoModal').getAttribute('data-id'))
  exTools.openMediaInNewTab([component.getHelperURL() + '/system/getScreenshot'], ['image'])
})
document.getElementById('componentInfoModalEditDMXButton').addEventListener('click', (event) => {
  const component = exExhibit.getExhibitComponent(document.getElementById('componentInfoModal').getAttribute('data-id'))
  window.open(component.getHelperURL() + '/dmx_control.html?standalone=true', '_blank').focus()
})
Array.from(document.querySelectorAll('.componentInfoProjectorSetting')).forEach((el) => {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalProjectorSettingsSaveButton').style.display = 'block'
  })
})
document.getElementById('componentInfoModalProjectorSettingsSaveButton').addEventListener('click', exExhibit.updateProjectorFromInfoModal)
Array.from(document.querySelectorAll('.componentInfoStaticSetting')).forEach((el) => {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalStaticSettingsSaveButton').style.display = 'block'
  })
})
document.getElementById('componentInfoModalStaticSettingsSaveButton').addEventListener('click', exExhibit.updateStaticComponentFromInfoModal)
Array.from(document.querySelectorAll('.componentInfoWakeOnLANSetting')).forEach((el) => {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').style.display = 'block'
  })
})
document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').addEventListener('click', exExhibit.updateWakeOnLANComponentFromInfoModal)

// Copy definition modal
document.getElementById('copyDefinitionModalSubmitButton').addEventListener('click', exExhibit.copyDefinitionModalPerformCopy)

// Schedule tab
// =========================
document.getElementById('manageFutureDateButton').addEventListener('click', exSchedule.showManageFutureDateModal)
document.getElementById('manageFutureDateCalendarInput').addEventListener('change', exSchedule.populateFutureDateCalendarInput)
document.getElementById('manageFutureDateAddActionButton').addEventListener('click', (event) => {
  const scheduleName = document.getElementById('manageFutureDateCalendarInput').value
  exSchedule.scheduleConfigureEditModal(scheduleName, 'date-specific')
})
document.getElementById('manageFutureDateCreateScheduleButton').addEventListener('click', exSchedule.convertFutureScheduleFromModal)
document.getElementById('manageFutureDateDeleteScheduleButton').addEventListener('click', (event) => {
  event.target.focus()
})
// Create schedule from file modal
document.getElementById('showScheduleFromFileModalButton').addEventListener('click', exSchedule.showScheduleFromFileModal)
document.getElementById('scheduleFromFileModalFileInput').addEventListener('change', exSchedule.onScheduleFromFileModalFileInputChange)
document.getElementById('scheduleFromFileModalUploadButton').addEventListener('click', exSchedule.previewScheduleFromFile)
document.getElementById('scheduleFromFileKindSelect').addEventListener('change', exSchedule.onCreateScheduleFromFileTypeSelect)
document.getElementById('scheduleFromFileDateSelect').addEventListener('change', exSchedule.onscheduleFromFileDateSelectChange)
document.getElementById('scheduleFromFileModalSubmitButton').addEventListener('click', exSchedule.createScheduleFromFile)

$('#scheduleEditDeleteActionButton').click(exSchedule.scheduleDeleteActionFromModal)
$('#scheduleEditSubmitButton').click(exSchedule.sendScheduleUpdateFromModal)
$('#scheduleActionSelector').change(() => {
  exSchedule.setScheduleActionTargetSelector()
}
)
$('#scheduleTargetSelector').change(() => {
  exSchedule.setScheduleActionValueSelector()
})
// This event detects when the delete button has been clicked inside a popover to delete a date-specific schedule.
document.addEventListener('click', (event) => {
  if (event.target.classList.contains('schedule-delete') === false) return
  if ($('#manageFutureDateModal').hasClass('show')) {
    // This popover is from the future dates edit modal
    exSchedule.deleteSchedule(document.getElementById('manageFutureDateCalendarInput').value)
  } else {
    // This popover is from the main schedule page
    exSchedule.deleteSchedule(event.target.getAttribute('id').slice(7))
  }
})

// Exhibits tab
// =========================
// document.getElementById('manageExhibitsButton').addEventListener('click', showManageExhibitsModal)
$('#exhibitSelect').change(function () {
  changeExhibit(false)
})
$('#exhibitDeleteSelector').change(checkDeleteSelection)
$('#createExhibitButton').click(function () {
  createExhibit($('#createExhibitNameInput').val(), null)
  $('#createExhibitNameInput').val('')
})
$('#cloneExhibitButton').click(function () {
  createExhibit($('#createExhibitNameInput').val(), $('#exhibitSelect').val())
  $('#createExhibitNameInput').val('')
})
$('#exhibitChangeConfirmationButton').click(function () {
  changeExhibit(true)
})
$('#deleteExhibitButton').click(deleteExhibitFromModal)
$('#exhibitDeleteSelectorButton').click(showExhibitDeleteModal)
document.getElementById('manageExhibitModalExhibitThumbnailCheckbox').addEventListener('change', onManageExhibitModalThumbnailCheckboxChange)

// Maintenance tab
// =========================
// This event detects when the delete button has been clicked inside a popover
document.addEventListener('click', (event) => {
  const id = event.target.getAttribute('id')
  if (id === 'issueMediaDeleteButtonConfirmation') {
    const file = document.getElementById('issueMediaViewFromModalSelect').value
    exIssues.issueMediaDelete([file])
  } else if (id === 'editUserDeleteButtonConfirmation') {
    const user = document.getElementById('editUserModal').getAttribute('data-uuid')
    exUsers.deleteUser(user)
  }
})
document.getElementById('issueModifyModalDeleteButton').addEventListener('click', () => {
  const id = document.getElementById('issueModifyModal').getAttribute('data-id')
  exIssues.modifyIssue(id, 'delete')
  $('#issueModifyModal').modal('hide')
})
document.getElementById('issueModifyModalArchiveButton').addEventListener('click', () => {
  const id = document.getElementById('issueModifyModal').getAttribute('data-id')
  exIssues.modifyIssue(id, 'archive')
  $('#issueModifyModal').modal('hide')
})
$('#issueMediaViewFromModal').click(function () {
  const file = document.getElementById('issueMediaViewFromModalSelect').value
  exTools.openMediaInNewTab(['issues/media/' + file])
})
$('#issueMediaUploadSubmitButton').click(exIssues.uploadIssueMediaFile)
$('#issueMediaUpload').change(exIssues.onIssueMediaUploadChange)
$('#issueEditSubmitButton').click(exIssues.submitIssueFromModal)
$('#createIssueButton').click(function () {
  exIssues.showIssueEditModal('new')
})
document.getElementById('viewIssueArchiveButton').addEventListener('click', () => {
  exIssues.showArchivedIssuesModal()
})
$('#issueListFilterPrioritySelect').change(function () {
  exIssues.rebuildIssueList()
})
$('#issueListFilterAssignedToSelect').change(function () {
  exIssues.rebuildIssueList()
})
$('#componentInfoModalMaintenanceNote').on('input', function () {
  $('#componentInfoModalMaintenanceSaveButton').show()
})

// Analytics tab
// =========================
document.getElementById('createTrackerTemplateButton').addEventListener('click', () => {
  exTracker.createTrackerTemplate()
})
document.getElementById('launchTrackerButton').addEventListener('click', exTracker.launchTracker)
document.getElementById('showEditTrackerTemplateButton').addEventListener('click', () => {
  exTracker.showEditTrackerTemplateModal()
})
document.getElementById('deleteTrackerTemplateButton').addEventListener('click', () => {
  const trackerTemplateSelect = document.getElementById('trackerTemplateSelect')
  const name = trackerTemplateSelect.options[trackerTemplateSelect.selectedIndex].text
  document.getElementById('deleteTrackerTemplateModalTemplateName').innerHTML = name
  $('#deleteTrackerTemplateModal').modal('show')
})
document.getElementById('deleteTrackerTemplateFromModalButton')
  .addEventListener('click', () => exTracker.deleteTrackerTemplate())
document.getElementById('getAvailableTrackerDataButton')
  .addEventListener('click', () => exTracker.getAvailableTrackerData(exTracker.populateTrackerDataSelect))
document.getElementById('downloadTrackerDataButton')
  .addEventListener('click', () => exTracker.downloadTrackerData(document.getElementById('trackerDataSelect').value))
document.getElementById('showDeleteTrackerDataModalButton')
  .addEventListener('click', () => exTracker.showDeleteTrackerDataModal())
document.getElementById('deleteTrackerDataFromModalButton')
  .addEventListener('click', () => exTracker.deleteTrackerDataFromModal())
document.getElementById('editTrackerTemplateModalAddCounterButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Counter', 'counter'))
document.getElementById('editTrackerTemplateModalAddDropdownButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Dropdown', 'dropdown'))
document.getElementById('editTrackerTemplateModalAddNumberButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Number', 'number'))
document.getElementById('editTrackerTemplateModalAddSliderButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Slider', 'slider'))
document.getElementById('editTrackerTemplateModalAddTextButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Text', 'text'))
document.getElementById('editTrackerTemplateModalAddTimerButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalAddWidget('New Timer', 'timer'))
document.getElementById('editTrackerTemplateModalSubmitChangesButton')
  .addEventListener('click', () => exTracker.editTrackerTemplateModalSubmitChanges())
document.getElementById('editTrackerTemplateGuestFacingCheckbox').addEventListener('change', exTracker.makeGuestFacing)

// Users tab
// =========================
document.getElementById('showEditUserModalButton').addEventListener('click', () => {
  exUsers.showEditUserModal()
})
Array.from(document.querySelectorAll('.editUserField')).forEach((el) => {
  el.addEventListener('change', () => {
    document.getElementById('editUserSubmitButton').style.display = 'block'
  })
})
document.getElementById('editUserPermissionGroups').addEventListener('change', (event) => {
  if (event.target.value === 'custom') {
    document.getElementById('editUserGroupsRow').style.display = 'flex'
  } else {
    document.getElementById('editUserGroupsRow').style.display = 'none'
  }
})
document.getElementById('editUserSubmitButton').addEventListener('click', exUsers.submitChangeFromEditUserModal)

// Settings tab
// =========================

// Groups
document.getElementById('settingsAddGroupButton').addEventListener('click', () => {
  exGroup.showEditGroupModal()
})
document.getElementById('editGroupModalSubmitButton').addEventListener('click', exGroup.submitChangeFromGroupEditModal)
document.getElementById('deleteGroupConfirmationButton').addEventListener('click', exGroup.deleteGroupFromModal)

// Server settings
Array.from(document.querySelectorAll('.controlServerSettingsInputField')).forEach((el) => {
  el.addEventListener('change', () => {
    document.getElementById('controlServerSettingsSaveButton').style.display = 'block'
  })
})
document.getElementById('controlServerSettingsSaveButton').addEventListener('click', updateSystemConfiguration)

// Activate all popovers
$(function () {
  $('[data-bs-toggle="popover"]').popover()
})

// Enable all tooltips
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

exConfig.serverAddress = location.origin

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

loadVersion()
populateHelpTab()
exUsers.populateUsers()
populateControlServerSettings()
const trackerTemplates = await exTracker.getAvailableTemplates()
exTracker.populateTrackerTemplateSelect(trackerTemplates)

exUsers.authenticateUser()
  .then(() => {
    // Subscribe to updates from Hub once we're logged in (or not)
    const eventSource = new EventSource(exConfig.serverAddress + '/system/updateStream')
    eventSource.addEventListener('update', function (event) {
      const update = JSON.parse(event.data)
      parseUpdate(update)
    })
    eventSource.addEventListener('end', function (event) {
      console.log('Handling end....')
      eventSource.close()
    })
  })
