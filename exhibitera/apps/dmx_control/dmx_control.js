/* global Coloris, bootstrap */

import config from '../../common/config.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exSetup from '../js/exhibitera_setup_common.js'

class DMXUniverse {
  // A mirror for the DMXUniverse Python class

  constructor (uuid, controller) {
    this.uuid = uuid
    this.controller = controller
    this.fixtures = {}
    this.channelMap = new Array(513).fill(false) // true means that channel is ocupied
  }

  addFixture (definition) {
    // Create a new fixture and add it to this.fixtures.

    const newFixture = new DMXFixture(definition.name, definition.start_channel, definition.channels, definition.uuid)
    newFixture.universe = this.uuid
    this.fixtures[definition.name] = newFixture

    // Mark these channels on the channelMap
    for (let i = definition.start_channel; i < definition.start_channel + definition.channels.length; i++) {
      this.channelMap[i] = true
    }
    return newFixture
  }

  removeFixture (fixtureUUID) {
    // Remove the given fixture

    const fixture = this.getFixture(fixtureUUID)
    console.log(fixtureUUID)

    // Clear the channels from the channel map
    console.log(fixture)
    for (let i = fixture.startChannel; i < fixture.startChannel + fixture.channelList.length; i++) {
      this.channelMap[i] = false
    }

    delete this.fixtures[fixture.name]
    rebuildUniverseInterface()
  }

  checkIfChannelsFree (startChannel, numChannels, fixtureUUID = null) {
    // Check if the given channels are available in the channelMap
    // If fixtureUUID != null, ignore overlaps with that fixture

    let excludeMin = 1000
    let excludeMax = 1000
    if (fixtureUUID != null) {
      const fixture = this.getFixture(fixtureUUID)
      excludeMin = fixture.startChannel
      excludeMax = excludeMin + fixture.channelList.length - 1
    }

    let channelTaken = false
    for (let i = startChannel; i < startChannel + numChannels; i++) {
      if (this.channelMap[i] === true && !(i >= excludeMin && i <= excludeMax)) {
        channelTaken = true
      }
    }

    return !channelTaken
  }

  getFixture (uuid) {
    let matchedFixture = null
    for (const key of Object.keys(this.fixtures)) {
      const fixture = this.fixtures[key]
      if (fixture.uuid === uuid) matchedFixture = fixture
    }
    return matchedFixture
  }

  createHTML () {
    // Create the HTML representation for this universe.

    const universeRow = document.getElementById('universeRow')
    universeRow.innerHTML = ''
    for (const key of Object.keys(this.fixtures)) {
      const fixture = this.fixtures[key]
      universeRow.appendChild(fixture.createHTML('universe'))
    }
  }
}

class DMXFixture {
  // A mirror for the DMXFixture Python class.

  constructor (name, startChannel, channelList, uuid) {
    this.name = name
    this.safeName = name.replaceAll(' ', '_').replaceAll('.', '_').replaceAll('#', '_')
    this.startChannel = startChannel
    this.channelList = channelList
    this.uuid = uuid

    this.channelValues = {}
    this.valueMemory = {} // A place to store values temporarily when making changes.
    this.universe = null
    this.groups = [] // Hold the name of every group this fixture is in
  }

  remove () {
    // Remove the fixture by removing it from any groups then its universe.

    // Remove from any groups
    for (const groupUUID of this.groups) {
      getGroupByUUID(groupUUID).removeFixture(this.uuid)
    }

    // Remove from universe
    universe.removeFixture(this.uuid)
  }

  setChannelValues (valueDict) {
    // Take a dictionary of channel values and update this.channelValues.

    for (const key of Object.keys(valueDict)) {
      this.channelValues[key] = valueDict[key]
    }
  }

  updateGUI () {
    // Take the current channelValues and use them to update the GUI.

    // Loop the channels and update their GUI representations
    for (const key of Object.keys(this.channelValues)) {
      // Update the universe representation
      document.getElementById('universe_fixture_' + this.uuid + '_' + 'channelValue_' + key).value = this.channelValues[key]
      document.getElementById('universe_fixture_' + this.uuid + '_' + 'channelSlider_' + key).value = this.channelValues[key]
      updatecolorPicker('universe', this.uuid)

      // Update the group(s) representation
      for (const groupUUID of this.groups) {
        const group = getGroupByUUID(groupUUID)
        document.getElementById(group.safeName + '_fixture_' + this.uuid + '_' + 'channelValue_' + key).value = this.channelValues[key]
        document.getElementById(group.safeName + '_fixture_' + this.uuid + '_' + 'channelSlider_' + key).value = this.channelValues[key]
        updatecolorPicker(group.safeName, this.uuid)
      }
    }
  }

  sendChannelUpdate (channel) {
    // Wrapper to choose the most efficient way to update

    if (['r', 'g', 'b'].includes(channel)) {
      this.sendColorUpdate()
    } else if (channel === 'dimmer') {
      this.sendBrightnessUpdate()
    } else {
      this.sendGenericChannelUpdate(channel)
    }
  }

  sendGenericChannelUpdate (channel) {
    // Send a message to the helper asking it to update the given channel

    if (channel == null || this.channelValues[channel] == null) {
      console.log('Error: null value:', channel, this.channelValues[channel])
      return
    }
    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/fixture/' + this.uuid + '/setChannel',
      params: {
        channel_name: channel,
        value: this.channelValues[channel]
      }
    })
  }

  sendColorUpdate () {
    // Send a message to the helper asking it to update the color

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/fixture/' + this.uuid + '/setColor',
      params: {
        color: [this.channelValues.r || 0, this.channelValues.g || 0, this.channelValues.b || 0]
      }
    })
  }

  sendBrightnessUpdate () {
    // Send a message to the helper asking it to update the brightness

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/fixture/' + this.uuid + '/setBrightness',
      params: {
        value: this.channelValues.dimmer || 0
      }
    })
  }

  locateStart () {
    // Send max brightness values to aid in finding the fixture.

    // Cycle the possible color channels + dimmer
    for (const channel of ['a', 'b', 'dimmer', 'g', 'r', 'uv', 'w']) {
      if (channel in this.channelValues) {
        // First, save the current value
        this.valueMemory[channel] = this.channelValues[channel]
        // Then, set the max values
        this.channelValues[channel] = 255
        this.sendChannelUpdate(channel)
      }
    }
  }

  locateEnd () {
    // Reset the brightness values to their pre-locate values.

    // Cycle the possible color channels + dimmer
    for (const channel of ['a', 'b', 'dimmer', 'g', 'r', 'uv', 'w']) {
      if (channel in this.channelValues) {
        this.channelValues[channel] = this.valueMemory[channel]
        this.sendChannelUpdate(channel)
      }
    }
  }

  createHTML (collectionName) {
    // Create the HTML representation for this fixture.
    // collectionName is the name of the universe/group/scene this HTML widget is being rendered for.

    const thisUUID = this.uuid

    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-6 col-lg-4 mt-2'
    col.setAttribute('id', 'Fixture_' + this.uuid + '_for_' + collectionName)

    const rounded = document.createElement('div')
    rounded.classList = 'border rounded-3 overflow-hidden shadow-sm'
    col.appendChild(rounded)

    const row = document.createElement('div')
    row.classList = 'row mx-0'
    row.style.backgroundColor = '#28587B'
    rounded.appendChild(row)

    const headerText = document.createElement('div')
    headerText.classList = 'col-8 fixture-header'
    headerText.innerHTML = this.name
    row.appendChild(headerText)

    const colorPickerCol = document.createElement('div')
    colorPickerCol.classList = 'col-4 px-0 mx-0'
    row.appendChild(colorPickerCol)

    const colorPicker = document.createElement('input')
    colorPicker.classList = 'coloris w-100'
    colorPicker.setAttribute('id', collectionName + '_fixture_' + this.uuid + '_' + 'colorPicker')
    colorPicker.setAttribute('type', 'text')
    colorPicker.value = 'rgb(255,255,255)'
    colorPicker.addEventListener('input', () => {
      onColorChangeFromPicker(collectionName, thisUUID, false)
    })
    colorPickerCol.appendChild(colorPicker)

    const optionsCol = document.createElement('div')
    optionsCol.classList = 'col-12 mt-1'
    row.appendChild(optionsCol)

    const optionsRow = document.createElement('div')
    optionsRow.classList = 'row'
    optionsCol.appendChild(optionsRow)

    const locateCol = document.createElement('div')
    locateCol.classList = 'col-6 col-md-4'
    optionsRow.appendChild(locateCol)

    const locateBtn = document.createElement('button')
    locateBtn.classList = 'btn btn-sm btn-secondary w-100'
    locateBtn.innerHTML = 'Locate'
    locateBtn.addEventListener('mousedown', (event) => {
      this.locateStart()
    })
    locateBtn.addEventListener('mouseup', (event) => {
      this.locateEnd()
    })
    locateBtn.addEventListener('mouseleave', (event) => {
      this.locateEnd()
    })
    locateCol.appendChild(locateBtn)

    const gearCol = document.createElement('div')
    gearCol.classList = 'col-2 col-sm-4 col-md-3 offset-4 offset-sm-2 offset-md-5'
    optionsRow.appendChild(gearCol)

    const dropdown = document.createElement('div')
    dropdown.classList = 'dropdown'
    gearCol.appendChild(dropdown)

    const gearButton = document.createElement('button')
    gearButton.classList = 'btn btn-secondary btn-sm dropdown-toggle w-100'
    gearButton.setAttribute('type', 'button')
    gearButton.setAttribute('data-bs-toggle', 'dropdown')
    gearButton.setAttribute('aria-expanded', false)
    gearButton.innerText = '⚙'
    dropdown.appendChild(gearButton)

    const gearMenu = document.createElement('ul')
    gearMenu.classList = 'dropdown-menu'
    gearMenu.innerHTML = `
    <span class="dropdown-item disabled fst-italic">Channels ${String(this.startChannel)} - ${String(this.startChannel + this.channelList.length - 1)}</span>
    <hr class="dropdown-divider">
    `
    dropdown.appendChild(gearMenu)

    const editButton = document.createElement('button')
    editButton.classList = 'dropdown-item'
    editButton.innerHTML = 'Edit fixture'
    const thisFixture = this
    editButton.addEventListener('click', () => {
      showAddFixtureModal(thisFixture)
    })
    gearMenu.appendChild(editButton)

    const expandMessage = document.createElement('div')
    expandMessage.classList = 'col-12 text-center fst-italic small'
    expandMessage.style.backgroundColor = '#28587B'
    expandMessage.style.cursor = 'pointer'
    expandMessage.innerHTML = 'Tap to collapse'
    row.appendChild(expandMessage)

    const row2 = document.createElement('div')
    row2.classList = 'row mx-0 is-expanded'
    rounded.appendChild(row2)

    for (const channel of this.channelList) {
      const channelCol = document.createElement('div')
      channelCol.classList = 'col-12 channel-entry py-1'
      row2.appendChild(channelCol)

      const channelRow = document.createElement('div')
      channelRow.classList = 'row'
      channelCol.appendChild(channelRow)

      const channelHeader = document.createElement('div')
      channelHeader.classList = 'col-12'
      channelHeader.innerHTML = channelNameToDisplayName(channel)
      channelRow.appendChild(channelHeader)

      const channelSliderCol = document.createElement('div')
      channelSliderCol.classList = 'col-8'
      channelRow.appendChild(channelSliderCol)

      const channelSlider = document.createElement('input')
      channelSlider.classList = 'form-range h-100'
      channelSlider.setAttribute('id', collectionName + '_fixture_' + this.uuid + '_' + 'channelSlider_' + channel)
      channelSlider.setAttribute('type', 'range')
      channelSlider.setAttribute('min', 0)
      channelSlider.setAttribute('max', 255)
      channelSlider.setAttribute('step', 1)
      channelSlider.value = 0
      channelSlider.addEventListener('input', (e) => {
        onChannelSliderChange(collectionName, thisUUID, channel, parseInt(e.target.value))
      })
      channelSliderCol.appendChild(channelSlider)

      const channelValueCol = document.createElement('div')
      channelValueCol.classList = 'col-4 ps-0'
      channelRow.appendChild(channelValueCol)

      const channelValue = document.createElement('input')
      channelValue.classList = 'form-control text-center'
      channelValue.setAttribute('id', collectionName + '_fixture_' + this.uuid + '_' + 'channelValue_' + channel)
      channelValue.setAttribute('type', 'number')
      channelValue.setAttribute('min', 0)
      channelValue.setAttribute('max', 255)
      channelValue.value = 0
      channelValue.addEventListener('input', e => {
        onChannelValueChange(collectionName, thisUUID, channel, parseInt(e.target.value))
      })
      channelValueCol.appendChild(channelValue)
    }

    [headerText, expandMessage].forEach(el => {
      el.addEventListener('click', () => {
        const isExpanding = !row2.classList.contains('is-expanded')

        // 1. Get the exact height of the content
        const startHeight = row2.offsetHeight
        const endHeight = isExpanding ? row2.scrollHeight : 0

        // 2. Animate between the two values
        row2.animate([
          { height: `${startHeight}px`, opacity: isExpanding ? 0 : 1 },
          { height: `${endHeight}px`, opacity: isExpanding ? 1 : 0 }
        ], {
          duration: 300,
          easing: 'ease-out',
          fill: 'forwards' // Keeps the element at the endHeight
        })

        // 3. Update State and Text
        row2.classList.toggle('is-expanded')
        expandMessage.innerHTML = isExpanding ? 'Tap to collapse' : 'Tap to expand'
      })
    })

    return col
  }
}

class DMXFixtureGroup {
  // A mirror for the DMXFixtureGroup Python class.

  constructor (name, uuid = '') {
    this.name = name
    this.uuid = uuid
    this.safeName = name.replaceAll(' ', '_').replaceAll('.', '_').replaceAll('#', '_')
    this.fixtures = {}
    this.scenes = []
  }

  addFixtures (fixtures) {
    // Take an array of fixtures and add them to the group.

    for (const fixture of fixtures) {
      this.fixtures[fixture.uuid] = fixture
      if (!this.fixtures[fixture.uuid].groups.includes(this.uuid)) {
        this.fixtures[fixture.uuid].groups.push(this.uuid)
      }
    }
  }

  removeFixture (fixtureUUID) {
    // Remove the given fixture

    delete this.fixtures[fixtureUUID]
    rebuildGroupsInterface()
  }

  clearFixtures () {
    this.fixtures = {}
  }

  locateStart () {
    // Trigger the locate effect for every fixture in the group.

    for (const key of Object.keys(this.fixtures)) {
      this.fixtures[key].locateStart()
    }
  }

  locateEnd () {
    // Trigger the locate effect for every fixture in the group.

    for (const key of Object.keys(this.fixtures)) {
      this.fixtures[key].locateEnd()
    }
  }

  createMetaFixtureHTML () {
    // Create a widget that provides controls for any channels included in every fixture in the group.

    const thisUUID = this.uuid

    // Cycle through the channels in the first fixture, comparing each to all the other fixtures
    // to find channels that exist for all.
    const matchingChannels = []
    const fixtureKeys = Object.keys(this.fixtures)
    if (fixtureKeys.length === 0) return

    for (const channel of this.fixtures[fixtureKeys[0]].channelList) {
      let channelMatches = true
      for (const fixtureUUID of fixtureKeys) {
        const fixture = this.fixtures[fixtureUUID]
        if (fixture.channelList.includes(channel) === false) channelMatches = false
      }
      if (channelMatches === true) matchingChannels.push(channel)
    }

    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-6 col-lg-4 mt-2'

    const rounded = document.createElement('div')
    rounded.classList = 'border rounded-3 overflow-hidden shadow-sm'
    col.appendChild(rounded)

    const row = document.createElement('div')
    row.style.backgroundColor = '#142f43'
    row.classList = 'row mx-0'
    rounded.appendChild(row)

    const headerText = document.createElement('div')
    headerText.classList = 'col-8 meta-header'
    headerText.innerHTML = 'Control all'
    row.appendChild(headerText)

    const colorPickerCol = document.createElement('div')
    colorPickerCol.classList = 'col-4 px-0 mx-0'
    row.appendChild(colorPickerCol)

    const colorPicker = document.createElement('input')
    colorPicker.classList = 'coloris w-100'
    colorPicker.setAttribute('id', 'meta_fixture_' + this.uuid + '_' + 'colorPicker')
    colorPicker.setAttribute('type', 'text')
    colorPicker.value = 'rgb(255,255,255)'
    colorPicker.addEventListener('input', () => {
      onColorChangeFromPicker('meta', thisUUID)
    })
    colorPickerCol.appendChild(colorPicker)

    const optionsCol = document.createElement('div')
    optionsCol.classList = 'col-12 mt-1'
    row.appendChild(optionsCol)

    const optionsRow = document.createElement('div')
    optionsRow.classList = 'row'
    optionsCol.appendChild(optionsRow)

    const locateCol = document.createElement('div')
    locateCol.classList = 'col-6 col-md-4'
    optionsRow.appendChild(locateCol)

    const locateBtn = document.createElement('button')
    locateBtn.classList = 'btn btn-sm btn-secondary w-100'
    locateBtn.innerHTML = 'Locate'
    locateBtn.addEventListener('mousedown', (event) => {
      this.locateStart()
    })
    locateBtn.addEventListener('mouseup', (event) => {
      this.locateEnd()
    })
    locateBtn.addEventListener('mouseleave', (event) => {
      this.locateEnd()
    })
    locateCol.appendChild(locateBtn)

    const expandMessage = document.createElement('div')
    expandMessage.classList = 'col-12 text-center fst-italic small'
    expandMessage.style.backgroundColor = '#142f43'
    expandMessage.style.cursor = 'pointer'
    expandMessage.innerHTML = 'Tap to collapse'
    row.appendChild(expandMessage)

    const row2 = document.createElement('div')
    row2.classList = 'row mx-0 is-expanded'
    rounded.appendChild(row2)

    for (const channel of matchingChannels) {
      const channelCol = document.createElement('div')
      channelCol.classList = 'col-12 meta-entry py-1'
      row2.appendChild(channelCol)

      const channelRow = document.createElement('div')
      channelRow.classList = 'row'
      channelCol.appendChild(channelRow)

      const channelHeader = document.createElement('div')
      channelHeader.classList = 'col-12'
      channelHeader.innerHTML = channelNameToDisplayName(channel)
      channelRow.appendChild(channelHeader)

      const channelSliderCol = document.createElement('div')
      channelSliderCol.classList = 'col-8'
      channelRow.appendChild(channelSliderCol)

      const channelSlider = document.createElement('input')
      channelSlider.classList = 'form-range h-100'
      channelSlider.setAttribute('id', 'meta_fixture_' + this.uuid + '_' + 'channelSlider_' + channel)
      channelSlider.setAttribute('type', 'range')
      channelSlider.setAttribute('min', 0)
      channelSlider.setAttribute('max', 255)
      channelSlider.setAttribute('step', 1)
      channelSlider.value = 0
      channelSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value)

        document.getElementById('meta_fixture_' + thisUUID + '_' + 'channelValue_' + channel).value = value
        updatecolorPicker('meta', thisUUID)

        // Update the fixtures and send a change to the helper
        for (const fixtureUUID of fixtureKeys) {
          const fixture = this.getFixture(fixtureUUID)
          const valueToUpdate = {}
          valueToUpdate[channel] = value
          fixture.setChannelValues(valueToUpdate)
        }
        exCommon.makeHelperRequest({
          method: 'POST',
          endpoint: '/DMX/group/' + thisUUID + '/setChannel',
          params: { channel, value }
        })
      })
      channelSliderCol.appendChild(channelSlider)

      const channelValueCol = document.createElement('div')
      channelValueCol.classList = 'col-4 ps-0'
      channelRow.appendChild(channelValueCol)

      const channelValue = document.createElement('input')
      channelValue.classList = 'form-control text-center'
      channelValue.setAttribute('id', 'meta_fixture_' + this.uuid + '_' + 'channelValue_' + channel)
      channelValue.setAttribute('type', 'number')
      channelValue.setAttribute('min', 0)
      channelValue.setAttribute('max', 255)
      channelValue.value = 0
      channelValue.addEventListener('input', e => {
        const value = parseInt(e.target.value)

        document.getElementById('meta_fixture_' + thisUUID + '_' + 'channelSlider_' + channel).value = value
        updatecolorPicker('meta', thisUUID)

        // Update the fixtures and send a change to th  e helper
        for (const fixtureUUID of fixtureKeys) {
          const fixture = this.getFixture(fixtureUUID)
          const valueToUpdate = {}
          valueToUpdate[channel] = value
          fixture.setChannelValues(valueToUpdate)
        }
        exCommon.makeHelperRequest({
          method: 'POST',
          endpoint: '/DMX/group/' + thisUUID + '/setChannel',
          params: { channel, value }
        })
      })
      channelValueCol.appendChild(channelValue)
    }

    [headerText, expandMessage].forEach(el => {
      el.addEventListener('click', () => {
        const isExpanding = !row2.classList.contains('is-expanded')

        // 1. Get the exact height of the content
        const startHeight = row2.offsetHeight
        const endHeight = isExpanding ? row2.scrollHeight : 0

        // 2. Animate between the two values
        row2.animate([
          { height: `${startHeight}px`, opacity: isExpanding ? 0 : 1 },
          { height: `${endHeight}px`, opacity: isExpanding ? 1 : 0 }
        ], {
          duration: 300,
          easing: 'ease-out',
          fill: 'forwards' // Keeps the element at the endHeight
        })

        // 3. Update State and Text
        row2.classList.toggle('is-expanded')
        expandMessage.innerHTML = isExpanding ? 'Tap to collapse' : 'Tap to expand'
      })
    })

    return col
  }

  createHTML () {
    // Create the HTML representation for this group.

    const div = document.createElement('div')

    const row1 = document.createElement('div')
    row1.classList = 'row'
    div.appendChild(row1)

    const editFixturesCol = document.createElement('div')
    editFixturesCol.classList = 'col-3 col-lg-2'
    row1.appendChild(editFixturesCol)

    const editFixturesButton = document.createElement('button')
    editFixturesButton.classList = 'btn btn-primary w-100'
    editFixturesButton.innerHTML = `
    <span class='d-none d-md-inline'>Edit group</span>
    <span class='d-inline d-md-none'>Edit</span>
  `
    editFixturesButton.addEventListener('click', () => {
      showEditGroupModal(this.uuid)
    })
    editFixturesCol.appendChild(editFixturesButton)

    // Add fixtures
    const fixtureRow = document.createElement('div')
    fixtureRow.classList = 'row'
    div.appendChild(fixtureRow)

    if (Object.keys(this.fixtures).length > 0) {
      // Add meta control widget
      fixtureRow.appendChild(this.createMetaFixtureHTML())

      // Add regular fixtures
      for (const key of Object.keys(this.fixtures)) {
        const fixture = this.fixtures[key]
        fixtureRow.appendChild(fixture.createHTML(this.safeName))
      }
    }

    return div
  }

  getFixture (uuid) {
    let matchedFixture = null
    for (const key of Object.keys(this.fixtures)) {
      const fixture = this.fixtures[key]
      if (fixture.uuid === uuid) matchedFixture = fixture
    }
    return matchedFixture
  }
}

class DMXScene {
  // A mirror for the DMXScene Python class

  constructor (name, values, uuid = '', duration = 0) {
    this.name = name
    this.values = values
    this.uuid = uuid
    this.duration = duration
  }

  getFixture (uuid) {
    let matchedFixture = null
    for (const key of Object.keys(this.values)) {
      if (key === uuid) {
        matchedFixture = this.values[key]
        break
      }
    }
    return matchedFixture
  }

  createHTML () {
    // Create the HTML representation for this scene.

    const thisUUID = this.uuid

    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-4 col-lg-3 mt-2'

    const topRow = document.createElement('div')
    topRow.classList = 'row'
    col.appendChild(topRow)

    const header = document.createElement('div')
    header.classList = 'col-12 text-center rounded-top fixture-header'
    header.innerHTML = this.name
    col.appendChild(header)

    const bottomRow = document.createElement('div')
    bottomRow.classList = 'row rounded-bottom mx-0 py-2 mb-2'
    bottomRow.style.backgroundColor = '#2D648B'
    col.appendChild(bottomRow)

    const runCol = document.createElement('div')
    runCol.classList = 'col-6'
    bottomRow.appendChild(runCol)

    const runButton = document.createElement('button')
    runButton.classList = 'btn btn-primary w-100'
    runButton.innerHTML = 'Run'
    runButton.addEventListener('click', function () {
      showScene(thisUUID)
    })
    runCol.appendChild(runButton)

    const editCol = document.createElement('div')
    editCol.classList = 'col-6'
    bottomRow.appendChild(editCol)

    const editButton = document.createElement('button')
    editButton.classList = 'btn btn-info w-100'
    editButton.innerHTML = 'Edit'
    editButton.addEventListener('click', function () {
      showEditSceneModal(thisUUID)
    })
    editCol.appendChild(editButton)

    return col
  }
}

function onColorChangeFromPicker (collectionName, uuid, meta = true) {
  // When is a color is changed from the picker, update the interface to match.

  const prefix = collectionName + '_fixture_' + uuid + '_'
  const newColor = document.getElementById(prefix + 'colorPicker').value

  // newColor is a string of format 'rgb(123, 123, 132)'
  const colorSplit = newColor.slice(4, -1).split(',')
  const red = parseInt(colorSplit[0])
  const green = parseInt(colorSplit[1])
  const blue = parseInt(colorSplit[2])

  // Set the sliders
  document.getElementById(prefix + 'channelValue_r').value = red
  document.getElementById(prefix + 'channelValue_g').value = green
  document.getElementById(prefix + 'channelValue_b').value = blue

  // Set the inputs
  document.getElementById(prefix + 'channelSlider_r').value = red
  document.getElementById(prefix + 'channelSlider_g').value = green
  document.getElementById(prefix + 'channelSlider_b').value = blue

  if (meta === true) {
    // Send the update to the whole group
    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/group/' + uuid + '/setColor',
      params: { color: [red, green, blue] }
    })
  } else {
    // Update the fixture and send a color change to the helper
    const fixture = getFixture(uuid)
    fixture.setChannelValues({ r: red, g: green, b: blue })
    fixture.sendColorUpdate()
  }
}

function onChannelSliderChange (collectionName, uuid, channel, value) {
  // When the slider changes, update the number field.

  document.getElementById(collectionName + '_fixture_' + uuid + '_' + 'channelValue_' + channel).value = value

  updatecolorPicker(collectionName, uuid)

  // Update the fixture and send a color change to the helper
  const fixture = getFixture(uuid)
  const valueToUpdate = {}
  valueToUpdate[channel] = value
  fixture.setChannelValues(valueToUpdate)
  fixture.sendChannelUpdate(channel)
}

function onChannelValueChange (collectionName, uuid, channel, value) {
  // When the number box is changed, update the slider.

  document.getElementById(collectionName + '_fixture_' + uuid + '_' + 'channelSlider_' + channel).value = value

  const fixture = getFixture(uuid)
  const valueToUpdate = {}
  valueToUpdate[channel] = value
  fixture.setChannelValues(valueToUpdate)
  fixture.sendChannelUpdate(channel)
}

function updatecolorPicker (collectionName, uuid) {
  // Read the values from the number inputs and update the color picker

  const prefix = collectionName + '_fixture_' + uuid + '_'

  const red = document.getElementById(prefix + 'channelSlider_r').value
  const green = document.getElementById(prefix + 'channelSlider_g').value
  const blue = document.getElementById(prefix + 'channelSlider_b').value

  const colorStr = 'rgb(' + red + ',' + green + ',' + blue + ')'

  // Update the input and the color of the parent div
  try {
    const picker = document.getElementById(prefix + 'colorPicker')

    // Set the input value
    picker.value = colorStr

    // Find the closest wrapper and set the text color
    // Original: .closest('.clr-field')[0].style.color = colorStr
    const clrField = picker.closest('.clr-field')
    if (clrField) {
      clrField.style.color = colorStr
    }
  } catch (error) {
    // This will fail if the value is changed before the Coloris color picker is activated.
  }
}

function showAddFixtureModal (fixture = null) {
  // Prepare the addFixtureModal and then show it.
  // If a fixture is passed to 'fixture', the modal will be
  // configuerd to edit the fixture rather than add a new one.

  // Reset common fields
  document.getElementById('addFixtureChannelList').innerHTML = ''
  document.getElementById('addFixtureFromModalButton').style.display = 'none'
  document.getElementById('addFixtureChannelsOccupiedWarning').style.display = 'none'

  const addFixtureModal = document.getElementById('addFixtureModal')
  // Set up fields by mode
  if (fixture == null) {
    // Add a new fixture
    addFixtureModal.dataset.mode = 'add'
    document.getElementById('addFixtureName').value = ''
    document.getElementById('addFixtureFromModalButton').innerHTML = 'Add'
    document.getElementById('deleteFixtureFromModalButton').style.display = 'none'

    // Find the next free channel
    const searchFunc = (el) => el === false
    const nextChannel = universe.channelMap.slice(1).findIndex(searchFunc) + 1
    document.getElementById('addFixtureStartingChannel').value = nextChannel

    // Populate the available clone options
    document.getElementById('cloneFixtureGroup').style.display = 'block'
    const cloneFixtureList = document.getElementById('cloneFixtureList')
    cloneFixtureList.innerHTML = ''
    for (const key of Object.keys(universe.fixtures)) {
      const fixture = universe.fixtures[key]
      const option = document.createElement('option')
      option.value = fixture.uuid
      option.innerHTML = fixture.name
      cloneFixtureList.appendChild(option)
    }
  } else {
    // Update an existing fixture
    addFixtureModal.dataset.mode = 'edit'
    addFixtureModal.dataset.fixtureUUID = fixture.uuid
    document.getElementById('addFixtureName').value = fixture.name
    document.getElementById('addFixtureFromModalButton').innerHTML = 'Save'
    document.getElementById('addFixtureStartingChannel').value = fixture.startChannel
    document.getElementById('deleteFixtureFromModalButton').style.display = 'block'

    // Populate the current channels
    document.getElementById('cloneFixtureGroup').style.display = 'none'
    cloneFixture(fixture)
  }

  exUtilities.showModal('#addFixtureModal')
}

function cloneFixture (fixtureToClone = null) {
  // Use an existing fixture to populate the addFixtureModal
  // Optionally pass a DMXFixture or the value of the select will be used.

  if (fixtureToClone == null) {
    fixtureToClone = universe.getFixture(document.getElementById('cloneFixtureList').value)
  }
  const addFixtureChannelList = document.getElementById('addFixtureChannelList')

  for (let channel of fixtureToClone.channelList) {
    addChannelToModal()
    if (['a', 'b', 'g', 'r', 'uv', 'w', 'dimmer'].includes(channel)) {
      Array.from(addFixtureChannelList.querySelectorAll('.channel-select')).slice(-1)[0].value = channel
    } else {
      const input = Array.from(addFixtureChannelList.querySelectorAll('.other-channel-input')).slice(-1)[0]
      Array.from(addFixtureChannelList.querySelectorAll('.channel-select')).slice(-1)[0].value = 'other'
      channel = channel.replaceAll('_', ' ')
      input.value = channel[0].toUpperCase() + channel.slice(1)
      input.parentNode.style.display = 'block'
    }
  }
}

function showEditGroupModal (groupUUID) {
  // Configure the edit group modal and show it

  const titleEl = document.getElementById('editGroupModalTitle')

  document.getElementById('editGroupErrorAlert').style.display = 'none'

  let group
  if ((groupUUID == null) || (groupUUID.trim() === '')) {
    titleEl.innerText = 'Create new group'
    groupUUID = ''
    document.getElementById('editGroupNameInput').value = ''
    document.getElementById('editGroupModalDeleteButton').style.display = 'none'
  } else {
    group = getGroupByUUID(groupUUID)
    titleEl.innerText = 'Edit ' + group.name
    // Add the current name
    document.getElementById('editGroupNameInput').value = group.name
    document.getElementById('editGroupModalDeleteButton').style.display = 'block'
  }

  document.getElementById('editGroupModal').dataset.groupUUID = groupUUID

  // Populate the list of fixtures
  const fixtureRow = document.getElementById('editGroupFixtureRow')
  fixtureRow.innerText = ''

  for (const fixtureName of Object.keys(universe.fixtures)) {
    const fixture = universe.fixtures[fixtureName]

    fixtureRow.append(createFixtureCheckbox(fixture, group))
  }

  exUtilities.showModal('#editGroupModal')
}

function editGroupFromModal () {
  // Called when the Save button is pressed in the editGroupModal

  const groupUUID = document.getElementById('editGroupModal').dataset.groupUUID

  const fixturesElements = document.getElementById('editGroupFixtureRow').querySelectorAll('.form-check-input')

  const editGroupErrorAlert = document.getElementById('editGroupErrorAlert')

  const name = document.getElementById('editGroupNameInput').value.trim()

  if (name === '') {
    editGroupErrorAlert.innerText = 'Name field must not be blank.'
    editGroupErrorAlert.style.display = 'block'
    return
  }

  const fixturesToAdd = []
  const fixturesToAddUUID = []
  for (const element of fixturesElements) {
    if (element.checked === true) {
      const fixture = getFixture(element.dataset.uuid)
      fixturesToAdd.push(fixture)
      fixturesToAddUUID.push(fixture.uuid)
    }
  }

  if (fixturesToAddUUID.length === 0) {
    editGroupErrorAlert.innerText = 'Your group must include at least one fixture.'
    editGroupErrorAlert.style.display = 'block'
    return
  }

  let group
  if (groupUUID !== '') {
    // We are editing a group
    group = getGroupByUUID(groupUUID)
    group.clearFixtures()
    group.name = name
    group.addFixtures(fixturesToAdd)

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/group/' + groupUUID + '/edit',
      params: {
        name: group.name,
        fixture_list: fixturesToAddUUID
      }
    })
      .then((result) => {
        if ('uuid' in result) {
          group.uuid = result.uuid
        }
        rebuildGroupsInterface()
        exUtilities.hideModal('#editGroupModal')
      })
  } else {
    // We are creating a new group
    createGroupFromModal(name, fixturesToAdd, fixturesToAddUUID)
  }
}

function createGroupFromModal (name, fixturesToAdd, fixturesToAddUUID) {
  // Ask the helper to create the group, then add the fixtures.

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/DMX/group/create',
    params: {
      name,
      fixture_list: fixturesToAddUUID
    }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        const group = createGroup(name, result.uuid)
        group.addFixtures(fixturesToAdd)
      }
      rebuildGroupsInterface()
      exUtilities.hideModal('#editGroupModal')
    })
}

function showEditSceneModal (uuid = '') {
  // Configure the edit scene modal and show it

  const scene = getScene(uuid)

  const editSceneModal = document.getElementById('editSceneModal')
  const editSceneFixtureList = document.getElementById('editSceneFixtureList')
  editSceneModal.dataset.uuid = uuid

  editSceneFixtureList.innerText = ''
  for (const key of Object.keys(universe.fixtures)) {
    const fixture = universe.fixtures[key]
    editSceneFixtureList.appendChild(createFixtureCheckbox(fixture, scene))
  }

  document.getElementById('editSceneModalSceneName').value = scene?.name ?? ''

  if (uuid !== '') {
    // We are editing an existing scene
    document.getElementById('editSceneModalDurationInput').value = scene.duration
    document.getElementById('editSceneModalTitle').innerText = 'Edit scene: ' + scene.name
    document.getElementById('editSceneModalSaveButton').innerText = 'Save'
    document.getElementById('editSceneModalDeleteButton').style.display = 'block'
  } else {
    document.getElementById('editSceneModalDurationInput').value = 0
    document.getElementById('editSceneModalTitle').innerText = 'Add scene'
    document.getElementById('editSceneModalSaveButton').innerText = 'Create'
    document.getElementById('editSceneModalDeleteButton').style.display = 'none'
  }

  document.getElementById('editSceneErrorAlert').style.display = 'none'

  exUtilities.showModal('#editSceneModal')
}

function editSceneFromModal () {
  // Save the scene changse from the modal.

  const editSceneModal = document.getElementById('editSceneModal')
  const editSceneErrorAlert = document.getElementById('editSceneErrorAlert')

  const sceneName = document.getElementById('editSceneModalSceneName').value.trim()
  if (sceneName === '') {
    editSceneErrorAlert.innerText = 'Name field must not be blank.'
    editSceneErrorAlert.style.display = 'block'
    return
  }
  const duration = parseInt(document.getElementById('editSceneModalDurationInput').value)
  const checkboxes = document.getElementById('editSceneFixtureList').querySelectorAll('.form-check-input')
  const uuid = editSceneModal.dataset.uuid

  const sceneDict = {}
  for (const box of checkboxes) {
    if (box.checked === true) {
      const fixture = getFixture(box.dataset.uuid)
      const values = fixture.channelValues
      sceneDict[fixture.uuid] = values
    }
  }

  if (Object.keys(sceneDict).length === 0) {
    editSceneErrorAlert.innerText = 'Your scene must include at least one fixture.'
    editSceneErrorAlert.style.display = 'block'
    return
  }

  if (uuid === '') {
    // We are creating a new scene

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/scene/create',
      params: { name: sceneName, values: sceneDict, duration }
    })
      .then((result) => {
        if (result?.success === true) {
          createScene(sceneName, sceneDict, result.uuid, duration)
          exUtilities.hideModal('#editSceneModal')
          rebuildScenesInterface()
        }
      })
  } else {
    // We are editing an existing scene

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/scene/' + uuid + '/edit',
      params: { name: sceneName, values: sceneDict, duration }
    })
      .then((result) => {
        if (result?.success === true) {
          const scene = getScene(uuid)
          scene.name = sceneName
          scene.duration = duration
          scene.values = sceneDict
          exUtilities.hideModal('#editSceneModal')
          rebuildGroupsInterface()
        }
      })
  }
}

function deleteSceneFromModal () {
  // Delete the scene we are currently editing.

  const editSceneModal = document.getElementById('editSceneModal')
  const uuid = editSceneModal.dataset.uuid

  exCommon.makeHelperRequest({
    method: 'DELETE',
    endpoint: '/DMX/scene/' + uuid
  })
    .then((result) => {
      if (result?.success === true) {
        deleteScene(uuid)
        exUtilities.hideModal('#editSceneModal')
        rebuildScenesInterface()
      }
    })
}

function createFixtureCheckbox (fixture, collection = null) {
  // Return a column that holds a checkbox representing the fixture.
  // If 'collecion' is specified, the box will be checked if the fixture
  // is in 'collecion'

  const col = document.createElement('div')
  col.classList = 'col-3 my-1'

  const container = document.createElement('div')
  container.classList = 'form-check'
  col.appendChild(container)

  const check = document.createElement('input')
  check.classList = 'form-check-input'
  check.setAttribute('type', 'checkbox')
  check.setAttribute('id', 'editGroupFixture_' + fixture.uuid)
  check.dataset.uuid = fixture.uuid
  check.value = ''

  if (collection != null && collection.getFixture(fixture.uuid) != null) {
    check.checked = true
  }

  container.appendChild(check)

  const label = document.createElement('label')
  label.class = 'form-check-label'
  label.setAttribute('for', 'editGroupFixture_' + fixture.uuid)
  label.innerHTML = fixture.name
  container.appendChild(label)

  return col
}

function addChannelToModal () {
  // Called when the Add channel button is pressed in the addFixtureModal.

  const col = document.createElement('div')
  col.classList = 'col-12 mt-1'

  const row = document.createElement('div')
  row.classList = 'row'
  col.appendChild(row)

  // This col counts the channels (the count will happen elsewhere)
  const countCol = document.createElement('div')
  countCol.classList = 'col-2 pe-0 my-auto channel-count'
  row.appendChild(countCol)

  const selectCol = document.createElement('div')
  selectCol.classList = 'col'
  row.appendChild(selectCol)

  const select = document.createElement('select')
  select.classList = 'form-control channel-select'
  select.addEventListener('change', (event) => {
    if (event.target.value === 'other') {
      event.target.parentNode.parentNode.querySelector('.other-channel-input').parentNode.style.display = 'block'
    } else {
      event.target.parentNode.parentNode.querySelector('.other-channel-input').parentNode.style.display = 'none'
    }
  })
  selectCol.appendChild(select)

  const options = [['Colors', ''], ['Amber', 'a'], ['Blue', 'b'], ['Green', 'g'], ['Red', 'r'], ['Ultraviolet', 'uv'], ['White', 'w'], ['Properties', ''], ['Dimmer', 'dimmer'], ['Other', 'other']]

  for (const entry of options) {
    const option = document.createElement('option')
    option.innerHTML = entry[0]
    if (entry[1] === '') {
      option.setAttribute('disabled', true)
    } else {
      option.value = entry[1]
    }
    select.appendChild(option)
  }

  const otherCol = document.createElement('div')
  otherCol.classList = 'col-5'
  otherCol.style.display = 'none'
  row.appendChild(otherCol)

  const otherNameInput = document.createElement('input')
  otherNameInput.setAttribute('type', 'text')
  otherNameInput.classList = 'form-control other-channel-input'
  otherNameInput.setAttribute('placeholder', 'Custom name')
  otherCol.appendChild(otherNameInput)

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-2 align-self-center'
  row.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm w-100'
  deleteButton.innerHTML = '✕'
  deleteButton.style.fontSize = '20px'
  deleteButton.addEventListener('click', () => {
    col.remove()

    const channelList = document.getElementById('addFixtureChannelList')
    const modalButton = document.getElementById('addFixtureFromModalButton')

    if (channelList.children.length === 0) {
      modalButton.style.display = 'none'
    }
  })
  deleteCol.appendChild(deleteButton)

  const channelList = document.getElementById('addFixtureChannelList')
  channelList.appendChild(col)
  channelList.scrollTop = channelList.scrollHeight
  updateModalChannelCounts()

  document.getElementById('addFixtureFromModalButton').style.display = 'block'
  document.getElementById('cloneFixtureGroup').style.display = 'none'
}

function updateModalChannelCounts () {
  // Using the starting channel and number of channels, updte the labels for each channel

  const channelList = document.getElementById('addFixtureChannelList')
  const startingChannel = parseInt(document.getElementById('addFixtureStartingChannel').value)

  let i = 0
  for (const el of channelList.querySelectorAll('.channel-count')) {
    el.innerHTML = String(i + 1) + ' (' + String(startingChannel + i) + ')'
    i += 1
  }
}

function addFixtureFromModal () {
  // Collect the necessary information from the addFixtureModal and ask the helper to add or edit the fixture.

  const addFixtureModal = document.getElementById('addFixtureModal')
  const mode = addFixtureModal.dataset.mode

  const channelList = []
  for (const el of document.getElementById('addFixtureChannelList').childNodes) {
    const select = el.querySelector('select')
    if (select.value !== 'other') {
      channelList.push(select.value)
    } else {
      const input = el.querySelector('.other-channel-input')
      channelList.push(input.value.trim().replaceAll(' ', '_'))
    }
  }
  const startChannel = parseInt(document.getElementById('addFixtureStartingChannel').value)

  const definition = {
    name: document.getElementById('addFixtureName').value.trim(),
    start_channel: startChannel,
    channels: channelList
  }

  let fixtureUUID = null
  if (mode === 'edit') {
    fixtureUUID = addFixtureModal.dataset.fixtureUUID
  }

  const channelsFree = universe.checkIfChannelsFree(startChannel, channelList.length, fixtureUUID)
  if (channelsFree === false) {
    document.getElementById('addFixtureChannelsOccupiedWarning').style.display = 'block'
    return
  }

  let promise
  if (mode === 'add') {
    promise = exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/fixture/create',
      params: definition
    })
  } else {
    promise = exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/fixture/' + fixtureUUID + '/edit',
      params: definition
    })
  }

  promise.then((response) => {
    if (response?.success === true) {
      getDMXConfiguration()
      exUtilities.hideModal('#addFixtureModal')
    }
  })
}

function createUniverse (uuid, controller) {
  // Create a new universe and add it to the global list.

  universe = new DMXUniverse(uuid, controller)
}

function deleteUniverse (uid) {
  // Ask the helper to delete the universe and then remove it from the interface.

  exCommon.makeHelperRequest({
    method: 'DELETE',
    endpoint: '/DMX/universe/'
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        getDMXConfiguration()
      }
    })
}

function createGroup (name, uuid = '') {
  // Create a new group and add it to the global list.

  const newGroup = new DMXFixtureGroup(name, uuid)

  groupList.push(newGroup)
  return newGroup
}

function deleteGroup (uuid) {
  // Ask the helper to delete the given group and then remove it from the interface.

  exCommon.makeHelperRequest({
    method: 'DELETE',
    endpoint: '/DMX/group/' + uuid
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        groupList = groupList.filter((obj) => {
          return obj.uuid !== uuid
        })

        // Cycle the fixtures and remove any reference to this group
        for (const key of Object.keys(universe.fixtures)) {
          const fixture = universe.fixtures[key]
          fixture.groups = fixture.groups.filter(e => e !== uuid)
        }
        exUtilities.hideModal('#editGroupModal')
        rebuildGroupsInterface()
      }
    })
}

function createScene (name, values, uuid = '', duration = 0) {
  // Create a new scene and add it to sceneList

  if (uuid === '') uuid = exUtilities.uuid()

  const newScene = new DMXScene(name, values, uuid, duration)

  sceneList.push(newScene)
  return newScene
}

function deleteScene (uuid) {
  // Remove the given scene.

  sceneList = sceneList.filter(function (obj) {
    return obj.uuid !== uuid
  })
}

function showScene (uuid) {
  // Tell the helper to set the given scene.

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/scene/' + uuid + '/set'
  })
}

function channelNameToDisplayName (name) {
  // Take a name such as 'r' and convert it to the proper name to display.

  const nameDict = {
    a: 'Amber',
    b: 'Blue',
    g: 'Green',
    r: 'Red',
    uv: 'UV',
    w: 'White',
    dimmer: 'Dimmer'
  }
  if (name in nameDict) {
    return nameDict[name]
  }
  return (name[0].toUpperCase() + name.slice(1)).replaceAll('_', ' ')
}

function updateFunc (update) {
  // Read updates for media player-specific actions and act on them

}

function getGroupByUUID (uuid) {
  let matchedGroup = null
  for (const group of groupList) {
    if (group.uuid === uuid) matchedGroup = group
  }
  return matchedGroup
}

function getScene (uuid) {
  let matchedScene = null

  for (const scene of sceneList) {
    if (scene.uuid === uuid) {
      matchedScene = scene
    }
  }
  return matchedScene
}

function getFixture (uuid) {
  return universe.getFixture(uuid)
}

function getDMXStatus () {
  // Ask the helper for the latest status for each fixture.

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/status'
  })
    .then((response) => {
      for (const key of Object.keys(response.status)) {
        const update = response.status[key]
        const fixture = getFixture(key)
        fixture.setChannelValues(update)
        fixture.updateGUI()
      }
    })
}

function getDMXConfiguration () {
  // Ask the helper for the current DMX configuration and update the interface.

  let configuration

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/configuration'
  })
    .then((response) => {
      groupList.length = 0
      configuration = response.configuration

      if (response.success === false && response.reason === 'device_not_found') {
        document.getElementById('missingDeviceWarning').style.display = 'block'
      } else {
        document.getElementById('missingDeviceWarning').style.display = 'none'
      }

      if (configuration.universe != null) {
        // First, create the universe
        const universeDef = configuration.universe
        createUniverse(universeDef.uuid, universeDef.controller)
        // Then, loop the fixtures and add each.
        for (const fixture of universeDef.fixtures) {
          universe.addFixture(fixture)
        }
        rebuildUniverseInterface()
        document.getElementById('noUniverseWarning').style.display = 'none'
        document.getElementById('addFixtureButton').style.display = 'block'
        document.getElementById('fixturesPaneOptionsButton').style.display = 'block'
      } else {
        document.getElementById('universeRow').innerText = ''
        document.getElementById('noUniverseWarning').style.display = 'block'
        document.getElementById('addFixtureButton').style.display = 'none'
        document.getElementById('fixturesPaneOptionsButton').style.display = 'none'
      }
    })
    .then(() => {
      if (configuration.groups.length === 0) return

      for (const groupDef of configuration.groups) {
        // First, create the group
        const groupObj = createGroup(groupDef.name, groupDef.uuid)
        // Then, add fixtures
        for (const fixtureDef of groupDef.fixtures) {
          const fixture = getFixture(fixtureDef)
          groupObj.addFixtures([fixture])
        }
      }
      rebuildGroupsInterface()
      document.getElementById('noGroupsWarning').style.display = 'none'
      document.getElementById('createNewGroupButton').style.display = 'block'
    })
    .then(() => {
      if ((configuration?.scenes ?? []).length === 0) {
        rebuildScenesInterface()
        return
      }

      for (const sceneDef of configuration.scenes) {
        createScene(sceneDef.name, sceneDef.values, sceneDef.uuid, sceneDef.duration)
      }
      rebuildScenesInterface()
    })
    .then(() => {
      getDMXStatus()
    })
}

function rebuildUniverseInterface () {
  // Build an HTML representation of the universe

  document.getElementById('noUniverseWarning').style.display = 'none'

  universe.createHTML()
  // Then, bind the color picker to each element.
  for (const fixtureName of Object.keys(universe.fixtures)) {
    const fixture = universe.fixtures[fixtureName]
    Coloris({
      alpha: false,
      theme: 'pill',
      themeMode: 'dark',
      format: 'rgb',
      el: '#universe_fixture_' + fixture.uuid + '_' + 'colorPicker',
      wrap: true
    })
  }
}

function rebuildGroupsInterface () {
  // Take the list of groups and create a tab for each of them

  const tabNav = document.getElementById('groupTabNav')
  const tabContent = document.getElementById('groupTabContent')
  tabNav.innerHTML = ''
  tabContent.innerHTML = ''

  groupList.forEach((group, index) => {
    const isFirst = index === 0

    // 1. Create the Tab Link
    const navItem = document.createElement('li')
    navItem.className = 'nav-item'
    navItem.role = 'presentation'

    const navButton = document.createElement('button')
    navButton.className = `nav-link ${isFirst ? 'active' : ''}`
    navButton.id = `tab-${group.safeName}`
    navButton.setAttribute('data-bs-toggle', 'tab')
    navButton.setAttribute('data-bs-target', `#pane-${group.safeName}`)
    navButton.type = 'button'
    navButton.role = 'tab'
    navButton.innerText = group.name

    navItem.appendChild(navButton)
    tabNav.appendChild(navItem)

    // 2. Create the Tab Pane
    const tabPane = document.createElement('div')
    tabPane.className = `tab-pane fade ${isFirst ? 'show active' : ''}`
    tabPane.id = `pane-${group.safeName}`
    tabPane.role = 'tabpanel'
    tabPane.setAttribute('aria-labelledby', `tab-${group.safeName}`)

    // 3. Append Group Content
    tabPane.appendChild(group.createHTML())
    tabContent.appendChild(tabPane)

    // Then, bind the color picker to each element.
    for (const fixtureName of Object.keys(group.fixtures)) {
      const fixture = group.fixtures[fixtureName]
      Coloris({
        alpha: false,
        theme: 'pill',
        themeMode: 'dark',
        format: 'rgb',
        el: '#' + group.safeName + '_fixture_' + fixture.uuid + '_' + 'colorPicker',
        wrap: true
      })
    }
    Coloris({
      alpha: false,
      theme: 'pill',
      themeMode: 'dark',
      format: 'rgb',
      el: '#' + 'meta_fixture_' + group.uuid + '_' + 'colorPicker',
      wrap: true
    })
  })
}

function rebuildScenesInterface () {
  // Build an HTML representation of each scene

  const scenesRow = document.getElementById('scenesRow')
  const noScenesWarning = document.getElementById('noScenesWarning')
  const createSceneButton = document.getElementById('createSceneButton')
  scenesRow.innerText = ''

  if (sceneList.length === 0) {
    noScenesWarning.style.display = 'block'
    createSceneButton.style.display = 'none'
    return
  }

  noScenesWarning.style.display = 'none'
  createSceneButton.style.display = 'block'
  for (const scene of sceneList) {
    scenesRow.appendChild(scene.createHTML())
  }
}

function showAddUniverseMOdal () {
  // Show the addUniverseModal

  const addUniverseController = document.getElementById('addUniverseController')
  // Clear previous input
  document.getElementById('addUniverseName').value = ''
  addUniverseController.innerHTML = ''
  document.getElementById('addUniverseMissingNameWarning').style.display = 'none'

  // Get a list of available DMX controllers
  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/availableControllers'
  })
    .then((response) => {
      if (response.success === false) {
        document.getElementById('addUniverseMissingDriverWarning').style.display = 'block'
      } else {
        document.getElementById('addUniverseMissingDriverWarning').style.display = 'none'

        const controllers = response.controllers
        for (const controller of controllers) {
          const option = document.createElement('option')
          if (controller.model === 'OpenDMX') {
            option.innerHTML = `OpenDMX (S/N: ${controller.serial_number}, bus: ${controller.bus}, address: ${controller.address})`
          } else if (controller.model === 'uDMX') {
            option.innerHTML = `uDMX (Bus: ${controller.bus}, address: ${controller.address})`
          }
          option.setAttribute('data-value', JSON.stringify(controller))

          addUniverseController.appendChild(option)
        }
      }
    })

  exUtilities.showModal('#addUniverseModal')
}

function addUniverseFromModal () {
  // Use the addUniverseModal to create a new universe.

  const name = document.getElementById('addUniverseName').value.trim()
  const controller = JSON.parse(document.getElementById('addUniverseController')?.selectedOptions[0]?.dataset.value)

  if (name === '') {
    document.getElementById('addUniverseMissingNameWarning').style.display = 'block'
    return
  }

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/DMX/universe/create',
    params: {
      name,
      controller: controller.model,
      device_details: controller
    }
  })
    .then((response) => {
      if (response?.success === true) {
        createUniverse(response.universe.uuid, response.universe.controller)
        rebuildUniverseInterface()
        exUtilities.hideModal('#addUniverseModal')
      }
    })
}

// Add event listeners
// Universe tab
document.getElementById('showAddUniverseModalButton')?.addEventListener('click', showAddUniverseMOdal)
document.getElementById('addFixtureButton').addEventListener('click', () => {
  showAddFixtureModal()
})
document.getElementById('addFixtureAddChannelButton')?.addEventListener('click', addChannelToModal)
document.getElementById('addFixtureFromModalButton')?.addEventListener('click', addFixtureFromModal)
document.getElementById('addFixtureStartingChannel').addEventListener('input', updateModalChannelCounts)
document.getElementById('deleteFixtureFromModalButton').addEventListener('click', () => {
  const fixtureUUID = document.getElementById('addFixtureModal').dataset.fixtureUUID

  exCommon.makeHelperRequest({
    method: 'DELETE',
    endpoint: '/DMX/fixture/' + fixtureUUID
  })
    .then((response) => {
      if (response?.success === true) {
        getFixture(fixtureUUID).remove()
        exUtilities.hideModal('#addFixtureModal')
      }
    })
})
document.getElementById('addUniverseFromModalButton')?.addEventListener('click', addUniverseFromModal)
document.getElementById('cloneFixtureButton').addEventListener('click', () => {
  cloneFixture()
})

// Group tab
document.getElementById('createNewGroupFromWarningButton')?.addEventListener('click', () => showEditGroupModal(''))
document.getElementById('createNewGroupButton')?.addEventListener('click', () => showEditGroupModal(''))
document.getElementById('editGroupModalSaveButton')?.addEventListener('click', editGroupFromModal)
document.getElementById('editSceneModalSaveButton')?.addEventListener('click', editSceneFromModal)
document.getElementById('editSceneModalDeleteButton')?.addEventListener('click', deleteSceneFromModal)

// Scenes tab
for (const id of ['createSceneButton', 'createNewSceneFromWarningButton']) {
  document.getElementById(id).addEventListener('click', () => {
    showEditSceneModal('')
  })
}

// Place the popover trigger after all the event listeners
document.addEventListener('click', (event) => {
  switch (event.target.getAttribute('id')) {
    case 'groupDeletePopover':
      deleteGroup(document.getElementById('editGroupModal').dataset.groupUUID)
      break
    case 'universeDeletePopover':
      deleteUniverse()
      break
  }
})

const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
popoverTriggerList.map(function (popoverTriggerEl) {
  return new bootstrap.Popover(popoverTriggerEl)
})

exCommon.config.updateParser = updateFunc // Function to read app-specific updatess
exCommon.config.exhibiteraAppID = 'dmx_control'
exCommon.config.helperAddress = window.location.origin

let universe = null
let groupList = []
let sceneList = []

exCommon.config.debug = true

const searchParams = exCommon.parseQueryString()
if (searchParams.has('standalone')) {
  // We are displaying this because it was clicked from the web console DMX tab
} else {
  // We are displaying this as the main app
  exCommon.askForDefaults()
    .then(() => {
      exCommon.sendPing()

      setInterval(exCommon.sendPing, 5000)
    })
}

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

document.getElementById('helpButton').addEventListener('click', (event) => {
  exSetup.showAppHelpModal('dmx_control')
})

setInterval(exCommon.checkForHelperUpdates, 5000)

getDMXConfiguration()
setInterval(getDMXStatus, 5000)
