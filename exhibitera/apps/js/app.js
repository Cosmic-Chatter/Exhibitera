import * as exCommon from '../js/exhibitera_app_common.js'

function updateParser (update) {
  // Read updates
}

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

exCommon.config.updateParser = updateParser // Function to read app-specific updatess
exCommon.config.exhibiteraAppID = 'none'
exCommon.config.debug = true
exCommon.config.helperAddress = window.location.origin

exCommon.askForDefaults()
  .then(() => {
    console.log(exCommon.config)
    if (exCommon.config.standalone === false) {
      // Using Control Server
      document.getElementById('standaloneWelcome').style.display = 'none'
      document.getElementById('controlServerWelcome').style.display = 'block'
      document.getElementById('controlServerAddress').innerHTML = exCommon.config.serverAddress

      exCommon.sendPing()
      setInterval(exCommon.sendPing, 5000)
      if (exCommon.config.connectionChecker != null) setInterval(exCommon.config.connectionChecker, 500)
    } else {
      // Not using Control Server
      document.getElementById('standaloneWelcome').style.display = 'block'
      document.getElementById('controlServerWelcome').style.display = 'none'
      exCommon.loadDefinition(exCommon.config.currentDefinition)
    }
  })

document.getElementById('settingsButton').addEventListener('click', (event) => {
  if (exCommon.config.remoteDisplay === true) {
    // Switch webpages in the browser

    window.open(window.location.origin + '/setup.html', '_blank').focus()
  } else {
    // Launch the appropriate webview page in the app

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/app/showWindow/settings',
      params: { reload: true }
    })
  }
})
