/* global bootstrap */

import * as exUtilities from '../../../common/utilities.js'

import hubConfig from '../../config.js'
import * as hubTools from '../tools.js'
import * as hubUsers from './users.js'

import { ActionConfigurator } from './action_config.js'
import { ModalController } from './modal_controller.js'

// Modal for creating or editing a schedule entry
const scheduleEditModal = new ModalController({
  id: 'scheduleEditModal',
  defaultFields: [
    { id: 'scheduleActionTimeInput', value: null },
    { id: 'scheduleActionSelector', value: null },
    { id: 'scheduleTargetSelector', value: null },
    { id: 'scheduleValueSelector', value: null },
    { id: 'scheduleNoteInput', value: '' }
  ],
  warningIDs: ['scheduleEditErrorAlert']
})

const scheduleActionConfigurator = new ActionConfigurator({
  actionSelectorId: 'scheduleActionSelector',
  targetSelectorId: 'scheduleTargetSelector',
  targetSelectorLabelId: 'scheduleTargetSelectorLabel',
  valueSelectorId: 'scheduleValueSelector',
  valueSelectorLabelId: 'scheduleValueSelectorLabel',
  modalId: 'scheduleEditModal',
  errorAlertId: 'scheduleEditErrorAlert',
  onError: () => scheduleEditModal.showWarning('scheduleEditErrorAlert'),
  onErrorClear: () => scheduleEditModal.hideWarning('scheduleEditErrorAlert'),
  extraElements: {
    note: ['scheduleNoteInput']
    // clear_exhibition_mods needs nothing extra shown
  }
})

const dateOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
}

export function deleteSchedule (name) {
  // Send a message to Hub asking to delete the schedule
  // file with the given name. The name should not include ".ini"

  hubTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/schedule/' + name
  })
    .then((response) => {
      if (response?.success) {
        populateSchedule(response)
        if (document.getElementById('manageFutureDateModal').classList.contains('show')) {
          populateFutureDatesList()
          document.getElementById('manageFutureDateCalendarInput').value = ''
          populateFutureDateCalendarInput()
        }
      }
    })
}

export function scheduleConvertToDateSpecific (date, dayName) {
  // Send a message to Hub, asking to create a date-specific
  // schedule out of the given day name

  const requestDict = {
    date,
    convert_from: dayName
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/convert',
    params: requestDict
  })
    .then((response) => {
      if (response?.success) {
        populateSchedule(response)
      }
    })
}

export function populateSchedule (schedule) {
  // Take a provided schedule and build the interface to show it.

  document.getElementById('scheduleContainer').textContent = ''
  document.getElementById('dateSpecificScheduleAlert').style.display = 'none'

  const allowEdit = hubTools.checkPermission('schedule', 'edit')

  // Record the timestamp when this schedule was generated
  hubConfig.scheduleUpdateTime = schedule.updateTime
  const sched = schedule.schedule

  for (const day of sched) {
    // Apply a background color to date-specific schedules so that we
    // know that they are special

    let scheduleClass
    let addItemText
    let convertState
    let deleteState
    let scheduleName
    if (day.source === 'date-specific') {
      scheduleClass = 'schedule-date-specific'
      addItemText = 'Add date-specific action'
      document.getElementById('dateSpecificScheduleAlert').style.display = 'block'
      convertState = 'none'
      deleteState = 'block'
      scheduleName = day.date
    } else {
      scheduleClass = ''
      addItemText = 'Add recurring action'
      convertState = 'block'
      deleteState = 'none'
      scheduleName = day.dayName.toLowerCase()
    }

    const dayCol = document.createElement('div')
    dayCol.classList = 'col-12 col-sm-6 col-xl-4'

    const dayContainer = document.createElement('div')
    dayContainer.classList = `h-100 px-2 border border-secondary rounded d-flex flex-column ${scheduleClass}`
    dayCol.appendChild(dayContainer)

    const row = document.createElement('div')
    row.classList = 'row px-2'
    dayContainer.appendChild(row)

    const dayNameCol = document.createElement('div')
    dayNameCol.classList = 'col-10 border-bottom py-2'
    row.appendChild(dayNameCol)

    // Parse the date into a string
    const dateSplit = day.date.split('-')
    const date = new Date(parseInt(dateSplit[0]), parseInt(dateSplit[1]) - 1, parseInt(dateSplit[2]))
    const dateStr = date.toLocaleDateString(undefined, dateOptions)

    const dayNameSpan = document.createElement('span')
    dayNameSpan.style.fontSize = '24px'
    dayNameSpan.textContent = dateStr
    dayNameCol.appendChild(dayNameSpan)

    const menuCol = document.createElement('div')
    menuCol.classList = 'col-2 border-bottom py-2 d-flex flex-column justify-content-center'
    row.appendChild(menuCol)

    const dropdownDiv = document.createElement('div')
    dropdownDiv.classList = 'dropdown text-end'
    menuCol.appendChild(dropdownDiv)

    const dropdownButton = document.createElement('button')
    dropdownButton.classList = 'btn btn-sm btn-outline-secondary dropdown-toggle'
    dropdownButton.setAttribute('type', 'button')
    dropdownButton.setAttribute('data-bs-toggle', 'dropdown')
    dropdownButton.setAttribute('aria-expanded', 'false')
    dropdownDiv.appendChild(dropdownButton)

    const dropdownMenu = document.createElement('ul')
    dropdownMenu.classList = 'dropdown-menu'
    dropdownDiv.appendChild(dropdownMenu)

    const jsonLi = document.createElement('li')
    dropdownMenu.appendChild(jsonLi)

    const json = document.createElement('button')
    json.classList = 'dropdown-item'
    json.textContent = 'Download as JSON'
    json.addEventListener('click', () => {
      downloadScheduleAsJSON(scheduleName)
    })
    jsonLi.appendChild(json)

    if (allowEdit) {
      const editButtonCol = document.createElement('div')
      editButtonCol.classList = 'col-12 col-lg-6 mt-2 px-1'
      row.appendChild(editButtonCol)

      const editButton = document.createElement('button')
      editButton.classList = 'btn btn-primary btn-sm w-100'
      editButton.setAttribute('type', 'button')
      editButton.textContent = addItemText
      editButton.addEventListener('click', function () {
        scheduleConfigureEditModal(scheduleName, day.source)
      })
      editButtonCol.appendChild(editButton)

      const convertButtonCol = document.createElement('div')
      convertButtonCol.classList = 'col-12 col-lg-6 mt-2 px-1'
      convertButtonCol.style.display = convertState
      row.appendChild(convertButtonCol)

      const convertButton = document.createElement('button')
      convertButton.classList = 'btn btn-warning btn-sm w-100'
      convertButton.setAttribute('type', 'button')
      convertButton.textContent = 'Convert to date-specific'
      convertButton.addEventListener('click', function () {
        scheduleConvertToDateSpecific(day.date, day.dayName)
      })
      convertButtonCol.appendChild(convertButton)

      const deleteButtonCol = document.createElement('div')
      deleteButtonCol.classList = 'col-12 col-lg-6 mt-2 px-1'
      deleteButtonCol.style.display = deleteState
      row.appendChild(deleteButtonCol)

      const deleteButton = document.createElement('button')
      deleteButton.classList = 'btn btn-danger btn-sm w-100'
      deleteButton.setAttribute('type', 'button')
      deleteButton.textContent = 'Delete date-specific'
      deleteButton.setAttribute('data-bs-toggle', 'popover')
      deleteButton.setAttribute('title', 'Are you sure?')
      deleteButton.setAttribute('data-bs-content', `<a id="Popover${day.date}" class='btn btn-danger w-100 schedule-delete'>Confirm</a>`)
      deleteButton.setAttribute('data-bs-trigger', 'focus')
      deleteButton.setAttribute('data-bs-html', 'true')
      // Note: The event listener to detect is the delete button is clicked is defined in webpage.js
      deleteButton.addEventListener('click', function () { deleteButton.focus() })
      deleteButtonCol.appendChild(deleteButton)
      new bootstrap.Popover(deleteButton)
    }

    const divider = document.createElement('div')
    divider.classList = 'mt-2 border-top'

    row.appendChild(divider)

    document.getElementById('scheduleContainer').appendChild(dayCol)

    // Loop through the schedule elements and add a row for each
    const scheduleIDs = Object.keys(day.schedule)

    if (scheduleIDs.length === 0) {
      const noneContainer = document.createElement('div')
      noneContainer.classList = 'flex-grow-1 d-flex align-items-center justify-content-center fst-italic py-3'
      noneContainer.textContent = 'No scheduled actions'
      dayContainer.appendChild(noneContainer)
    } else {
      const entriesDiv = document.createElement('div')
      entriesDiv.classList = 'pb-2'
      dayContainer.appendChild(entriesDiv)

      for (const scheduleID of scheduleIDs) {
        entriesDiv.appendChild(createScheduleEntryHTML(day.schedule[scheduleID], scheduleID, scheduleName, day.source))
      }
    }
    // Sort the elements by time
    const events = Array.from(dayContainer.querySelectorAll('.eventListing'))

    events.sort((a, b) => {
      return parseInt(a.dataset.time_in_seconds) - parseInt(b.dataset.time_in_seconds)
    })

    // Append sorted elements back to the container
    for (const event of events) {
      dayContainer.appendChild(event)
    }
  }

  document.getElementById('Schedule_next_event').textContent = populateScheduleDescriptionHelper(schedule.nextEvent, true)
}

function createScheduleEntryHTML (item, scheduleID, scheduleName, scheduleType, allowEdit = hubTools.checkPermission('schedule', 'edit')) {
  // Take a dictionary of properties and build an HTML representation of the schedule entry.

  let description = null
  const action = item.action
  let target = item.target
  const value = item.value

  // Create the plain-language description of the action
  if (['power_off', 'power_on', 'refresh_page', 'restart', 'set_definition', 'set_dmx_scene'].includes(action)) {
    description = populateScheduleDescriptionHelper([item], false)
  } else if (action === 'set_exhibit') {
    if (Array.isArray(target) && target.length > 0) {
      target = target[0]
    }
    description = `Set exhibition: ${hubTools.getExhibitName(target.value)}`
  } else if (action === 'note') {
    description = item.value
  } else if (action === 'clear_exhibition_mods') {
    description = 'Clear exhibition modifications'
  }

  const eventRow = document.createElement('div')
  eventRow.classList = 'row mt-2 eventListing'
  eventRow.dataset.time_in_seconds = item.time_in_seconds

  let eventDescriptionOuterContainer
  if (action === 'note') {
    const eventDescriptionCol = document.createElement('div')
    if (allowEdit) {
      eventDescriptionCol.classList = 'me-0 pe-0 col-9'
    } else {
      eventDescriptionCol.classList = 'col-12'
    }
    eventRow.appendChild(eventDescriptionCol)

    eventDescriptionOuterContainer = document.createElement('div')
    eventDescriptionOuterContainer.classList = 'text-white bg-success w-100 h-100 justify-content-center d-flex py-1 pe-1 rounded-start'
    eventDescriptionCol.appendChild(eventDescriptionOuterContainer)

    const eventDescriptionInnerContainer = document.createElement('div')
    eventDescriptionInnerContainer.classList = 'align-self-center justify-content-center text-wrap'
    eventDescriptionOuterContainer.appendChild(eventDescriptionInnerContainer)

    const eventDescription = document.createElement('center')
    eventDescription.textContent = description
    eventDescriptionOuterContainer.appendChild(eventDescription)
  } else {
    const eventTimeCol = document.createElement('div')
    eventTimeCol.classList = 'col-4 me-0 pe-0'
    eventRow.appendChild(eventTimeCol)

    const eventTimeContainer = document.createElement('div')
    eventTimeContainer.classList = 'rounded-start text-light bg-secondary w-100 h-100 justify-content-center d-flex py-1 ps-1'
    eventTimeCol.appendChild(eventTimeContainer)

    const eventTime = document.createElement('div')
    eventTime.classList = 'align-self-center justify-content-center'
    eventTime.textContent = formatTimeForLocale(item.time_in_seconds)
    eventTimeContainer.appendChild(eventTime)

    const eventDescriptionCol = document.createElement('div')
    if (allowEdit) {
      eventDescriptionCol.classList = 'mx-0 px-0 col-5'
    } else {
      eventDescriptionCol.classList += 'ms-0 ps-0 col-8'
    }
    eventRow.appendChild(eventDescriptionCol)

    eventDescriptionOuterContainer = document.createElement('div')
    eventDescriptionOuterContainer.classList = 'text-light bg-secondary w-100 h-100 justify-content-center d-flex py-1 pe-1'
    eventDescriptionCol.appendChild(eventDescriptionOuterContainer)

    const eventDescriptionInnerContainer = document.createElement('div')
    eventDescriptionInnerContainer.classList = 'align-self-center justify-content-center text-wrap'
    eventDescriptionOuterContainer.appendChild(eventDescriptionInnerContainer)

    const eventDescription = document.createElement('center')
    eventDescription.textContent = description
    eventDescriptionOuterContainer.appendChild(eventDescription)
  }

  if (allowEdit) {
    const eventEditButtonCol = document.createElement('div')
    eventEditButtonCol.classList = 'col-3 ms-0 ps-0'
    eventRow.appendChild(eventEditButtonCol)

    const eventEditButton = document.createElement('button')
    eventEditButton.classList = 'bg-info w-100 h-100 rounded-end text-dark'
    eventEditButton.setAttribute('type', 'button')
    eventEditButton.style.borderStyle = 'solid'
    eventEditButton.style.border = '0px'
    eventEditButton.textContent = 'Edit'
    eventEditButton.addEventListener('click', function () {
      scheduleConfigureEditModal(scheduleName, scheduleType, false, scheduleID, item.time_in_seconds, action, target, value)
    })
    eventEditButtonCol.appendChild(eventEditButton)
  } else {
    eventDescriptionOuterContainer.classList.add('rounded-end')
  }

  return eventRow
}

export function populateScheduleDescriptionHelper (eventList, includeTime) {
  // Helper function to create text strings that describe the upcoming action(s)

  let description = ''

  if (eventList.length === 0) {
    return 'No more actions today'
  } else if (eventList.length === 1) {
    const event = eventList[0]
    description += ActionConfigurator.actionToDescription(event.action) + ' '
    if ((description.trim() !== 'No action') && (event.action !== 'clear_exhibition_mods')) {
      description += ActionConfigurator.targetToDescription(event.target, event.action)
    }
  } else {
    const action = eventList[0].action
    let allSame = true
    for (const event of eventList) {
      if (event.action !== action) {
        allSame = false
      }
    }
    if (allSame) {
      description += ActionConfigurator.actionToDescription(action) + ' multiple'
    } else {
      description = 'Multiple actions'
    }
  }
  if (includeTime) {
    description += ' at ' + formatTimeForLocale(eventList[0].time_in_seconds)
  }
  return description
}

export function setScheduleActionTargetSelector (action = null, target = null) {
  // Helper function to show/hide the select element for picking the target
  // of an action when appropriate

  scheduleActionConfigurator.configureTargetSelector(action, target, {
    set_exhibit: ({ targetSelector, targetSelectorLabel }) => {
      targetSelector.multiple = false
      targetSelector.innerText = ''
      const availableExhibits = Array.from(document.querySelectorAll('#exhibitSelect option'))
      for (const item of availableExhibits) {
        targetSelector.appendChild(new Option(hubTools.getExhibitName(item.value), JSON.stringify({
          type: 'value',
          value: item.value
        })))
      }
      targetSelector.style.display = 'block'
      targetSelectorLabel.style.display = 'block'
    }
  })
}

export async function setScheduleActionValueSelector (action = null, target = null) {
  // Helper function to show/hide the select element for picking the value
  // of an action when appropriate

  await scheduleActionConfigurator.configureValueSelector(action, target)
}

export function scheduleConfigureEditModal (scheduleName,
  type,
  isAddition = true,
  currentScheduleID = null,
  currentTime = null,
  currentAction = null,
  currentTarget = null,
  currentValue = null) {
  // Set up and then show the modal that enables editing a scheduled event
  // or adding a new one

  scheduleEditModal.reset()

  // If currentScheduleID == null, we are adding a new schedule item, so create a unique ID
  if (currentScheduleID == null) {
    currentScheduleID = exUtilities.uuid()
  }

  // Hide elements that aren't always visible
  const targetSelector = document.getElementById('scheduleTargetSelector')
  targetSelector.style.display = 'none'
  const targetSelectorLabel = document.getElementById('scheduleTargetSelectorLabel')
  targetSelectorLabel.style.display = 'none'
  document.getElementById('scheduleValueSelector').style.display = 'none'
  document.getElementById('scheduleValueSelectorLabel').style.display = 'none'

  const noteInput = document.getElementById('scheduleNoteInput')
  noteInput.style.display = 'none'

  // Tag the modal with a bunch of data that we can read if needed when
  // submitting the change

  scheduleEditModal.setData('scheduleName', scheduleName)
  scheduleEditModal.setData('scheduleID', currentScheduleID)
  scheduleEditModal.setData('isAddition', isAddition)
  // scheduleEditModal.setData('currentTime', currentTime)
  // scheduleEditModal.setData('currentAction', currentAction)
  // scheduleEditModal.setData('currentTarget', currentTarget)
  // scheduleEditModal.setData('currentValue', currentValue)

  if (isAddition) {
    scheduleEditModal.setTitle('Add action')
  } else scheduleEditModal.setTitle('Edit action')

  // Set the scope notice so that users know what their change will affect
  if (type === 'date-specific') {
    // Parse the date into a string
    const dateSplit = scheduleName.split('-')
    const date = new Date(parseInt(dateSplit[0]), parseInt(dateSplit[1]) - 1, parseInt(dateSplit[2]))
    const dateStr = date.toLocaleDateString(undefined, dateOptions)
    document.getElementById('scheduleEditScopeAlert').textContent = `This change will only affect ${dateStr}`
  } else {
    document.getElementById('scheduleEditScopeAlert').textContent = `This change will affect all ${scheduleName.charAt(0).toUpperCase() + scheduleName.slice(1)}s`
  }

  // If we're editing an existing action, pre-fill the current options
  if (isAddition === false) {
    scheduleEditModal.populate([
      { id: 'scheduleActionTimeInput', value: formatTimeForLocale(currentTime) },
      { id: 'scheduleActionSelector', value: currentAction }
    ])

    if (currentAction === 'note') {
      document.getElementById('scheduleNoteInput').value = currentValue
      noteInput.style.display = 'block'
    } else if (currentAction === 'clear_exhibition_mods') {
      // Do nothing because there are no targets or values to show
    } else {
      if (currentTarget != null) {
        setScheduleActionTargetSelector(currentAction, currentTarget)

        if (Array.isArray(currentTarget)) {
          // We need to stringify each of the items in the list
          const tempArray = currentTarget.map(target => JSON.stringify(target))

          for (const option of targetSelector.options) {
            option.selected = tempArray.includes(option.value)
          }
        } else {
          targetSelector.value = JSON.stringify(currentTarget)
        }

        // Show the target selector and its label
        targetSelector.style.display = 'block'
        targetSelectorLabel.style.display = 'block'
      }
    }
  }

  scheduleEditModal.show()
}

export function sendScheduleUpdateFromModal () {
  // Gather necessary info from the schedule editing modal and send a
  // message to Hub asking to add the given action

  const scheduleName = scheduleEditModal.getData('scheduleName')
  const time = document.getElementById('scheduleActionTimeInput').value.trim()
  const action = document.getElementById('scheduleActionSelector').value
  const targetSelector = document.getElementById('scheduleTargetSelector')
  let target = Array.from(targetSelector.selectedOptions).map(option => option.value)

  if (Array.isArray(target)) {
    target = target.map(item => JSON.parse(item))
  } else {
    target = JSON.parse(target)
  }
  let value

  if (action === 'note') {
    value = document.getElementById('scheduleNoteInput').value
    target = null
  } else if (action === 'clear_exhibition_mods') {
    target = null
    value = null
  } else {
    value = document.getElementById('scheduleValueSelector').value
  }
  const scheduleID = scheduleEditModal.getData('scheduleID')

  const editErrorAlert = document.getElementById('scheduleEditErrorAlert')
  if (time === '' || time == null) {
    editErrorAlert.innerText = 'You must specifiy a time for the action'
    scheduleEditModal.showWarning('scheduleEditErrorAlert')
    return
  } else if (action === '' || action == null) {
    editErrorAlert.innerText = 'You must specifiy an action'
    scheduleEditModal.showWarning('scheduleEditErrorAlert')
    return
  } else if (action === 'set_exhibit' && target == null) {
    editErrorAlert.innerText = 'You must specifiy an exhibition to set'
    scheduleEditModal.showWarning('scheduleEditErrorAlert')
    return
  } else if (['power_on', 'power_off', 'refresh_page', 'restart'].includes(action) && target == null) {
    editErrorAlert.innerText = 'You must specifiy a target for this action'
    scheduleEditModal.showWarning('scheduleEditErrorAlert')
    return
  } else if (['set_deinition', 'set_dmx_scene'].includes(value) && value == null) {
    editErrorAlert.innerText = 'You must specifiy a value for this action'
    scheduleEditModal.showWarning('scheduleEditErrorAlert')
    return
  }

  const requestDict = {
    time_to_set: time,
    action_to_set: action,
    target_to_set: target,
    value_to_set: value
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/' + scheduleName + '/action/' + scheduleID + '/update',
    params: requestDict
  })
    .then((update) => {
      if (update.success) {
        scheduleEditModal.hide()
        populateSchedule(update)
        if (document.getElementById('manageFutureDateModal').classList.contains('show')) {
          populateFutureDateCalendarInput()
        }
      } else {
        const alertEl = document.getElementById('scheduleEditErrorAlert')
        alertEl.innerText = update.reason
        alertEl.style.display = 'block'
      }
    })
}

export function scheduleDeleteActionFromModal () {
  // Gather necessary info from the schedule editing modal and send a
  // message to Hub asking to delete the given action

  const scheduleName = scheduleEditModal.getData('scheduleName')
  const scheduleID = scheduleEditModal.getData('scheduleID')

  hubTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/schedule/' + scheduleName + '/action/' + scheduleID
  })
    .then((update) => {
      if (update.success) {
        scheduleEditModal.hide()
        populateSchedule(update)
        if (document.getElementById('manageFutureDateModal').classList.contains('show')) {
          populateFutureDateCalendarInput()
        }
      }
    })
}

export function showManageFutureDateModal () {
  // Prepare the modal and show it.

  const allowEdit = hubTools.checkPermission('schedule', 'edit')

  // Clear any existing entries
  document.getElementById('manageFutureDateEntryList').textContent = ''
  document.getElementById('manageFutureDateCalendarInput').value = ''
  populateFutureDatesList()
  document.getElementById('manageFutureDateAddActionButton').style.display = 'none'
  document.getElementById('manageFutureDateDeleteScheduleButton').style.display = 'none'
  document.getElementById('manageFutureDateDownloadAsJSONDropdown').style.display = 'none'

  if (allowEdit) {
    document.getElementById('manageFutureDateModal').querySelector('.modal-title').textContent = 'Manage a future date'
    document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'block'
    document.getElementById('manageFutureDateEntryList').classList.add('mt-3')
  } else {
    document.getElementById('manageFutureDateModal').querySelector('.modal-title').textContent = 'View a future date'
    document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'none'
    document.getElementById('manageFutureDateCalendarInput').style.display = 'none'
    document.getElementById('manageFutureDateEntryList').classList.remove('mt-3')
  }

  exUtilities.showModal('#manageFutureDateModal')
}

function populateFutureDatesList () {
  // Get a list of upcoming dates with special schedules and build GUI elements for them.

  hubTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/date_specific/list'
  })
    .then((result) => {
      if (result.success === true) {
        const availableDatesList = document.getElementById('manageFutureDateAvailableSchedulesList')
        availableDatesList.textContent = ''
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }

        const sortedSchedules = result.schedules.sort((date1, date2) => {
          return new Date(date1) - new Date(date2)
        })
        for (const date of sortedSchedules) {
          const button = document.createElement('button')
          button.classList = 'btn btn-info mt-2 w-100 futureEventDateButton'
          button.setAttribute('id', 'futureDateButton_' + date)

          // Build the date string
          const dateObj = new Date(date + 'T00:00')
          button.textContent = dateObj.toLocaleDateString(undefined, options)

          button.addEventListener('click', (event) => {
            document.getElementById('manageFutureDateCalendarInput').value = date
            populateFutureDateCalendarInput()

            // Highlight the button
            for (const el of availableDatesList.querySelectorAll('.futureEventDateButton')) {
              el.classList.replace('btn-success', 'btn-info')
            }
            event.target.classList.replace('btn-info', 'btn-success')
          })

          availableDatesList.appendChild(button)
        }
      }
    })
}

export function populateFutureDateCalendarInput () {
  // Called when the user selects a date on the manageFutureDateModal

  const allowEdit = hubTools.checkPermission('schedule', 'edit')

  const date = document.getElementById('manageFutureDateCalendarInput').value
  const scheduleList = document.getElementById('manageFutureDateEntryList')
  scheduleList.textContent = ''
  const availableDatesList = document.getElementById('manageFutureDateAvailableSchedulesList')

  for (const el of availableDatesList.querySelectorAll('.futureEventDateButton')) {
    el.classList.replace('btn-success', 'btn-info')
  }

  if (date === '') {
    document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'block'
    document.getElementById('manageFutureDateAddActionButton').style.display = 'none'
    document.getElementById('manageFutureDateDeleteScheduleButton').style.display = 'none'
    document.getElementById('manageFutureDateDownloadAsJSONDropdown').style.display = 'none'
    return
  }

  hubTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/' + date
  })
    .then((day) => {
      if (day.success === false) {
        document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'block'
        document.getElementById('manageFutureDateAddActionButton').style.display = 'none'
        document.getElementById('manageFutureDateDeleteScheduleButton').style.display = 'none'
        document.getElementById('manageFutureDateDownloadAsJSONDropdown').style.display = 'none'
        return
      } else {
        document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'none'
        if (allowEdit) {
          document.getElementById('manageFutureDateAddActionButton').style.display = 'block'
          document.getElementById('manageFutureDateDeleteScheduleButton').style.display = 'block'
          document.getElementById('manageFutureDateDownloadAsJSONDropdown').style.display = 'block'
        }

        // Find the appropriate button and highlight it
        document.getElementById('futureDateButton_' + date).classList.replace('btn-info', 'btn-success')
      }

      // Loop through the schedule elements and add a row for each
      const scheduleIDs = Object.keys(day.schedule)

      for (const scheduleID of scheduleIDs) {
        scheduleList.appendChild(createScheduleEntryHTML(day.schedule[scheduleID], scheduleID, date, 'date-specific'))

        // Sort the elements by time
        const events = Array.from(scheduleList.querySelectorAll(':scope > .eventListing'))
        events.sort(function (a, b) {
          return parseInt(a.dataset.time_in_seconds) - parseInt(b.dataset.time_in_seconds)
        })
        events.forEach(event => scheduleList.appendChild(event))
      }
    })
}

export function convertFutureScheduleFromModal () {
  // Take the current date from the input and convert it to a date-specific schedule.

  const date = document.getElementById('manageFutureDateCalendarInput').value
  if (date === '') return

  const dateObj = new Date(date + 'T00:00')
  const dayOfWeek = dateObj.toLocaleDateString(undefined, { weekday: 'long' })

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/convert',
    params: {
      date,
      convert_from: dayOfWeek
    }
  })
    .then((result) => {
      populateFutureDatesList()
    })
}

export function downloadScheduleAsJSON (name) {
  // Get the given schedule as JSON from Hub and download for the user.

  hubTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/' + name + '/JSONString'
  })
    .then((result) => {
      if (result?.success) {
        // Convert the text to a file and initiate download
        const fileBlob = new Blob([result.json], {
          type: 'text/plain'
        })
        const a = document.createElement('a')
        const objectUrl = window.URL.createObjectURL(fileBlob)
        a.href = objectUrl
        a.download = name + '.json'
        a.click()
        window.URL.revokeObjectURL(objectUrl)
      }
    })
}

export function showScheduleFromFileModal () {
  // Prepare the scheduleFromFileModal and show it.

  // Reset fields
  document.getElementById('scheduleFromFileKindSelect').value = 'monday'
  onCreateScheduleFromFileTypeSelect()
  const fileDateSelect = document.getElementById('scheduleFromFileDateSelect')
  fileDateSelect.value = null
  fileDateSelect.style.display = 'none'
  document.getElementById('scheduleFromFileModalFileInputLabel').textContent = 'Select file'
  document.getElementById('scheduleFromFileModalFileInput').value = null
  document.getElementById('scheduleFromFileNewSchedule').textContent = ''
  document.getElementById('scheduleFromFileModal').dataset.schedule = ''
  document.getElementById('scheduleFromFileModalSubmitButton').style.display = 'none'

  exUtilities.showModal('#scheduleFromFileModal')
}

export function onScheduleFromFileModalFileInputChange (event) {
  // Called when a user selects a file for upload from the scheduleFromFileModal.

  const file = event.target.files[0]

  document.getElementById('scheduleFromFileModalFileInputLabel').textContent = file.name
}

export function onscheduleFromFileDateSelectChange () {
  // Called when a user selects a new date

  const name = document.getElementById('scheduleFromFileDateSelect').value
  _scheduleFromFilePreviewCurrentSchedule(name, 'date-specific')
}

export function previewScheduleFromFile () {
  // Use details from scheduleFromFileModal to preview a new schedule.

  const fileInput = document.getElementById('scheduleFromFileModalFileInput')
  if (fileInput.files.length === 0) return
  const file = fileInput.files[0]
  const extension = file.name.split('.').slice(-1)[0].toLowerCase()

  const fileReader = new FileReader()
  fileReader.onload = (result) => {
    if (extension === 'json') {
      previewJSONSchedule(result.target.result)
    }
  }
  fileReader.readAsText(file, 'UTF-8')
  document.getElementById('scheduleFromFileModalSubmitButton').style.display = 'block'
}

export function createScheduleFromFile () {
  // Submit the upoaded schedule to Hub for creation.

  const jsonStr = document.getElementById('scheduleFromFileModal').dataset.schedule
  if (jsonStr == null || jsonStr === '') return
  const schedule = JSON.parse(jsonStr)

  const nameStr = document.getElementById('scheduleFromFileKindSelect').value
  let name
  if (nameStr !== 'date-specific') {
    name = nameStr
  } else {
    name = document.getElementById('scheduleFromFileDateSelect').value
    if (name == null || name === '') return
  }

  hubTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/create',
    params: {
      name,
      entries: schedule
    }
  })
    .then((response) => {
      if (response.success === true) {
        exUtilities.hideModal('#scheduleFromFileModal')
      }
    })
}

async function previewJSONSchedule (jsonStr) {
  // Read the given JSON string and turn it into a schedule

  const schedule = JSON.parse(jsonStr)

  const newScheduleEl = document.getElementById('scheduleFromFileNewSchedule')
  const type = document.getElementById('scheduleFromFileKindSelect').value
  newScheduleEl.textContent = ''

  // Sort schedule IDs in time order
  const scheduleIDs = Object.keys(schedule)
  for (const entryID of scheduleIDs) {
    schedule[entryID].time_in_seconds = await _getSecondsFromMidnight(schedule[entryID].time)
  }
  scheduleIDs.sort((a, b) => {
    const scheduleA = schedule[a]
    const scheduleB = schedule[b]
    return scheduleA.time_in_seconds - scheduleB.time_in_seconds
  })

  // Loop through the schedule elements and add a row for each
  for (const scheduleID of scheduleIDs) {
    newScheduleEl.appendChild(createScheduleEntryHTML(schedule[scheduleID], scheduleID, type, 'day-specific', false))
  }
  document.getElementById('scheduleFromFileModal').dataset.schedule = JSON.stringify(schedule)
}

function _getSecondsFromMidnight (timeString) {
  return new Promise(function (resolve, reject) {
    hubTools.makeServerRequest({
      method: 'POST',
      endpoint: '/schedule/getSecondsFromMidnight',
      params: { time_str: String(timeString) }
    })
      .then((response) => {
        resolve(parseFloat(response.seconds))
      })
  })
}

export function onCreateScheduleFromFileTypeSelect () {
  // Called when the user selects a schedule from the dropdown

  const name = document.getElementById('scheduleFromFileKindSelect').value

  if (name === 'date-specific') {
    document.getElementById('scheduleFromFileDateSelect').style.display = 'block'
    document.getElementById('scheduleFromFileCurrentSchedule').textContent = ''
    return
  }
  document.getElementById('scheduleFromFileDateSelect').style.display = 'none'
  _scheduleFromFilePreviewCurrentSchedule(name, 'day-specific')
}

function _scheduleFromFilePreviewCurrentSchedule (name, kind, retry = false) {
  // Build the HTML representation of the schedule to preview.
  // `kind` should be one of ['day-specific', 'date-specific']

  const currentScheduleEl = document.getElementById('scheduleFromFileCurrentSchedule')
  hubTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/' + name
  })
    .then((response) => {
      if (response.success === true) {
        currentScheduleEl.textContent = ''

        // Loop through the schedule elements and add a row for each
        const scheduleIDs = Object.keys(response.schedule)
        for (const scheduleID of scheduleIDs) {
          currentScheduleEl.appendChild(createScheduleEntryHTML(response.schedule[scheduleID], scheduleID, kind, 'day-specific', false))

          // Sort the elements by time
          const events = Array.from(currentScheduleEl.querySelectorAll(':scope > .eventListing'))
          events.sort(function (a, b) {
            return parseInt(a.dataset.time_in_seconds) - parseInt(b.dataset.time_in_seconds)
          })
          events.forEach(event => currentScheduleEl.appendChild(event))
        }
      } else if (kind === 'date-specific' && retry === false) {
        // A fail probably means there isn't a date-specific scheudle,
        // so look for a day-sepcific one. Only retry once to prevent an infinite loop

        // Parse the date into a string
        const dateSplit = name.split('-')
        const date = new Date(parseInt(dateSplit[0]), parseInt(dateSplit[1]) - 1, parseInt(dateSplit[2]))
        const dayStr = date.toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase()
        // Retry the function with this new schedule
        _scheduleFromFilePreviewCurrentSchedule(dayStr, 'day-specific', true)
      }
    })
}

export function formatTimeForLocale (timeInSeconds, locale = navigator.language) {
  const totalSeconds = Math.round(timeInSeconds) % 86400 // wrap in case >= 24h
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes, seconds))

  const options = {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit'
  }

  // Format time to match the user's preference (if they have auto set, set nothing)
  const timeFormat = hubUsers.checkUserPreference('time_format')
  if (timeFormat === '12-hour') {
    options.hour12 = true
  } else if (timeFormat === '24-hour') {
    options.hour12 = false
  }

  if (seconds !== 0) {
    options.second = '2-digit'
  }

  return date.toLocaleTimeString(locale, options)
}
