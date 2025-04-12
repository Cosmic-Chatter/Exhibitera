import * as exTools from '../tools.js'

export function populateDMXScenesForInfoModal (groups, helperURL) {
  // Take an array of groups and build an HTML representation for each scene.

  const container = document.getElementById('componentInfoModalDMXSceneList')
  container.innerHTML = ''

  groups.forEach(group => {
    group.scenes.forEach(scene => {
      const col = document.createElement('div')
      col.classList = 'col-6 col-sm-4 mt-2 handCursor dmx-entry'
      col.addEventListener('click', (event) => {
        exTools.makeRequest({
          method: 'POST',
          url: helperURL,
          endpoint: '/DMX/group/' + group.uuid + '/showScene',
          params: { uuid: scene.uuid }
        })
          .then((response) => {
            if ('success' in response && response.success === true) {
              console.log(event.target)
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

      const groupDiv = document.createElement('div')
      groupDiv.classList = 'col-12 bg-info text-dark rounded-bottom pb-1'
      groupDiv.innerHTML = group.name
      row.appendChild(groupDiv)
    })
  })
}
