import * as exUtilities from '../../../common/utilities.js'

import hubConfig from '../../config.js'
import * as hubTools from '../tools.js'

import { ModalController } from './modal_controller.js'

// Modal for creating or editing a Group entry
const editGroupModal = new ModalController({
  id: 'editGroupModal',
  defaultFields: [
    { id: 'editGroupModalNameInput', value: '' },
    { id: 'editGroupModalDescriptionInput', value: '' }
  ],
  warningIDs: ['editGroupModalNameWarning']
})

export function showEditGroupModal (uuid = '') {
  // Show the modal for creatng or editing a group

  editGroupModal.reset()
  editGroupModal.setData('uuid', uuid)

  if (uuid !== '') {
    // We are editing a group
    editGroupModal.setTitle('Edit group')
    document.getElementById('editGroupModalSubmitButton').innerHTML = 'Save'

    hubTools.makeServerRequest({
      method: 'GET',
      endpoint: '/group/' + uuid + '/details'
    })
      .then((response) => {
        if (response.success === true) {
          editGroupModal.populate([
            { id: 'editGroupModalNameInput', value: response.details.name },
            { id: 'editGroupModalDescriptionInput', value: response.details.description }
          ])
        }
        editGroupModal.show()
      })
  } else {
    // Creating a new group
    editGroupModal.setTitle('Create group')
    document.getElementById('editGroupModalSubmitButton').innerHTML = 'Create'

    editGroupModal.show()
  }
}

export function submitChangeFromGroupEditModal () {
  // Collect details from the group edit modal and submit them to the server

  const uuid = editGroupModal.getData('uuid')
  const name = document.getElementById('editGroupModalNameInput').value.trim()
  const description = document.getElementById('editGroupModalDescriptionInput').value.trim()

  if (name === '') {
    editGroupModal.showWarning('editGroupModalNameWarning')
    return
  }

  if (uuid === '') {
    // Create new group
    hubTools.makeServerRequest({
      method: 'POST',
      endpoint: '/group/create',
      params: {
        name, description
      }
    })
      .then(() => {
        editGroupModal.hide()
      })
  } else {
    // Edit group
    hubTools.makeServerRequest({
      method: 'POST',
      endpoint: '/group/' + uuid + '/edit',
      params: {
        name, description
      }
    })
      .then(() => {
        editGroupModal.hide()
      })
  }
}

export function populateGroupsRow () {
  // Take the list of groups and build an HTML representation of them.

  const groupRow = document.getElementById('settingsGroupsRow')
  groupRow.innerHTML = ''

  if (hubConfig.groups == null) hubConfig.groups = []

  const sorted = exUtilities.sortAlphabetically(hubConfig.groups, 'name')

  for (const group of sorted) {
    const groupCol = document.createElement('div')
    groupCol.classList = 'col'
    groupRow.appendChild(groupCol)

    const row = document.createElement('div')
    row.classList = 'row'
    groupCol.appendChild(row)

    const titleCol = document.createElement('div')
    titleCol.classList = 'col-12'
    row.appendChild(titleCol)

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group w-100'
    titleCol.appendChild(btnGroup)

    const name = document.createElement('button')
    name.classList = 'btn btn-primary w-75'
    name.addEventListener('click', () => {
      showEditGroupModal(group.uuid)
    })
    name.style.fontSize = '18px'
    name.textContent = group.name
    btnGroup.appendChild(name)

    const dropdownBtn = document.createElement('button')
    dropdownBtn.classList = 'btn btn-primary dropdown-toggle dropdown-toggle-split'
    dropdownBtn.setAttribute('data-bs-toggle', 'dropdown')
    dropdownBtn.setAttribute('aria-haspopup', 'true')
    dropdownBtn.setAttribute('aria-expanded', 'false')
    dropdownBtn.innerHTML = '<span class="visually-hidden">Toggle Dropdown</span>'
    btnGroup.appendChild(dropdownBtn)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'
    btnGroup.appendChild(dropdownMenu)

    const editButton = document.createElement('button')
    editButton.classList = 'dropdown-item text-info'
    editButton.innerHTML = 'Edit'
    editButton.addEventListener('click', () => {
      showEditGroupModal(group.uuid)
    })
    dropdownMenu.appendChild(editButton)

    const deleteButton = document.createElement('button')
    deleteButton.classList = 'dropdown-item text-danger'
    deleteButton.innerHTML = 'Delete'
    deleteButton.addEventListener('click', () => {
      document.getElementById('deleteGroupModal').dataset.uuid = group.uuid
      exUtilities.showModal('#deleteGroupModal')
    })
    dropdownMenu.appendChild(deleteButton)

    if (group.description !== '') {
      // Adjust the rounding on the name row to make room for the description
      name.style.borderBottomLeftRadius = '0'
      dropdownBtn.style.borderBottomRightRadius = '0'

      const descCol = document.createElement('div')
      titleCol.classList = 'col-12'
      row.appendChild(descCol)

      const description = document.createElement('div')
      description.classList = 'bg-secondary rounded-bottom text-white px-2 py-2'
      description.textContent = group.description
      descCol.appendChild(description)
    }
  }
}

export function deleteGroupFromModal () {
  // Delete the group for the displayed confirmation modal

  const uuid = document.getElementById('deleteGroupModal').dataset.uuid

  hubTools.makeServerRequest({
    method: 'DELETE',
    endpoint: '/group/' + uuid
  })
    .then(() => {
      exUtilities.hideModal('#deleteGroupModal')
    })
}

export function populateGroupsForSelect (select, selected = []) {
  // Create Option entries for the given select corresponding to the groups.
  // 'select' should the the DOM element that will hold the options
  // 'selected' is an option array of uuids to set as selected

  // Clear the select
  select.innerHTML = ''

  const defaultOption = new Option('Default', 'Default')
  if (selected.includes('Default')) defaultOption.selected = true
  select.appendChild(defaultOption)

  if (hubConfig.groups == null) hubConfig.groups = []

  const sorted = exUtilities.sortAlphabetically(hubConfig.groups, 'name')

  for (const group of sorted) {
    const option = new Option(group.name, group.uuid)
    if (selected.includes(group.uuid)) {
      option.selected = true
    }

    select.appendChild(option)
  }
}
