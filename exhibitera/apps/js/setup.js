/* global bootstrap, showdown, $ */

import * as exCommon from './exhibitera_app_common.js'
import * as exSetup from './exhibitera_setup_common.js'
import * as exFileSelectModal from './exhibitera_file_select_modal.js'

function updateParser (update) {
  // Take a list of defaults and build the interface for editing them.

  if ('app' in update) {
    if ('id' in update.app) {
      document.getElementById('IDInput').value = update.app.id
    }
  }
  if ('control_server' in update) {
    if ('ip_address' in update.control_server) {
      document.getElementById('controlServerIPInput').value = update.control_server.ip_address
    }
    if ('port' in update.control_server) {
      document.getElementById('controlServerPortInput').value = update.control_server.port
    }
  }
  if ('permissions' in update) {
    if ('audio' in update.permissions) {
      document.getElementById('permissionsAudioInput').value = String(update.permissions.audio)
    }
    if ('refresh' in update.permissions) {
      document.getElementById('permissionsRefreshInput').value = String(update.permissions.refresh)
    }
    if ('restart' in update.permissions) {
      document.getElementById('permissionsRestartInput').value = String(update.permissions.restart)
    }
    if ('shutdown' in update.permissions) {
      document.getElementById('permissionsShutdownInput').value = String(update.permissions.shutdown)
    } else {
      document.getElementById('permissionsShutdownInput').value = 'false'
    }
    if ('sleep' in update.permissions) {
      document.getElementById('permissionsSleepInput').value = String(update.permissions.sleep)
    }
  }
  if ('smart_restart' in update) {
    if ('state' in update.smart_restart) {
      document.getElementById('smartRestartStateSelect').value = update.smart_restart.state
    }
    if ('interval' in update.smart_restart) {
      document.getElementById('smartRestartIntervalInput').value = update.smart_restart.interval
    }
    if ('threshold' in update.smart_restart) {
      document.getElementById('smartRestartThresholdInput').value = update.smart_restart.threshold
    }
  }
  if ('software_update' in update && update.software_update.update_available === true) {
    document.getElementById('showUpdateInfoButtonCol').style.display = 'block'
  } else {
    document.getElementById('showUpdateInfoButtonCol').style.display = 'none'
  }
  if ('system' in update) {
    if ('active hours' in update.system) {
      document.getElementById('activeHoursStartInput').value = update.system.active_hours.start
      document.getElementById('activeHoursEndInput').value = update.system.active_hours.end
    }
    if ('port' in update.system) {
      document.getElementById('remoteDisplayPortInput').value = update.system.port
    }
    if ('remote_display' in update.system) {
      document.getElementById('useRemoteDisplayToggle').checked = update.system.remote_display
    }
    if ('standalone' in update.system) {
      document.getElementById('useControlServerToggle').checked = !update.system.standalone
    }
  }
  configureInterface()
}

function showUpdateInfoModal (details) {
  // Populate the model with details about the update and show it.

  return exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getDefaults'
  })
    .then((result) => {
      const details = result.software_update

      $('#updateInfoModalCurrentVersion').html(details.current_version)
      $('#updateInfoModalLatestVersion').html(details.available_version)
      $('#updateInfoModalDownloadButton').attr('href', 'https://exhibitera.org/download/')

      // Get the changelog
      exCommon.makeRequest({
        method: 'GET',
        url: 'https://raw.githubusercontent.com/Cosmic-Chatter/Exhibitera/main/exhibitera/changelog.md',
        endpoint: '',
        rawResponse: true
      })
        .then((response) => {
          const markdownConverter = new showdown.Converter({ headerLevelStart: 4.0 })
          markdownConverter.setFlavor('github')

          const formattedText = markdownConverter.makeHtml(response)
          $('#updateInfoModalChangelogContainer').html(formattedText)
        })

      $('#updateInfoModal').modal('show')
    })
}

function saveConfiguration () {
  // Construct an object from the user settings and send it to the helper for saving.

  const defaults = {
    app: {},
    system: {
      remote_display: document.getElementById('useRemoteDisplayToggle').checked,
      standalone: !document.getElementById('useControlServerToggle').checked
    }
  }

  if (defaults.system.standalone === false) {
    // We are using Hub, so update relevant defaults
    defaults.app.id = document.getElementById('IDInput').value.trim()
    defaults.control_server = {
      ip_address: document.getElementById('controlServerIPInput').value.trim(),
      port: parseInt(document.getElementById('controlServerPortInput').value)
    }
    defaults.permissions = {
      audio: exCommon.stringToBool(document.getElementById('permissionsAudioInput').value),
      refresh: exCommon.stringToBool(document.getElementById('permissionsRefreshInput').value),
      restart: exCommon.stringToBool(document.getElementById('permissionsRestartInput').value),
      shutdown: exCommon.stringToBool(document.getElementById('permissionsShutdownInput').value),
      sleep: exCommon.stringToBool(document.getElementById('permissionsSleepInput').value)
    }
    defaults.smart_restart = {
      state: document.getElementById('smartRestartStateSelect').value,
      interval: parseInt(document.getElementById('smartRestartIntervalInput').value),
      threshold: parseInt(document.getElementById('smartRestartThresholdInput').value)
    }
    defaults.system.active_hours = {
      start: document.getElementById('activeHoursStartInput').value.trim(),
      end: document.getElementById('activeHoursEndInput').value.trim()
    }
  } else {
    // We are not using Hub
    defaults.app.definition = document.getElementById('definitionSelect').value
  }

  if (defaults.system.remote_display === true) {
    defaults.system.port = parseInt(document.getElementById('remoteDisplayPortInput').value)
  }

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/setDefaults',
    params: { defaults }
  })
    .then((result) => {
      const el = document.getElementById('saveDefaultsButton')
      el.classList.add('btn-success')
      el.classList.remove('btn-primary')
      el.innerHTML = 'Saved!'
      setTimeout(() => {
        console.log('here')
        el.classList.remove('btn-success')
        el.classList.add('btn-primary')
        el.innerHTML = 'Save changes'
      }, 2000)
    })
    .catch((result) => {
      const el = document.getElementById('saveDefaultsButton')
      el.classList.add('btn-danger')
      el.classList.remove('btn-primary')
      el.innerHTML = 'Error'
      setTimeout(() => {
        console.log('here')
        el.classList.remove('btn-danger')
        el.classList.add('btn-primary')
        el.innerHTML = 'Save changes'
      }, 2000)
    })
  console.log(defaults)
}

function configureInterface () {
  // Check the state of various toggles and show/hide interface elements as appropriate.

  // Hub
  if (document.getElementById('useControlServerToggle').checked === true) {
    document.getElementById('IDInputGroup').style.display = 'block'
    document.getElementById('definitionSelectGroup').style.display = 'none'
    document.getElementById('controlServerIPInputGroup').style.display = 'block'
    document.getElementById('controlServerPortInputGroup').style.display = 'block'
    document.getElementById('smartRestartPane').style.display = 'block'
    document.getElementById('permissionsPane').style.display = 'block'
    document.getElementById('votingKioskCSVDownloadDiv').style.display = 'none'
  } else {
    document.getElementById('IDInputGroup').style.display = 'none'
    document.getElementById('definitionSelectGroup').style.display = 'block'
    document.getElementById('controlServerIPInputGroup').style.display = 'none'
    document.getElementById('controlServerPortInputGroup').style.display = 'none'
    document.getElementById('smartRestartPane').style.display = 'none'
    document.getElementById('permissionsPane').style.display = 'none'
    document.getElementById('votingKioskCSVDownloadDiv').style.display = 'block'
  }
  // Remote display
  if (document.getElementById('useRemoteDisplayToggle').checked === true) {
    document.getElementById('remoteDisplayPortInputGroup').style.display = 'block'
  } else {
    document.getElementById('remoteDisplayPortInputGroup').style.display = 'none'
  }
  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/system/getPlatformDetails'
  })
    .then((result) => {
      if (result.os === 'linux') {
        document.getElementById('useRemoteDisplayToggle').setAttribute('disabled', true)
      }
    })

  // Smart Restart
  if (document.getElementById('smartRestartStateSelect').value === 'off') {
    Array.from(document.querySelectorAll('.smart-restart-options-div')).forEach((el) => {
      el.style.display = 'none'
    })
  } else {
    Array.from(document.querySelectorAll('.smart-restart-options-div')).forEach((el) => {
      el.style.display = 'block'
    })
  }
}

function loadVersion () {
  // Load version.txt and update the GUI with the current version

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/_static/version.txt',
    rawResponse: true
  })
    .then((response) => {
      $('#versionSpan').html(response)
    })
}

function populateAvailableData () {
  // Get a list of available data files and populate the voting kiosk download select

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/data/getAvailable'
  })
    .then((result) => {
      const select = document.getElementById('votingKioskCSVDownloadSelect')
      select.innerHTML = ''

      result.files.forEach((file) => {
        const split = file.split('.')
        const noExt = split.slice(0, -1).join('.')
        const option = new Option(noExt)
        select.appendChild(option)
      })
    })
}

function downloadDataAsCSV () {
  // Download the currently selected data file as a CSV file.

  const name = document.getElementById('votingKioskCSVDownloadSelect').value
  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/data/getCSV',
    params: { name }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        if (exCommon.config.remoteDisplay === false) {
          // Ask the app to create a save dialog
          exCommon.makeHelperRequest({
            method: 'POST',
            endpoint: '/app/saveFile',
            params: {
              data: result.csv,
              filename: name + '.csv'
            }
          })
        } else {
          // Ask the browser to initiate a download
          const fileBlob = new Blob([result.csv], {
            type: 'text/plain'
          })
          const a = document.createElement('a')
          a.href = window.URL.createObjectURL(fileBlob)
          a.download = name + '.csv'
          a.click()
        }
      }
    })
}

function populateHelpTab () {
  // Load the overall README.md and add its contents to the Help tab

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/README.md',
    rawResponse: true
  })
    .then((result) => {
      const formattedText = markdownConverter.makeHtml(result)

      // Add the formatted text
      $('#mainHelpTextDiv').html(formattedText)
    })
}

function populateAvailableDefinitions () {
  // Get a list of available definitions and format it for the select.

  const definitionSelect = document.getElementById('definitionSelect')
  definitionSelect.innerHTML = ''

  const optionsByApp = {}

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((result) => {
      // First, create option elements and sort them into catefories by app
      Object.keys(result.definitions).forEach((key) => {
        const def = result.definitions[key]
        if (def.uuid.slice(0, 9) === '__preview') return

        const option = new Option(def.name, def.uuid)
        if (def.app in optionsByApp) {
          optionsByApp[def.app].push(option)
        } else {
          optionsByApp[def.app] = [option]
        }
      })
      // Then, sort the categories and add them with header entries
      Object.keys(optionsByApp).sort().forEach((app) => {
        const header = new Option(exCommon.appNameToDisplayName(app))
        header.setAttribute('disabled', true)
        definitionSelect.appendChild(header)

        optionsByApp[app].sort().forEach((option) => definitionSelect.appendChild(option))
      })
    })
}

function gotoAppLink (el) {
  // Navigate to the link given by element el, either in the browser or in the webview

  if (exCommon.config.remoteDisplay === true) {
    // Switch webpages in the browser

    const endpoint = el.getAttribute('data-web-link')
    window.open(window.location.origin + endpoint, '_blank').focus()
  } else {
    // Launch the appropriate webview page in the app

    const page = el.getAttribute('data-app-link')
    let reload = false
    if (page === 'app') {
      reload = true
    }
    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/app/showWindow/' + page,
      params: { reload }
    })
  }
}

function configureUser (user) {
  // Configure the interface for the permissions of the given user

  // Check whether the user has permission to edit this component
  exCommon.makeServerRequest({
    method: 'GET',
    endpoint: '/component/' + exCommon.config.uuid + '/groups'
  })
    .then((response) => {
      let groups = []
      if ('success' in response) {
        groups = response.groups
      }

      let allowed = false

      if (user.permissions.components.edit.includes('__all') || user.permissions.components.edit_content.includes('__all')) {
        allowed = true
      } else {
        for (const group of groups) {
          if (user.permissions.components.edit.includes(group) || user.permissions.components.edit_content.includes(group)) {
            allowed = true
          }
        }
      }

      if (allowed) {
        document.getElementById('helpInsufficientPermissionstMessage').style.display = 'none'
      } else {
        if (exSetup.config.loggedIn === true) {
          document.getElementById('helpInsufficientPermissionstMessage').style.display = 'block'
        }
        document.getElementById('nav-settings-tab').style.setProperty('display', 'none', 'important')
        document.getElementById('nav-apps-tab').style.setProperty('display', 'none', 'important')
        setTimeout(() => {
          $('#nav-help-tab').tab('show')
        }, 20)
      }
    })
}

exCommon.config.helperAddress = window.location.origin
exCommon.config.updateParser = updateParser // Function to read app-specific updates
exCommon.config.exhibiteraAppID = 'settings'

// Activate tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

const markdownConverter = new showdown.Converter()
markdownConverter.setFlavor('github')

exCommon.askForDefaults(false)
  .then(() => {
    if (exCommon.config.standalone === false) {
      // We are using Hub, so attempt to log in
      exSetup.authenticateUser()
        .then(() => {
          configureUser(exSetup.config.user)
        })
        .catch(() => {
          // This has likely failed because of no connection to Hub
        })
    } else {
      // Hide the login details
      document.getElementById('loginMenu').style.display = 'none'
    }
  })
loadVersion()
populateHelpTab()
populateAvailableData()
populateAvailableDefinitions()

// Add event handlers
exSetup.createLoginEventListeners()

// Activate app links
Array.from(document.querySelectorAll('.app-link')).forEach((el) => {
  el.addEventListener('click', (event) => {
    gotoAppLink(event.target)
  })
})

// Settings page
document.getElementById('showUpdateInfoButton').addEventListener('click', (event) => {
  showUpdateInfoModal()
})
document.getElementById('saveDefaultsButton').addEventListener('click', (event) => {
  saveConfiguration()
})
document.getElementById('manageContentButton').addEventListener('click', (event) => {
  exFileSelectModal.createFileSelectionModal({ manage: true })
})
document.getElementById('definitionSelectListRefresh').addEventListener('click', populateAvailableDefinitions)
Array.from(document.querySelectorAll('.gui-toggle')).forEach((el) => {
  el.addEventListener('change', configureInterface)
})
document.getElementById('smartRestartStateSelect').addEventListener('change', (event) => {
  configureInterface()
})
document.getElementById('useRemoteDisplayToggle').addEventListener('change', (event) => {
  document.getElementById('remoteDisplayRestartRequiredWarning').style.display = 'block'
})

// Apps page
document.getElementById('votingKioskCSVDownloadButton').addEventListener('click', downloadDataAsCSV)

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}
