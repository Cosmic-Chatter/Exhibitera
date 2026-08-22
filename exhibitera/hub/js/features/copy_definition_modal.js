/* global bootstrap */

import * as exUtilities from '../../../common/utilities.js'

import hubConfig from '../../config.js'
import * as hubTools from '../tools.js'

export async function showCopyDefinitionModal (componentUUID, definitionUUID, definitionName) {
  // Set up and show the model for copying a definition from one component to another

  const component = hubTools.getExhibitComponent(componentUUID)
  const modal = document.getElementById('copyDefinitionModal')
  modal.dataset.definition = definitionUUID
  modal.dataset.component = componentUUID

  const submitButton = document.getElementById('copyDefinitionModalSubmitButton')
  submitButton.innerHTML = 'Copy'
  submitButton.disabled = false
  submitButton.classList.remove('btn-info')
  submitButton.classList.add('btn-primary')
  submitButton.style.display = 'none'
  document.getElementById('copyProgressContainer').style.display = 'none'

  if (component.getHelperURL() == null) {
    // We don't have enough information to contact the helper
    console.error('Error: No helper address')
  }

  let content = []
  let contentList = { content: [] }

  try {
    contentList = await component.makeRequest({
      method: 'GET',
      endpoint: '/definitions/' + definitionUUID + '/getContentList'
    })
  } catch (err) {
    console.error('Failed to fetch source content list:', err)
  }

  // Populate source files
  const sourceDiv = document.getElementById('copyDefinitionModalSourceFiles')
  sourceDiv.innerHTML = ''

  sourceDiv.appendChild(copyDefinitionModalCreateSourceHTML(definitionName, '', true))

  if (contentList.content && contentList.content.length > 0) {
    content = contentList.content
    content = contentList.content.sort((a, b) => (b.size || 0) - (a.size || 0))

    modal.setAttribute('data-sourceFiles', JSON.stringify(contentList.content))

    let supportingText = ' supporting file'
    if (contentList.content.length > 1) supportingText = ' supporting files'
    sourceDiv.appendChild(copyDefinitionModalCreateSourceHTML(String(contentList.content.length) + supportingText, contentList?.total_size ?? ''))

    // Create a list for supporting files
    const fileList = document.createElement('ul')
    fileList.classList = 'list-unstyled ms-3 small text-muted'

    for (const file of content) {
      const li = document.createElement('li')
      li.classList.add('mb-1')
      li.innerHTML = `
      <span class="file-status ms-2" data-filename="${file.name}"></span>
    ${file.name} <span class="text-muted small">(${file.size_text})</span>
  `
      fileList.appendChild(li)
    }

    sourceDiv.appendChild(fileList)
  } else {
    modal.setAttribute('data-sourceFiles', JSON.stringify([]))
  }

  // Populate destination options
  const destDiv = document.getElementById('copyDefinitionModalDestinations')
  destDiv.innerHTML = ''

  const compsByGroup = hubTools.sortComponentsByGroup()
  const groups = Object.keys(compsByGroup)
  let totalComps = 0

  for (const group of groups) {
    const comps = compsByGroup[group]

    const compsToShow = []
    for (const comp of comps) {
      if (comp.type !== 'exhibit_component') continue
      if (comp.status === hubConfig.STATUS.STATIC) continue
      if (comp.uuid === componentUUID) continue
      totalComps += 1
      compsToShow.push(comp)
    }
    if (compsToShow.length === 0) continue

    const label = document.createElement('label')
    label.innerHTML = hubTools.getGroup(group)?.name ?? group
    label.classList = 'text-secondary'
    destDiv.appendChild(label)

    const compsToShowSorted = exUtilities.sortAlphabetically(compsToShow, 'id')

    for (const comp of compsToShowSorted) {
      const col = copyDefinitionModalCreateDestinationHTML(comp, group, definitionUUID, content)
      destDiv.appendChild(col)
    }
  }

  if (totalComps === 0) destDiv.innerHTML = '<i>No available components</i>'

  exUtilities.hideModal('#componentInfoModal')
  exUtilities.showModal('#copyDefinitionModal')
}

function copyDefinitionModalCreateDestinationHTML (component, group, def, content) {
  // Take an exhibit component and build an HTML representation.
  // Check if the given destination contains a definition or content of the
  // same name and warn the user.

  const modal = document.getElementById('copyDefinitionModal')
  const submitButton = document.getElementById('copyDefinitionModalSubmitButton')

  const col = document.createElement('div')

  const checkGroup = document.createElement('div')
  checkGroup.classList = 'form-check'
  col.appendChild(checkGroup)

  const input = document.createElement('input')
  input.classList = 'form-check-input copyDest'
  input.setAttribute('type', 'checkbox')
  input.setAttribute('id', 'copyOption_' + group + '_' + component.uuid)
  input.dataset.uuid = component.uuid
  input.value = ''

  input.addEventListener('change', (ev) => {
    const checked = modal.querySelectorAll('input.copyDest:checked')
    if (checked.length > 0) {
      submitButton.style.display = 'block'
    } else submitButton.style.display = 'none'
  })
  checkGroup.appendChild(input)

  const label = document.createElement('label')
  label.classList = 'form-check-label'
  label.setAttribute('for', 'copyOption_' + group + '_' + component.uuid)
  label.innerText = component.id

  const badgeContainer = document.createElement('span')
  badgeContainer.className = 'badge-container'

  const spinner = document.createElement('span')
  spinner.className = 'spinner-border spinner-border-sm ms-2 text-secondary align-middle'
  spinner.setAttribute('role', 'status')
  badgeContainer.appendChild(spinner)

  badgeContainer.insertAdjacentHTML('beforeend', `<span data-uuid="${component.uuid}" class="ms-2 badge text-bg-success copy-success" style="display:none; font-size: 0.55em">Copied</span>`)
  badgeContainer.insertAdjacentHTML('beforeend', `<span data-uuid="${component.uuid}" class="ms-2 badge text-bg-danger copy-fail" style="display:none;">Error</span>`)

  label.appendChild(badgeContainer)
  checkGroup.appendChild(label)

  // Check if any content already exists on the destination
  checkDestinationStatus(component, badgeContainer, spinner, input, content)

  return col
}

async function checkDestinationStatus (component, badgeContainer, spinner, input, content) {
  // Check if any content is already on the given component.

  try {
    const [contentResponse] = await Promise.all([
      component.makeRequest({ method: 'GET', endpoint: '/files/availableContent' })
    ])

    let tooltipAdded = false

    if (contentResponse.content) {
      for (const file of content) {
        if (contentResponse.content.includes(file.name)) {
          badgeContainer.insertAdjacentHTML('beforeend', `<span class="badge bg-warning ms-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="${file.name} already exists here and will be overwritten." style="font-size: 0.55em;">!</span>`)
          tooltipAdded = true
        }
      }
    }

    if (tooltipAdded) {
      const tooltips = badgeContainer.querySelectorAll('[data-bs-toggle="tooltip"]'); [...tooltips].map(el => new bootstrap.Tooltip(el))
    }
  } catch (err) {
    // We cannot connect to this component
    console.warn(`Could not reach ${component.id}:`, err)

    input.disabled = true
    input.checked = false // Uncheck if the user managed to click it while loading
    input.closest('.form-check').classList.add('opacity-50')

    // Add an error badge explaining the state
    badgeContainer.insertAdjacentHTML('beforeend', '<span class="badge text-bg-danger ms-1 align-middle" style="font-size: 0.55em;">Connection Error</span>')

    // Trigger a change event to update the "Submit" button visibility if this was the only one checked
    input.dispatchEvent(new Event('change'))
  } finally {
    // Remove the loading spinner whether the check succeeded or timed out
    if (spinner && spinner.parentNode) {
      spinner.remove()
    }
  }
}

function copyDefinitionModalCreateSourceHTML (filename, sizeText, isDefinition = false) {
  // Create an HTML representation of the given file for the definitionCopyModal.

  const col = document.createElement('div')
  col.classList = ''

  const row = document.createElement('div')
  row.classList = 'row gy-2'
  col.appendChild(row)

  const name = document.createElement('div')
  name.classList = 'col-8'
  if (isDefinition) {
    name.classList.add('fw-bold')
  } else {
    name.classList.add('ps-4')
  }
  name.textContent = filename
  row.appendChild(name)

  const size = document.createElement('div')
  size.classList = 'col-4'
  size.innerHTML = sizeText
  row.appendChild(size)

  return col
}

export async function copyDefinitionModalPerformCopy () {
  // Collect information from the modal and trigger the file copy to each destinaition.

  const modal = document.getElementById('copyDefinitionModal')
  const submitButton = document.getElementById('copyDefinitionModalSubmitButton')
  const progressBar = document.getElementById('copyProgressBar')
  const progressContainer = document.getElementById('copyProgressContainer')

  submitButton.innerHTML = 'Copying...'
  submitButton.classList.replace('btn-primary', 'btn-info')
  submitButton.disabled = true

  progressContainer.style.display = 'flex'
  progressBar.style.width = '0%'
  progressBar.classList.remove('bg-success')
  progressBar.classList.add('progress-bar-animated')

  // Sources
  const definitionUUID = modal.dataset.definition
  let definition
  const sourceUUID = modal.dataset.component
  const sourceComponent = hubTools.getExhibitComponent(sourceUUID)
  const filesToCopy = JSON.parse(modal.getAttribute('data-sourceFiles')) ?? []

  // Load the definition to be copies
  const defResponse = await sourceComponent.makeRequest({
    method: 'GET',
    endpoint: '/definitions/' + definitionUUID + '/load'
  })
  if (defResponse?.success) {
    definition = defResponse.definition
  } else {
    console.error('Could not reach source component:', sourceComponent)
    return
  }

  // Identify unique components to prevent redundant transfers
  const checkedElements = modal.querySelectorAll('input.copyDest:checked')
  const uniqueDestinations = new Map()

  for (const checkbox of checkedElements) {
    const uuid = checkbox.dataset.uuid
    if (uuid && !uniqueDestinations.has(uuid)) {
      const comp = hubTools.getExhibitComponent(uuid)
      if (comp) {
        uniqueDestinations.set(uuid, {
          component: comp,
          // Store all checkboxes associated with this UUID so we can update all badges
          elements: Array.from(modal.querySelectorAll(`input.copyDest[data-uuid="${uuid}"]`))
        })
      }
    }
  }

  const defSizeEstimate = 5000 // ~5 kB for the definition JSON
  const bytesPerDest = filesToCopy.reduce((acc, file) => acc + (file.size || 0), defSizeEstimate)
  const totalBytes = uniqueDestinations.size * bytesPerDest
  let completedBytes = 0

  const updateProgress = (bytes) => {
    completedBytes += bytes
    const percent = Math.min(Math.round((completedBytes / totalBytes) * 100), 100)
    progressBar.style.width = percent + '%'
    progressBar.innerHTML = percent + '%'
  }

  const totalDests = uniqueDestinations.size
  // Tracker: filename -> count of successful transfers
  const fileProgress = {}

  // Set all files to a loading spinner initially
  filesToCopy.forEach(file => {
    fileProgress[file.name] = { success: 0, error: 0 }
    const statusIcon = modal.querySelector(`.file-status[data-filename="${CSS.escape(file.name)}"]`)
    if (statusIcon) {
      statusIcon.innerHTML = '<span class="spinner-border spinner-border-sm text-primary" role="status"></span>'
    }
  })

  // Initiate file transfers in parallel
  const transferPromises = Array.from(uniqueDestinations.values()).map(async (dest) => {
    const destComp = dest.component
    const destUrl = destComp.getHelperURL()
    const relatedCheckboxes = dest.elements

    if (!destUrl) {
      updateProgress(bytesPerDest) // Move the progress bar anyway
      return
    }

    try {
      // Transfer Definition

      // Create a unique UUID
      const thisDef = structuredClone(definition)
      thisDef.uuid = exUtilities.uuid()

      await exUtilities.makeRequest({
        method: 'POST',
        url: destUrl,
        endpoint: '/definitions/write',
        params: { definition: thisDef },
        timeout: 120000
      })
      updateProgress(defSizeEstimate)

      // Transfer Supporting Files concurrently
      const filePromises = filesToCopy.map(async (file) => {
        try {
          await exUtilities.makeRequest({
            method: 'POST',
            url: destUrl,
            endpoint: '/files/retrieve',
            params: {
              file_url: `${sourceComponent.getHelperURL()}/content/${file.name}`,
              path_list: ['content', file.name]
            },
            timeout: 120000
          })
          fileProgress[file.name].success++
        } catch (err) {
          fileProgress[file.name].error++
          throw err
        } finally {
          updateProgress(file.size)
          // Check if this file is finished across all components
          const statusIcon = modal.querySelector(`.file-status[data-filename="${CSS.escape(file.name)}"]`)
          if (statusIcon) {
            const prog = fileProgress[file.name]
            if (prog.success + prog.error === totalDests) {
              statusIcon.innerHTML = prog.error > 0 ? '⚠️' : '✅'
            }
          }
        }
      })

      await Promise.all(filePromises)

      // Success: Show badges for ALL instances of this component in the list
      relatedCheckboxes.forEach(cb => {
        const successBadge = cb.parentElement.querySelector('.copy-success')
        if (successBadge) successBadge.style.display = 'inline'
      })

      return { success: true }
    } catch (e) {
      console.error(`Copy failed for ${destComp.id}:`, e)
      // Failure: Show badges for ALL instances
      relatedCheckboxes.forEach(cb => {
        const failBadge = cb.parentElement.querySelector('.copy-fail')
        if (failBadge) failBadge.style.display = 'inline'
      })
      return { success: false }
    }
  })

  await Promise.allSettled(transferPromises)

  progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped')
  progressBar.classList.add('bg-success')
  progressBar.innerHTML = 'Complete'
  submitButton.style.display = 'none'
}
