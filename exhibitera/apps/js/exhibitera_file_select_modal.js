/* global bootstrap */
import * as exFiles from '../../common/files.js'
import * as exUtilities from '../../common/utilities.js'
import * as exCommon from './exhibitera_app_common.js'

let lastClickedSelectBox = null // For handling multiple selection on shift-click

// Files uploaded while the page is open, with when. Their addresses include it, so browsers don't show a cached copy
// of a file that was replaced.
const fileVersions = {}

function withVersion (url, file) {
  return fileVersions[file] == null ? url : url + '?v=' + fileVersions[file]
}

function thumbnailURL (file) {
  return withVersion(exCommon.config.helperAddress + exCommon.config.api + '/files/' + file + '/thumbnail/240', file)
}

function contentURL (file) {
  return withVersion(exCommon.config.helperAddress + '/content/' + file, file)
}

const CONNECTION_PROBLEM = 'Check the connection to Apps and try again.'

function showProblem (message) {
  // Tell the person something they tried didn't work

  const alert = document.getElementById('exFileSelectModalError')
  alert.textContent = message
  alert.style.display = 'block'
}

function clearProblem () {
  document.getElementById('exFileSelectModalError').style.display = 'none'
}

export function createFileSelectionModal (userOptions) {
  // Build a standard Exhibitera file selection modal

  let options = {
    directory: 'content', // Choice of 'content' or 'static'
    filetypes: [], // List of file types to allow ([] for all)
    manage: false, // Allow uploading, deleting, and renaming, but not selecting
    multiple: true, // Select multiple files?
    upload_any: false // If false, users may only upload files matching filetypes.
  }

  // Merge in user options
  options = { ...options, ...userOptions }
  return new Promise(function (resolve, reject) {
    const selectedFiles = []

    const modal = document.createElement('div')
    modal.classList = 'modal'
    modal.setAttribute('id', 'exFileSelectModal')
    modal.setAttribute('tabindex', '-1000') // Always on top
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-lg-down">
        <div id="exFileSelectModalDropOverlay"
            class="position-absolute top-0 start-0 w-100 h-100 align-items-center justify-content-center rounded"
            style="
              display:none!important;
              z-index:1056;
              background: rgba(0,0,0,0.6);
              border: 3px dashed #0d6efd;
              color: white;
              font-size: 1.5rem;
              pointer-events:none;">
          Drop files to upload
        </div>
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="exFileSelectModalTitle" class="modal-title">Select Files</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div id="exFileSelectModalError" class="alert alert-danger py-2" role="alert" style="display: none;"></div>
            <div class="row mb-2">
              <div class='col-4 col-sm-3 col-md-2'>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" value="" id="exFileSelectModalThumbnailCheckbox" checked>
                  <label class="form-check-label" for="exFileSelectModalThumbnailCheckbox">
                    Thumbnails
                  </label>
                </div>
              </div>
              <div class='col-4 col-sm-3 col-md-2'>
                <div id="selectAllCol" class="dropdown">
                  <button class="btn btn-sm btn-primary w-100 dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    Multiple
                  </button>
                  <ul class="dropdown-menu">
                    <li><a class='dropdown-item disabled fst-italic small'>Affects only items that <br>aren't filtered out</a></li>
                    <li><a id='selectAllButton' class="dropdown-item text-primary" style="cursor: pointer;">Select all</a></li>
                    <li><a id='deselectAllButton' class="dropdown-item text-primary" style="cursor: pointer;">Unselect all</a></li>
                  </ul>
                </div>
              </div>
              <div class="col-4 col-sm-6 col-md-4 offset-md-3 offset-lg-4">
              <div class="input-group input-group-sm">
                <input id="exFileSelectModalSearchField" type="text" placeholder="Search" class="form-control" aria-label="Search">
              </div>
                
              </div>
            </div>
            <div class="row flex-column-reverse flex-md-row">
            <div class="col-12 col-md-8" style="max-height: 55vh; overflow-y: auto;">
              <div id="exFileSelectModalFileList"  class='row'></div>
            </div>
            <div id="exFileSelectModalFilePreview" class="col-12 col-md-4 mb-3">
              <div class="row justify-content-center">
                <div class='col-6 col-md-12'>
                  <img id="exFileSelectModalFilePreviewImage" style="width: 100%; height: 200px; object-fit: contain;">
                  <video id="exFileSelectModalFilePreviewVideo" loop autoplay muted disablePictureInPicture="true" webkit-playsinline="true" playsinline="true" style="width: 100%; height: 200px; object-fit: contain;"></video>
                  <div style="height: 200px; display: flex; justify-content: center; align-items: center;">
                    <audio id="exFileSelectModalFilePreviewAudio" controls style="width: 100%;"></audio>
                  </div>
                  <div id="exFileSelectModalFilePreviewFont" style="height: 200px; word-break: break-word; font-size: 16px;">
                    <p>AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789</p>
                    <p>The quick brown fox jumps over the lazy dog.</p>
                  </div>
                </div>
                <div class='col-6 col-md-12 mt-2 text-center h6' style="word-wrap: break-word">
                  <div style="height: 60px; overflow-y: auto;">
                    <div id="exFileSelectModalFilePreviewFilename" ></div>
                    <div id="exFileSelectModalFilePreviewFilesize" class="text-secondary mt-1 small"></div>
                  </div>
                  <div id="exFileSelectModalFilePreviewEditContainer" class='row align-items-center'>
                    <div class='col-12'>
                      <input id="exFileSelectModalFilePreviewEditField" type='text' class='form-control'>
                    </div>
                    <div id="exFileSelectModalFilePreviewEditFileExistsWarning" class='col-12 text-danger text-center mt-2'>
                    A file with this name already exists.
                    </div>
                    <div class='col-6 col-sm-3 offset-sm-3 mt-2'>
                      <button id="exFileSelectModalFilePreviewEditCancelButton" class='btn btn-danger btn-sm w-100'>✕</button>
                    </div>
                    <div class='col-6 col-sm-3 mt-2'>
                      <button id="exFileSelectModalFilePreviewEditSaveButton" class='btn btn-success btn-sm w-100'>✓</button>
                    </div>
                  </div>

                  <div class='row'>
                    <div class='col-12 col-sm-6'>
                      <button id="exFileSelectModalRenameFileButton" class='btn btn-sm btn-info w-100 mt-3'>Rename</button>
                    </div>
                    <div class='col-12 col-sm-6'>
                      <button id="exFileSelectModalDeleteFileButton" class='btn btn-sm btn-danger w-100 mt-3' data-bs-toggle='popover' title='Are you sure?' data-bs-content='<a id="fileDeletePopover" class="btn btn-danger w-100">Confirm</a>' data-bs-trigger='focus' data-bs-html='true'>Delete</button>
                    </div>
                    <div class='col-12 col-sm-6'>
                      <a id="exFileSelectModalDownloadFileButton" class='btn btn-sm btn-info w-100 mt-3'>Download</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          <div class="modal-footer">
            <div class='row w-100 gy-2 px-0'>
              <div class='col-12 col-md-8 col-lg-9 ps-0'>
                <div id="exFileSelectModalUploadInterface" class="form-group">
                  <div class="row gy-2 align-middle d-flex">
                    <div class="col-6 col-md-4">
                      <label class="btn btn-outline-secondary w-100">
                        <span id="exFileSelectModalUploadfilename" style="overflow-wrap: break-word!important;">Upload new</span>
                        <input hidden type="file" class="form-control" id="exFileSelectModalUpload" multiple>
                      </label>
                    </div>
                    <div id="exFileSelectModalUploadSubmitCol" class="col-6 col-md-3 col-lg-2">
                      <button id="exFileSelectModalUploadSubmitButton" class='btn w-100 btn-outline-primary'>Upload</button>
                    </div>
                    <div class='col-12 col-md-5 col-lg-6 my-auto' id='exFileSelectModalUploadProgressBarContainer'>
                      <div class="progress" style="height: 25px;">
                        <div id='exFileSelectModalUploadProgressBar' class="progress-bar" role="progressbar" style="width: 30%; font-size: large;" aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>
                      </div>
                    </div>
                    <div class='col-12 text-danger mt-2' id='exFileSelectModalUploadOverwriteWarning'>Warning: this upload will overwrite a file of the same name.</div>

                    <div id="exFileSelectModalDeleteMultipleButtonCol" class="col-6 col-sm-4" style="display: none;">
                      <div>
                        <button id="exFileSelectModalDeleteMultipleFileButton" class='btn btn-danger w-100' data-bs-toggle='popover' title='Are you sure?' data-bs-content='<a id="fileDeleteMultiplePopover" class="btn btn-danger w-100">Confirm</a>' data-bs-trigger='focus' data-bs-html='true'>Delete multiple</button>
                      </div>
                    </div>
                    <div id="exFileSelectModalDownloadMultipleButtonCol" class="col-6 col-sm-4" style="display: none;">
                      <div>
                        <button id="exFileSelectModalDownloadMultipleFileButton" class='btn btn-info w-100'>Download multiple</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class='col-12 col-lg-3 justify-content-end d-flex pe-0'>
                <button type="button" class="btn btn-secondary me-1" data-bs-dismiss="modal">Close</button>
                <button id="exFileSelectModalChooseButton" type="button" class="btn btn-primary">Choose</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    // Thumbnails checkbox
    document.getElementById('exFileSelectModalThumbnailCheckbox').addEventListener('change', (event) => {
      modal.querySelectorAll('.const-file-thumb-container').forEach((el) => {
        if (event.target.checked === true) {
          el.style.display = 'block'
        } else {
          el.style.display = 'none'
        }
      })
    })

    // (de)select all button
    if (options.multiple === false && options.manage === false) {
      document.getElementById('selectAllCol').style.display = 'none'
    }
    document.getElementById('selectAllButton').addEventListener('click', (event) => {
      selectAllFiles()
    })
    document.getElementById('deselectAllButton').addEventListener('click', (event) => {
      deselectAllFiles()
    })

    // Search field
    document.getElementById('exFileSelectModalSearchField').addEventListener('input', (event) => {
      filterComponentContent(event.target.value)
    })

    // File upload
    document.getElementById('exFileSelectModalUpload').addEventListener('change', onUploadContentChange)
    document.getElementById('exFileSelectModalUploadSubmitButton').addEventListener('click', () => {
      uploadFile(options)
    })
    if (options.filetypes.length > 0) {
      // Need to configure the accept= property to limit which file types can be uploaded.

      let acceptStr = ''
      if (options.upload_any === false) {
        for (const type of options.filetypes) {
          if (type === 'audio' || type === 'image' || type === 'video') acceptStr += type + '/*, '
          else acceptStr += '.' + type + ', '
        }
      }

      document.getElementById('exFileSelectModalUpload').setAttribute('accept', acceptStr)
    }
    setupDragAndDrop(modal, options)

    // File rename
    document.getElementById('exFileSelectModalFilePreviewEditContainer').style.display = 'none'
    document.getElementById('exFileSelectModalRenameFileButton').addEventListener('click', showRenameField)
    document.getElementById('exFileSelectModalFilePreviewEditCancelButton').addEventListener('click', cancelFileRename)
    document.getElementById('exFileSelectModalFilePreviewEditSaveButton').addEventListener('click', renameFile)

    // File delete
    const deleteBUtton = document.getElementById('exFileSelectModalDeleteFileButton')
    deleteBUtton.addEventListener('click', function () {
      deleteBUtton.focus()
    })

    if (document.body.getAttribute('data-fileDeletePopoverEventAdded') !== 'true') {
      // Only add this listener the first time we create a file select modal
      document.addEventListener('click', (event) => {
        if (event.target.getAttribute('id') !== 'fileDeletePopover') return
        const file = document.getElementById('exFileSelectModalFilePreview').getAttribute('data-filename')
        deleteFiles([file])
      })
      document.body.setAttribute('data-fileDeletePopoverEventAdded', 'true')
    }

    // Delete multiple
    const deleteMultipleButton = document.getElementById('exFileSelectModalDeleteMultipleFileButton')
    deleteMultipleButton.addEventListener('click', function () { deleteMultipleButton.focus() })

    if (document.body.getAttribute('data-fileMultipleDeletePopoverEventAdded') !== 'true') {
      // Only add this listener the first time we create a file select modal
      document.addEventListener('click', (event) => {
        if (event.target.getAttribute('id') !== 'fileDeleteMultiplePopover') return
        deleteMultipleFiles()
      })
      document.body.setAttribute('data-fileMultipleDeletePopoverEventAdded', 'true')
    }

    // Download multiple
    document.getElementById('exFileSelectModalDownloadMultipleButtonCol').addEventListener('click', downloadMultipleFiles)

    // Choose button. It's disabled until a file is selected.
    const chooseButton = document.getElementById('exFileSelectModalChooseButton')
    chooseButton.disabled = true
    chooseButton.addEventListener('click', () => {
      modal.querySelectorAll('.const-file-selected').forEach((el) => {
        selectedFiles.push(el.getAttribute('data-filename'))
      })
      bootstrap.Modal.getInstance(modal).hide()
    },
    { once: true })

    // Enter chooses the selected files, except where it already does something: in a field, or on a button or link
    modal.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.target.closest('input, textarea, select, button, a') != null) return
      if (options.manage === true || chooseButton.disabled) return
      event.preventDefault()
      chooseButton.click()
    })

    modal.addEventListener('hidden.bs.modal', () => {
      // If we dismiss the modal in any way other than clicking the Choose button,
      // return no files.

      // Destroy the modal
      const modal = document.getElementById('exFileSelectModal')
      modal.parentElement.removeChild(modal)

      // Return any selected files
      resolve(selectedFiles)
    },
    { once: true })

    const title = document.getElementById('exFileSelectModalTitle')
    if (options.manage === true) {
      title.innerHTML = 'Manage files'
    } else if (options.multiple === true) {
      title.innerHTML = 'Select files'
    } else if (options.multiple === false) {
      title.innerHTML = 'Select file'
    }

    // File upload
    document.getElementById('exFileSelectModalUploadSubmitCol').style.display = 'none'
    document.getElementById('exFileSelectModalUploadProgressBarContainer').style.display = 'none'
    document.getElementById('exFileSelectModalUploadOverwriteWarning').style.display = 'none'

    populateComponentContent(options)
      .then(() => {
        // Configure manage vs select
        if (options.manage === true) {
          document.getElementById('exFileSelectModalChooseButton').style.display = 'none'
        }
        new bootstrap.Modal(modal).show()
      })

    // Activate popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    popoverTriggerList.map(function (popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl)
    })
  })
}

function setupDragAndDrop (modal, options) {
  const overlay = modal.querySelector('#exFileSelectModalDropOverlay')
  const fileInput = document.getElementById('exFileSelectModalUpload')

  let dragCounter = 0
  let rejectFlashTimeout = null

  // Enable smooth visual transitions (inline, self-contained)
  overlay.style.transition =
  'background-color 180ms ease, border-color 180ms ease'

  // Cache base styles so we can restore them reliably
  const baseBackground = overlay.style.background || 'rgba(13,110,253,0.15)'
  const baseBorder = overlay.style.border || '3px dashed #0d6efd'
  const baseText = overlay.textContent

  const showOverlay = () => {
    overlay.style.display = 'flex'
  }

  const hideOverlay = () => {
    overlay.style.display = 'none'
  }

  const flashReject = () => {
    // Clear any in-flight flash
    if (rejectFlashTimeout) {
      clearTimeout(rejectFlashTimeout)
      rejectFlashTimeout = null
    }

    // Apply error state
    overlay.style.background = 'rgba(220,53,69,0.25)' // Bootstrap danger red
    overlay.style.border = '3px dashed #dc3545'
    overlay.textContent = 'Invalid file type dropped'

    rejectFlashTimeout = setTimeout(() => {
      overlay.style.background = baseBackground
      overlay.style.border = baseBorder
      overlay.textContent = baseText
      rejectFlashTimeout = null
    }, 950)
  }

  const matchesFiletypes = (file) => {
    if (options.filetypes.length === 0 || options.upload_any === true) return true

    const ext = file.name.split('.').pop().toLowerCase()
    const mimetype = file.type.split('/')[0]

    return options.filetypes.some(type => type === ext || type === mimetype)
  }

  modal.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    dragCounter++
    showOverlay()
  })

  modal.addEventListener('dragleave', (e) => {
    e.preventDefault()
    dragCounter--
    if (dragCounter <= 0) {
      dragCounter = 0
      hideOverlay()
    }
  })

  modal.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
  })

  modal.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()

    dragCounter = 0
    hideOverlay()

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length === 0) return

    const accepted = []
    const rejected = []

    for (const file of droppedFiles) {
      if (matchesFiletypes(file)) accepted.push(file)
      else rejected.push(file)
    }

    if (rejected.length > 0) {
      // Briefly re-show overlay to display the rejection flash
      showOverlay()
      flashReject()

      // Hide again after the flash completes
      setTimeout(() => {
        hideOverlay()
      }, 950)
    }

    if (accepted.length === 0) return

    const dataTransfer = new DataTransfer()
    accepted.forEach(file => dataTransfer.items.add(file))
    fileInput.files = dataTransfer.files

    onUploadContentChange()
  })
}

function filterComponentContent (strToMatch) {
  // Use CSS to hide any files that don't include the given string.

  Array.from(document.getElementById('exFileSelectModalFileList').children).forEach((el) => {
    const filename = el.getAttribute('data-filename')
    if (filename.toLowerCase().includes(strToMatch.toLowerCase())) {
      el.style.display = 'flex'
      el.setAttribute('data-filtered-out', 'false')
    } else {
      el.style.display = 'none'
      el.setAttribute('data-filtered-out', 'true')
    }
  })
}

function populateComponentContent (options) {
  // Get a list of the available files and create an element for each.

  return exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/files/availableContent'
  })
    .then((result) => {
      _populateComponentContent(result, options)
      filterComponentContent(document.getElementById('exFileSelectModalSearchField').value)
      previewFile({})
    })
}

function _populateComponentContent (fileDict, options) {
  // Build HTML elements for every file, modified by
  // the options passed in from createFileSelectionModal()

  const fileRow = document.getElementById('exFileSelectModalFileList')

  let fileDirectory
  if (options.directory === 'content') {
    fileDirectory = fileDict.content_details
  } else fileDirectory = fileDict.static_details

  // Alphabetize the list
  const fileList = exUtilities.sortAlphabetically(fileDirectory, 'name')

  // Clear any existing files, but keep the ones selected selected
  const wasSelected = new Set(Array.from(fileRow.querySelectorAll('.const-file-select-box.const-file-selected'))
    .map((box) => box.getAttribute('data-filename')))
  fileRow.innerHTML = ''
  const showThumbs = document.getElementById('exFileSelectModalThumbnailCheckbox').checked

  fileList.forEach((fileDetails) => {
    const file = fileDetails.name
    const extension = file.split('.').slice(-1)[0].toLowerCase()
    const mimetype = exFiles.guessMimetype(file)

    // If we are provided a list of allowable filetypes, reject any files
    // that are not of an acceptable type.
    if (options.filetypes.length > 0) {
      let match = false
      options.filetypes.forEach((type) => {
        if (extension === type || mimetype === type) match = true
      })
      if (match === false) return
    }

    const entry = document.createElement('div')
    entry.classList = 'col-12 row py-2 ps-4 const-file-entry'
    entry.style.cursor = 'default'
    entry.setAttribute('data-filtered-out', 'false')
    entry.innerHTML = `
      <div class='col-1 my-auto px-0 const-file-select-col' style="cursor: pointer;">
        <center>
          <div class='border text-center const-file-select-box' style="width: 30px; height: 30px;"></div>
        </center>
      </div>
      <div class='col-3 ps-1 const-file-thumb-container'></div>
      <div class='col-8 my-auto const-file-name'></div>
    `
    fileRow.appendChild(entry)

    // Set color based on whether dark mode is enabled
    const mode = document.querySelector('html').getAttribute('data-bs-theme')
    const box = entry.querySelector('.const-file-select-box')
    if (mode === 'dark') box.classList.add('border-light')
    else box.classList.add('border-dark')

    entry.setAttribute('data-filename', file)
    entry.setAttribute('data-details', JSON.stringify(fileDetails))

    // Hover
    entry.addEventListener('mouseenter', (event) => {
      document.querySelectorAll('.const-file-entry').forEach((el) => {
        el.classList.remove('bg-secondary', 'text-dark')
      })
      event.target.classList.add('bg-secondary', 'text-dark')
      const fileDetails = JSON.parse(entry.getAttribute('data-details'))
      previewFile(fileDetails)
    })

    // Checkbox
    const check = entry.querySelector('.const-file-select-box')
    check.setAttribute('data-filename', file)
    if (wasSelected.has(file)) {
      check.classList.add('const-file-selected', 'bg-success')
      check.innerHTML = '✓'
    }

    entry.addEventListener('click', (event) => {
      selectFile(check, options.multiple, event)
    })
    if (options.manage === false) {
      // Double-clicking chooses the file, along with any others already selected
      entry.addEventListener('dblclick', () => {
        // The double-click's two clicks can leave the file unselected, so select it again
        if (!check.classList.contains('const-file-selected')) selectFile(check, options.multiple, {})
        document.getElementById('exFileSelectModalChooseButton').click()
      })
    }

    // Thumbnail
    const thumbContainer = entry.querySelector('.const-file-thumb-container')
    _populateThumbnail(file, thumbContainer)
    if (showThumbs === false) thumbContainer.style.display = 'none'

    // Filename
    const filename = entry.querySelector('.const-file-name')
    filename.textContent = shortenFilename(file)
    filename.title = file
  })

  // The file last clicked, for shift-click, was replaced
  lastClickedSelectBox = null
  selectionChanged()
}

function _populateThumbnail (file, thumbContainer) {
  // Retrieve an appropriate thumbnail for the content and add it to the container.
  // If a thumbnail doesn't exist, the function will be rerun the number of times
  // given by retries. This gives time for a thumbnail to be generated after an upload.

  let thumb
  const mimetype = exFiles.guessMimetype(file)
  thumbContainer.innerHTML = '' // Clear in case we're replacing an existing thumbnail

  if (mimetype === 'image') {
    thumb = document.createElement('img')
    thumb.src = thumbnailURL(file)
  } else if (mimetype === 'video') {
    thumb = document.createElement('video')
    thumb.setAttribute('loop', true)
    thumb.setAttribute('autoplay', true)
    thumb.setAttribute('disablePictureInPicture', true)
    thumb.setAttribute('webkit-playsinline', true)
    thumb.setAttribute('playsinline', true)
    thumb.src = thumbnailURL(file)
  } else if (mimetype === 'audio') {
    thumb = document.createElement('img')
    thumb.src = exCommon.config.helperAddress + getDefaultAudioIcon()
  } else if (mimetype === 'model') {
    thumb = document.createElement('img')
    thumb.src = exCommon.config.helperAddress + getDefaultModelIcon()
  } else if (mimetype === 'spreadsheet') {
    thumb = document.createElement('img')
    thumb.src = exCommon.config.helperAddress + getDefaultSpreadsheetImage()
  } else if (mimetype === 'font') {
    thumb = document.createElement('div')
    thumb.classList = 'd-flex justify-content-center align-items-center'
    const thumbInner = document.createElement('div')
    thumb.appendChild(thumbInner)
    thumbInner.innerHTML = 'AaBb123'

    const clearFontName = file.replaceAll('.', '').replaceAll(' ', '') + 'Preview'
    const fontDef = new FontFace(clearFontName, 'url(' + encodeURI(contentURL(file)) + ')')
    document.fonts.add(fontDef)
    thumbInner.style.setProperty('Font-Family', clearFontName)
    thumbInner.style.fontSize = '25px'
    thumbInner.style.overflow = 'hidden'
  } else {
    // We don't have a thumbnail
    thumb = document.createElement('img')
    thumb.src = exCommon.config.helperAddress + getDefaultDocumentImage(file)
  }
  thumbContainer.appendChild(thumb)
  thumb.style.width = '100%'
  thumb.style.height = '50px'
  thumb.style.objectFit = 'contain'
}

function shortenFilename (filename) {
  // Shorten the given filename so it fits on one line

  if (filename.length > 30) {
    return filename.substr(0, 15) + '...' + filename.substr(filename.length - 10, filename.length)
  }
  return filename
}

function previewFile (fileDetails) {
  // Take the given filename and fill the preview with its details

  if (fileDetails.name == null) {
    fileDetails.name = ''
    fileDetails.size_text = ''
  }
  const file = fileDetails.name
  const img = document.getElementById('exFileSelectModalFilePreviewImage')
  const vid = document.getElementById('exFileSelectModalFilePreviewVideo')
  const aud = document.getElementById('exFileSelectModalFilePreviewAudio')
  const font = document.getElementById('exFileSelectModalFilePreviewFont')

  document.getElementById('exFileSelectModalFilePreviewFilename').textContent = file
  document.getElementById('exFileSelectModalFilePreviewFilesize').textContent = fileDetails.size_text
  document.getElementById('exFileSelectModalFilePreview').setAttribute('data-filename', file)

  // Configure download button

  const download = document.getElementById('exFileSelectModalDownloadFileButton')
  download.href = contentURL(file)
  download.download = file

  const mimetype = exFiles.guessMimetype(file)

  if (mimetype === 'image') {
    img.style.display = 'block'
    vid.style.display = 'none'
    font.style.display = 'none'
    aud.parentElement.style.display = 'none'
    img.src = thumbnailURL(file)
  } else if (mimetype === 'video') {
    img.style.display = 'none'
    vid.style.display = 'block'
    font.style.display = 'none'
    aud.parentElement.style.display = 'none'
    vid.src = thumbnailURL(file)
  } else if (mimetype === 'audio') {
    img.style.display = 'none'
    vid.style.display = 'none'
    font.style.display = 'none'
    aud.parentElement.style.display = 'flex'
    aud.src = contentURL(file)
  } else if (mimetype === 'model') {
    img.style.display = 'block'
    vid.style.display = 'none'
    font.style.display = 'none'
    aud.parentElement.style.display = 'none'
    img.src = exCommon.config.helperAddress + getDefaultModelIcon()
  } else if (mimetype === 'font') {
    img.style.display = 'none'
    vid.style.display = 'none'
    aud.style.display = 'none'
    font.style.display = 'block'

    const fontDef = new FontFace('fontPreview', 'url(' + encodeURI(contentURL(file)) + ')')
    document.fonts.add(fontDef)
    font.style.setProperty('Font-Family', 'fontPreview')
  } else if (mimetype === 'spreadsheet') {
    img.style.display = 'block'
    vid.style.display = 'none'
    aud.parentElement.style.display = 'none'
    font.style.display = 'none'
    img.src = exCommon.config.helperAddress + getDefaultSpreadsheetImage()
  } else {
    // We have something other than an image or video, or we are missing a thumbnail
    img.style.display = 'block'
    vid.style.display = 'none'
    aud.parentElement.style.display = 'none'
    font.style.display = 'none'
    img.src = exCommon.config.helperAddress + getDefaultDocumentImage(file)
  }
}

function getDefaultDocumentImage (file = '', png = false) {
  // Return the approriate thumbnail based on whether dark mode is enabled.
  // If a file is passed, try to populate an image based on the extension.

  let ext = 'svg'
  if (png === true) ext = 'png'

  let fileExt = ''
  if (file !== '') {
    fileExt = file.split('.').slice(-1)[0].toLowerCase()
  }
  const icons = {
    css: 'css',
    html: 'html',
    js: 'js',
    md: 'md'
  }
  let icon = icons[fileExt]
  if (icon == null) icon = 'document'

  const mode = document.querySelector('html').getAttribute('data-bs-theme')
  if (mode === 'dark') return '/_static/icons/' + icon + '_white.' + ext
  else if (mode === 'light') return '/_static/icons/document_black.' + ext
  else return '/_static/icons/' + icon + '_black.' + ext
}

function getDefaultSpreadsheetImage () {
  // Return the approriate thumbnail based on whether dark mode is enabled.

  const mode = document.querySelector('html').getAttribute('data-bs-theme')
  if (mode === 'dark') return '/_static/icons/spreadsheet_white.svg'
  else if (mode === 'light') return '/_static/icons/spreadsheet_black.svg'
  else return '/_static/icons/spreadsheet_black.svg'
}

export function getDefaultAudioIcon (png = false) {
  // Return the approriate thumbnail based on whether dark mode is enabled.

  let ext = 'svg'
  if (png === true) ext = 'png'

  const mode = document.querySelector('html').getAttribute('data-bs-theme')
  if (mode === 'dark') return '/_static/icons/audio_white.' + ext
  else if (mode === 'light') return '/_static/icons/audio_black.' + ext
  else return '/_static/icons/audio_black.' + ext
}

export function getDefaultModelIcon (png = false) {
  // Return the approriate model thumbnail based on whether dark mode is enabled.

  let ext = 'svg'
  if (png === true) ext = 'png'

  const mode = document.querySelector('html').getAttribute('data-bs-theme')
  if (mode === 'dark') return '/_static/icons/model_white.' + ext
  else if (mode === 'light') return '/_static/icons/model_black.' + ext
  else return '/_static/icons/model_black.' + ext
}

function selectFile (target, allowMultiple, clickEvent) {
  // Called when the user clicks on a file. If allowMultiple=false,
  // selecting one file unselects the others.
  // If shift is held and allowMultiple=true, select a range of files.

  document.getSelection().removeAllRanges() // Clear any text selection from a shift-click

  const fileList = document.getElementById('exFileSelectModalFileList')
  const allSelectBoxes = Array.from(fileList.querySelectorAll('.const-file-entry:not([data-filtered-out="true"]) .const-file-select-box'))

  // Handle shift+click range selection
  if (clickEvent.shiftKey && allowMultiple && lastClickedSelectBox !== null) {
    const lastIndex = allSelectBoxes.indexOf(lastClickedSelectBox)
    const currentIndex = allSelectBoxes.indexOf(target)

    if (lastIndex !== -1 && currentIndex !== -1) {
      const start = Math.min(lastIndex, currentIndex)
      const end = Math.max(lastIndex, currentIndex)

      // Select all items in the range
      for (let i = start; i <= end; i++) {
        allSelectBoxes[i].classList.add('const-file-selected', 'bg-success')
        allSelectBoxes[i].innerHTML = '✓'
      }
    }
  } else {
    // Normal click behavior
    if (target.classList.contains('const-file-selected')) {
      target.classList.remove('const-file-selected', 'bg-success')
      target.innerHTML = ''
    } else {
      if (allowMultiple === false) {
        document.querySelectorAll('.const-file-select-box').forEach((el) => {
          el.classList.remove('const-file-selected', 'bg-success')
          el.innerHTML = ''
        })
      }
      target.classList.add('const-file-selected', 'bg-success')
      target.innerHTML = '✓'
    }
  }

  // Update last clicked reference
  lastClickedSelectBox = target

  selectionChanged()
}

function selectionChanged () {
  // Show the delete and download multiple buttons when more than one file is selected, and only allow choosing when
  // at least one is.

  const count = document.querySelectorAll('#exFileSelectModalFileList .const-file-select-box.const-file-selected').length
  const display = count > 1 ? 'block' : 'none'
  document.getElementById('exFileSelectModalDeleteMultipleButtonCol').style.display = display
  document.getElementById('exFileSelectModalDownloadMultipleButtonCol').style.display = display
  document.getElementById('exFileSelectModalChooseButton').disabled = count === 0
}

function selectAllFiles () {
  // Select all files that have not been filtered out.

  document.getElementById('exFileSelectModalFileList').querySelectorAll('.const-file-entry').forEach((el) => {
    if (el.getAttribute('data-filtered-out') === 'true') return
    const checkbox = el.querySelector('.const-file-select-box')
    checkbox.classList.add('const-file-selected', 'bg-success')
    checkbox.innerHTML = '✓'
  })
  selectionChanged()
}

function deselectAllFiles () {
  // Uncheck all files that are not filtered out

  document.getElementById('exFileSelectModalFileList').querySelectorAll('.const-file-entry').forEach((el) => {
    if (el.getAttribute('data-filtered-out') === 'true') return
    const checkbox = el.querySelector('.const-file-select-box')
    checkbox.classList.remove('const-file-selected', 'bg-success')
    checkbox.innerHTML = ''
  })
  selectionChanged()
}

function onUploadContentChange () {
  // When we select a file for uploading, check against the existing files
  //  and warn if we will overwrite.

  // Show the upload button
  document.getElementById('exFileSelectModalUploadSubmitCol').style.display = 'block'

  const fileInput = document.getElementById('exFileSelectModalUpload')

  // Check for filename collision
  const currentFiles = Array.from(document.getElementById('exFileSelectModal').querySelectorAll('.const-file-select-box')).map(el => el.getAttribute('data-filename'))

  let collision = false
  for (let i = 0; i < fileInput.files.length; i++) {
    const file = fileInput.files[i]
    if (currentFiles.includes(file.name)) {
      collision = true
    }
  }
  // Format button text
  if (fileInput.files.length === 1) {
    document.getElementById('exFileSelectModalUploadfilename').innerHTML = '1 file selected'
  } else {
    document.getElementById('exFileSelectModalUploadfilename').textContent = String(fileInput.files.length) + ' files selected'
  }
  if (collision) {
    document.getElementById('exFileSelectModalUploadOverwriteWarning').style.display = 'block'
  } else {
    document.getElementById('exFileSelectModalUploadOverwriteWarning').style.display = 'none'
  }
}

function uploadFile (options) {
  // Handle uploading files

  const fileInput = document.getElementById('exFileSelectModalUpload')

  document.getElementById('exFileSelectModalUploadOverwriteWarning').style.display = 'none'
  clearProblem()

  if (fileInput.files[0] != null) {
    document.getElementById('exFileSelectModalUploadSubmitCol').style.display = 'none'
    document.getElementById('exFileSelectModalUploadProgressBarContainer').style.display = 'block'

    const formData = new FormData()
    formData.append('path', options.directory)

    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i]
      formData.append('files', file)
    }

    const uploadedNames = Array.from(fileInput.files).map((file) => file.name)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', exCommon.config.helperAddress + exCommon.config.api + '/files/upload', true)

    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      document.getElementById('exFileSelectModalUploadProgressBarContainer').style.display = 'none'

      let response = null
      try {
        response = JSON.parse(this.responseText)
      } catch {
        // Not a reply from Apps
      }
      if (this.status !== 200 || response?.success !== true) {
        // Keep the chosen files, so the upload can be tried again
        document.getElementById('exFileSelectModalUploadSubmitCol').style.display = 'block'
        showProblem("The files couldn't be uploaded. " + CONNECTION_PROBLEM)
        return
      }

      document.getElementById('exFileSelectModalUploadfilename').innerHTML = 'Upload new'
      const skipped = response.skipped ?? []
      if (skipped.length === 1) {
        showProblem(`This file wasn't uploaded because its name isn't allowed: ${skipped[0]}. Rename it and try again.`)
      } else if (skipped.length > 1) {
        showProblem(`These files weren't uploaded because their names aren't allowed: ${skipped.join(', ')}. Rename them and try again.`)
      }

      const uploaded = uploadedNames.filter((name) => !skipped.includes(name))
      const version = Date.now()
      for (const name of uploaded) fileVersions[name] = version
      populateComponentContent(options)
        .then(() => showUploadedFiles(uploaded, options))
    }

    xhr.upload.addEventListener('progress', function (evt) {
      if (evt.lengthComputable) {
        let percentComplete = evt.loaded / evt.total
        percentComplete = parseInt(percentComplete * 100)
        document.getElementById('exFileSelectModalUploadProgressBar').style.width = String(percentComplete) + '%'
        if (percentComplete > 0) {
          document.getElementById('exFileSelectModalUploadProgressBarContainer').style.display = 'block'
        }
      }
    }, false)

    xhr.send(formData)
  }
}

function showUploadedFiles (filenames, options) {
  // Select the files that were just uploaded and scroll the list to the first one. If only one file can be
  // chosen, select just that first one, in place of any file already selected.

  const fileList = document.getElementById('exFileSelectModalFileList')
  const entries = Array.from(fileList.querySelectorAll('.const-file-entry'))
    .filter((entry) => filenames.includes(entry.getAttribute('data-filename')))
  if (entries.length === 0) return // The list doesn't show files of these types

  // Show the uploads, even if the search would hide them
  if (entries.some((entry) => entry.getAttribute('data-filtered-out') === 'true')) {
    document.getElementById('exFileSelectModalSearchField').value = ''
    filterComponentContent('')
  }

  if (!options.multiple) {
    fileList.querySelectorAll('.const-file-select-box').forEach((box) => {
      box.classList.remove('const-file-selected', 'bg-success')
      box.innerHTML = ''
    })
  }
  const toSelect = options.multiple ? entries : entries.slice(0, 1)
  for (const entry of toSelect) {
    const box = entry.querySelector('.const-file-select-box')
    box.classList.add('const-file-selected', 'bg-success')
    box.innerHTML = '✓'
  }
  lastClickedSelectBox = toSelect[0].querySelector('.const-file-select-box')
  selectionChanged()

  // With several files, show the first at the top so the others follow it
  entries[0].scrollIntoView({ block: entries.length > 1 ? 'start' : 'nearest' })
}

function deleteFiles (files) {
  // Delete the given files

  const exFileSelectModal = document.getElementById('exFileSelectModal')
  const failed = () => showProblem((files.length === 1 ? "The file couldn't be deleted. " : "The files couldn't be deleted. ") + CONNECTION_PROBLEM)
  clearProblem()
  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/files/delete',
    params: { file: files }
  })
    .then((result) => {
      if (result?.success !== true) {
        failed()
        return
      }
      for (const file of files) {
        const entry = exFileSelectModal.querySelector(`.const-file-entry[data-filename="${file}"]`)
        entry?.remove()
        delete fileVersions[file]
      }
      previewFile({})
      document.getElementById('exFileSelectModalFilePreview').dataset.filename = ''
      selectionChanged()
    }, failed)
}

function downloadMultipleFiles () {
  // Download all selected files as a ZIP.

  clearProblem()

  const filesToDownload = document.querySelectorAll('.const-file-select-box.const-file-selected')
  const filenamesToDownload = []
  for (const el of filesToDownload) {
    filenamesToDownload.push(el.dataset.filename)
  }

  fetch(exCommon.config.helperAddress + exCommon.config.api + '/files/createZip',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'

      },
      body: JSON.stringify({
        zip_filename: 'files.zip',
        files: filenamesToDownload
      })
    }
  )
    .then(async (response) => {
      // Apps refuses with a JSON reply, so only save a ZIP file, rather than the error
      if (response.ok && (response.headers.get('content-type') ?? '').includes('zip')) return response.blob()
      const reply = await response.json().catch(() => null)
      throw new Error(reply?.reason ?? 'no_zip')
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'files.zip'
      document.body.appendChild(a) // append the element to the dom
      a.click()
      a.remove() // afterward, remove the element
      window.URL.revokeObjectURL(url)
    })
    .catch((error) => {
      if (error.message === 'unsafe_filename') {
        showProblem("These files couldn't be downloaded because some of their names aren't allowed.")
      } else showProblem("The files couldn't be downloaded. " + CONNECTION_PROBLEM)
    })
}

function deleteMultipleFiles () {
  // Delete all selected files.

  const filesToDelete = document.querySelectorAll('.const-file-select-box.const-file-selected')
  const filenamesToDelete = []
  for (const el of filesToDelete) {
    filenamesToDelete.push(el.dataset.filename)
  }
  deleteFiles(filenamesToDelete)
}

function showRenameField () {
  // Show the rename field for the file currently being previewed.

  const filename = document.getElementById('exFileSelectModalFilePreview').dataset.filename

  if (filename === '') return

  document.getElementById('exFileSelectModalFilePreviewEditContainer').style.display = 'flex'
  document.getElementById('exFileSelectModalFilePreviewFilename').style.display = 'none'
  document.getElementById('exFileSelectModalFilePreviewEditFileExistsWarning').style.display = 'none'

  const fileNameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename
  const renameField = document.getElementById('exFileSelectModalFilePreviewEditField')
  renameField.dataset.filename = filename // Save the original name to ensure we rename the correct file
  renameField.value = filename
  renameField.setSelectionRange(0, fileNameWithoutExt.length)
  renameField.focus()
}

function cancelFileRename () {
  // Reset the GUI after canceling a file rename

  document.getElementById('exFileSelectModalFilePreviewEditContainer').style.display = 'none'
  document.getElementById('exFileSelectModalFilePreviewFilename').style.display = 'block'
}

function renameFile () {
  // Get the new name and send it to the helper to be changed.

  const renameField = document.getElementById('exFileSelectModalFilePreviewEditField')
  const originalName = renameField.dataset.filename
  const newName = renameField.value

  if (originalName === newName) {
    cancelFileRename()
    return
  }

  // The rename field stays open when a rename fails, so the name can be corrected
  const failed = () => showProblem("This file couldn't be renamed. " + CONNECTION_PROBLEM)
  clearProblem()
  document.getElementById('exFileSelectModalFilePreviewEditFileExistsWarning').style.display = 'none'
  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/files/' + originalName + '/rename',
    params: {
      current_name: originalName,
      new_name: newName
    }
  })
    .then((result) => {
      if (!result?.success) {
        if (result?.error === 'file_exists') {
          document.getElementById(
            'exFileSelectModalFilePreviewEditFileExistsWarning'
          ).style.display = 'block'
        } else if (result?.reason === 'unsafe_filename') {
          showProblem("This file couldn't be renamed because the new name isn't allowed. Names can't include / \\ : * ? \" < > |.")
        } else failed()
        return
      }
      if (fileVersions[originalName] != null) {
        fileVersions[newName] = fileVersions[originalName]
        delete fileVersions[originalName]
      }

      // Update the preview pane
      document.getElementById('exFileSelectModalFilePreview').setAttribute('data-filename', newName)

      // Update the entry
      const entry = document.getElementById('exFileSelectModal').querySelector(`.const-file-entry[data-filename="${originalName}"]`)
      const fileDetails = JSON.parse(entry.getAttribute('data-details'))
      fileDetails.name = newName
      entry.setAttribute('data-details', JSON.stringify(fileDetails))
      entry.setAttribute('data-filename', newName)
      entry.querySelector('.const-file-name').title = newName
      entry.querySelector('.const-file-name').textContent = shortenFilename(newName)
      entry.querySelector('.const-file-select-box').setAttribute('data-filename', newName)

      // Update the preview filename
      document.getElementById('exFileSelectModalFilePreviewFilename').textContent = newName
      document.getElementById('exFileSelectModalFilePreviewEditContainer').style.display = 'none'
      document.getElementById('exFileSelectModalFilePreviewFilename').style.display = 'block'
    }, failed)
}
