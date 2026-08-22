/* global bootstrap */

import exConfig from '../../common/config.js'
import * as exUtilities from '../../common/utilities.js'

import hubConfig from '../config.js'
import * as hubComponents from './features/components.js'
import * as hubComponentInfo from './features/component_info_modal.js'
import * as hubExhibit from './features/exhibits.js'
import * as hubGroup from './features/groups.js'
import * as hubIssues from './features/issues.js'
import * as hubMaintenance from './features/maintenance.js'
import * as hubNotifications from './features/notifications.js'
import * as hubPrograms from './features/programs.js'
import * as hubProjector from './features/projectors.js'
import * as hubSchedule from './features/schedules.js'
import * as hubTools from './tools.js'
import * as hubTracker from './features/tracker.js'
import * as hubUsers from './features/users.js'

function parseUpdate (update) {
  // Take a dictionary of updates from Hub and act on them.

  if (update?.gallery) {
    hubConfig.currentExhibit = update.gallery.current_exhibit
    hubExhibit.updateAvailableExhibits(update.gallery.available_exhibits)
    document.getElementById('exhibitNameField').innerHTML = hubTools.getExhibit(update.gallery.current_exhibit).name

    if (update.gallery?.name) {
      document.getElementById('galleryNameField').innerHTML = update.gallery.name
      document.title = update.gallery.name
    }

    for (const key of Object.keys(update.gallery?.notifications ?? {})) {
      if (update.gallery.notifications?.[key] === true) {
        hubConfig.notifications.hub[key] = {}
        hubConfig.notifications.hub[key][key] = true
      }
    }
    hubNotifications.rebuildNotificationList()

    if (update?.gallery?.software_update?.update_available) {
      const notification = {
        update_available: true,
        current_version: update.gallery.software_version,
        available_version: update.gallery.software_version_available
      }
      hubConfig.notifications.hub.software_update = notification

      hubNotifications.rebuildNotificationList()
    }

    if (update.gallery?.outdated_os) {
      hubConfig.notifications.hub.outdated_os = { outdated_os: true }

      hubNotifications.rebuildNotificationList()
    }
    if (update.gallery?.exhibit_modified ?? false) {
      document.getElementById('exhibitModifiedButton').style.display = 'block'
    } else {
      document.getElementById('exhibitModifiedButton').style.display = 'none'
    }
  }

  if (update?.groups) {
    // Check if the list of groups has changed.

    const updateDate = new Date(update.groups.last_update_date)
    const currentGroupsDate = new Date(hubConfig.groupLastUpdateDate)

    if (updateDate > currentGroupsDate) {
      hubConfig.groupLastUpdateDate = update.groups.last_update_date
      hubConfig.groups = update.groups.group_list
      hubGroup.populateGroupsRow()
    }
  }

  if (update?.components) {
    let numComps = 0
    let numOnline = 0

    hubComponents.checkForRemovedComponents(update.components)
    for (const component of update.components) {
      numComps += 1
      if ((component.status === hubConfig.STATUS.ONLINE.name) || (component.status === hubConfig.STATUS.STANDBY.name) || (component.status === hubConfig.STATUS['SYSTEM ON'].name) || (component.status === hubConfig.STATUS.STATIC.name)) {
        numOnline += 1
      }
      hubComponents.updateComponentFromServer(component)
    }

    // Set the favicon to reflect the aggregate status
    const favicon = document.querySelector("link[rel='icon']")

    if (numOnline === numComps) {
      favicon.href = '_static/icons/green.ico'
    } else if (numOnline === 0) {
      favicon.href = '_static/icons/red.ico'
    } else {
      favicon.href = '_static/icons/yellow.ico'
    }
  }

  if (update?.issues) {
    // Check for the time of the most recent update. If it is more
    // recent than our existing date, rebuild the issue list

    const currentLastDate = Math.max.apply(Math, hubConfig.issueList.map(function (o) { return new Date(o.lastUpdateDate) }))
    const updatedDate = new Date(update.issues.lastUpdateDate)

    if (updatedDate > currentLastDate) {
      hubConfig.issueList = update.issues.issue_list
      hubIssues.upateIssueList()
      hubIssues.rebuildIssueFilters()
    }
  }

  // Schedule should be after components
  if (update?.schedule) {
    if (hubConfig.scheduleUpdateTime !== update.schedule.updateTime) {
      hubSchedule.populateSchedule(update.schedule)
    }
  }
}

function populateHubSettings () {
  // Get the latest system settings from Hub and build out the interface for changing them.

  // Hide warnings and buttons
  document.getElementById('hubSettingsIPWarning').style.display = 'none'
  document.getElementById('hubSettingsPortWarning').style.display = 'none'
  document.getElementById('hubSettingsSaveButton').style.display = 'none'

  hubTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/configuration/system'
  })
    .then((result) => {
      const config = result.configuration

      document.getElementById('hubSettingsIPAddress').value = config.ip_address
      document.getElementById('hubSettingsPort').value = config.port
      document.getElementById('hubSettingsGalleryName').value = config.gallery_name
      document.getElementById('hubSettingsDebugMode').value = config.debug
    })
}

function updateSystemConfiguration () {
  // Update the system configuration

  const update = {
    ip_address: document.getElementById('hubSettingsIPAddress').value.trim(),
    port: parseInt(document.getElementById('hubSettingsPort').value),
    gallery_name: document.getElementById('hubSettingsGalleryName').value.trim(),
    debug: exUtilities.stringToBool(document.getElementById('hubSettingsDebugMode').value)
  }

  // Check that fields are properly filled out
  if (update.ip_address === '') {
    document.getElementById('hubSettingsIPWarning').style.display = 'block'
    return
  } else {
    document.getElementById('hubSettingsIPWarning').style.display = 'none'
  }
  if (isNaN(update.port)) {
    document.getElementById('hubSettingsPortWarning').style.display = 'block'
    return
  } else {
    document.getElementById('hubSettingsPortWarning').style.display = 'none'
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/system/configuration/system/update',
    params: {
      configuration: update
    }
  })
    .then((result) => {
      if (result?.success) {
        document.getElementById('hubSettingsSaveButton').style.display = 'none'
      }
    })
}

function loadVersion () {
  // Load version and update the GUI with the current version

  hubTools.makeServerRequest({
    api: '',
    method: 'GET',
    endpoint: '/_static/semantic_version.json'
  })
    .then((response) => {
      document.getElementById('versionSpan').textContent = exUtilities.formatSemanticVersion(response.version)
    })
}

function checkNavOverflow () {
  // Move items that have overflowed the nav bar into a "More" menu

  const nav = document.getElementById('nav-tab')
  const dropdown = nav.querySelector('.id-overflow-dropdown')
  const dropdownMenu = document.getElementById('overflow-menu')
  const navItems = Array.from(nav.querySelectorAll('.nav-item:not(.id-overflow-dropdown)'))

  // Temporarily restore all items to main nav to calculate raw widths
  navItems.forEach(item => {
    const link = item.querySelector('.nav-link, .dropdown-item')
    if (link) {
      link.classList.remove('dropdown-item')
      link.classList.add('nav-link')
    }
    nav.insertBefore(item, dropdown)
  })

  dropdown.classList.add('d-none')

  const navWidth = nav.clientWidth
  let totalWidth = dropdown.offsetWidth || 80

  // Move overflowing items into the dropdown
  navItems.forEach((item) => {
    totalWidth += item.offsetWidth

    if (totalWidth > navWidth) {
      dropdown.classList.remove('d-none')

      const link = item.querySelector('.nav-link')
      if (link) {
        link.classList.remove('nav-link')
        link.classList.add('dropdown-item')
      }
      dropdownMenu.appendChild(item)
    }
  })

  // Sync active state immediately after reflow
  updateNavDropdownActiveState()
}

// Check active state inside the dropdown and update the dropdown toggle
function updateNavDropdownActiveState () {
  // If the active tab is inside the nav bar "More" dropdown, highlight it

  const dropdown = document.querySelector('.id-overflow-dropdown')
  if (!dropdown) return

  const dropdownToggle = dropdown.querySelector('.dropdown-toggle')
  // Check if any item in the dropdown menu currently has the 'active' class
  const activeDropdownItem = dropdown.querySelector('#overflow-menu .dropdown-item.active')

  if (activeDropdownItem) {
    dropdownToggle.classList.add('active')
  } else {
    dropdownToggle.classList.remove('active')
  }
}

hubNotifications.rebuildNotificationList()
hubPrograms.populatePrograms()

// ===================================
// Bind event listeners
// ===================================

// Nav bar
const navObserver = new ResizeObserver(() => checkNavOverflow())
navObserver.observe(document.getElementById('nav-tab'))

document.getElementById('nav-tab').addEventListener('shown.bs.tab', (event) => {
  // Clear lingering active state on dropdown toggle if the newly shown tab is NOT inside the dropdown
  updateNavDropdownActiveState()
})

// Login
document.getElementById('loginForm').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault() // Prevents form from reloading the page
    document.getElementById('loginSubmitButton').click() // Trigger form submission programmatically
  }
})
document.getElementById('loginSubmitButton').addEventListener('click', hubUsers.loginFromDropdown)
document.getElementById('logoutButton').addEventListener('click', hubUsers.logoutUser)
document.getElementById('viewUserPreferencesModalButton').addEventListener('click', hubUsers.showUserPreferenceModal)
document.getElementById('userPreferencesModalSaveButton').addEventListener('click', hubUsers.submitUserPreferencesFromModal)
document.getElementById('userPreferencesModalResetHintsButton').addEventListener('click', () => {
  hubUsers.updateUserPreferences({ onboarding: null })
})
document.getElementById('changePasswordButton').addEventListener('click', hubUsers.showPasswordChangeModal)
document.getElementById('passwordChangeModalSubmitButton').addEventListener('click', hubUsers.submitUserPasswordChange)

// Onboarding panes
for (const el of document.querySelectorAll('.onboarding-close')) {
  el.addEventListener('click', (ev) => {
    const name = ev.target.dataset.name
    const pref = { onboarding: {} }
    pref.onboarding[name] = false
    hubUsers.updateUserPreferences(pref)
  })
}

// Components tab
// =========================
document.getElementById('componentsTabSettingsSortSelect').addEventListener('change', () => {
  // Update user preference
  hubUsers.updateUserPreferences({ sort_order: document.getElementById('componentsTabSettingsSortSelect').value })
    .then(() => {
      // Rebuild the interface with the new option
      hubComponents.rebuildComponentInterface()
    })
})
document.getElementById('componentsTabSettingsLayoutSelect').addEventListener('change', () => {
  // Update user preference
  hubUsers.updateUserPreferences({ components_layout: document.getElementById('componentsTabSettingsLayoutSelect').value })
    .then(() => {
      // Rebuild the interface with the new option
      hubComponents.rebuildComponentInterface()
    })
})
document.getElementById('componentsTabSettingsSizeSelect').addEventListener('change', () => {
  // Update user preference
  hubUsers.updateUserPreferences({ components_size: document.getElementById('componentsTabSettingsSizeSelect').value })
    .then(() => {
      // Rebuild the interface with the new option
      hubComponents.rebuildComponentInterface()
    })
})
document.getElementById('componentsTabSettingsShowStatic').addEventListener('change', () => {
  // Update user preference
  hubUsers.updateUserPreferences({ show_static: document.getElementById('componentsTabSettingsShowStatic').checked })
    .then(() => {
      // Rebuild the interface with the new option
      hubComponents.rebuildComponentInterface()
    })
})

for (const el of document.querySelectorAll('.view-mode-radio')) {
  el.addEventListener('change', () => {
    let mode = 'maintenance'
    if (document.getElementById('componentStatusModeRealtimeCheckbox').checked) {
      mode = 'realtime'
    }
    hubUsers.updateUserPreferences({ status_mode: mode })
      .then(hubComponents.rebuildComponentInterface)
  })
}

document.getElementById('showHideGroupsModalShowButton').addEventListener('click', hubExhibit.configureVisibleGroups)
document.getElementById('showHideGroupsModalSaveButton').addEventListener('click', hubExhibit.updateVisibleGroupsPreference)

document.getElementById('showAddStaticComponentModalButton').addEventListener('click', hubExhibit.showAddStaticComponentsModal)
document.getElementById('addStaticComponentModalAddButton').addEventListener('click', hubExhibit.submitStaticComponentAdditionFromModal)
document.getElementById('showAddProjetorModalButton').addEventListener('click', hubProjector.showAddProjectorModal)
document.getElementById('addProjectorModalAddButton').addEventListener('click', hubProjector.submitProjectorAdditionFromModal)
document.getElementById('showAddWakeOnLANModalButton').addEventListener('click', hubExhibit.showAddWakeOnLANModal)
document.getElementById('addWakeOnLANModalAddButton').addEventListener('click', hubExhibit.submitWakeOnLANAdditionFromModal)

// Component info modal
document.getElementById('componentInfoModalRemoveComponentButton')
  .addEventListener('click', hubComponentInfo.removeExhibitComponentFromModal)
document.getElementById('componentInfoModalMaintenanceSaveButton')
  .addEventListener('click', function () {
    hubMaintenance.submitComponentMaintenanceStatusChange()
  })
document.getElementById('componentInfoModalMaintenanceStatusSelector')
  .addEventListener('change', function () {
    document.getElementById('componentInfoModalMaintenanceSaveButton').style.display = ''
  })
document.getElementById('componentInfoModalBasicSettingsSaveButton').addEventListener('click', hubComponentInfo.submitComponentBasicSettingsChange)

for (const el of document.querySelectorAll('.componentInfoBasicSetting')) {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalBasicSettingsSaveButton').style.display = 'block'
  })
}
const settingEls = document.querySelectorAll('.componentInfoSetting')
for (const el of settingEls) {
  el.addEventListener('change', function () {
    document.getElementById('componentInfoModalSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('componentInfoModalSettingsSaveButton')
  .addEventListener('click', hubComponentInfo.submitComponentSettingsChange)
document.getElementById('definitionTabAppFilterSelect').addEventListener('change', (event) => {
  hubComponentInfo.filterDefinitionListByApp()
})
document.getElementById('definitionTabThumbnailsCheckbox').addEventListener('change', (event) => {
  hubComponentInfo.onDefinitionTabThumbnailsCheckboxChange()
})
document.getElementById('componentInfoModalDefinitionSaveButton').addEventListener('click', hubComponentInfo.submitDefinitionSelectionFromModal)

document.getElementById('componentInfoModalViewScreenshot').addEventListener('click', () => {
  const component = hubTools.getExhibitComponent(document.getElementById('componentInfoModal').dataset.uuid)
  console.log(component)
  hubTools.openMediaInNewTab([component.getScreenshot()], ['image'])
})
document.getElementById('componentInfoModalEditDMXButton').addEventListener('click', (event) => {
  const component = hubTools.getExhibitComponent(document.getElementById('componentInfoModal').dataset.uuid)
  window.open(component.getHelperURL() + '/dmx_control/?standalone=true', '_blank').focus()
})
document.getElementById('componentInfoModalDMXIntroConfigureButton').addEventListener('click', (event) => {
  const component = hubTools.getExhibitComponent(document.getElementById('componentInfoModal').dataset.uuid)
  window.open(component.getHelperURL() + '/dmx_control/?standalone=true', '_blank').focus()
})
for (const el of document.querySelectorAll('.componentInfoProjectorSetting')) {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalProjectorSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('componentInfoModalProjectorSettingsSaveButton').addEventListener('click', hubComponentInfo.updateProjectorFromInfoModal)
for (const el of document.querySelectorAll('.componentInfoStaticSetting')) {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalStaticSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('componentInfoModalStaticSettingsSaveButton').addEventListener('click', hubComponentInfo.updateStaticComponentFromInfoModal)
for (const el of document.querySelectorAll('.componentInfoWakeOnLANSetting')) {
  el.addEventListener('change', () => {
    document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').addEventListener('click', hubComponentInfo.updateWakeOnLANComponentFromInfoModal)

// Copy definition modal
document.getElementById('copyDefinitionModalSubmitButton').addEventListener('click', hubExhibit.copyDefinitionModalPerformCopy)

// Schedule tab
// =========================
document.getElementById('manageFutureDateButton').addEventListener('click', hubSchedule.showManageFutureDateModal)
document.getElementById('manageFutureDateCalendarInput').addEventListener('change', hubSchedule.populateFutureDateCalendarInput)
document.getElementById('manageFutureDateAddActionButton').addEventListener('click', (event) => {
  const scheduleName = document.getElementById('manageFutureDateCalendarInput').value
  hubSchedule.scheduleConfigureEditModal(scheduleName, 'date-specific')
})
document.getElementById('manageFutureDateCreateScheduleButton').addEventListener('click', hubSchedule.convertFutureScheduleFromModal)
document.getElementById('manageFutureDateDeleteScheduleButton').addEventListener('click', (event) => {
  event.target.focus()
})
document.getElementById('manageFutureDateDownloadAsJSONButton').addEventListener('click', () => {
  const date = document.getElementById('manageFutureDateCalendarInput').value
  hubSchedule.downloadScheduleAsJSON(date)
})
// Create schedule from file modal
document.getElementById('showScheduleFromFileModalButton').addEventListener('click', hubSchedule.showScheduleFromFileModal)
document.getElementById('scheduleFromFileModalFileInput').addEventListener('change', hubSchedule.onScheduleFromFileModalFileInputChange)
document.getElementById('scheduleFromFileModalUploadButton').addEventListener('click', hubSchedule.previewScheduleFromFile)
document.getElementById('scheduleFromFileKindSelect').addEventListener('change', hubSchedule.onCreateScheduleFromFileTypeSelect)
document.getElementById('scheduleFromFileDateSelect').addEventListener('change', hubSchedule.onscheduleFromFileDateSelectChange)
document.getElementById('scheduleFromFileModalSubmitButton').addEventListener('click', hubSchedule.createScheduleFromFile)

document.getElementById('scheduleEditDeleteActionButton').addEventListener('click', hubSchedule.scheduleDeleteActionFromModal)
document.getElementById('scheduleEditSubmitButton').addEventListener('click', hubSchedule.sendScheduleUpdateFromModal)
document.getElementById('scheduleActionSelector').addEventListener('change', () => {
  hubSchedule.setScheduleActionTargetSelector()
})
document.getElementById('scheduleTargetSelector').addEventListener('change', () => {
  hubSchedule.setScheduleActionValueSelector()
})

// This event detects when the delete button has been clicked inside a popover to delete a date-specific schedule.
document.addEventListener('click', (event) => {
  if (event.target.classList.contains('schedule-delete') === false) return
  if (document.getElementById('manageFutureDateModal').classList.contains('show')) {
    // This popover is from the future dates edit modal
    hubSchedule.deleteSchedule(document.getElementById('manageFutureDateCalendarInput').value)
  } else {
    // This popover is from the main schedule page
    hubSchedule.deleteSchedule(event.target.getAttribute('id').slice(7))
  }
})

// Exhibits tab
// =========================
document.getElementById('exhibitModifiedButton').addEventListener('click', hubExhibit.showExhibitionModificationsModal)
document.getElementById('exhibitSelect').addEventListener('change', () => {
  hubExhibit.updateExhibitButtons()
})
document.getElementById('setExhibitButton').addEventListener('click', () => {
  hubExhibit.changeExhibit(false)
})
document.getElementById('editExhibitButton').addEventListener('click', () => {
  hubExhibit.editExhibitPopulateExhibitContent(document.getElementById('exhibitSelect').value)
})
document.getElementById('editExhibitAddComponentButton').addEventListener('click', hubExhibit.editExhibitAddComponentPopulateList)
document.getElementById('createExhibitButton').addEventListener('click', () => {
  hubExhibit.createExhibit('New exhibit', null)
})
document.getElementById('cloneExhibitButton').addEventListener('click', () => {
  hubExhibit.createExhibit('New exhibit', document.getElementById('exhibitSelect').value)
})
document.getElementById('exhibitChangeConfirmationButton').addEventListener('click', () => {
  hubExhibit.changeExhibit(true)
})
document.getElementById('deleteExhibitButton').addEventListener('click', hubExhibit.deleteExhibitFromModal)
document.getElementById('exhibitDeleteSelectorButton').addEventListener('click', hubExhibit.showExhibitDeleteModal)
document.getElementById('editExhibitThumbnailCheckbox').addEventListener('change', hubExhibit.onManageExhibitModalThumbnailCheckboxChange)
document.getElementById('editExhibitSaveButton').addEventListener('click', hubExhibit.editExhibitSubmitUpdate)
document.getElementById('editExhibitShowActionModalButton').addEventListener('click', () => {
  hubExhibit.showEditExhibitActionModal()
})
document.getElementById('editExhibitActionSelector').addEventListener('change', () => { hubExhibit.editExhibitActionConfigureTargetSelector() })
document.getElementById('editExhibitActionTargetSelector').addEventListener('change', () => { hubExhibit.editExhibitActionConfigureValueSelector() })
document.getElementById('editExhibitActionEditDeleteActionButton').addEventListener('click', () => {
  const uuid = document.getElementById('editExhibitActionModal').dataset.uuid
  hubExhibit.editExhibitActionDeleteAction(uuid)
})
document.getElementById('editExhibitActionEditSubmitButton').addEventListener('click', hubExhibit.editExhibitActionSubmit)
document.getElementById('exhibitModificationsModalSaveButton').addEventListener('click', hubExhibit.removeExhibitionModifications)
document.getElementById('exhibitModificationsModalApplyButton').addEventListener('click', hubExhibit.applyExhibitionModifications)

// Programs tab
// =========================
document.getElementById('refreshProgramSelect').addEventListener('click', () => {
  hubPrograms.populatePrograms()
})
document.getElementById('createProgramButton').addEventListener('click', () => {
  hubPrograms.createProgram()
})
document.getElementById('editProgramButton').addEventListener('click', () => {
  hubPrograms.editProgram()
})
document.getElementById('saveProgramButton').addEventListener('click', () => {
  hubPrograms.updateProgram()
})
document.getElementById('editProgramThumbnailButton').addEventListener('change', ev => {
  hubPrograms.uploadProgramMediaFile(ev.target, 'thumbnail')
})
document.getElementById('editProgramTrailerButton').addEventListener('change', ev => {
  hubPrograms.uploadProgramMediaFile(ev.target, 'trailer')
})
document.getElementById('editProgramAddActionButton').addEventListener('click', () => {
  hubPrograms.showprogramActionEditModal()
})

// Maintenance tab
// =========================
// This event detects when the delete button has been clicked inside a popover
document.addEventListener('click', (event) => {
  const id = event.target.getAttribute('id')
  if (id === 'issueMediaDeleteButtonConfirmation') {
    const file = document.getElementById('issueMediaViewFromModalSelect').value
    hubIssues.issueMediaDelete([file])
  } else if (id === 'editUserDeleteButtonConfirmation') {
    const user = document.getElementById('editUserModal').dataset.uuid
    hubUsers.deleteUser(user)
  }
})
document.getElementById('issueModifyModalDeleteButton').addEventListener('click', () => {
  const id = document.getElementById('issueModifyModal').dataset.id
  hubIssues.modifyIssue(id, 'delete')
  exUtilities.hideModal('#issueModifyModal')
})
document.getElementById('issueModifyModalArchiveButton').addEventListener('click', () => {
  const id = document.getElementById('issueModifyModal').dataset.id
  hubIssues.modifyIssue(id, 'archive')
  exUtilities.hideModal('#issueModifyModal')
})
document.getElementById('issueMediaViewFromModal').addEventListener('click', () => {
  const file = document.getElementById('issueMediaViewFromModalSelect').value
  hubTools.openMediaInNewTab(['issues/media/' + file])
})
document.getElementById('issueMediaUploadSubmitButton').addEventListener('click', hubIssues.uploadIssueMediaFile)
document.getElementById('issueMediaUpload').addEventListener('change', hubIssues.onIssueMediaUploadChange)
document.getElementById('issueEditSubmitButton').addEventListener('click', hubIssues.submitIssueFromModal)
document.getElementById('createIssueButton').addEventListener('click', () => {
  hubIssues.showIssueEditModal('new')
})

document.getElementById('viewIssueArchiveButton').addEventListener('click', () => {
  hubIssues.showArchivedIssuesModal()
})
document.getElementById('issueListFilterPrioritySelect').addEventListener('change', () => {
  hubIssues.rebuildIssueList()
})
document.getElementById('issueListFilterAssignedToSelect').addEventListener('change', () => {
  hubIssues.rebuildIssueList()
})
document.getElementById('componentInfoModalMaintenanceNote').addEventListener('input', () => {
  document.getElementById('componentInfoModalMaintenanceSaveButton').style.display = 'block'
})

// Analytics tab
// =========================
document.getElementById('createTrackerTemplateButton').addEventListener('click', () => {
  hubTracker.createTrackerTemplate()
})
document.getElementById('launchTrackerButton').addEventListener('click', hubTracker.launchTracker)
document.getElementById('showEditTrackerTemplateButton').addEventListener('click', () => {
  hubTracker.showEditTrackerTemplateModal()
})
document.getElementById('deleteTrackerTemplateButton').addEventListener('click', () => {
  const trackerTemplateSelect = document.getElementById('trackerTemplateSelect')
  const name = trackerTemplateSelect.options[trackerTemplateSelect.selectedIndex].text
  document.getElementById('deleteTrackerTemplateModalTemplateName').innerHTML = name
  exUtilities.showModal('#deleteTrackerTemplateModal')
})
document.getElementById('deleteTrackerTemplateFromModalButton')
  .addEventListener('click', () => hubTracker.deleteTrackerTemplate())
document.getElementById('getAvailableTrackerDataButton')
  .addEventListener('click', () => hubTracker.getAvailableTrackerData(hubTracker.populateTrackerDataSelect))
document.getElementById('downloadTrackerDataButton')
  .addEventListener('click', () => hubTracker.downloadTrackerData(document.getElementById('trackerDataSelect').value))
document.getElementById('showDeleteTrackerDataModalButton')
  .addEventListener('click', () => hubTracker.showDeleteTrackerDataModal())
document.getElementById('deleteTrackerDataFromModalButton')
  .addEventListener('click', () => hubTracker.deleteTrackerDataFromModal())
document.getElementById('editTrackerTemplateModalAddCounterButton')
  .addEventListener('click', () => hubTracker.editTrackerTemplateModalAddWidget('New Counter', 'counter'))
document.getElementById('editTrackerTemplateModalAddDropdownButton')
  .addEventListener('click', () => hubTracker.editTrackerTemplateModalAddWidget('New Dropdown', 'dropdown'))
document.getElementById('editTrackerTemplateModalAddNumberButton')
  .addEventListener('click', () => hubTracker.editTrackerTemplateModalAddWidget('New Number', 'number'))
document.getElementById('editTrackerTemplateModalAddSliderButton')
  .addEventListener('click', () => hubTracker.editTrackerTemplateModalAddWidget('New Slider', 'slider'))
document.getElementById('editTrackerTemplateModalAddTextButton')
  .addEventListener('click', () => hubTracker.editTrackerTemplateModalAddWidget('New Text', 'text'))
document.getElementById('editTrackerTemplateModalAddTimerButton')
  .addEventListener('click', () => hubTracker.editTrackerTemplateModalAddWidget('New Timer', 'timer'))
document.getElementById('editTrackerTemplateModalSubmitChangesButton')
  .addEventListener('click', () => hubTracker.editTrackerTemplateModalSubmitChanges())
document.getElementById('editTrackerTemplateGuestFacingCheckbox').addEventListener('change', hubTracker.makeGuestFacing)

// Users tab
// =========================
document.getElementById('showEditUserModalButton').addEventListener('click', () => {
  hubUsers.showEditUserModal()
})
for (const el of document.querySelectorAll('.editUserField')) {
  el.addEventListener('change', () => {
    document.getElementById('editUserSubmitButton').style.display = 'block'
  })
}
document.getElementById('editUserPermissionGroups').addEventListener('change', (event) => {
  if (event.target.value === 'custom') {
    document.getElementById('editUserGroupsRow').style.display = 'flex'
  } else {
    document.getElementById('editUserGroupsRow').style.display = 'none'
  }
})
document.getElementById('editUserSubmitButton').addEventListener('click', hubUsers.submitChangeFromEditUserModal)

// Settings tab
// =========================

// Groups
document.getElementById('settingsAddGroupButton').addEventListener('click', () => {
  hubGroup.showEditGroupModal()
})
document.getElementById('editGroupModalSubmitButton').addEventListener('click', hubGroup.submitChangeFromGroupEditModal)
document.getElementById('deleteGroupConfirmationButton').addEventListener('click', hubGroup.deleteGroupFromModal)

// Server settings
for (const el of document.querySelectorAll('.hubSettingsInputField')) {
  el.addEventListener('change', () => {
    document.getElementById('hubSettingsSaveButton').style.display = 'block'
  })
}
document.getElementById('hubSettingsSaveButton').addEventListener('click', updateSystemConfiguration)

// Activate all popovers
const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
for (const triggerEl of popoverTriggerList) {
  const po = new bootstrap.Popover(triggerEl)
}

// Enable all tooltips
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

hubConfig.serverAddress = location.origin

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Fix bootstrap modal accessibility issue
document.addEventListener('hidden.bs.modal', function (event) {
  if (document.activeElement) document.activeElement.blur()
})

loadVersion()
// populateHelpTab()
hubUsers.populateUsers()
populateHubSettings()
const trackerTemplates = await hubTracker.getAvailableTemplates()
hubTracker.populateTrackerTemplateSelect(trackerTemplates)

hubUsers.authenticateUser()
  .then(() => {
    // Subscribe to updates from Hub once we're logged in (or not)
    const eventSource = new EventSource(hubConfig.serverAddress + exConfig.api + '/system/updateStream')
    eventSource.addEventListener('update', function (event) {
      const update = JSON.parse(event.data)
      parseUpdate(update)
    })
    eventSource.addEventListener('end', function (event) {
      console.log('Handling end....')
      eventSource.close()
    })
  })
