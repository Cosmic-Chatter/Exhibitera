import exConfig from './config.js'
import * as exTools from './exhibitera_tools.js'

export function checkUserPermission (action, neededLevel, group = null) {
  // Return true if the user's permissions allow this action and false if they do not.

  try {
    if ((action in exConfig.user.permissions) === false) return false
  } catch {
    return false
  }

  if (neededLevel === 'none') {
    return true
  }

  if (action !== 'components') {
    const allowedLevel = exConfig.user.permissions[action]

    if (neededLevel === 'edit') {
      if (allowedLevel === 'edit') return true
      return false
    }
    if (neededLevel === 'view') {
      if (allowedLevel === 'edit' || allowedLevel === 'view') return true
      return false
    }
  }
  if (action === 'components') {
    if (neededLevel === 'edit') {
      if (exConfig.user.permissions.components.edit.includes('__all')) return true
      if ((group != null) && exConfig.user.permissions.components.edit.includes(group)) return true
      return false
    }
    if (neededLevel === 'edit_content') {
      if (exConfig.user.permissions.components.edit.includes('__all')) return true
      if (exConfig.user.permissions.components.edit_content.includes('__all')) return true
      if ((group != null) && (exConfig.user.permissions.components.edit.includes(group) || exConfig.user.permissions.components.edit_content.includes(group))) return true
      return false
    }
    if (neededLevel === 'view') {
      if (exConfig.user.permissions.components.edit.includes('__all')) return true
      if (exConfig.user.permissions.components.edit_content.includes('__all')) return true
      if (exConfig.user.permissions.components.view.includes('__all')) return true
      if ((group != null) && (exConfig.user.permissions.components.edit.includes(group) || exConfig.user.permissions.components.edit_content.includes(group) || exConfig.user.permissions.components.view.includes(group))) return true
      return false
    }
  }
  return false
}

export function showEditUserModal (user = null) {
  // Show the modal for creating a new user account.

  if (user == null) {
    // We are creating a new user.
    configureEditUserModalForNewUser()
  } else {
    // We are editing an existing user.
    configureEditUserModalForExistingUser(user)
  }

  document.getElementById('editUserBlankUsername').style.display = 'none'
  document.getElementById('editUserBlankDisplayname').style.display = 'none'
  document.getElementById('editUserPasswordMismatch').style.display = 'none'
  document.getElementById('editUserBlankPassword').style.display = 'none'
  document.getElementById('editUserUsernameExists').style.display = 'none'

  document.getElementById('editUserSubmitButton').style.display = 'none'
  $('#editUserModal').modal('show')
}

function configureEditUserModalForNewUser () {
  // Set up the editUser modal for a new user.

  document.getElementById('editUserModal').setAttribute('data-uuid', '')
  document.getElementById('editUserModalTitle').innerHTML = 'Create a user'
  document.getElementById('editUserSubmitButton').innerHTML = 'Create'

  document.getElementById('editUserUsernameInput').value = ''
  document.getElementById('editUserDisplayNameInput').value = ''

  // Permissions
  document.getElementById('editUserPermissionAnalytics').value = 'none'
  document.getElementById('editUserPermissionExhibits').value = 'none'
  document.getElementById('editUserPermissionMaintenance').value = 'none'
  document.getElementById('editUserPermissionSchedule').value = 'none'
  document.getElementById('editUserPermissionSettings').value = 'none'
  document.getElementById('editUserPermissionUsers').value = 'none'
  document.getElementById('editUserPermissionGroups').value = 'none'
  document.getElementById('editUserGroupsRow').style.display = 'none'
  populateEditUserGroupsRow({ edit: [], view: [] })
}

function configureEditUserModalForExistingUser (user) {
  // Set up the editUser modal for editing an existing user.

  document.getElementById('editUserModal').setAttribute('data-uuid', user.uuid)
  document.getElementById('editUserModalTitle').innerHTML = 'Edit user'
  document.getElementById('editUserSubmitButton').innerHTML = 'Save'

  document.getElementById('editUserUsernameInput').value = user.username
  document.getElementById('editUserDisplayNameInput').value = user.display_name

  // Permissions
  document.getElementById('editUserPermissionAnalytics').value = user.permissions.analytics
  document.getElementById('editUserPermissionExhibits').value = user.permissions.exhibits
  document.getElementById('editUserPermissionMaintenance').value = user.permissions.maintenance
  document.getElementById('editUserPermissionSchedule').value = user.permissions.schedule
  document.getElementById('editUserPermissionSettings').value = user.permissions.settings
  document.getElementById('editUserPermissionUsers').value = user.permissions.users

  if (user.permissions.components.edit.includes('__all')) {
    document.getElementById('editUserPermissionGroups').value = 'edit'
    document.getElementById('editUserGroupsRow').style.display = 'none'
  } else if (user.permissions.components.view.includes('__all')) {
    document.getElementById('editUserPermissionGroups').value = 'view'
    document.getElementById('editUserGroupsRow').style.display = 'none'
  } else if (user.permissions.components.edit.length === 0 && user.permissions.components.view.length === 0) {
    document.getElementById('editUserPermissionGroups').value = 'none'
    document.getElementById('editUserGroupsRow').style.display = 'none'
  } else {
    document.getElementById('editUserPermissionGroups').value = 'custom'
    document.getElementById('editUserGroupsRow').style.display = 'flex'
  }

  populateEditUserGroupsRow(user.permissions.components)
}

function populateEditUserGroupsRow (permissions) {
  // Create an entry for each group and configure any existing permissions.
  // 'permissions' should be of the form: {edit: ['group1',...], view: ['group2',...]}

  const row = document.getElementById('editUserGroupsRow')
  row.innerHTML = ''

  const groups = [{ name: 'Default', uuid: 'Default' }, ...exConfig.groups]
  for (const group of groups) {
    const col = document.createElement('div')
    col.classList = 'col d-flex flex-column justify-content-end'
    row.appendChild(col)

    const label = document.createElement('label')
    label.classList = 'form-label fst-italic'
    label.innerHTML = group.name
    col.appendChild(label)

    const select = document.createElement('select')
    select.classList = 'form-select editUserGroupSelect'
    select.setAttribute('data-uuid', group.uuid)
    select.addEventListener('change', () => {
      document.getElementById('editUserSubmitButton').style.display = 'block'
    })
    col.appendChild(select)

    const optionNone = new Option('None', 'none')
    select.appendChild(optionNone)
    const optionView = new Option('View', 'view')
    select.appendChild(optionView)
    const optionEditContent = new Option('Edit (content & definitions only)', 'edit_content')
    select.appendChild(optionEditContent)
    const optionEdit = new Option('Edit (content, definitions, & settings)', 'edit')
    select.appendChild(optionEdit)

    if (permissions.edit.includes(group.uuid)) {
      select.value = 'edit'
    } else if (permissions.edit_content.includes(group.uuid)) {
      select.value = 'edit_content'
    } else if (permissions.view.includes(group.uuid)) {
      select.value = 'view'
    } else select.value = 'none'
  }
}

export function submitChangeFromEditUserModal () {
  // Collect the necessary details and submit a new or edited user.

  const uuid = document.getElementById('editUserModal').getAttribute('data-uuid')

  const details = {
    username: document.getElementById('editUserUsernameInput').value.trim(),
    display_name: document.getElementById('editUserDisplayNameInput').value.trim(),
    permissions: {
      analytics: document.getElementById('editUserPermissionAnalytics').value,
      exhibits: document.getElementById('editUserPermissionExhibits').value,
      maintenance: document.getElementById('editUserPermissionMaintenance').value,
      schedule: document.getElementById('editUserPermissionSchedule').value,
      settings: document.getElementById('editUserPermissionSettings').value,
      users: document.getElementById('editUserPermissionUsers').value
    }
  }
  const groupsPermission = document.getElementById('editUserPermissionGroups').value
  if (groupsPermission === 'none') {
    details.permissions.components = { edit: [], edit_content: [], view: [] }
  } else if (groupsPermission === 'view') {
    details.permissions.components = { edit: [], edit_content: [], view: ['__all'] }
  } else if (groupsPermission === 'edit_content') {
    details.permissions.components = { edit: [], edit_content: ['__all'], view: [] }
  } else if (groupsPermission === 'edit') {
    details.permissions.components = { edit: ['__all'], edit_content: [], view: [] }
  } else {
    // Custom
    const obj = { edit: [], edit_content: [], view: [] }
    Array.from(document.querySelectorAll('.editUserGroupSelect')).forEach((el) => {
      const groupUUID = el.getAttribute('data-uuid')
      if (el.value === 'edit') {
        obj.edit.push(groupUUID)
      } else if (el.value === 'edit_content') {
        obj.edit_content.push(groupUUID)
      } else if (el.value === 'view') {
        obj.view.push(groupUUID)
      }
    })
    details.permissions.components = obj
  }

  if (details.username === '') {
    document.getElementById('editUserBlankUsername').style.display = 'block'
    return
  } else {
    document.getElementById('editUserBlankUsername').style.display = 'none'
  }
  if (details.display_name === '') {
    document.getElementById('editUserBlankDisplayname').style.display = 'block'
    return
  } else {
    document.getElementById('editUserBlankDisplayname').style.display = 'none'
  }
  const password1 = document.getElementById('editUserPassword1Input').value
  const password2 = document.getElementById('editUserPassword2Input').value

  if (password1 !== password2) {
    document.getElementById('editUserPasswordMismatch').style.display = 'block'
    return
  } else {
    document.getElementById('editUserPasswordMismatch').style.display = 'none'
  }

  if (uuid === '') {
    // Creating a new user

    if (password1 === '') {
      document.getElementById('editUserBlankPassword').style.display = 'block'
      return
    } else {
      document.getElementById('editUserBlankPassword').style.display = 'none'
    }
    details.password = password1
    exTools.makeServerRequest({
      method: 'POST',
      endpoint: '/user/create',
      params: details
    })
      .then((response) => {
        if (response.success === false && response.reason === 'username_taken') {
          document.getElementById('editUserUsernameExists').style.display = 'block'
        } else if (response.success === true) {
          $('#editUserModal').modal('hide')
          populateUsers()
        }
      })
  } else {
    // Editing an existing user
    if (password1 !== '') {
      details.password = password1
    }

    exTools.makeServerRequest({
      method: 'POST',
      endpoint: '/user/' + uuid + '/edit',
      params: details
    })
      .then((response) => {
        console.log(response)
        if (response.success === false && response.reason === 'username_taken') {
          document.getElementById('editUserUsernameExists').style.display = 'block'
        } else if (response.success === true) {
          $('#editUserModal').modal('hide')
          populateUsers()
        }
      })
  }
}

export function populateUsers () {
  // Retrieve a list of current users and create a representation of each.

  const usersRow = document.getElementById('usersRow')
  usersRow.innerHTML = ''

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/users/list'
  }).then((response) => {
    for (const user of response.users) {
      const col = document.createElement('div')
      col.classList = 'col'
      usersRow.appendChild(col)

      const button = document.createElement('button')
      button.classList = 'btn btn-secondary w-100'
      button.innerHTML = user.display_name
      button.addEventListener('click', () => {
        showEditUserModal(user)
      })
      col.appendChild(button)
    }
  })
}

export function loginFromDropdown () {
  // Collect the username and password and attempt to log in the user.

  const username = document.getElementById('loginDropdownUsername').value.trim().toLowerCase()
  const password = document.getElementById('loginDropdownPassword').value

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/user/login',
    params: {
      credentials: [username, password]
    }
  })
    .then((response) => {
      console.log(response)
      if (response.success === true) {
        // Reload the page now that the authentication cookie is set.
        location.reload()
      }
    })
}

export function authenticateUser () {
  // If authToken exists in the cookie, use it to log in

  let token = ''
  document.cookie.split(';').forEach((item) => {
    item = item.trim()
    if (item.startsWith('authToken="')) {
      token = item.slice(11, -1)
    }
  })

  if (token === '') {
    token = 'This will fail' // Token cannot be an empty string
    configureUser({}, false)
  }

  return exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/user/login'
  })
    .then((response) => {
      if (response.success === true) {
        configureUser(response.user)
      }
    })
}

function configureUser (userDict, login = true) {
  // Take a dictionary of user details and set up Constellation to reflect it.
  // set login=false to set up a logged out user

  if (Object.keys(userDict).length === 0) {
    // Configure minimal permissions
    userDict.permissions = {
      analytics: 'none',
      components: {
        edit: [],
        edit_content: [],
        view: []
      },
      exhibits: 'none',
      maintenance: 'none',
      schedule: 'none',
      settings: 'none',
      users: 'none'
    }
  }
  exConfig.user = userDict

  if (login === true) {
    document.getElementById('helpNewAccountMessage').style.display = 'none'
  } else {
    document.getElementById('helpNewAccountMessage').style.display = 'block'
  }

  if (login) {
    document.getElementById('loginMenu').style.display = 'none'
    document.getElementById('userMenu').style.display = 'block'

    // Set the name of the account
    document.getElementById('userMenuUserDisplayName').innerHTML = userDict.display_name
    let initials = ''
    userDict.display_name.split(' ').forEach((word) => {
      initials += word.slice(0, 1)
    })
    document.getElementById('userMenuUserShortName').innerHTML = initials
  } else {
    document.getElementById('loginMenu').style.display = 'block'
    document.getElementById('userMenu').style.display = 'none'
  }

  // Iterate through the tabs until we find one we can display.
  let match = ''

  if (userDict.permissions.components.edit.length > 0 || userDict.permissions.components.view.length > 0) {
    document.getElementById('nav-components-tab').style.setProperty('display', 'block', 'important')
    if (match === '') match = 'components'
  } else {
    document.getElementById('nav-components-tab').style.setProperty('display', 'none', 'important')
  }

  if (exTools.checkPermission('schedule', 'view')) {
    document.getElementById('nav-schedule-tab').style.display = 'block'
    configureSchedulePermissions()
    if (match === '') match = 'schedule'
  } else {
    document.getElementById('nav-schedule-tab').style.setProperty('display', 'none', 'important')
  }

  if (exTools.checkPermission('exhibits', 'view')) {
    document.getElementById('nav-exhibits-tab').style.display = 'block'
    document.getElementById('nav-exhibits-dropdown-tab').style.display = 'block'
    if (match === '') match = 'exhibits'
  } else {
    document.getElementById('nav-exhibits-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-exhibits-dropdown-tab').style.setProperty('display', 'none', 'important')
  }

  if (exTools.checkPermission('maintenance', 'view')) {
    document.getElementById('nav-issues-tab').style.display = 'block'
    document.getElementById('nav-issues-dropdown-tab').style.display = 'block'
    configureMaintenancePermissions()
    if (match === '') match = 'issues'
  } else {
    document.getElementById('nav-issues-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-issues-dropdown-tab').style.setProperty('display', 'none', 'important')
  }

  if (exTools.checkPermission('analytics', 'view')) {
    document.getElementById('nav-analytics-tab').style.display = 'block'
    document.getElementById('nav-analytics-dropdown-tab').style.display = 'block'
    if (match === '') match = 'analytics'
  } else {
    document.getElementById('nav-analytics-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-analytics-dropdown-tab').style.setProperty('display', 'none', 'important')
  }

  if (exTools.checkPermission('users', 'view')) {
    document.getElementById('nav-users-tab').style.display = 'block'
    document.getElementById('nav-users-dropdown-tab').style.display = 'block'
    if (match === '') match = 'users'
  } else {
    document.getElementById('nav-users-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-users-dropdown-tab').style.setProperty('display', 'none', 'important')
  }

  if (exTools.checkPermission('settings', 'view')) {
    document.getElementById('nav-settings-tab').style.display = 'block'
    document.getElementById('nav-settings-dropdown-tab').style.display = 'block'
    if (match === '') match = 'settings'
  } else {
    document.getElementById('nav-settings-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-settings-dropdown-tab').style.setProperty('display', 'none', 'important')
  }
  if (match === '') match = 'help'
  _showTab(match)
}

function _showTab (tab) {
  setTimeout(() => {
    $('#nav-' + tab + '-tab').tab('show')
  }, 20)
}

export function logoutUser () {
  // Remove the user and delete the cookie.

  document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
  location.reload()
}

function configureSchedulePermissions () {
  // Configure the schedule to respect the level of user permission.

  if (exTools.checkPermission('schedule', 'edit')) {
    // User may edit
    document.getElementById('showScheduleFromFileModalButton').parentElement.style.display = 'block'
  } else {
    // User may view
    document.getElementById('showScheduleFromFileModalButton').parentElement.style.display = 'none'
  }
}

function configureMaintenancePermissions () {
  // Configure the maintenance tab to respect the level of user permission.

  const createIssueButtonCol = document.getElementById('createIssueButton').parentNode
  if (exTools.checkPermission('maintenance', 'edit')) {
    // User may edit
    createIssueButtonCol.style.setProperty('display', 'block')
  } else {
    // User may view only
    createIssueButtonCol.style.setProperty('display', 'none', 'important')
  }
}

export function showPasswordChangeModal () {
  // Prepare the modal for changing the current user's password and show it.

  // Hide warnings and clear fields
  document.getElementById('passwordChangeModalCurrentPassword').value = ''
  document.getElementById('passwordChangeModalNewPassword1').value = ''
  document.getElementById('passwordChangeModalNewPassword2').value = ''

  document.getElementById('passwordChangeModalNoCurrentPassWarning').style.display = 'none'
  document.getElementById('passwordChangeModalNoBlankPassWarning').style.display = 'none'
  document.getElementById('passwordChangeModalPassMismatchWarning').style.display = 'none'
  document.getElementById('passwordChangeModalBadCurrentPassWarning').style.display = 'none'

  $('#passwordChangeModal').modal('show')
}

export function submitUserPasswordChange () {
  // Collect the relevant details from the password change modal and submit it

  const currentPass = document.getElementById('passwordChangeModalCurrentPassword').value
  const newPass1 = document.getElementById('passwordChangeModalNewPassword1').value
  const newPass2 = document.getElementById('passwordChangeModalNewPassword2').value
  if (currentPass === '') {
    document.getElementById('passwordChangeModalNoCurrentPassWarning').style.display = 'block'
    return
  } else {
    document.getElementById('passwordChangeModalNoCurrentPassWarning').style.display = 'none'
  }
  if (newPass1 === '') {
    document.getElementById('passwordChangeModalNoBlankPassWarning').style.display = 'block'
    return
  } else {
    document.getElementById('passwordChangeModalNoBlankPassWarning').style.display = 'none'
  }
  if (newPass1 !== newPass2) {
    document.getElementById('passwordChangeModalPassMismatchWarning').style.display = 'block'
    return
  } else {
    document.getElementById('passwordChangeModalPassMismatchWarning').style.display = 'none'
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/user/' + exConfig.user.uuid + '/changePassword',
    params: {
      current_password: currentPass,
      new_password: newPass1
    }
  })
    .then((response) => {
      if (response.success === false) {
        if (response.reason === 'authentication_failed') {
          document.getElementById('passwordChangeModalBadCurrentPassWarning').style.display = 'block'
        }
      } else {
        $('changePasswordModal').modal('hide')
        logoutUser()
      }
    })
}
