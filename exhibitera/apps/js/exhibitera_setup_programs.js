// A kiosk's location, so Hub can tag its records with the program running there, for Voting and Survey Kiosk's
// setup pages. Each page has #locationCol, with #locationSelect and #locationLoadWarning, and #programWindowCol,
// with the #behaviorInput_minutes_after_program advanced slider.

import * as exCommon from './exhibitera_app_common.js'
import * as exSetup from './exhibitera_setup_common.js'

// Hub's groups, which a kiosk can be set to as its location, as [{ uuid, name }]. null until loaded, or if
// they couldn't be.
let hubLocations = null
let hubLocationsLoading = null
// The location most recently asked to be shown, so a slower, earlier request doesn't replace it
let locationToShow = ''

function loadHubLocations () {
  // Load Hub's groups once, sorted by name

  hubLocationsLoading ??= exCommon.makeServerRequest({ method: 'GET', endpoint: '/program/locations' })
    .then((result) => {
      if (result?.success === true && Array.isArray(result.locations)) {
        hubLocations = [...result.locations].sort((a, b) => String(a.name).localeCompare(String(b.name)))
      }
    }, () => {
      // Hub couldn't be reached. The saved location is kept, and the warning says why there are no others.
    })
  return hubLocationsLoading
}

export function showProgramSettings (definition) {
  // Show the given definition's location, and how long after a program its records still count

  exSetup.createAdvancedSlider(document.getElementById('behaviorInput_minutes_after_program'),
    definition?.behavior?.minutes_after_program)
  showLocation(definition?.behavior?.location ?? '')
}

async function showLocation (locationUUID = '') {
  // Show the location selector, with the given location selected. It's only used with Hub.

  const col = document.getElementById('locationCol')
  if (exCommon.config.standalone !== false) {
    col.style.display = 'none'
    showProgramWindow('')
    return
  }
  col.style.display = 'block'
  showProgramWindow(locationUUID)

  locationToShow = locationUUID
  await loadHubLocations()
  if (locationToShow !== locationUUID) return

  const select = document.getElementById('locationSelect')
  const options = [new Option("None (don't record programs)", '')]
  for (const location of hubLocations ?? []) options.push(new Option(location.name, location.uuid))
  // Keep a location Hub no longer has, so saving other changes doesn't drop it
  if (locationUUID !== '' && !(hubLocations ?? []).some((location) => location.uuid === locationUUID)) {
    options.push(new Option('Unknown location', locationUUID))
  }
  select.replaceChildren(...options)
  select.value = locationUUID
  document.getElementById('locationLoadWarning').style.display = hubLocations == null ? 'block' : 'none'
}

function showProgramWindow (locationUUID) {
  // How long after a program its records count only matters once the kiosk has a location

  document.getElementById('programWindowCol').style.display = locationUUID === '' ? 'none' : 'block'
}

export function connectProgramSettings () {
  // Save the location when it's chosen

  document.getElementById('locationSelect').addEventListener('change', (event) => {
    // The location doesn't change how the kiosk looks, so there's nothing to preview
    exSetup.updateWorkingDefinition(['behavior', 'location'], event.target.value)
    showProgramWindow(event.target.value)
  })
}
