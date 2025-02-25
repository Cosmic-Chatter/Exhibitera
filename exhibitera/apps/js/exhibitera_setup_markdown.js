/* global bootstrap, showdown, TinyMDE */
// Create rich markdown editors for setup pages.

import * as exFileSelect from './exhibitera_file_select_modal.js'
import * as exCommon from './exhibitera_app_common.js'

const markdownConverter = new showdown.Converter({ parseImgDimensions: true })

const timerThreshold = 2000 // ms to wait before calling the callback
const undoCacheLimit = 1000
const undoCacheUpdateThreshold = 250 // ms minimum between adding undo actions

export class ExhibiteraMarkdownEditor {
  constructor (options) {
    // Validate required parameters
    if (
      !options ||
      options.content == null ||
      options.editorDiv == null ||
      options.commandDiv == null
    ) {
      throw new Error('Missing required parameter')
    }

    this.timer = 0 // holds reference to setTimeout instance
    this.undoCache = []
    this.redoCache = []
    this.lastUndoCacheUpdate = new Date()
    this.undoDone = false // true immediately after an undo is performed
    this.updateSinceUndo = true // false immediately after an undo; true when new text is added
    this.options = options

    // Create TinyMDE editor instance
    this.tinyMDE = new TinyMDE.Editor({
      content: options.content,
      element: options.editorDiv
    })

    // Initialize the undo cache with the starting state
    this.appendToUndo(options.content)

    // Listen for changes in the editor
    this.tinyMDE.addEventListener('change', (event) => {
      this.handleChange(event)
    })

    // Set up the command bar. Use default commands if none are provided.
    const commands = []
    for (const category of (options.commands || ['basic', 'headers', 'formatting', 'image'])) {
      if (category === 'basic') {
        commands.push({ name: 'bold', innerHTML: 'B' })
        commands.push({ name: 'italic', innerHTML: '<i>I</i>' })
        commands.push('|')
      } else if (category === 'headers') {
        commands.push({ name: 'h1', innerHTML: 'H' })
        commands.push({ name: 'h2', innerHTML: 'h' })
        commands.push('|')
      } else if (category === 'formatting') {
        commands.push('ul')
        commands.push('ol')
        commands.push('blockquote')
        commands.push('|')
      } else if (category === 'image') {
        commands.push({ name: 'insertImage', action: this.showInsertImageModal.bind(this) })
        commands.push('|')
      }
    }
    commands.push({ name: 'undo', action: this.undo.bind(this), innerHTML: '↺', hotkey: 'Mod-z', title: 'Undo' })
    commands.push({ name: 'redo', action: this.redo.bind(this), innerHTML: '↻', hotkey: 'Mod-Shift-z', title: 'Redo' })

    this.commandBar = new TinyMDE.CommandBar({
      element: options.commandDiv,
      editor: this.tinyMDE,
      commands
    })
  }

  /**
   * Called whenever a change is made to the editor's content.
   * Updates the undo cache and throttles callback invocation.
   */
  handleChange (event) {
    // If the change was triggered by an undo/redo action, ignore it.
    if (this.undoDone === true) {
      this.undoDone = false
      return
    }

    // Append to undo cache if enough time has passed
    if ((new Date() - this.lastUndoCacheUpdate) > undoCacheUpdateThreshold) {
      this.appendToUndo(event.content, this.tinyMDE.getSelection())
    }
    console.log('clearing redo')
    this.redoCache = []

    this.updateSinceUndo = true

    if (this.options.limitCallbacks !== false) {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        if (this.options.callback) this.options.callback(event.content)
      }, timerThreshold)
    } else {
      this.options.callback(event.content)
    }
  }

  showInsertImageModal () {
    // Create a modal that allows the user to select an image, style it, and add a caption.

    // Record the current state of the cursor
    const focus = this.tinyMDE.getSelection()
    const anchor = this.tinyMDE.getSelection(true)

    const modalHTML = `
      <div class="modal" id="dynamicModal" tabindex="-1" aria-labelledby="dynamicModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="dynamicModalLabel">Insert an image</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="row gy-2 d-flex align-items-end">
                <div class="col-4">
                  <img class="w-100" id="exMarkdownSelectImage">
                  <button id="exMarkdownSelectImageButton" class="btn btn-outline-primary w-100 mt-3">Select image</button>
                </div>
                <div class="col-4">
                  <label for="exMarkdownSelectImageAlignmentSelect" class="form-label">Alignment</label>
                  <select id="exMarkdownSelectImageAlignmentSelect" class="form-select">
                    <option value="left">Left</option>
                    <option value="middle">Middle</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div class="col-4">
                  <label for="exMarkdownSelectImageSizeSelect" class="form-label">Width</label>
                  <select id="exMarkdownSelectImageSizeSelect" class="form-select">
                    <option value="25%">25%</option>
                    <option value="33%">33%</option>
                    <option value="50%">50%</option>
                    <option value="67%">67%</option>
                    <option value="75%">75%</option>
                    <option value="100%">100%</option>
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label" for="exMarkdownSelectImageCaption">Caption</label>
                  <input type="text" class="form-control" id="exMarkdownSelectImageCaption">
                </div>
              </div>
              <div class="col-12 mt-2">
                <span id="exMarkdownSelectImageNoImageWarning" class="text-warning" style="display: none;">
                  Select the image you want to insert.
                </span>
              </div>
              
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button id="exMarkdownInsertImageFromModalButton" type="button" class="btn btn-primary">Insert</button>
            </div>
          </div>
        </div>
      </div>
    `

    // Create a temporary container to hold the HTML.
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = modalHTML

    // Get the actual modal element.
    const modalElement = tempDiv.firstElementChild

    // Append the modal to the document body.
    document.body.appendChild(modalElement)

    // Initialize a new Bootstrap modal instance.
    const modalInstance = new bootstrap.Modal(modalElement)

    // Bind event listeners
    document.getElementById('exMarkdownSelectImageButton').addEventListener('click', () => {
      exFileSelect
        .createFileSelectionModal({
          filetypes: ['image'],
          manage: false,
          multiple: false
        })
        .then((files) => {
          if (files.length !== 0) {
            const exMarkdownSelectImage = document.getElementById('exMarkdownSelectImage')
            exMarkdownSelectImage.src = exCommon.config.helperAddress + '/files/' + files[0] + '/thumbnail'
            exMarkdownSelectImage.setAttribute('data-filename', files[0])
          }
        })
    })

    document.getElementById('exMarkdownInsertImageFromModalButton').addEventListener('click', () => {
      // Collect the details and format the Markdown image string
      const filename = document.getElementById('exMarkdownSelectImage').getAttribute('data-filename')

      if ((filename == null) || filename === '') {
        document.getElementById('exMarkdownSelectImageNoImageWarning').style.display = 'block'
        return
      }

      const caption = document.getElementById('exMarkdownSelectImageCaption').value
      const alignment = document.getElementById('exMarkdownSelectImageAlignmentSelect').value
      const size = document.getElementById('exMarkdownSelectImageSizeSelect').value

      this.tinyMDE.paste(`![${alignment} ${size}](content/${filename} "${caption}")`, anchor, focus)
      modalInstance.hide()
      modalElement.remove()
    })

    // Add an event listener that will remove the modal from the DOM when it’s fully hidden.
    modalElement.addEventListener('hidden.bs.modal', () => {
      this.tinyMDE.setSelection(focus)
      modalElement.remove()
    })

    // Show the modal.
    modalInstance.show()
  }

  /**
   * Adds a snapshot of the content to the undo cache.
   * @param {string} content - The current content.
   * @param {*} focus - The current selection/focus.
   * @param {boolean} [fromRedo] - If true, add the entry twice to maintain order.
   */
  appendToUndo (content, focus, fromRedo) {
    this.lastUndoCacheUpdate = new Date()
    const entry = { content, position: focus }
    this.undoCache.push(entry)
    if (this.undoCache.length > undoCacheLimit) {
      this.undoCache.shift()
    }
  }

  /**
   * Adds a snapshot to the redo cache.
   * @param {string} content - The current content.
   * @param {*} focus - The current selection/focus.
   */
  appendToRedo (content, focus) {
    const entry = { content, position: focus }
    this.redoCache.push(entry)
    if (this.redoCache.length > undoCacheLimit) {
      this.redoCache.shift()
    }
  }

  /**
   * Reverts the editor to the previous state.
   */
  undo () {
    if (this.undoCache.length > 0) {
      this.undoDone = true
      let entry
      // Add the current state to the redo cache
      this.appendToRedo(this.tinyMDE.getContent(), this.tinyMDE.getSelection())

      // If text was added since the last undo, skip one entry; otherwise use the last entry.
      if (this.updateSinceUndo === true) {
        this.undoCache.pop()
        entry = this.undoCache.pop()
      } else {
        entry = this.undoCache.pop()
      }
      this.updateSinceUndo = false
      if (entry) {
        this.tinyMDE.setContent(entry.content)
        this.tinyMDE.setSelection(entry.position)
      }
    }
  }

  /**
   * Redoes an undone change.
   */
  redo () {
    if (this.redoCache.length > 0) {
      this.undoDone = true
      this.appendToUndo(this.tinyMDE.getContent(), this.tinyMDE.getSelection(), true)
      const entry = this.redoCache.pop()
      this.updateSinceUndo = false
      if (entry) {
        this.tinyMDE.setContent(entry.content)
        this.tinyMDE.setSelection(entry.position)
      }
    }
  }
}

export function formatText (inputStr, options = {}) {
  // Take a string of Markdown-formatted text and return a dom object containing
  // the formatted text.
  // Set options.removeParagraph to remove the enclosing <p> element from short texts

  const outputStr = markdownConverter.makeHtml(inputStr)
  let el = document.createElement('div')
  el.innerHTML = outputStr
  if ((options?.removeParagraph || false) === true) {
    el = el?.firstElementChild || el
  }
  if ((options?.string || false) === true) return el.innerHTML
  return el
}
