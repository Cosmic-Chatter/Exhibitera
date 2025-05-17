import exConfig from './config.js'
import * as exTools from './exhibitera_tools.js'

export function rebuildIssueList () {
  // Take an array of issue dictionaries and build the GUI representation.

  // Gather the settings for the various filters
  const filterPriority = document.getElementById('issueListFilterPrioritySelect').value
  let filterAssignedTo = document.getElementById('issueListFilterAssignedToSelect').value
  if (filterAssignedTo === '') filterAssignedTo = 'all'
  const issueList = document.getElementById('issuesRow')
  issueList.innerHTML = ''

  for (const issue of exConfig.issueList) {
    // Check against the filters
    if (filterPriority !== 'all' && filterPriority !== issue.priority && filterPriority != null) {
      continue
    }
    if (
      (filterAssignedTo != null && filterAssignedTo !== 'all' && filterAssignedTo !== 'unassigned' && !issue.assignedTo.includes(filterAssignedTo)) ||
      (filterAssignedTo === 'unassigned' && issue.assignedTo.length > 0)
    ) continue

    issueList.append(createIssueHTML(issue))
  }
}

export function upateIssueList () {
  // Iterate over the issues, only updating those that have changed
  // Also adds newly-created issues.

  const issueRow = document.getElementById('issuesRow')
  const issueCols = Array.from(issueRow.querySelectorAll('.issue-col'))

  // Create a mapping of issue UUIDs to issue cols
  const issueColMap = {}
  for (const issueCol of issueCols) {
    const details = JSON.parse(issueCol.getAttribute('data-details'))
    issueColMap[details.id] = {
      element: issueCol,
      uuid: details.id,
      lastUpdateDate: details.lastUpdateDate
    }
  }

  for (const issue of exConfig.issueList) {
    if (issue.id in issueColMap) {
      const details = issueColMap[issue.id]
      if (issue.lastUpdateDate > details.lastUpdateDate) {
        // Create an updated element and replace the old one
        issueRow.replaceChild(createIssueHTML(issue, !details.element.classList.contains('issue-collapsed')), details.element)
      }
      // Delete the item from the map
      delete issueColMap[issue.id]
    } else {
      // This is a new issue
      issueRow.appendChild(createIssueHTML(issue))
    }
  }

  // Anything left in the map at the end is a col that should be deleted.
  for (const uuid of Object.keys(issueColMap)) {
    console.log(uuid, issueColMap[uuid])
    issueColMap[uuid].element.remove()
  }
}

export async function rebuildIssueFilters () {
  // Rebuild the 'Assigned to' issue filter

  const assignedToSelect = document.getElementById('issueListFilterAssignedToSelect')
  assignedToSelect.innerHTML = ''
  assignedToSelect.appendChild(new Option('All', 'all'))
  assignedToSelect.appendChild(new Option('Unassigned', 'unassigned'))

  // First, aggregate the various options needed
  const assignableUserList = []
  const optionList = []
  for (const issue of exConfig.issueList) {
    for (const uuid of issue.assignedTo) {
      if (assignableUserList.includes(uuid) === false) {
        assignableUserList.push(uuid)
        const displayName = await exTools.getUserDisplayName(uuid)
        optionList.push(new Option(displayName, uuid))
      }
    }
  }

  const sortedOptionsList = optionList.sort(function (a, b) {
    return a.innerHTML.toLowerCase().localeCompare(b.innerHTML.toLowerCase())
  })
  // Populate the filter
  for (const option of sortedOptionsList) {
    assignedToSelect.appendChild(option)
  }
}

export function createIssueHTML (issue, full = true, archived = false) {
  // Create an HTML representation of an issue

  const allowEdit = exTools.checkPermission('maintenance', 'edit')

  const col = document.createElement('div')
  col.classList = 'col mt-2 issue-col'
  col.setAttribute('data-details', JSON.stringify(issue))
  col.setAttribute('data-uuid', issue.id)

  const card = document.createElement('div')
  // Color the border based on the priority
  let borderColor
  if (issue.priority === 'low') {
    borderColor = 'border-primary'
  } else if (issue.priority === 'medium') {
    borderColor = 'border-warning'
  } else {
    borderColor = 'border-danger'
  }
  card.setAttribute('class', `card border ${borderColor}`)
  col.appendChild(card)

  const body = document.createElement('div')
  body.setAttribute('class', 'card-body')
  card.appendChild(body)

  const title = document.createElement('H5')
  title.setAttribute('class', 'card-title')
  title.innerHTML = issue.issueName
  body.appendChild(title)

  const content = document.createElement('div')
  content.style.transition = 'all 1s'
  body.appendChild(content)

  if (issue.relatedComponentUUIDs) {
    for (const uuid of issue.relatedComponentUUIDs) {
      const component = exConfig.exhibitComponents.find(obj => {
        return obj.uuid === uuid
      })
      if (component == null) continue
      const tag = document.createElement('span')
      tag.setAttribute('class', 'badge bg-secondary me-1')
      tag.innerHTML = component.id
      content.appendChild(tag)
    }
  }
  

  for (const uuid of issue.assignedTo) {
    const tag = document.createElement('span')
    tag.setAttribute('class', 'badge bg-success me-1')
    exTools.getUserDisplayName(uuid)
      .then((displayName) => {
        tag.innerHTML = displayName
      })
    content.appendChild(tag)
  }

  const desc = document.createElement('p')
  desc.classList = 'card-text mt-2'
  desc.style.whiteSpace = 'pre-wrap' // To preserve new lines
  desc.innerHTML = issue.issueDescription
  content.appendChild(desc)

  const row1 = document.createElement('div')
  row1.classList = 'row gy-2 row-cols-2'
  content.appendChild(row1)

  const row2 = document.createElement('div')
  row2.classList = 'row'
  content.appendChild(row2)

  if (allowEdit) {
    const actionCol = document.createElement('div')
    actionCol.classList = 'col'
    row1.appendChild(actionCol)

    if (archived === false) {
      const actionDropdownContainer = document.createElement('div')
      actionDropdownContainer.classList = 'dropdown'
      actionCol.appendChild(actionDropdownContainer)

      const actionButton = document.createElement('a')
      actionButton.classList = 'btn btn-primary btn-sm dropdown-toggle w-100'
      actionButton.innerHTML = 'Action'
      actionButton.href = '#'
      actionButton.setAttribute('role', 'button')
      actionButton.setAttribute('data-bs-toggle', 'dropdown')
      actionButton.setAttribute('aria-expanded', 'false')
      actionDropdownContainer.appendChild(actionButton)

      const actionDropdownList = document.createElement('ul')
      actionDropdownList.classList = 'dropdown-menu'
      actionDropdownList.style.position = 'static'
      actionDropdownContainer.appendChild(actionDropdownList)

      const actionDropdownListEditItem = document.createElement('li')
      const actionDropdownListEditButton = document.createElement('a')
      actionDropdownListEditButton.classList = 'dropdown-item text-info handCursor'
      actionDropdownListEditButton.innerHTML = 'Edit'
      actionDropdownListEditButton.addEventListener('click', function () {
        showIssueEditModal('edit', issue.id)
      })
      actionDropdownListEditItem.appendChild(actionDropdownListEditButton)
      actionDropdownList.appendChild(actionDropdownListEditItem)

      const actionDropdownListDeleteItem = document.createElement('li')
      const actionDropdownListDeleteButton = document.createElement('a')
      actionDropdownListDeleteButton.classList = 'dropdown-item text-danger handCursor'
      actionDropdownListDeleteButton.innerHTML = 'Delete'
      actionDropdownListDeleteButton.addEventListener('click', function () {
        showModifyIssueModal(issue.id, 'delete')
      })
      actionDropdownListDeleteItem.appendChild(actionDropdownListDeleteButton)
      actionDropdownList.appendChild(actionDropdownListDeleteItem)

      const actionDropdownListArchiveItem = document.createElement('li')
      const actionDropdownListArchiveButton = document.createElement('a')
      actionDropdownListArchiveButton.classList = 'dropdown-item text-success handCursor'
      actionDropdownListArchiveButton.innerHTML = 'Mark complete'
      actionDropdownListArchiveButton.addEventListener('click', function () {
        showModifyIssueModal(issue.id, 'archive')
      })
      actionDropdownListArchiveItem.appendChild(actionDropdownListArchiveButton)
      actionDropdownList.appendChild(actionDropdownListArchiveItem)
    } else {
      const unarchiveButton = document.createElement('button')
      unarchiveButton.classList = 'btn btn-primary w-100'
      unarchiveButton.innerHTML = 'Re-open issue'
      unarchiveButton.addEventListener('click', (event) => {
        modifyIssue(issue.id, 'restore')
          .then(() => {
            showArchivedIssuesModal()
          })
      })
      actionCol.appendChild(unarchiveButton)
    }
  }

  if (issue.media != null && issue.media.length > 0) {
    const mediaCol = document.createElement('div')
    mediaCol.classList = 'col'
    row1.appendChild(mediaCol)

    const mediaBut = document.createElement('button')
    mediaBut.setAttribute('class', 'btn btn-sm btn-info w-100')
    mediaBut.innerHTML = 'View media'

    const mediaFiles = []
    for (const file of issue.media) {
      mediaFiles.push('issues/media/' + file)
    }
    mediaBut.addEventListener('click', function () {
      exTools.openMediaInNewTab(mediaFiles)
    }, false)
    mediaCol.appendChild(mediaBut)
  }

  const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' }
  if (archived === true) {
    if ('archivedUsername' in issue && 'archiveDate' in issue) {
      // Add line with when this was archived and by whom.
      const archivedDateCol = document.createElement('div')
      archivedDateCol.classList = 'col-12 fst-italic text-secondary mt-2'
      archivedDateCol.style.fontSize = '0.7rem'

      const archivedDate = new Date(issue.archiveDate)
      archivedDateCol.innerHTML = `Archived ${archivedDate.toLocaleDateString(undefined, dateOptions)}`
      row2.appendChild(archivedDateCol)

      exTools.getUserDisplayName(issue.archivedUsername)
        .then((displayName) => {
          archivedDateCol.innerHTML = `Archived ${archivedDate.toLocaleDateString(undefined, dateOptions)} by ${displayName}`
        })
    }
  } else {
    // Add a line about when this issue was created
    const createdDateCol = document.createElement('div')
    createdDateCol.classList = 'col-12 fst-italic text-secondary mt-2'
    createdDateCol.style.fontSize = '0.7rem'

    const createdDate = new Date(issue.creationDate)
    createdDateCol.innerHTML = `Created ${createdDate.toLocaleDateString(undefined, dateOptions)}`
    row2.appendChild(createdDateCol)

    if ('createdUsername' in issue && issue.createdUsername !== '') {
      exTools.getUserDisplayName(issue.createdUsername)
        .then((displayName) => {
          createdDateCol.innerHTML = `Created ${createdDate.toLocaleDateString(undefined, dateOptions)} by ${displayName}`
        })
    }

    // Add a line about when this issue was last updated, if different than created.
    if (issue.creationDate !== issue.lastUpdateDate) {
      const updatedDateCol = document.createElement('div')
      updatedDateCol.classList = 'col-12 fst-italic text-secondary'
      updatedDateCol.style.fontSize = '0.7rem'

      const updatedDate = new Date(issue.lastUpdateDate)
      updatedDateCol.innerHTML = `Updated ${updatedDate.toLocaleDateString(undefined, dateOptions)}`
      row2.appendChild(updatedDateCol)

      if ('lastUpdateUsername' in issue && issue.lastUpdateUsername !== '') {
        exTools.getUserDisplayName(issue.lastUpdateUsername)
          .then((displayName) => {
            updatedDateCol.innerHTML = `Updated ${updatedDate.toLocaleDateString(undefined, dateOptions)} by ${displayName}`
          })
      }
    }
  }

  const footer = document.createElement('div')
  footer.classList = 'card-footer text-body-secondary text-center'

  if (full === false) {
    content.style.height = '0px'
    content.style.overflow = 'hidden'
    footer.innerHTML = 'More'
  } else {
    content.style.overflow = ''
    footer.innerHTML = 'Less'
  }
  card.appendChild(footer)

  footer.addEventListener('click', (event) => {
    if (content.style.height === '') {
      // Nothing set yet
      content.style.height = String(content.scrollHeight) + 'px'
    }
    // Give a frame for the above option to take
    setTimeout(() => {
      if (content.style.height === '0px') {
        content.style.height = String(content.scrollHeight) + 'px'
        footer.innerHTML = 'Less'
        setTimeout(() => {
          content.style.overflow = ''
        }, 1000)
        col.classList.remove('issue-collapsed')
      } else {
        content.style.height = '0px'
        content.style.overflow = 'hidden'
        footer.innerHTML = 'More'
        col.classList.add('issue-collapsed')
      }
    }, 1)
  })

  return col
}

function showModifyIssueModal (id, mode) {
  // Configure the modal to confirm archiving or deleting

  document.getElementById('issueModifyModal').setAttribute('data-id', id)

  const deleteTitle = document.getElementById('issueModifyModalDeleteTitle')
  const archiveTitle = document.getElementById('issueModifyModalArchiveTitle')
  const deleteContent = document.getElementById('issueModifyModalDeleteContent')
  const archiveContent = document.getElementById('issueModifyModalArchiveContent')
  const deleteButton = document.getElementById('issueModifyModalDeleteButton')
  const archiveButton = document.getElementById('issueModifyModalArchiveButton')

  if (mode === 'archive') {
    deleteTitle.style.display = 'none'
    archiveTitle.style.display = 'block'
    deleteContent.style.display = 'none'
    archiveContent.style.display = 'block'
    deleteButton.style.display = 'none'
    archiveButton.style.display = 'block'
  } else if (mode === 'delete') {
    deleteTitle.style.display = 'block'
    archiveTitle.style.display = 'none'
    deleteContent.style.display = 'block'
    archiveContent.style.display = 'none'
    deleteButton.style.display = 'block'
    archiveButton.style.display = 'none'
  }

  exTools.showModal('#issueModifyModal')
}

export function showArchivedIssuesModal () {
  // Retrieve a list of archived issues, configure the modal, and display it.

  exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/issue/archive/list/__all'
  })
    .then((response) => {
      const issueRow = document.getElementById('completedIssuesModalIssueRow')
      issueRow.innerHTML = ''
      for (const issue of response.issues.reverse()) {
        issueRow.appendChild(createIssueHTML(issue, false, true))
      }
      exTools.showModal('#archivedIssuesModal')
    })
}

export function modifyIssue (id, mode) {
  // Ask Hub to remove or archive the specified issue
  // mode is one of 'archive' or 'delete'

  return exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/issue/' + id + '/' + mode
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        getIssueList()
          .then((issueList) => {
            exConfig.issueList = issueList
            rebuildIssueList()
          })
      }
    })
}

function getIssueList (id = '__all') {
  // Get a list of all the current issues and rebuild the issue GUI

  return exTools.makeServerRequest({
    method: 'GET',
    endpoint: '/issue/list/' + id
  }).then((response) => response.issueList)
}

function getIssue (id) {
  // Function to search the issueList for a given id

  const result = exConfig.issueList.find(obj => {
    return obj.id === id
  })

  return result
}

export async function showIssueEditModal (issueType, target) {
  // Show the modal and configure for either "new" or "edit"

  // Make sure we have all the current components listed as objections for
  // the issueRelatedComponentsSelector
  const issueRelatedComponentsSelector = document.getElementById('issueRelatedComponentsSelector')
  issueRelatedComponentsSelector.innerHTML = ''

  const components = exTools.sortComponentsByGroup()

  for (const group of Object.keys(components).sort()) {
    const header = new Option(exTools.getGroupName(group))
    header.setAttribute('disabled', true)
    issueRelatedComponentsSelector.appendChild(header)
    const sortedGroup = components[group].sort((a, b) => {
      const aID = a.id.toLowerCase()
      const bID = b.id.toLowerCase()
      if (aID > bID) return 1
      if (aID < bID) return -1
      return 0
    })
    for (const component of sortedGroup) {
      const option = new Option(component.id, component.uuid)
      issueRelatedComponentsSelector.appendChild(option)
    }
  }

  for (let i = 0; i < exConfig.exhibitComponents.length; i++) {
    // Check if component already exists as an option. If not, add it
    if ($(`#issueRelatedComponentsSelector option[value='${exConfig.exhibitComponents[i].uuid}']`).length === 0) {
      $('#issueRelatedComponentsSelector').append()
    }
  }

  // Make sure we have all the assignable staff listed as options for
  // issueAssignedToSelector
  document.getElementById('issueAssignedToSelector').innerHTML = ''
  await exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/users/list',
    params: {
      permissions: {
        maintenance: 'view'
      }
    }
  })
    .then((response) => {
      if (response.success === true) {
        for (const user of response.users) {
          document.getElementById('issueAssignedToSelector').appendChild(new Option(user.display_name, user.uuid))
        }
      }
    })

  // Clear file upload interface elements
  $('#issueMediaUploadFilename').html('Choose files')
  $('#issueMediaUploadHEICWarning').hide()
  $('#issueMediaUploadSubmitButton').hide()
  $('#issueMediaUploadProgressBarContainer').hide()
  $('#issueMediaUpload').val(null)

  // Clone the cancel button to remove any lingering event listeners
  const oldElement = document.getElementById('issueEditCancelButton')
  const newElement = oldElement.cloneNode(true)
  oldElement.parentNode.replaceChild(newElement, oldElement)

  if (issueType === 'new') {
    // Clear inputs
    $('#issueTitleInput').val('')
    $('#issueDescriptionInput').val('')
    $('#issueAssignedToSelector').val(null)
    $('#issueRelatedComponentsSelector').val(null)

    $('#issueEditModal').data('type', 'new')
    $('#issueEditModalTitle').html('Create Issue')
    rebuildIssueMediaUploadedList()
  } else if (target != null) {
    $('#issueEditModal').data('type', 'edit')
    $('#issueEditModal').data('target', target)
    $('#issueEditModalTitle').html('Edit Issue')

    const targetIssue = getIssue(target)
    $('#issueTitleInput').val(targetIssue.issueName)
    $('#issueDescriptionInput').val(targetIssue.issueDescription)
    $('#issueAssignedToSelector').val(targetIssue.assignedTo)
    $('#issueRelatedComponentsSelector').val(targetIssue.relatedComponentUUIDs)
    if (targetIssue.media.length > 0) {
      rebuildIssueMediaUploadedList(target)
    } else {
      rebuildIssueMediaUploadedList()
    }
  }

  exTools.showModal('#issueEditModal')
}

export function onIssueMediaUploadChange () {
  // When a file is selected, check if it contains an equal sign (not allowed).
  // If not, display it

  $('#issueMediaUploadSubmitButton').show()
  // Show the upload button (we may hide it later)
  const fileInput = $('#issueMediaUpload')[0]
  $('#issueMediaUploadFilename').html('File: ' + fileInput.files[0].name)

  // Check for HEIC file
  if (fileInput.files[0].type === 'image/heic') {
    $('#issueMediaUploadHEICWarning').show()
    $('#issueMediaUploadSubmitButton').hide()
  } else {
    $('#issueMediaUploadHEICWarning').hide()
  }
}

export function uploadIssueMediaFile () {
  const fileInput = $('#issueMediaUpload')[0]
  if (fileInput.files[0] != null) {
    $('#issueMediaUploadSubmitButton').prop('disabled', true)
    $('#issueMediaUploadSubmitButton').html('Working...')

    const formData = new FormData()

    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i]
      formData.append('files', file)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', exConfig.serverAddress + '/issue/uploadMedia', true)
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          if (response.success === true) {
            _rebuildIssueMediaUploadedList(response.filenames, true)
            // If we cancel without saving, need to delete this file.
            document.getElementById('issueEditCancelButton').addEventListener('click', function () {
              issueMediaDelete(response.filenames)
            })
          }
        }
        $('#issueMediaUploadSubmitButton').prop('disabled', false)
        $('#issueMediaUploadSubmitButton').html('Upload')
        $('#issueMediaUploadProgressBarContainer').hide()
        $('#issueMediaUploadSubmitButton').hide()
        $('#issueMediaUploadFilename').html('Choose file')
      }
    }

    xhr.upload.addEventListener('progress', function (evt) {
      if (evt.lengthComputable) {
        let percentComplete = evt.loaded / evt.total
        percentComplete = parseInt(percentComplete * 100)
        $('#issueMediaUploadProgressBar').width(String(percentComplete) + '%')
        if (percentComplete > 0) {
          $('#issueMediaUploadProgressBarContainer').show()
        } else if (percentComplete === 100) {
          $('#issueMediaUploadProgressBarContainer').hide()
        }
      }
    }, false)

    xhr.send(formData)
  }
}

function rebuildIssueMediaUploadedList (id = '') {
  // Configure the file upload/view interface depending on whether a file has
  // been uploaded.

  let filenames
  if (id === '') {
    _rebuildIssueMediaUploadedList([])
  } else {
    exTools.makeServerRequest({
      method: 'GET',
      endpoint: '/issue/' + id + '/getMedia'
    })
      .then((result) => {
        if (result.success === true) {
          filenames = result.media
        } else {
          filenames = []
        }
        _rebuildIssueMediaUploadedList(filenames)
      })
  }
}

function _rebuildIssueMediaUploadedList (filenames, append = false) {
  // Helper function to format the issue media details based on the supplied filenames
  // Set append = true to add the given files to the existing ones, rather than
  // overwriting.

  let current
  if (append === true) {
    current = $('#issueMediaViewFromModal').data('filenames')
    current = [...current, ...filenames]
  } else {
    current = filenames
  }
  $('#issueMediaViewFromModal').data('filenames', current)
  if (current.length > 0) {
    $('#issueMediaViewCol').show()
    $('#issueMediaModalLabel').html('Uploaded media')

    // Build select entries for each file
    const mediaSelect = document.getElementById('issueMediaViewFromModalSelect')
    mediaSelect.innerHTML = ''
    let imageCounter = 0
    let videoCounter = 0
    const imageOptions = []
    const videoOptions = []
    for (const filename of current) {
      const fileType = exTools.guessMimetype(filename)
      if (fileType === 'image') {
        imageCounter += 1
        imageOptions.push(new Option('Image ' + imageCounter, filename))
      } else if (fileType === 'video') {
        videoCounter += 1
        videoOptions.push(new Option('Video ' + videoCounter, filename))
      }
    }
    if (imageOptions.length > 0) {
      const imageHeader = new Option('Images')
      imageHeader.setAttribute('disabled', true)
      mediaSelect.appendChild(imageHeader)
      for (const option of imageOptions) {
        mediaSelect.appendChild(option)
      }
    }

    if (videoOptions.length > 0) {
      const videoHeader = new Option('Videos')
      videoHeader.setAttribute('disabled', true)
      mediaSelect.appendChild(videoHeader)
      for (const option of videoOptions) {
        mediaSelect.appendChild(option)
      }
    }
  } else {
    $('#issueMediaModalLabel').html('Add media')
    $('#issueMediaViewCol').hide()
  }
}

export function issueMediaDelete (filenames) {
  // Send a message to Hub, asking for the files to be deleted.
  // filenames is an array of strings

  const requestDict = { filenames }

  // If this is an existing issue, we need to say what the issue id is
  const issueType = $('#issueEditModal').data('type')
  if (issueType === 'edit') {
    requestDict.owner = $('#issueEditModal').data('target')
  }

  exTools.makeServerRequest({
    method: 'POST',
    endpoint: '/issue/deleteMedia',
    params: requestDict
  })
    .then((response) => {
      if ('success' in response) {
        if (response.success === true) {
          let current = $('#issueMediaViewFromModal').data('filenames')
          current = current.filter(e => !filenames.includes(e))
          _rebuildIssueMediaUploadedList(current)
        }
      }
    })
}

export function submitIssueFromModal () {
  // Take the inputs from the modal, check that we have everything we need,
  // and submit it to the server.

  const issueDict = {}
  issueDict.issueName = $('#issueTitleInput').val()
  issueDict.issueDescription = $('#issueDescriptionInput').val()
  issueDict.relatedComponentUUIDs = $('#issueRelatedComponentsSelector').val()
  issueDict.assignedTo = $('#issueAssignedToSelector').val()
  issueDict.priority = $('#issuePrioritySelector').val()
  if ($('#issueMediaViewFromModal').data('filenames').length > 0) {
    issueDict.media = $('#issueMediaViewFromModal').data('filenames')
  }

  let error = false
  if (issueDict.issueName === '') {
    console.log('Need issue name')
    error = true
  }

  if (error === false) {
    const issueType = $('#issueEditModal').data('type')
    let endpoint
    if (issueType === 'new') {
      endpoint = '/issue/create'
    } else {
      issueDict.id = $('#issueEditModal').data('target')
      endpoint = '/issue/edit'
    }
    exTools.hideModal('#issueEditModal')

    exTools.makeServerRequest({
      method: 'POST',
      endpoint,
      params: { details: issueDict }
    })
      .then((result) => {
        if ('success' in result && result.success === true) {
          getIssueList()
        }
      })
  }
}
