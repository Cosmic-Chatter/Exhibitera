/* global TinyMDE */
// Create rich markdown editors for setup pages.

import * as exFileSelect from './exhibitera_file_select_modal.js'

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
      options.commandDiv == null ||
      options.callback == null
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
    const defaultCommands = [
      { name: 'bold', innerHTML: 'B' },
      'italic',
      '|',
      'h1',
      'h2',
      '|',
      'ul',
      'ol',
      'blockquote',
      '|',
      { name: 'insertImage', action: this.insertImage.bind(this) },
      '|',
      { name: 'undo', action: this.undo.bind(this), innerHTML: '↺' },
      { name: 'redo', action: this.redo.bind(this), innerHTML: '↻' }
    ]
    const commands = options.commands || defaultCommands

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
        this.options.callback(event.content)
      }, timerThreshold)
    } else {
      this.options.callback(event.content)
    }
  }

  /**
   * Prompts the user to select an image and then inserts a Markdown-formatted image.
   */
  insertImage () {
    const focus = this.tinyMDE.getSelection()
    const anchor = this.tinyMDE.getSelection(true)

    exFileSelect
      .createFileSelectionModal({
        filetypes: ['image'],
        manage: false,
        multiple: false
      })
      .then((files) => {
        if (files.length !== 0) {
          console.log('here', files[0])
          this.tinyMDE.paste(`![left](content/${files[0]} "Caption")`, anchor, focus)
        }
      })
  }

  /**
   * Adds a snapshot of the content to the undo cache.
   * @param {string} content - The current content.
   * @param {*} focus - The current selection/focus.
   * @param {boolean} [fromRedo] - If true, add the entry twice to maintain order.
   */
  appendToUndo (content, focus, fromRedo) {
    console.log('appendToUndo', this.undoCache.length)
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
    console.log('appendToRedo', this.redoCache.length)
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
