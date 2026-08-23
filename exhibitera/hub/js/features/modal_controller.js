import * as exUtilities from '../../../common/utilities.js'

export class ModalController {
  // Manage the state of the given modal

  constructor ({ id, defaultFields = [], warningIDs = [] }) {
    this.id = id
    this.el = document.getElementById(id)
    this.defaultFields = defaultFields // [{ id, value }]
    this.warningIDs = warningIDs
  }

  reset () {
    // Set the modal to its default state

    for (const { id, value } of this.defaultFields) {
      this._setFieldValue(id, value)
    }
    for (const id of this.warningIDs) {
      document.getElementById(id).style.display = 'none'
    }
  }

  showWarning (id) {
    document.getElementById(id).style.display = 'block'
  }

  hideWarning (id) {
    document.getElementById(id).style.display = 'none'
  }

  setData (key, value) {
    this.el.dataset[key] = value
  }

  getData (key) {
    return this.el.dataset[key]
  }

  show () {
    exUtilities.showModal('#' + this.id)
  }

  hide () {
    exUtilities.hideModal('#' + this.id)
  }

  populate (fields = []) {
    // Set the modal's fields to the given values
    // fields = [{id: '', value: ''}, ...]

    for (const { id, value } of fields) {
      this._setFieldValue(id, value)
    }
  }

  _setFieldValue (id, value) {
    // Set a single field's value, handling multi-select elements
    // (where value is an array of selected option values)

    const el = document.getElementById(id)

    if (Array.isArray(value)) {
      const values = value.map(String)
      for (const option of el.options) {
        option.selected = values.includes(option.value)
      }
    } else {
      el.value = value
    }
  }

  setTitle (value) {
    document.getElementById(this.id + 'Title').innerText = value
  }
}
