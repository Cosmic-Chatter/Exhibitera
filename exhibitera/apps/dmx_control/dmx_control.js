/* global Coloris, bootstrap */

import * as exCommon from '../js/exhibitera_app_common.js'
import * as exSetup from '../js/exhibitera_setup_common.js'

class DMXUniverse {
  // A mirror for the DMXUniverse Python class

  constructor (name, uuid, controller) {
    this.name = name
    this.uuid = uuid
    this.safeName = name.replaceAll(' ', '_').replaceAll('.', '_').replaceAll('#', '_')
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

  checkIfChannelsFree (startChannel, numChannels, fixtureUUID = null) {
    // Check if the given channels are available in the channelMap
    // If fixtureUUID != null, ignore overlaps with that fixture

    let excludeMin = 1000
    let excludeMax = 1000
    if (fixtureUUID != null) {
      const fixture = this.getFixtureByUUID(fixtureUUID)
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

  getFixtureByName (name) {
    return this.fixtures[name]
  }

  getFixtureByUUID (uuid) {
    let matchedFixture = null
    Object.keys(this.fixtures).forEach((key) => {
      const fixture = this.fixtures[key]
      if (fixture.uuid === uuid) matchedFixture = fixture
    })
    return matchedFixture
  }

  createHTML () {
    // Create the HTML representation for this universe.

    const col = document.createElement('div')
    col.classList = 'col-12'

    const row1 = document.createElement('div')
    row1.classList = 'row bg-secondary mx-0 rounded-top'
    col.appendChild(row1)

    const nameCol = document.createElement('div')
    nameCol.classList = 'col-6 col-md-6 col-lg-8 h4 px-2 py-2 mb-0'
    nameCol.innerHTML = this.name
    row1.appendChild(nameCol)

    const editButtonCol = document.createElement('div')
    editButtonCol.classList = 'col-3 col-md-3 col-lg-2 align-self-center pe-1'
    row1.appendChild(editButtonCol)

    const editButton = document.createElement('button')
    editButton.classList = 'btn btn-primary w-100'
    editButton.innerHTML = `
      <span class='d-none d-md-inline'>Edit universe</span>
      <span class='d-inline d-md-none'>Edit</span>
    `
    editButton.addEventListener('click', () => {
      showUniverseEditModal(this.name, this.uuid)
    })
    editButtonCol.appendChild(editButton)

    const addButtonCol = document.createElement('div')
    addButtonCol.classList = 'col-3 col-md-3 col-lg-2 align-self-center pe-1'
    row1.appendChild(addButtonCol)

    const addButton = document.createElement('button')
    addButton.classList = 'btn btn-primary w-100'
    addButton.innerHTML = `
    <span class='d-none d-md-inline'>Add fixture</span>
    <span class='d-inline d-md-none'>Add</span>
  `
    addButton.addEventListener('click', () => {
      showAddFixtureModal(this.uuid)
    })
    addButtonCol.appendChild(addButton)

    const row2 = document.createElement('div')
    row2.classList = 'row'
    col.appendChild(row2)

    $(nameCol).click(() => {
      $(row2).slideToggle(300)
    })

    Object.keys(this.fixtures).forEach((key) => {
      const fixture = this.fixtures[key]
      row2.appendChild(fixture.createHTML(this.safeName))
    })

    return col
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

  setChannelValues (valueDict) {
    // Take a dictionary of channel values and update this.channelValues.

    Object.keys(valueDict).forEach((key) => {
      this.channelValues[key] = valueDict[key]
    })
  }

  updateGUI () {
    // Take the current channelValues and use them to update the GUI.

    // Loop the channels and update their GUI representations
    Object.keys(this.channelValues).forEach(key => {
      // Update the universe representation
      const universe = getUniverseByUUID(this.universe)
      $('#' + universe.safeName + '_fixture_' + this.uuid + '_' + 'channelValue_' + key).val(this.channelValues[key])
      $('#' + universe.safeName + '_fixture_' + this.uuid + '_' + 'channelSlider_' + key).val(this.channelValues[key])
      updatecolorPicker(universe.safeName, this.uuid)

      // Update the group(s) representation
      this.groups.forEach((groupUUID) => {
        const group = getGroupByUUID(groupUUID)
        $('#' + group.safeName + '_fixture_' + this.uuid + '_' + 'channelValue_' + key).val(this.channelValues[key])
        $('#' + group.safeName + '_fixture_' + this.uuid + '_' + 'channelSlider_' + key).val(this.channelValues[key])
        updatecolorPicker(group.safeName, this.uuid)
      })
    })
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
    ['a', 'b', 'dimmer', 'g', 'r', 'uv', 'w'].forEach((channel) => {
      if (channel in this.channelValues) {
        // First, save the current value
        this.valueMemory[channel] = this.channelValues[channel]
        // Then, set the max values
        this.channelValues[channel] = 255
        this.sendChannelUpdate(channel)
      }
    })
  }

  locateEnd () {
    // Reset the brightness values to their pre-locate values.

    // Cycle the possible color channels + dimmer
    ['a', 'b', 'dimmer', 'g', 'r', 'uv', 'w'].forEach((channel) => {
      if (channel in this.channelValues) {
        this.channelValues[channel] = this.valueMemory[channel]
        this.sendChannelUpdate(channel)
      }
    })
  }

  createHTML (collectionName) {
    // Create the HTML representation for this fixture.
    // collectionName is the name of the universe/group/scene this HTML widget is being rendered for.

    const thisUUID = this.uuid

    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-6 col-lg-4 mt-2'

    const row = document.createElement('div')
    row.classList = 'row mx-0'
    row.style.backgroundColor = '#28587B'
    col.appendChild(row)

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
    // colorPicker.setAttribute('data-coloris', true)
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

    const editCol = document.createElement('div')
    editCol.classList = 'col-6 col-md-4 offset-md-4'
    optionsRow.appendChild(editCol)

    const editButton = document.createElement('button')
    editButton.classList = 'btn btn-sm btn-info w-100'
    editButton.innerHTML = 'Edit'
    const thisFixture = this
    editButton.addEventListener('click', () => {
      showAddFixtureModal(thisFixture.universe, thisFixture)
    })
    editCol.appendChild(editButton)

    const universeCol = document.createElement('div')
    universeCol.classList = 'col-6 fst-italic pt-1'
    universeCol.style.backgroundColor = '#28587B'
    universeCol.innerHTML = getUniverseByUUID(this.universe).name
    row.appendChild(universeCol)

    const channelsCol = document.createElement('div')
    channelsCol.classList = 'col-6 text-end pt-1'
    channelsCol.style.backgroundColor = '#28587B'
    channelsCol.innerHTML = `
      <span class='d-inline d-sm-none d-xl-inline'>Channels ${String(this.startChannel)} - ${String(this.startChannel + this.channelList.length - 1)} </span>
      <span class='d-none d-sm-inline d-xl-none'>Ch. ${String(this.startChannel)} - ${String(this.startChannel + this.channelList.length - 1)} </span>
    `
    row.appendChild(channelsCol)

    const expandMessage = document.createElement('div')
    expandMessage.classList = 'col-12 text-center fst-italic small'
    expandMessage.style.backgroundColor = '#28587B'
    expandMessage.style.cursor = 'pointer'
    expandMessage.innerHTML = 'Tap to collapse'
    row.appendChild(expandMessage)

    const row2 = document.createElement('div')
    row2.classList = 'row mx-0'
    col.appendChild(row2)

    this.channelList.forEach((channel) => {
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
    })

    $([headerText, expandMessage]).click(() => {
      $(row2).slideToggle({
        duration: 300,
        complete: () => {
          if (expandMessage.innerHTML === 'Tap to collapse') {
            expandMessage.innerHTML = 'Tap to expand'
          } else {
            expandMessage.innerHTML = 'Tap to collapse'
          }
        }
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

    fixtures.forEach((fixture) => {
      this.fixtures[fixture.uuid] = fixture
      if (!this.fixtures[fixture.uuid].groups.includes(this.uuid)) {
        this.fixtures[fixture.uuid].groups.push(this.uuid)
      }
    })
  }

  clearFixtures () {
    this.fixtures = {}
  }

  locateStart () {
    // Trigger the locate effect for every fixture in the group.

    Object.keys(this.fixtures).forEach((key) => {
      this.fixtures[key].locateStart()
    })
  }

  locateEnd () {
    // Trigger the locate effect for every fixture in the group.

    Object.keys(this.fixtures).forEach((key) => {
      this.fixtures[key].locateEnd()
    })
  }

  createMetaFixtureHTML () {
    // Create a widget that provides controls for any channels included in every fixture in the group.

    const thisUUID = this.uuid

    // Cycle through the channels in the first fixture, comparing each to all the other fixtures
    // to find channels that exist for all.
    const matchingChannels = []
    const fixtureKeys = Object.keys(this.fixtures)
    if (fixtureKeys.length === 0) return

    this.fixtures[fixtureKeys[0]].channelList.forEach((channel) => {
      let channelMatches = true
      fixtureKeys.forEach((fixtureUUID) => {
        const fixture = this.fixtures[fixtureUUID]
        if (fixture.channelList.includes(channel) === false) channelMatches = false
      })
      if (channelMatches === true) matchingChannels.push(channel)
    })

    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-6 col-lg-4 mt-2'

    const row = document.createElement('div')
    row.style.backgroundColor = '#142f43'
    row.classList = 'row mx-0'
    col.appendChild(row)

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
    expandMessage.innerHTML = 'Tap to collapse'
    row.appendChild(expandMessage)

    const row2 = document.createElement('div')
    row2.classList = 'row mx-0'
    col.appendChild(row2)

    matchingChannels.forEach((channel) => {
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

        $('#' + 'meta_fixture_' + thisUUID + '_' + 'channelValue_' + channel).val(value)
        updatecolorPicker('meta', thisUUID)

        // Update the fixtures and send a change to the helper
        fixtureKeys.forEach((fixtureUUID) => {
          const fixture = this.getFixtureByUUID(fixtureUUID)
          const valueToUpdate = {}
          valueToUpdate[channel] = value
          fixture.setChannelValues(valueToUpdate)
        })
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

        $('#' + 'meta_fixture_' + thisUUID + '_' + 'channelSlider_' + channel).val(value)
        updatecolorPicker('meta', thisUUID)

        // Update the fixtures and send a change to th  e helper
        fixtureKeys.forEach((fixtureUUID) => {
          const fixture = this.getFixtureByUUID(fixtureUUID)
          const valueToUpdate = {}
          valueToUpdate[channel] = value
          fixture.setChannelValues(valueToUpdate)
        })
        exCommon.makeHelperRequest({
          method: 'POST',
          endpoint: '/DMX/group/' + thisUUID + '/setChannel',
          params: { channel, value }
        })
      })
      channelValueCol.appendChild(channelValue)
    })

    $([headerText, expandMessage]).click(() => {
      $(row2).slideToggle({
        duration: 300,
        complete: () => {
          if (expandMessage.innerHTML === 'Tap to collapse') {
            expandMessage.innerHTML = 'Tap to expand'
          } else {
            expandMessage.innerHTML = 'Tap to collapse'
          }
        }
      })
    })

    return col
  }

  createScene (name, uuid, values, duration = 0) {
    // Create a new DMXScene and add it this this.scenes.

    this.scenes.push(new DMXScene(name, values, this.uuid, uuid, duration))
  }

  deleteScene (uuid) {
    // Remove the given scene.

    this.scenes = this.scenes.filter(function (obj) {
      return obj.uuid !== uuid
    })
  }

  createHTML () {
    // Create the HTML representation for this group.

    const col = document.createElement('div')
    col.classList = 'col-12 mt-2'

    const row1 = document.createElement('div')
    row1.classList = 'row bg-secondary mx-0 rounded-top'
    col.appendChild(row1)

    const nameCol = document.createElement('div')
    nameCol.classList = 'col-6 col-lg-8 h4 px-2 py-2 mb-0'
    nameCol.innerHTML = this.name
    row1.appendChild(nameCol)

    const editFixturesCol = document.createElement('div')
    editFixturesCol.classList = 'col-3 col-lg-2 align-self-center pe-1'
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

    const addSceneCol = document.createElement('div')
    addSceneCol.classList = 'col-3 col-lg-2 align-self-center pe-1'
    row1.appendChild(addSceneCol)

    const addSceneButton = document.createElement('button')
    addSceneButton.classList = 'btn btn-primary w-100'
    addSceneButton.innerHTML = `
    <span class='d-none d-md-inline'>Create scene</span>
    <span class='d-inline d-md-none'>New scene</span>
  `
    addSceneButton.addEventListener('click', () => {
      showEditSceneModal('', this.uuid)
    })
    addSceneCol.appendChild(addSceneButton)

    const contentDiv = document.createElement('div')
    contentDiv.classList = 'px-1 pt-2 bg-secondary'
    col.appendChild(contentDiv)

    // Collapse the content div when the group's top bar is clicked.
    $(nameCol).click(() => {
      $(contentDiv).slideToggle(300)
    })

    const tabNav = document.createElement('nav')
    tabNav.classList = 'nav nav-tabs'
    contentDiv.appendChild(tabNav)

    const fixtureTab = document.createElement('a')
    fixtureTab.classList = 'nav-link active'
    fixtureTab.setAttribute('aria-current', 'page')
    fixtureTab.setAttribute('id', this.safeName + '_fixtureTab')
    fixtureTab.setAttribute('href', '#' + this.safeName + '_fixturePane')
    fixtureTab.setAttribute('data-bs-toggle', 'tab')
    fixtureTab.setAttribute('data-bs-target', '#' + this.safeName + '_fixturePane')
    fixtureTab.innerHTML = 'Fixtures'
    tabNav.appendChild(fixtureTab)

    const sceneTab = document.createElement('a')
    sceneTab.classList = 'nav-link'
    sceneTab.setAttribute('href', '#')
    sceneTab.setAttribute('id', this.safeName + '_sceneTab')
    sceneTab.setAttribute('href', '#' + this.safeName + '_scenePane')
    sceneTab.setAttribute('data-bs-toggle', 'tab')
    sceneTab.setAttribute('data-bs-target', '#' + this.safeName + '_scenePane')
    sceneTab.innerHTML = 'Scenes'
    tabNav.appendChild(sceneTab)

    const tabPaneContainer = document.createElement('div')
    tabPaneContainer.classList = 'tab-content'
    contentDiv.appendChild(tabPaneContainer)

    const fixturePane = document.createElement('div')
    fixturePane.classList = 'tab-pane active'
    fixturePane.setAttribute('id', this.safeName + '_fixturePane')
    fixturePane.setAttribute('role', 'tabpanel')
    fixturePane.setAttribute('aria-labelledby', this.safeName + '_fixturePane')
    fixturePane.setAttribute('tabindex', '0')
    tabPaneContainer.appendChild(fixturePane)

    const scenePane = document.createElement('div')
    scenePane.classList = 'tab-pane'
    scenePane.setAttribute('id', this.safeName + '_scenePane')
    scenePane.setAttribute('role', 'tabpanel')
    scenePane.setAttribute('aria-labelledby', this.safeName + '_SceneTab')
    scenePane.setAttribute('tabindex', '0')
    tabPaneContainer.appendChild(scenePane)

    // Add fixtures
    const fixtureRow = document.createElement('div')
    fixtureRow.classList = 'row'
    fixturePane.appendChild(fixtureRow)

    if (Object.keys(this.fixtures).length > 0) {
      // Add meta control widget
      fixtureRow.appendChild(this.createMetaFixtureHTML())

      // Add regular fixtures
      Object.keys(this.fixtures).forEach((key) => {
        const fixture = this.fixtures[key]
        fixtureRow.appendChild(fixture.createHTML(this.safeName))
      })
    }

    // Add scenes
    const sceneRow = document.createElement('div')
    sceneRow.classList = 'row'
    scenePane.appendChild(sceneRow)

    Object.keys(this.scenes).forEach((key) => {
      const scene = this.scenes[key]
      sceneRow.appendChild(scene.createHTML())
    })

    return col
  }

  getFixtureByName (name) {
    return this.fixtures[name]
  }

  getFixtureByUUID (uuid) {
    let matchedFixture = null
    Object.keys(this.fixtures).forEach((key) => {
      const fixture = this.fixtures[key]
      if (fixture.uuid === uuid) matchedFixture = fixture
    })
    return matchedFixture
  }

  getSceneByName (name) {
    let matchedScene = null

    this.scenes.forEach((scene) => {
      if (scene.name === name) {
        matchedScene = scene
      }
    })
    return matchedScene
  }

  getSceneByUUID (uuid) {
    let matchedScene = null

    this.scenes.forEach((scene) => {
      if (scene.uuid === uuid) {
        matchedScene = scene
      }
    })
    return matchedScene
  }

  showScene (uuid) {
    // Tell the helper to set the given scene.

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/group/' + this.uuid + '/showScene',
      params: {
        uuid
      }
    })
  }
}

class DMXScene {
  // A mirror for the DMXScene Python class

  constructor (name, values, group = null, uuid = '', duration = 0) {
    this.name = name
    this.values = values
    this.group = group
    this.uuid = uuid
    this.duration = duration
  }

  createHTML () {
    // Create the HTML representation for this scene.

    const thisName = this.name
    const thisUUID = this.uuid
    const thisGroup = this.group

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
      getGroupByUUID(thisGroup).showScene(thisUUID)
    })
    runCol.appendChild(runButton)

    const editCol = document.createElement('div')
    editCol.classList = 'col-6'
    bottomRow.appendChild(editCol)

    const editButton = document.createElement('button')
    editButton.classList = 'btn btn-info w-100'
    editButton.innerHTML = 'Edit'
    editButton.addEventListener('click', function () {
      showEditSceneModal(thisName, thisGroup, thisUUID)
    })
    editCol.appendChild(editButton)

    return col
  }

  getFixtureByName (name) {
    // Return the fixture, if it is in this scene

    if (name in this.values) {
      if (this.group != null) {
        return getGroupByUUID(this.group).getFixtureByName(name)
      }
    }
  }

  getFixtureByUUID (uuid) {
    // Pass the request to the group

    if (this.group != null) {
      const fixture = getGroupByUUID(this.group).getFixtureByUUID(uuid)
      if (fixture.uuid in this.values) {
        return fixture
      }
    }
  }
}

function onColorChangeFromPicker (collectionName, uuid, meta = true) {
  // When is a color is changed from the picker, update the interface to match.

  const newColor = $('#' + collectionName + '_fixture_' + uuid + '_' + 'colorPicker').val()
  // newColor is a string of format 'rgb(123, 123, 132)'
  const colorSplit = newColor.slice(4, -1).split(',')
  const red = parseInt(colorSplit[0])
  const green = parseInt(colorSplit[1])
  const blue = parseInt(colorSplit[2])

  // Set the sliders
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelValue_r').val(red)
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelValue_g').val(green)
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelValue_b').val(blue)

  // Set the inputs
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_r').val(red)
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_g').val(green)
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_b').val(blue)

  if (meta === true) {
    // Send the update to the whole group
    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/group/' + uuid + '/setColor',
      params: { color: [red, green, blue] }
    })
  } else {
    // Update the fixture and send a color change to the helper
    const fixture = getFixtureByUUID(uuid)
    fixture.setChannelValues({ r: red, g: green, b: blue })
    fixture.sendColorUpdate()
  }
}

function onChannelSliderChange (collectionName, uuid, channel, value) {
  // When the slider changes, update the number field.
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelValue_' + channel).val(value)
  updatecolorPicker(collectionName, uuid)

  // Update the fixture and send a color change to the helper
  const fixture = getFixtureByUUID(uuid)
  const valueToUpdate = {}
  valueToUpdate[channel] = value
  fixture.setChannelValues(valueToUpdate)
  fixture.sendChannelUpdate(channel)
}

function onChannelValueChange (collectionName, uuid, channel, value) {
  // When the number box is changed, update the slider.
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_' + channel).val(value)

  const fixture = getFixtureByUUID(uuid)
  const valueToUpdate = {}
  valueToUpdate[channel] = value
  fixture.setChannelValues(valueToUpdate)
  fixture.sendChannelUpdate(channel)
}

function updatecolorPicker (collectionName, uuid) {
  // Read the values from the number inputs and update the color picker

  const red = $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_r').val()
  const blue = $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_g').val()
  const green = $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_b').val()
  const colorStr = 'rgb(' + red + ',' + blue + ',' + green + ')'

  // Update the input and the color of the parent div
  try {
    $('#' + collectionName + '_fixture_' + uuid + '_' + 'colorPicker').val(colorStr).closest('.clr-field')[0].style.color = colorStr
  } catch (TypeError) {
    // This will fail is the value is changed before the Coloris color picker is activated.
  }
}

function showUniverseEditModal (universeName, universeUUID) {
  // Prepare the editUniverseModal and then show it.

  const universe = getUniverseByUUID(universeUUID)
  $('#editUniverseModal').data('uuid', universeUUID)
  $('#editUniverseModal').data('name', universe.name)

  document.getElementById('editUniverseModalName').innerHTML = universeName
  document.getElementById('editUniverseModalNameInput').value = universeName

  // Populate the list of fixtures
  const fixtureRow = $('#editUniverseFixtureRow')
  fixtureRow.empty()
  Object.keys(universe.fixtures).forEach((fixtureName) => {
    const fixture = universe.fixtures[fixtureName]
    fixtureRow.append(createFixtureCheckbox(fixture, universe))
  })

  $('#editUniverseModal').modal('show')
}

function updateUniverseFromModal () {
  // Gather information from the editUniverseModal and send it to Control Server to make an update.

  const uuid = $('#editUniverseModal').data('uuid')
  const currentName = $('#editUniverseModal').data('name')

  const promiseList = []

  // Get all the checkboxes for the fixtures and iterate through them to find unchecked ones.
  const fixtureChecks = document.querySelectorAll('#editUniverseFixtureRow > div > div > input')
  fixtureChecks.forEach((fixture) => {
    if (fixture.checked === false) {
      const fixtureUUID = fixture.getAttribute('data-uuid')
      promiseList.push(exCommon.makeHelperRequest({
        method: 'POST',
        endpoint: '/DMX/fixture/remove',
        params: { fixtureUUID }
      }))
    }
  })

  // Change the name
  const newName = document.getElementById('editUniverseModalNameInput').value
  if (newName !== currentName) {
    promiseList.push(exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/universe/rename',
      params: {
        uuid,
        new_name: newName
      }
    })
      .then(() => {
        getUniverseByUUID(uuid).name = newName
      })
    )
  }

  // Once all the promises have resolved, rebuild the interface
  if (promiseList.length > 0) {
    Promise.all(promiseList)
      .then(() => {
        getDMXConfiguration()
      })
  }
  $('#editUniverseModal').modal('hide')
}

function showAddFixtureModal (universeUUID, fixture = null) {
  // Prepare the addFixtureModal and then show it.
  // If a fixture is passed to 'fixture', the modal will be
  // configuerd to edit the fixture rather than add a new one.

  const universe = getUniverseByUUID(universeUUID)
  $('#addFixtureModal').data('universeUUID', universeUUID)

  // Reset common fields
  document.getElementById('addFixtureChannelList').innerHTML = ''
  document.getElementById('addFixtureFromModalButton').style.display = 'none'
  document.getElementById('addFixtureChannelsOccupiedWarning').style.display = 'none'

  // Set up fields by mode
  if (fixture == null) {
    // Add a new fixture
    $('#addFixtureModal').data('mode', 'add')
    document.getElementById('addFixtureName').value = ''
    document.getElementById('addFixtureFromModalButton').innerHTML = 'Add'

    // Find the next free channel
    const searchFunc = (el) => el === false
    const nextChannel = universe.channelMap.slice(1).findIndex(searchFunc) + 1
    document.getElementById('addFixtureStartingChannel').value = nextChannel

    // Populate the available clone options
    document.getElementById('cloneFixtureGroup').style.display = 'block'
    const cloneFixtureList = document.getElementById('cloneFixtureList')
    cloneFixtureList.innerHTML = ''
    Object.keys(universe.fixtures).forEach((key) => {
      const fixture = universe.fixtures[key]
      const option = document.createElement('option')
      option.value = fixture.uuid
      option.innerHTML = fixture.name
      cloneFixtureList.appendChild(option)
    })
  } else {
    // Update an existing fixture
    $('#addFixtureModal').data('mode', 'edit')
    $('#addFixtureModal').data('fixtureUUID', fixture.uuid)
    document.getElementById('addFixtureName').value = fixture.name
    document.getElementById('addFixtureFromModalButton').innerHTML = 'Save'
    document.getElementById('addFixtureStartingChannel').value = fixture.startChannel

    // Populate the current channels
    document.getElementById('cloneFixtureGroup').style.display = 'none'
    cloneFixture(fixture)
  }

  $('#addFixtureModal').modal('show')
}

function cloneFixture (fixtureToClone = null) {
  // Use an existing fixture to populate the addFixtureModal
  // Optionally pass a DMXFixture or the value of the select will be used.

  const universe = getUniverseByUUID($('#addFixtureModal').data('universeUUID'))
  if (fixtureToClone == null) {
    fixtureToClone = universe.getFixtureByUUID(document.getElementById('cloneFixtureList').value)
  }
  console.log(fixtureToClone)
  const addFixtureChannelList = document.getElementById('addFixtureChannelList')

  fixtureToClone.channelList.forEach((channel) => {
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
  })
}

function showEditGroupModal (groupUUID) {
  // Configure the edit group modal and show it

  let group
  if ((groupUUID == null) || (groupUUID.trim() === '')) {
    $('#editGroupModalTitle').html('Create new group')
    groupUUID = ''
    document.getElementById('editGroupNameInput').value = ''
    document.getElementById('editGroupModalDeleteButton').style.display = 'none'
  } else {
    group = getGroupByUUID(groupUUID)
    $('#editGroupModalTitle').html('Edit ' + group.name)
    // Add the current name
    document.getElementById('editGroupNameInput').value = group.name
    document.getElementById('editGroupModalDeleteButton').style.display = 'block'
  }

  $('#editGroupModal').data('group', groupUUID)

  // Populate the list of fixtures
  const fixtureRow = $('#editGroupFixtureRow')
  fixtureRow.empty()
  universeList.forEach((universe) => {
    const header = document.createElement('div')
    header.classList = 'h5 col-12'
    header.innerHTML = universe.name
    fixtureRow.append(header)
    Object.keys(universe.fixtures).forEach((fixtureName) => {
      const fixture = universe.fixtures[fixtureName]

      fixtureRow.append(createFixtureCheckbox(fixture, group))
    })
  })

  $('#editGroupModal').modal('show')
}

function editGroupFromModal () {
  // Called when the Save button is pressed in the editGroupModal

  const groupUUID = $('#editGroupModal').data('group')

  const fixturesElements = $('#editGroupFixtureRow').find('.form-check-input ').toArray()

  const fixturesToAdd = []
  const fixturesToAddUUID = []
  fixturesElements.forEach((element) => {
    if ($(element).prop('checked') === true) {
      const fixture = getFixtureByUUID($(element).data('uuid'))
      fixturesToAdd.push(fixture)
      fixturesToAddUUID.push(fixture.uuid)
    }
  })

  let group
  if (groupUUID !== '') {
    // We are editing a group
    group = getGroupByUUID(groupUUID)
    group.clearFixtures()
    group.name = document.getElementById('editGroupNameInput').value
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
        $('#editGroupModal').modal('hide')
      })
  } else {
    // We are creating a new group
    createGroupFromModal(document.getElementById('editGroupNameInput').value, fixturesToAdd, fixturesToAddUUID)
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
      $('#editGroupModal').modal('hide')
    })
}

function showEditSceneModal (sceneName, groupUUID, uuid = '') {
  // Configure the edit scene modal and show it

  const group = getGroupByUUID(groupUUID)
  const scene = group.getSceneByName(sceneName)
  $('#editSceneModal').data('group', group)
  $('#editSceneModal').data('uuid', uuid)

  $('#editSceneFixtureList').empty()
  Object.keys(group.fixtures).forEach((fixtureName) => {
    const fixture = group.getFixtureByName(fixtureName)
    $('#editSceneFixtureList').append(createFixtureCheckbox(fixture, scene))
  })

  $('#editSceneModalSceneName').val(sceneName)

  if (uuid !== '') {
    // We are editing an existing scene
    $('#editSceneModalDurationInput').val(scene.duration)

    $('#editSceneModalTitle').html('Edit scene: ' + sceneName)
    $('#editSceneModalSaveButton').html('Save')
    $('#editSceneModalDeleteButton').show()
  } else {
    $('#editSceneModalDurationInput').val(0)
    $('#editSceneModalTitle').html('Add scene')
    $('#editSceneModalSaveButton').html('Create')
    $('#editSceneModalDeleteButton').hide()
  }

  $('#editSceneModal').modal('show')
}

function editSceneFromModal () {
  // Save the scene changse from the modal.

  const sceneName = $('#editSceneModalSceneName').val().trim()
  const duration = parseInt($('#editSceneModalDurationInput').val())
  const checkboxes = $('#editSceneFixtureList').find('.form-check-input').toArray()
  const groupUUID = $('#editSceneModal').data('group').uuid
  const uuid = $('#editSceneModal').data('uuid')

  const sceneDict = {}
  checkboxes.forEach((box) => {
    if ($(box).prop('checked') === true) {
      const fixture = getFixtureByUUID($(box).data('uuid'))
      const values = fixture.channelValues
      values.duration = duration
      sceneDict[fixture.uuid] = values
    }
  })

  if (uuid === '') {
    // We are creating a new scene

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/group/' + groupUUID + '/createScene',
      params: { name: sceneName, values: sceneDict, duration }
    })
      .then((result) => {
        if ('success' in result && result.success === true) {
          const group = getGroupByUUID(groupUUID)
          group.createScene(sceneName, result.uuid, sceneDict, duration)
          $('#editSceneModal').modal('hide')
          rebuildGroupsInterface()
        }
      })
  } else {
    // We are editing an existing scene

    exCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/group/' + groupUUID + '/editScene',
      params: { name: sceneName, values: sceneDict, duration, uuid }
    })
      .then((result) => {
        if ('success' in result && result.success === true) {
          const group = getGroupByUUID(groupUUID)
          const scene = group.getSceneByUUID(uuid)
          scene.name = sceneName
          scene.duration = duration
          scene.values = sceneDict
          $('#editSceneModal').modal('hide')
          rebuildGroupsInterface()
        }
      })
  }
}

function deleteSceneFromModal () {
  // Delete the scene we are currently editing.

  const groupUUID = $('#editSceneModal').data('group').uuid
  const uuid = $('#editSceneModal').data('uuid')

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/DMX/group/' + groupUUID + '/deleteScene',
    params: { uuid }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        const group = getGroupByUUID(groupUUID)
        group.deleteScene(uuid)
        $('#editSceneModal').modal('hide')
        rebuildGroupsInterface()
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
  check.setAttribute('data-uuid', fixture.uuid)
  check.value = ''

  if (collection != null && collection.getFixtureByUUID(fixture.uuid) != null) {
    check.setAttribute('checked', true)
  }

  $(check).data('uuid', fixture.uuid)
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

  options.forEach((entry) => {
    const option = document.createElement('option')
    option.innerHTML = entry[0]
    if (entry[1] === '') {
      option.setAttribute('disabled', true)
    } else {
      option.value = entry[1]
    }
    select.appendChild(option)
  })

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
    $(col).remove()
    if ($('#addFixtureChannelList').children().length === 0) {
      $('#addFixtureFromModalButton').hide()
    }
  })
  deleteCol.appendChild(deleteButton)

  const channelList = document.getElementById('addFixtureChannelList')
  channelList.appendChild(col)
  channelList.scrollTop = channelList.scrollHeight
  updateModalChannelCounts()

  $('#addFixtureFromModalButton').show()
  document.getElementById('cloneFixtureGroup').style.display = 'none'
}

function updateModalChannelCounts () {
  // Using the starting channel and number of channels, updte the labels for each channel

  const channelList = document.getElementById('addFixtureChannelList')
  const startingChannel = parseInt(document.getElementById('addFixtureStartingChannel').value)

  let i = 0
  Array.from(channelList.querySelectorAll('.channel-count')).forEach((el) => {
    el.innerHTML = String(i + 1) + ' (' + String(startingChannel + i) + ')'
    i += 1
  })
}

function addFixtureFromModal () {
  // Collect the necessary information from the addFixtureModal and ask the helper to add or edit the fixture.

  const mode = $('#addFixtureModal').data('mode')
  const universeUUID = $('#addFixtureModal').data('universeUUID')

  const channelList = []
  document.getElementById('addFixtureChannelList').childNodes.forEach((el) => {
    const select = el.querySelector('select')
    if (select.value !== 'other') {
      channelList.push(select.value)
    } else {
      const input = el.querySelector('.other-channel-input')
      channelList.push(input.value.trim().replaceAll(' ', '_'))
    }
  })
  const startChannel = parseInt($('#addFixtureStartingChannel').val())

  const definition = {
    name: $('#addFixtureName').val(),
    start_channel: startChannel,
    channels: channelList,
    universe: universeUUID
  }

  let fixtureUUID = null
  if (mode === 'edit') {
    fixtureUUID = $('#addFixtureModal').data('fixtureUUID')
    definition.fixture_uuid = fixtureUUID
  }

  const channelsFree = getUniverseByUUID(universeUUID).checkIfChannelsFree(startChannel, channelList.length, fixtureUUID)
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
      endpoint: '/DMX/fixture/edit',
      params: definition
    })
  }

  promise.then((response) => {
    if ('success' in response && response.success === true) {
      getDMXConfiguration()
      $('#addFixtureModal').modal('hide')
    }
  })
}

function createUniverse (name, uuid, controller) {
  // Create a new universe and add it to the global list.

  const newUniverse = new DMXUniverse(name, uuid, controller)
  universeList.push(newUniverse)
  return newUniverse
}

function deleteUniverse (uuid) {
  // Ask the helper to delete the given universe and then remove it from the interface.

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/universe/' + uuid + '/delete'
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        $('#editUniverseModal').modal('hide')
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
    method: 'GET',
    endpoint: '/DMX/group/' + uuid + '/delete'
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        groupList = groupList.filter((obj) => {
          return obj.uuid !== uuid
        })

        // Cycle the fixtures and remove any reference to this group
        universeList.forEach((universe) => {
          Object.keys(universe.fixtures).forEach((key) => {
            const fixture = universe.fixtures[key]
            fixture.groups = fixture.groups.filter(e => e !== uuid)
          })
        })
        $('#editGroupModal').modal('hide')
        rebuildGroupsInterface()
      }
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

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = (update.commands)[i]
    }
  }
}

function getUniverseByUUID (uuid) {
  let matchedUniverse = null
  universeList.forEach(universe => {
    if (universe.uuid === uuid) matchedUniverse = universe
  })
  return matchedUniverse
}

function getGroupByUUID (uuid) {
  let matchedGroup = null
  groupList.forEach((group) => {
    if (group.uuid === uuid) {
      matchedGroup = group
    }
  })
  return matchedGroup
}

function getFixtureByUUID (uuid) {
  let matchedFixture = null
  universeList.forEach(universe => {
    const fixture = universe.getFixtureByUUID(uuid)
    if (fixture != null) matchedFixture = fixture
  })
  return matchedFixture
}

function getDMXStatus () {
  // Ask the helper for the latest status for each fixture.

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/getStatus'
  })
    .then((response) => {
      Object.keys(response.status).forEach((key) => {
        const update = response.status[key]
        const fixture = getFixtureByUUID(key)
        fixture.setChannelValues(update)
        fixture.updateGUI()
      })
    })
}

function getDMXConfiguration () {
  // Ask the helper for the current DMX configuration and update the interface.

  let configuration

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/getConfiguration'
  })
    .then((response) => {
      universeList.length = 0
      groupList.length = 0
      configuration = response.configuration

      if (response.success === false && response.reason === 'device_not_found') {
        document.getElementById('missingDeviceWarning').style.display = 'block'
      } else {
        document.getElementById('missingDeviceWarning').style.display = 'none'
      }

      if (configuration.universes.length > 0) {
        configuration.universes.forEach((universeDef) => {
          // First, create the universe
          const universeObj = createUniverse(universeDef.name, universeDef.uuid, universeDef.controller)
          // Then, loop the fixtures and add each.
          universeDef.fixtures.forEach((fixture) => {
            universeObj.addFixture(fixture)
          })
        })
        rebuildUniverseInterface()
        document.getElementById('noUniverseWarning').style.display = 'none'
        document.getElementById('createNewUniverseButton').style.display = 'block'
      }
    })
    .then(() => {
      if (configuration.groups.length > 0) {
        configuration.groups.forEach((groupDef) => {
          // First, create the group
          const groupObj = createGroup(groupDef.name, groupDef.uuid)
          // Then, add fixtures and scenes
          groupDef.fixtures.forEach((fixtureDef) => {
            const fixture = getFixtureByUUID(fixtureDef)
            groupObj.addFixtures([fixture])
          })
          groupDef.scenes.forEach((sceneDef) => {
            groupObj.createScene(sceneDef.name, sceneDef.uuid, sceneDef.values, sceneDef.duration)
          })
        })
        rebuildGroupsInterface()
        document.getElementById('noGroupsWarning').style.display = 'none'
        document.getElementById('createNewGroupButton').style.display = 'block'
      }
    })
    .then(() => {
      getDMXStatus()
    })
}

function rebuildUniverseInterface () {
  // Take the list of universes and add the HTML representation of each.

  document.getElementById('noUniverseWarning').style.display = 'none'
  $('#universeRow').empty()
  universeList.forEach(universe => {
    $('#universeRow').append(universe.createHTML())
    // Then, bind the color picker to each element.
    Object.keys(universe.fixtures).forEach(fixtureName => {
      const fixture = universe.fixtures[fixtureName]
      Coloris({
        alpha: false,
        theme: 'pill',
        themeMode: 'dark',
        format: 'rgb',
        el: '#' + universe.safeName + '_fixture_' + fixture.uuid + '_' + 'colorPicker',
        wrap: true
      })
    })
  })
}

function rebuildGroupsInterface () {
  // Take the list of group and add the HTML representation of each.

  if (groupList.length > 0) {
    document.getElementById('noGroupsWarning').style.display = 'none'
    document.getElementById('createNewGroupButton').style.display = 'block'
  } else {
    document.getElementById('noGroupsWarning').style.display = 'block'
    document.getElementById('createNewGroupButton').style.display = 'none'
  }
  $('#groupsRow').empty()
  groupList.forEach(group => {
    $('#groupsRow').append(group.createHTML())
    // Then, bind the color picker to each element.
    Object.keys(group.fixtures).forEach(fixtureName => {
      const fixture = group.fixtures[fixtureName]
      Coloris({
        alpha: false,
        theme: 'pill',
        themeMode: 'dark',
        format: 'rgb',
        el: '#' + group.safeName + '_fixture_' + fixture.uuid + '_' + 'colorPicker',
        wrap: true
      })
    })
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

function showAddUniverseMOdal () {
  // Show the addUniverseModal

  // Clear previous input
  $('#addUniverseName').val('')
  $('#addUniverseController').empty()
  $('#addUniverseMissingNameWarning').hide()

  // Get a list of available DMX controllers
  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/getAvailableControllers'
  })
    .then((response) => {
      if (response.success === false) {
        document.getElementById('addUniverseMissingDriverWarning').style.display = 'block'
      } else {
        document.getElementById('addUniverseMissingDriverWarning').style.display = 'none'

        const controllers = response.controllers
        controllers.forEach((controller) => {
          const option = document.createElement('option')
          if (controller.model === 'OpenDMX') {
            option.innerHTML = `OpenDMX (S/N: ${controller.serial_number}, bus: ${controller.bus}, address: ${controller.address})`
          } else if (controller.model === 'uDMX') {
            option.innerHTML = `uDMX (Bus: ${controller.bus}, address: ${controller.address})`
          }
          $(option).data('value', controller)

          $('#addUniverseController').append(option)
        })
      }
    })

  $('#addUniverseModal').modal('show')
}

function addUniverseFromModal () {
  // Use the addUniverseModal to create a new universe.

  const name = $('#addUniverseName').val().trim()
  const controller = $('#addUniverseController').find(':selected').data('value')

  if (name === '') {
    $('#addUniverseMissingNameWarning').show()
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
      if ('success' in response && response.success === true) {
        console.log(response)
        createUniverse(response.universe.name,
          response.universe.uuid,
          response.universe.controller)
        rebuildUniverseInterface()
        $('#addUniverseModal').modal('hide')
      }
    })
}

// Add event listeners
// Universe tab
$('#showAddUniverseModalButton').click(showAddUniverseMOdal)
$('#addFixtureAddChannelButton').click(addChannelToModal)
document.getElementById('addFixtureStartingChannel').addEventListener('input', updateModalChannelCounts)
$('#addFixtureFromModalButton').click(addFixtureFromModal)
$('#addUniverseFromModalButton').click(addUniverseFromModal)
$('#editUniverseModalSaveButton').click(updateUniverseFromModal)
document.getElementById('cloneFixtureButton').addEventListener('click', () => {
  cloneFixture()
})
document.getElementById('createNewUniverseButton').addEventListener('click', showAddUniverseMOdal)

// Group tab
$('#createNewGroupFromWarningButton').click(() => {
  showEditGroupModal('')
})
$('#createNewGroupButton').click(() => {
  showEditGroupModal('')
})
$('#editGroupModalSaveButton').click(editGroupFromModal)
$('#editSceneModalSaveButton').click(editSceneFromModal)
$('#editSceneModalDeleteButton').click(deleteSceneFromModal)
// document.getElementById('groupDeletePopover').addEventListener('click', deleteGroupFromModal)

// Place the popover trigger after all the event listeners
document.addEventListener('click', (event) => {
  switch (event.target.getAttribute('id')) {
    case 'groupDeletePopover':
      deleteGroup($('#editGroupModal').data('group'))
      break
    case 'universeDeletePopover':
      deleteUniverse($('#editUniverseModal').data('uuid'))
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

const universeList = []
let groupList = []

exCommon.config.debug = true
let standalone = false

const searchParams = exCommon.parseQueryString()
if (searchParams.has('standalone')) {
  // We are displaying this because it was clicked from the web console DMX tab
  standalone = true
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
