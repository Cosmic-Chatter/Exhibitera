import * as exCommon from '../js/exhibitera_app_common.js'
import * as exSetup from '../js/exhibitera_setup_common.js'

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
    if (exCommon.config.standalone === false) {
      // Using Hub
      document.getElementById('standaloneWelcome').style.display = 'none'
      document.getElementById('hubWelcome').style.display = 'block'
      document.getElementById('hubAddress').innerHTML = exCommon.config.serverAddress

      exCommon.sendPing()
      setInterval(exCommon.sendPing, 5000)
      if (exCommon.config.connectionChecker != null) setInterval(exCommon.config.connectionChecker, 500)
    } else {
      // Not using Hub
      document.getElementById('standaloneWelcome').style.display = 'block'
      document.getElementById('hubWelcome').style.display = 'none'
      exCommon.loadDefinition(exCommon.config.currentDefinition)
    }
  })

// Activate app links
Array.from(document.querySelectorAll('.app-link')).forEach((el) => {
  el.addEventListener('click', (event) => {
    exSetup.gotoAppLink(event.target)
  })
})
