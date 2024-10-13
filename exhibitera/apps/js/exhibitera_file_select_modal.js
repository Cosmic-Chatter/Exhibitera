/* global bootstrap */
import * as exCommon from './exhibitera_app_common.js'

export function createFileSelectionModal (userOptions) {
  // Build a standard Exhibitera file selection modal

  let options = {
    filetypes: [], // List of file types to allow ([] for all)
    manage: false, // Allow uploading, deleting, and renaming, but not selecting
    multiple: true // Select multiple files?
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
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="exFileSelectModalTitle" class="modal-title">Select Files</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row mb-2">
              <div class='col-4 col-sm-3 col-lg-2'>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" value="" id="exFileSelectModalThumbnailCheckbox" checked>
                  <label class="form-check-label" for="exFileSelectModalThumbnailCheckbox">
                    Thumbnails
                  </label>
                </div>
              </div>
              <div class='col-4 col-md-3 col-lg-2'>
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
              <div class="col-4 col-sm-5 col-md-6 offset-lg-4 col-lg-4">
              <div class="input-group input-group-sm">
                <input id="exFileSelectModalSearchField" type="text" placeholder="Search" class="form-control" aria-label="Search">
              </div>
                
              </div>
            </div>
            <div class="row flex-column-reverse flex-lg-row">
            <div class="col-12 col-lg-8" style="max-height: 55vh; overflow-y: auto;">
              <div id="exFileSelectModalFileList"  class='row'></div>
            </div>
            <div id="exFileSelectModalFilePreview" class="col-12 col-lg-4 mb-3">
              <div class="row justify-content-center">
                <div class='col-6 col-lg-12'>
                  <img id="exFileSelectModalFilePreviewImage" style="width: 100%; height: 200px; object-fit: contain;"></img>
                  <video id="exFileSelectModalFilePreviewVideo" loop autoplay muted disablePictureInPicture="true" webkit-playsinline="true" playsinline="true" style="width: 100%; height: 200px; object-fit: contain;"></video>
                  <div style="height: 200px; display: flex; justify-content: center; align-items: center;">
                    <audio id="exFileSelectModalFilePreviewAudio" controls style="width: 100%;"></audio>
                  </div>
                  <div id="exFileSelectModalFilePreviewFont" style="height: 200px; word-break: break-word; font-size: 16px;">
                    <p>AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789</p>
                    <p>The quick brown fox jumps over the lazy dog.</p>
                  </div>
                </div>
                <div class='col-6 col-lg-12 mt-2 text-center h6' style="word-wrap: break-word">
                  <span id="exFileSelectModalFilePreviewFilename" ></span>
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
            <div class='row w-100 px-0'>
              <div class='col-12 col-lg-9 ps-0'>
                <div id="exFileSelectModalUploadInterface" class="form-group">
                  <div class="row align-middle d-flex">
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
      options.filetypes.forEach((type) => {
        if (type === 'audio' || type === 'image' || type === 'video') acceptStr += type + '/*, '
        else acceptStr += '.' + type + ', '
      })
      document.getElementById('exFileSelectModalUpload').setAttribute('accept', acceptStr)
    }

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

    // Choose button
    document.getElementById('exFileSelectModalChooseButton').addEventListener('click', () => {
      modal.querySelectorAll('.const-file-selected').forEach((el) => {
        selectedFiles.push(el.getAttribute('data-filename'))
      })
      bootstrap.Modal.getInstance(modal).hide()
    },
    { once: true })

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
    endpoint: '/getAvailableContent'
  })
    .then((result) => {
      _populateComponentContent(result, options)
      previewFile('', [])
    })
}

function _populateComponentContent (fileDict, options) {
  // Build HTML elements for every file in fileDict.all_exhibits, modified by
  // the options passed in from createFileSelectionModal()

  const fileRow = document.getElementById('exFileSelectModalFileList')
  // Alphabetize the list
  const fileList = fileDict.all_exhibits.sort(function (a, b) { return a.localeCompare(b) })

  // Clear any existing files
  fileRow.innerHTML = ''
  const showThumbs = document.getElementById('exFileSelectModalThumbnailCheckbox').checked

  fileList.forEach((file) => {
    const extension = file.split('.').slice(-1)[0].toLowerCase()
    const mimetype = exCommon.guessMimetype(file)

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

    // Hover
    entry.addEventListener('mouseenter', (event) => {
      document.querySelectorAll('.const-file-entry').forEach((el) => {
        el.classList.remove('bg-secondary', 'text-dark')
      })
      event.target.classList.add('bg-secondary', 'text-dark')
      const file = event.target.getAttribute('data-filename')
      previewFile(file)
    })

    // Checkbox
    const check = entry.querySelector('.const-file-select-box')
    check.setAttribute('data-filename', file)

    entry.addEventListener('click', (event) => {
      selectFile(check, options.multiple)
    })

    // Thumbnail
    const thumbContainer = entry.querySelector('.const-file-thumb-container')
    _populateThumbnail(file, thumbContainer)
    if (showThumbs === false) thumbContainer.style.display = 'none'

    // Filename
    const filename = entry.querySelector('.const-file-name')
    filename.innerHTML = shortenFilename(file)
    filename.title = file
  })
}

function _populateThumbnail (file, thumbContainer) {
  // Retrieve an appropriate thumbnail for the content and add it to the container.
  // If a thumbnail doesn't exist, the function will be rerun the number of times
  // given by retries. This gives time for a thumbnail to be generated after an upload.

  let thumb
  const mimetype = exCommon.guessMimetype(file)
  thumbContainer.innerHTML = '' // Clear in case we're replacing an existing thumbnail

  if (mimetype === 'image') {
    thumb = document.createElement('img')
    thumb.src = exCommon.config.helperAddress + '/files/' + file + '/thumbnail/240'
  } else if (mimetype === 'video') {
    thumb = document.createElement('video')
    thumb.setAttribute('loop', true)
    thumb.setAttribute('autoplay', true)
    thumb.setAttribute('disablePictureInPicture', true)
    thumb.setAttribute('webkit-playsinline', true)
    thumb.setAttribute('playsinline', true)
    thumb.src = exCommon.config.helperAddress + '/files/' + file + '/thumbnail/240'
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
    const fontDef = new FontFace(clearFontName, 'url(' + encodeURI(exCommon.config.helperAddress + '/content/' + file) + ')')
    document.fonts.add(fontDef)
    thumbInner.style.setProperty('Font-Family', clearFontName)
    thumbInner.style.fontSize = '25px'
    thumbInner.style.overflow = 'hidden'
  } else {
    // We don't have a thumbnail
    thumb = document.createElement('img')
    thumb.src = exCommon.config.helperAddress + getDefaultDocumentImage()
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

function previewFile (file) {
  // Take the given filename and fill the preview with its details

  const img = document.getElementById('exFileSelectModalFilePreviewImage')
  const vid = document.getElementById('exFileSelectModalFilePreviewVideo')
  const aud = document.getElementById('exFileSelectModalFilePreviewAudio')
  const font = document.getElementById('exFileSelectModalFilePreviewFont')

  document.getElementById('exFileSelectModalFilePreviewFilename').innerHTML = file
  document.getElementById('exFileSelectModalFilePreview').setAttribute('data-filename', file)

  // Configure downlaod button

  const download = document.getElementById('exFileSelectModalDownloadFileButton')
  download.href = exCommon.config.helperAddress + '/content/' + file
  download.download = file

  const mimetype = exCommon.guessMimetype(file)

  if (mimetype === 'image') {
    img.style.display = 'block'
    vid.style.display = 'none'
    font.style.display = 'none'
    aud.parentElement.style.display = 'none'
    img.src = exCommon.config.helperAddress + '/files/' + file + '/thumbnail/240'
  } else if (mimetype === 'video') {
    img.style.display = 'none'
    vid.style.display = 'block'
    font.style.display = 'none'
    aud.parentElement.style.display = 'none'
    vid.src = exCommon.config.helperAddress + '/files/' + file + '/thumbnail/240'
  } else if (mimetype === 'audio') {
    img.style.display = 'none'
    vid.style.display = 'none'
    font.style.display = 'none'
    aud.parentElement.style.display = 'flex'
    aud.src = exCommon.config.helperAddress + '/content/' + file
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

    const fontDef = new FontFace('fontPreview', 'url(' + encodeURI(exCommon.config.helperAddress + '/content/' + file) + ')')
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
    img.src = exCommon.config.helperAddress + getDefaultDocumentImage()
  }
}

function getDefaultDocumentImage (png = false) {
  // Return the approriate thumbnail based on whether dark mode is enabled.

  let ext = 'svg'
  if (png === true) ext = 'png'

  const mode = document.querySelector('html').getAttribute('data-bs-theme')
  if (mode === 'dark') return '/_static/icons/document_white.' + ext
  else if (mode === 'light') return '/_static/icons/document_black.' + ext
  else return '/_static/icons/document_black.' + ext
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

function selectFile (target, allowMultiple) {
  // Called when the user clicks on a file. If allowMultiple=false,
  // selecting one file unselects the others.

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

  // Check if multiple files are selected and show/hide the delete multiple button
  if (allowMultiple === true) {
    if (document.querySelectorAll('.const-file-select-box.const-file-selected').length > 1) {
      document.getElementById('exFileSelectModalDeleteMultipleButtonCol').style.display = 'block'
      document.getElementById('exFileSelectModalDownloadMultipleButtonCol').style.display = 'block'
    } else {
      document.getElementById('exFileSelectModalDeleteMultipleButtonCol').style.display = 'none'
      document.getElementById('exFileSelectModalDownloadMultipleButtonCol').style.display = 'none'
    }
  }
}

function selectAllFiles () {
  // Select all files that have not been filtered out.

  document.getElementById('exFileSelectModalFileList').querySelectorAll('.const-file-entry').forEach((el) => {
    if (el.getAttribute('data-filtered-out') === 'true') return
    const checkbox = el.querySelector('.const-file-select-box')
    checkbox.classList.add('const-file-selected', 'bg-success')
    checkbox.innerHTML = '✓'
  })

  document.getElementById('exFileSelectModalDeleteMultipleButtonCol').style.display = 'block'
  document.getElementById('exFileSelectModalDownloadMultipleButtonCol').style.display = 'block'
}

function deselectAllFiles () {
  // Uncheck all files that are not filtered out

  document.getElementById('exFileSelectModalFileList').querySelectorAll('.const-file-entry').forEach((el) => {
    if (el.getAttribute('data-filtered-out') === 'true') return
    const checkbox = el.querySelector('.const-file-select-box')
    checkbox.classList.remove('const-file-selected', 'bg-success')
    checkbox.innerHTML = ''
  })
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
    document.getElementById('exFileSelectModalUploadfilename').innerHTML = String(fileInput.files.length) + ' files selected'
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

  if (fileInput.files[0] != null) {
    document.getElementById('exFileSelectModalUploadSubmitCol').style.display = 'none'
    document.getElementById('exFileSelectModalUploadProgressBarContainer').style.display = 'block'

    const formData = new FormData()

    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i]
      formData.append('files', file)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', exCommon.config.helperAddress + '/uploadContent', true)

    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          document.getElementById('exFileSelectModalUploadProgressBarContainer').style.display = 'none'
          document.getElementById('exFileSelectModalUploadfilename').innerHTML = 'Upload new'
          populateComponentContent(options)
        }
      } else if (this.status === 422) {
        console.log(JSON.parse(this.responseText))
      }
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

function deleteFiles (files) {
  // Delete the given files

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/file/delete',
    params: { file: files }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        files.forEach((file) => {
          const entry = document.getElementById('exFileSelectModal').querySelector(`.const-file-entry[data-filename="${file}"]`)
          previewFile('', [])
          document.getElementById('exFileSelectModalFilePreview').setAttribute('data-filename', '')
          entry.parentElement.removeChild(entry)
        })
      }
    })
}

function downloadMultipleFiles () {
  // Download all selected files as a ZIP.

  const filesToDownload = document.querySelectorAll('.const-file-select-box.const-file-selected')
  const filenamesToDownload = []
  filesToDownload.forEach((el) => {
    filenamesToDownload.push(el.getAttribute('data-filename'))
  })

  fetch(exCommon.config.helperAddress + '/files/createZip',
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
    .then((response) => response.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'files.zip'
      document.body.appendChild(a) // append the element to the dom
      a.click()
      a.remove() // afterwards, remove the element
    })
}

function deleteMultipleFiles () {
  // Delete all selected files.

  const filesToDelete = document.querySelectorAll('.const-file-select-box.const-file-selected')
  const filenamesToDelete = []
  filesToDelete.forEach((el) => {
    filenamesToDelete.push(el.getAttribute('data-filename'))
  })
  deleteFiles(filenamesToDelete)
}

function showRenameField () {
  // Show the rename field for the file currently being previewed.

  const filename = document.getElementById('exFileSelectModalFilePreview').getAttribute('data-filename')

  if (filename === '') return

  document.getElementById('exFileSelectModalFilePreviewEditContainer').style.display = 'flex'
  document.getElementById('exFileSelectModalFilePreviewFilename').style.display = 'none'
  document.getElementById('exFileSelectModalFilePreviewEditFileExistsWarning').style.display = 'none'

  const fileNameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename
  const renameField = document.getElementById('exFileSelectModalFilePreviewEditField')
  renameField.setAttribute('filename', filename) // Save the original name to ensure we rename the correct file
  renameField.value = filename
  renameField.setSelectionRange(0, fileNameWithoutExt.length)
  renameField.focus()
}

function cancelFileRename () {
  document.getElementById('exFileSelectModalFilePreviewEditContainer').style.display = 'none'
  document.getElementById('exFileSelectModalFilePreviewFilename').style.display = 'block'
}

function renameFile () {
  // Get the new name and send it to the helper to be changed.

  const renameField = document.getElementById('exFileSelectModalFilePreviewEditField')
  const originalName = renameField.getAttribute('filename')
  const newName = renameField.value

  if (originalName === newName) {
    cancelFileRename()
    return
  }

  exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/renameFile',
    params: {
      current_name: originalName,
      new_name: newName
    }
  })
    .then((result) => {
      if ('success' in result) {
        if (result.success === false && result.error === 'file_exists') {
          document.getElementById('exFileSelectModalFilePreviewEditFileExistsWarning').style.display = 'block'
        } else if (result.success === true) {
          // Update the preview pane
          document.getElementById('exFileSelectModalFilePreview').setAttribute('data-filename', newName)
          // Update the entry
          const entry = document.getElementById('exFileSelectModal').querySelector(`.const-file-entry[data-filename="${originalName}"]`)
          entry.setAttribute('data-filename', newName)
          entry.querySelector('.const-file-name').title = newName
          entry.querySelector('.const-file-name').innerHTML = shortenFilename(newName)
          entry.querySelector('.const-file-select-box').setAttribute('data-filename', newName)

          // Update the preview filename
          document.getElementById('exFileSelectModalFilePreviewFilename').innerHTML = newName
          document.getElementById('exFileSelectModalFilePreviewEditContainer').style.display = 'none'
          document.getElementById('exFileSelectModalFilePreviewFilename').style.display = 'block'
        }
      }
    })
}
