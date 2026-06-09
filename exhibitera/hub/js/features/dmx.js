import * as exUtilities from '../../../common/utilities.js'

export function populateDMXScenesForInfoModal (scenes, helperURL) {
  // Take an array of scenes and build an HTML representation for each scene.

  const container = document.getElementById('componentInfoModalDMXSceneList')
  container.innerHTML = ''

  for (const scene of scenes) {
    const col = document.createElement('div')
    col.classList = 'col-6 col-sm-4 mt-2 handCursor dmx-entry'
    col.addEventListener('click', (event) => {
      exUtilities.makeRequest({
        method: 'GET',
        url: helperURL,
        endpoint: '/DMX/scene/' + scene.uuid + '/set'
      })
        .then((response) => {
          if (response?.success === true) {
            const nameEl = document.getElementById('DMXEntryName_' + scene.uuid)
            nameEl.classList.add('bg-success')
            nameEl.classList.remove('bg-primary')
            setTimeout(() => {
              nameEl.classList.remove('bg-success')
              nameEl.classList.add('bg-primary')
            }, 1000)
          }
        })
    })
    container.appendChild(col)

    const row = document.createElement('div')
    row.classList = 'row px-2'
    col.appendChild(row)

    const name = document.createElement('div')
    name.classList = 'col-12 bg-primary text-white rounded-top py-1 position-relative'
    name.setAttribute('id', 'DMXEntryName_' + scene.uuid)
    name.style.fontSize = '18px'
    name.innerHTML = scene.name
    row.appendChild(name)
  }
}
