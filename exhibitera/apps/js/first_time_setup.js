import * as exCommon from './exhibitera_app_common.js'

function pageForward (current) {
  // Based on the current page, check that it is complete and go to the next one.

  if (current === 'welcome') {
    document.getElementById('welcome').style.display = 'none'
    document.getElementById('control-server').style.display = 'block'
  } else if (current === 'control-server') {
    let moveOn = false
    const thisPage = document.getElementById('control-server')
    let nextPage
    const warning = document.getElementById('controlServerDetailsWarning')

    if (document.getElementById('useControlServerToggle').checked === true) {
      if ((document.getElementById('controlServerIPInput').value.trim() === '') || (document.getElementById('controlServerPortInput').value.trim() === '')) {
        warning.style.display = 'block'
      } else {
        moveOn = true
        nextPage = document.getElementById('hub-auth')
        warning.style.display = 'none'
        document.getElementById('hub-auth-success').style.display = 'none'
        document.getElementById('hub-auth-insufficient').style.display = 'none'
        document.getElementById('hub-auth-failure').style.display = 'none'
        document.getElementById('hub-auth-bad').style.display = 'none'
      }
    } else {
      moveOn = true
      nextPage = document.getElementById('remote-display')

      warning.style.display = 'none'
    }
    if (moveOn === true) {
      thisPage.style.display = 'none'
      nextPage.style.display = 'block'
    }
  } else if (current === 'hub-auth') {
    let moveOn = false
    const thisPage = document.getElementById('hub-auth')
    const nextPage = document.getElementById('remote-display')

    if (document.getElementById('hub-auth').getAttribute('data-authenticated') === 'true') {
      // Successfully authenticated
      moveOn = true
    }
    if (moveOn === true) {
      thisPage.style.display = 'none'
      nextPage.style.display = 'block'
    }
  } else if (current === 'remote-display') {
    document.getElementById('remote-display').style.display = 'none'
    if (document.getElementById('useControlServerToggle').checked === true) {
      document.getElementById('basic-settings').style.display = 'block'
    } else {
      // Skip basic settings if we're not using Hub
      populateSummary()
      document.getElementById('summary').style.display = 'block'
    }
  } else if (current === 'basic-settings') {
    let moveOn = false
    const IDInput = document.getElementById('IDInput')
    const warning = document.getElementById('basicSettingsWarning')
    if (IDInput.value.trim() === '') {
      warning.style.display = 'block'
    } else {
      moveOn = true
      warning.style.display = 'none'
    }
    if (moveOn === true) {
      populateSummary()
      document.getElementById('basic-settings').style.display = 'none'
      document.getElementById('summary').style.display = 'block'
    }
  } else if (current === 'summary') {
    submitSettings()
  }
}

function populateSummary () {
  // Use the settings on the various pages to populate a summary of selected settings.

  // Hub
  if (document.getElementById('useControlServerToggle').checked === true) {
    document.getElementById('summaryControlServerIP').innerHTML = document.getElementById('controlServerIPInput').value.trim()
    document.getElementById('summaryControlServerPort').innerHTML = document.getElementById('controlServerPortInput').value.trim()

    document.getElementById('summaryNoControlCenter').style.display = 'none'
    document.getElementById('summaryControlServerDetails').style.display = 'block'
  } else {
    document.getElementById('summaryNoControlCenter').style.display = 'block'
    document.getElementById('summaryControlServerDetails').style.display = 'none'
  }
  // Remote display
  if (document.getElementById('useRemoteDisplayToggle').checked === true) {
    document.getElementById('summaryPort').innerHTML = document.getElementById('remoteDisplayPortInput').value.trim()
    document.getElementById('summaryNoRemoteDisplay').style.display = 'none'
    document.getElementById('summaryRemoteDisplayDetails').style.display = 'block'
  } else {
    document.getElementById('summaryNoRemoteDisplay').style.display = 'block'
    document.getElementById('summaryRemoteDisplayDetails').style.display = 'none'
  }
  // Basic settings
  document.getElementById('summaryID').innerHTML = document.getElementById('IDInput').value.trim()
  if (document.getElementById('useControlServerToggle').checked === false) {
    document.getElementById('summaryBasicSettings').style.display = 'none'
  } else {
    document.getElementById('summaryBasicSettings').style.display = 'block'
  }
}

function pageBack (current) {
  // Based on the current page, go back one page.

  if (current === 'control-server') {
    document.getElementById('control-server').style.display = 'none'
    document.getElementById('welcome').style.display = 'block'
  } else if (current === 'hub-auth') {
    document.getElementById('control-server').style.display = 'block'
    document.getElementById('hub-auth').style.display = 'none'
  } else if (current === 'remote-display') {
    document.getElementById('remote-display').style.display = 'none'
    document.getElementById('control-server').style.display = 'block'
  } else if (current === 'basic-settings') {
    document.getElementById('basic-settings').style.display = 'none'
    document.getElementById('remote-display').style.display = 'block'
  } else if (current === 'summary') {
    document.getElementById('summary').style.display = 'none'
    if (document.getElementById('useControlServerToggle').checked === true) {
      // Goto basic settings
      document.getElementById('basic-settings').style.display = 'block'
    } else {
      // Skip back to remote display
      document.getElementById('remote-display').style.display = 'block'
    }
  }
}

function onUseControlServerToggle () {
  // Called when the user toggles the switch to use Hub

  if (document.getElementById('useControlServerToggle').checked === true) {
    document.getElementById('controlServerIPInputGroup').style.display = 'block'
    document.getElementById('controlServerPortInputGroup').style.display = 'block'
  } else {
    document.getElementById('controlServerIPInputGroup').style.display = 'none'
    document.getElementById('controlServerPortInputGroup').style.display = 'none'
  }
}

function onUseRemoteDisplayToggle () {
  // Called when the user toggles the switch to use a remote display

  if (document.getElementById('useRemoteDisplayToggle').checked === true) {
    document.getElementById('remoteDisplayPortInputGroup').style.display = 'block'
  } else {
    document.getElementById('remoteDisplayPortInputGroup').style.display = 'none'
  }
}

function authenticateUser () {
  // Use the provided user credentials to log in to Hub and confirm the user
  // has the required permission.

  const user = document.getElementById('loginUsername').value.trim()
  const password = document.getElementById('loginPassword').value
  const hubIP = document.getElementById('controlServerIPInput').value
  const hubPort = document.getElementById('controlServerPortInput').value
  const serverAddress = 'http://' + hubIP + ':' + hubPort

  const successMsg = document.getElementById('hub-auth-success')
  const permissionMsg = document.getElementById('hub-auth-insufficient')
  const failureMsg = document.getElementById('hub-auth-failure')
  const badConnectionMsg = document.getElementById('hub-auth-bad')

  exCommon.makeRequest({
    method: 'POST',
    url: serverAddress,
    endpoint: '/user/login',
    params: { credentials: [user, password] }
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        failureMsg.style.display = 'none'
        badConnectionMsg.style.display = 'none'
        if (response.user.permissions.settings === 'edit') {
          successMsg.style.display = 'block'
          permissionMsg.style.display = 'none'
          document.getElementById('hub-auth').setAttribute('data-authenticated', 'true')
        } else {
          successMsg.style.display = 'none'
          permissionMsg.style.display = 'block'
        }
      } else {
        successMsg.style.display = 'none'
        permissionMsg.style.display = 'none'
        failureMsg.style.display = 'block'
      }
    })
    .catch(() => {
      badConnectionMsg.style.display = 'block'
      successMsg.style.display = 'none'
      permissionMsg.style.display = 'none'
      failureMsg.style.display = 'none'
    })
}

function submitSettings () {
  // Collect the settings configured by the wizard and send them to the helper.
  const settings = {
    app: {},
    control_server: {},
    permissions: {},
    system: {}
  }
  if (document.getElementById('useControlServerToggle').checked === true) {
    settings.system.standalone = false
    settings.app.id = document.getElementById('IDInput').value.trim()
    settings.control_server.ip_address = document.getElementById('controlServerIPInput').value.trim()
    settings.control_server.port = parseInt(document.getElementById('controlServerPortInput').value.trim()) || 8082
  } else {
    settings.system.standalone = true
  }
  if (document.getElementById('useRemoteDisplayToggle').checked === true) {
    settings.system.remote_display = true
    settings.system.port = parseInt(document.getElementById('remoteDisplayPortInput').value.trim()) || 8000
  } else {
    settings.system.remote_display = false
  }

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/system/configuration/update',
    params: {
      defaults: settings
    }
  })
    .then((result) => {
      exCommon.makeHelperRequest({
        method: 'GET',
        endpoint: '/app/closeSetupWizard'
      })
    })
}

// Add event listeners
Array.from(document.querySelectorAll('.next-button')).forEach((el) => {
  el.addEventListener('click', (event) => {
    pageForward(event.target.getAttribute('data-page'))
  })
})
Array.from(document.querySelectorAll('.back-button')).forEach((el) => {
  el.addEventListener('click', (event) => {
    pageBack(event.target.getAttribute('data-page'))
  })
})
document.getElementById('useControlServerToggle').addEventListener('change', onUseControlServerToggle)
document.getElementById('useRemoteDisplayToggle').addEventListener('change', onUseRemoteDisplayToggle)
document.getElementById('loginSubmitButton').addEventListener('click', authenticateUser)

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Set helper address for Exhibitera
exCommon.config.helperAddress = window.location.origin
