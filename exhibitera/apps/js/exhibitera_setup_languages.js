/* global bootstrap */

// Manage the addition of languages for definitions

import * as exUtilities from '../../common/utilities.js'
import * as exSetup from './exhibitera_setup_common.js'

export const config = {
  languages: [
    { code: 'af', name: 'Afrikaans', name_en: 'Afrikaans' },
    { code: 'sq', name: 'Shqip', name_en: 'Albanian' },
    { code: 'ar-dz', name: 'عربي', name_en: 'Arabic (Algeria)' },
    { code: 'ar-eg', name: 'عربي', name_en: 'Arabic (Egypt)' },
    { code: 'ar-iq', name: 'عربي', name_en: 'Arabic (Iraq)' },
    { code: 'ar-sa', name: 'عربي', name_en: 'Arabic (Saudi Arabia)' },
    { code: 'ar-ae', name: 'عربي', name_en: 'Arabic (U.A.E.)' },
    { code: 'bn', name: 'বাংলা', name_en: 'Bengali' },
    { code: 'bg', name: 'български език', name_en: 'Bulgarian' },
    { code: 'ca', name: 'Català', name_en: 'Catalan' },
    { code: 'zh', name: '中国人', name_en: 'Chinese (China)' },
    { code: 'zh-tw', name: '中国人', name_en: 'Chinese (Taiwan)' },
    { code: 'hr', name: 'Hrvatski', name_en: 'Croatian' },
    { code: 'cs', name: 'Čeština', name_en: 'Czech' },
    { code: 'da', name: 'Dansk', name_en: 'Danish' },
    { code: 'nl', name: 'Nederlands', name_en: 'Dutch' },
    { code: 'en-au', name: 'English', name_en: 'English (Australia)' },
    { code: 'en-nz', name: 'English', name_en: 'English (New Zealand)' },
    { code: 'en-gb', name: 'English', name_en: 'English (U.K.)' },
    { code: 'en-us', name: 'English', name_en: 'English (U.S.)' },
    { code: 'et', name: 'Eesti keel', name_en: 'Estonian' },
    { code: 'fi', name: 'Suomi', name_en: 'Finnish' },
    { code: 'fr', name: 'Français', name_en: 'French' },
    { code: 'de', name: 'Deutsch', name_en: 'German' },
    { code: 'el', name: 'Ελληνικά', name_en: 'Greek' },
    { code: 'he', name: 'עִברִית', name_en: 'Hebrew' },
    { code: 'hi', name: 'हिंदी', name_en: 'Hindi' },
    { code: 'hu', name: 'Magyar nyelv', name_en: 'Hungarian' },
    { code: 'is', name: 'Íslenskur', name_en: 'Icelandic' },
    { code: 'id', name: 'Bahasa Indonesia', name_en: 'Indonesian' },
    { code: 'ga', name: 'Gaeilge', name_en: 'Irish' },
    { code: 'gd', name: 'Gàidhlig', name_en: 'Scottish Gaelic' },
    { code: 'it', name: 'Italiano', name_en: 'Italian' },
    { code: 'jp', name: '日本語', name_en: 'Japanese' },
    { code: 'kr', name: '한국인', name_en: 'Korean' },
    { code: 'lv', name: 'Latviešu valoda', name_en: 'Latvian' },
    { code: 'lt', name: 'Lietuvių kalba', name_en: 'Lithuanian' },
    { code: 'ms', name: 'بهاس ملايو', name_en: 'Malay' },
    { code: 'mt', name: 'Malti', name_en: 'Maltese' },
    { code: 'no', name: 'Norsk', name_en: 'Norwegian' },
    { code: 'fa', name: 'فارسی', name_en: 'Persian' },
    { code: 'pl', name: 'Polski', name_en: 'Polish' },
    { code: 'pt', name: 'Português', name_en: 'Portuguese (Portugal)' },
    { code: 'pt-br', name: 'Português', name_en: 'Portuguese (Brazil)' },
    { code: 'pa', name: 'Português', name_en: 'Punjabi' },
    { code: 'ro', name: 'Limba română', name_en: 'Romanian' },
    { code: 'ru', name: 'Русский', name_en: 'Russian' },
    { code: 'sr', name: 'Cрпски језик', name_en: 'Serbian' },
    { code: 'sk', name: 'Slovenčina', name_en: 'Slovak' },
    { code: 'sl', name: 'Slovenščina', name_en: 'Slovene' },
    { code: 'es-mx', name: 'Español', name_en: 'Spanish (Mexico)' },
    { code: 'es', name: 'Español', name_en: 'Spanish (Spain)' },
    { code: 'sv', name: 'Svenska', name_en: 'Swedish' },
    { code: 'th', name: 'ภาษาไทย', name_en: 'Thai' },
    { code: 'ts', name: 'Xitsonga', name_en: 'Tsonga' },
    { code: 'tn', name: 'Setswana', name_en: 'Tswana' },
    { code: 'tr', name: 'Türkçe', name_en: 'Turkish' },
    { code: 'uk', name: 'українська мова', name_en: 'Ukrainian' },
    { code: 'ur', name: 'اردو', name_en: 'Urdu' },
    { code: 'vi', name: 'Tiếng Việt', name_en: 'Vietnamese' },
    { code: 'cy', name: 'Cymraeg', name_en: 'Welsh' },
    { code: 'xh', name: 'IsiXhosa', name_en: 'Xhosa' },
    { code: 'zu', name: 'IsiXhosa', name_en: 'Zulu' }
  ]
}

export function createLanguagePicker (parent, callbacks = {}) {
  // Populate language picker into the given div

  // callbacks is an object with the following fields:
  // callbacks = {
  //              onLanguageAdd:     function(code, displayName, englishName),
  //              onLanguageDelete:  function(languageOrder),
  //              onLanguageReorder: function(languageOrder),
  //              onLanguageRebuild: function(languageOrder),
  //             }

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const uuid = exUtilities.uuid()
  parent.innerHTML = ''

  const row = document.createElement('div')
  row.classList = 'row gy-2 align-items-end'
  parent.appendChild(row)

  const languageSelectCol = document.createElement('div')
  languageSelectCol.classList = 'col-12 col-md-8 col-lg-6'
  row.appendChild(languageSelectCol)

  const languageSelect = document.createElement('select')
  languageSelect.classList = 'form-select'

  // Populate all available languages, plus an other option
  for (const lang of config.languages) {
    const option = new Option(lang.name_en, lang.code)
    languageSelect.appendChild(option)
  }
  const option = new Option('Other', 'other')
  languageSelect.appendChild(option)
  languageSelect.value = 'en-gb'

  languageSelectCol.appendChild(languageSelect)

  // Language code input
  const languageCodeInputCol = document.createElement('div')
  languageCodeInputCol.classList = 'col-12 col-md-6 custom-lang-col_' + uuid
  languageCodeInputCol.style.display = 'none'
  languageCodeInputCol.innerHTML = `
    <label for="languageCodeInput_${uuid}" class="form-label">
      Language code
      <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="The unique ISO 639-1 code for the language. E.g., de for German." style="font-size: 0.55em;">?</span>
    </label>
    `
  row.appendChild(languageCodeInputCol)

  const languageCodeInput = document.createElement('input')
  languageCodeInput.classList = 'form-control '
  languageCodeInput.setAttribute('type', 'text')
  languageCodeInput.setAttribute('id', 'languageCodeInput_' + uuid)
  languageCodeInputCol.appendChild(languageCodeInput)

  // Display name input
  const languageDisplayNameInputCol = document.createElement('div')
  languageDisplayNameInputCol.classList = 'col-12 col-md-6 custom-lang-col_' + uuid
  languageDisplayNameInputCol.style.display = 'none'
  languageDisplayNameInputCol.innerHTML = `
    <label for="languageDisplayNameInput_${uuid}" class="form-label">
      Display name
      <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="The name of the language in that language. E.g., Deutsch for German." style="font-size: 0.55em;">?</span>
    </label>
    `
  row.appendChild(languageDisplayNameInputCol)

  const languageDisplayNameInput = document.createElement('input')
  languageDisplayNameInput.classList = 'form-control '
  languageDisplayNameInput.setAttribute('type', 'text')
  languageDisplayNameInput.setAttribute('id', 'languageDisplayNameInput_' + uuid)
  languageDisplayNameInputCol.appendChild(languageDisplayNameInput)

  // English name input
  const languageEnglishNameInputCol = document.createElement('div')
  languageEnglishNameInputCol.classList = 'col-12 col-md-6 custom-lang-col_' + uuid
  languageEnglishNameInputCol.style.display = 'none'
  languageEnglishNameInputCol.innerHTML = `
    <label for="languageDisplayNameInput_${uuid}" class="form-label">
      English name
      <span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="The English name of the language." style="font-size: 0.55em;">?</span>
    </label>
    `
  row.appendChild(languageEnglishNameInputCol)

  const languageEnglishNameInput = document.createElement('input')
  languageEnglishNameInput.classList = 'form-control '
  languageEnglishNameInput.setAttribute('type', 'text')
  languageEnglishNameInput.setAttribute('id', 'languageEnglishNameInput_' + uuid)
  languageEnglishNameInputCol.appendChild(languageEnglishNameInput)

  // Add button
  const addButtonCol = document.createElement('div')
  addButtonCol.classList = 'col-12 col-md-4 col-lg-2'
  row.appendChild(addButtonCol)

  const addButton = document.createElement('button')
  addButton.classList = 'btn btn-primary w-100'
  addButton.innerHTML = 'Add'
  addButtonCol.appendChild(addButton)

  const warningCol = document.createElement('div')
  warningCol.classList = 'col-12 mt-1'
  warningCol.style.display = 'none'
  warningCol.innerHTML = `
  <span class="text-danger">You must enter all fields to add a custom language.</span>
  `
  row.appendChild(warningCol)

  // Language list
  const languageListCol = document.createElement('div')
  languageListCol.classList = 'col-12'
  row.appendChild(languageListCol)

  const languageList = document.createElement('div')
  languageList.classList = 'row gy-2'
  languageListCol.appendChild(languageList)

  rebuildLanguageList(languageList, callbacks)

  // Bind event listeners

  // Toggle the other language column
  languageSelect.addEventListener('change', (ev) => {
    if (ev.target.value === 'other') {
      document.querySelectorAll('.custom-lang-col_' + uuid).forEach((el) => {
        el.style.display = 'block'
      })
    } else {
      document.querySelectorAll('.custom-lang-col_' + uuid).forEach((el) => {
        el.style.display = 'none'
        el.querySelector('input').value = ''
      })
      warningCol.style.display = 'none'
    }
  })

  // Add language button clicked
  addButton.addEventListener('click', (ev) => {
    let code = languageSelect.value

    // Don't add a language that already exists
    if (workingDefinition.language_order.includes(code)) return

    let displayName, displayNameEn
    if (code === 'other') {
      code = languageCodeInput.value.trim()
      displayName = languageDisplayNameInput.value.trim()
      displayNameEn = languageEnglishNameInput.value.trim()

      if ((code === '') || (displayName === '') || (displayNameEn === '')) {
        warningCol.style.display = 'block'
        return
      }
    } else {
      displayNameEn = getLanguageDisplayName(code, true)
      displayName = getLanguageDisplayName(code)
    }

    addLanguage(languageList, code, displayName, displayNameEn, callbacks)
    if (callbacks.onLanguageAdd) {
      callbacks.onLanguageAdd(code, displayName, displayNameEn)
    }
    // Reset fields
    languageSelect.value = 'en-gb'
    languageCodeInput.value = ''
    languageCodeInputCol.style.display = 'none'
    languageDisplayNameInput.value = ''
    languageDisplayNameInputCol.style.display = 'none'
    languageEnglishNameInput.value = ''
    languageEnglishNameInputCol.style.display = 'none'
    warningCol.style.display = 'none'
  })
}

export function clearLanguagePicker (el) {
  // Erase the content for the given language picker

  el.innerHTML = ''
}
export function getLanguageDisplayName (langCode, en = false) {
  // Return the display name for the given language code.
  // By default, the name will be returned in that language.

  const lang = config.languages.find(({ code }) => code === langCode)

  if (lang == null) return langCode
  if (en === true) return lang.name_en
  return lang.name
}

function createLanguageHTML (languageList, code, displayName, englishName, isDefault = false, callbacks = {}) {
  // Create the HTML representation of a language.

  // Compatability with Ex5.2 and below
  englishName = getLanguageDisplayName(code, true)

  const col = document.createElement('div')
  col.classList = 'col-12'

  const card = document.createElement('div')
  card.classList = 'card'
  col.appendChild(card)

  const cardBody = document.createElement('div')
  cardBody.classList = 'card-body row gy-2 d-flex align-items-center p-2'
  card.appendChild(cardBody)

  const englishNameCol = document.createElement('div')
  englishNameCol.classList = 'col-12 col-lg-6'
  cardBody.appendChild(englishNameCol)

  const englishNameDiv = document.createElement('div')
  englishNameDiv.innerHTML = englishName
  englishNameCol.appendChild(englishNameDiv)

  if (isDefault === true) {
    const badge = document.createElement('span')
    badge.classList = 'badge text-bg-secondary ms-2'
    badge.innerHTML = 'Default'
    englishNameDiv.appendChild(badge)
  }

  const orderButtonLeftCol = document.createElement('div')
  orderButtonLeftCol.classList = 'col-4 col-lg-2'
  cardBody.appendChild(orderButtonLeftCol)

  const orderButtonLeft = document.createElement('button')
  orderButtonLeft.classList = 'btn btn-info btn-sm w-100'
  orderButtonLeft.innerHTML = '▲'
  orderButtonLeft.addEventListener('click', (event) => {
    changeLanguageOrder(languageList, code, -1, callbacks)
  })
  orderButtonLeftCol.appendChild(orderButtonLeft)

  const orderButtonRightCol = document.createElement('div')
  orderButtonRightCol.classList = 'col-4 col-lg-2'
  cardBody.appendChild(orderButtonRightCol)

  const orderButtonRight = document.createElement('button')
  orderButtonRight.classList = 'btn btn-info btn-sm w-100'
  orderButtonRight.innerHTML = '▼'
  orderButtonRight.addEventListener('click', (event) => {
    changeLanguageOrder(languageList, code, 1, callbacks)
  })
  orderButtonRightCol.appendChild(orderButtonRight)

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-4 col-lg-2'
  cardBody.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm w-100'
  deleteButton.innerHTML = '×'
  deleteButton.setAttribute('data-bs-toggle', 'popover')
  deleteButton.setAttribute('data-bs-content', `<a id="fileDeletePopover_${code}" class="btn btn-danger w-100 test">Confirm</a>`)
  deleteButton.setAttribute('data-bs-trigger', 'focus')
  deleteButton.setAttribute('data-bs-html', 'true')
  deleteButton.setAttribute('title', 'Are you sure?')

  // Listen for when the popover is shown to attach the event to the confirmation link
  const popover = new bootstrap.Popover(deleteButton)
  deleteButton.addEventListener('shown.bs.popover', () => {
    const confirmLink = document.getElementById('fileDeletePopover_' + code)
    if (confirmLink) {
    // Remove any previously attached listener if necessary
      confirmLink.addEventListener('click', () => {
        deleteLanguage(languageList, code, callbacks)
        // Optionally, hide the popover after confirming
        popover.hide()
      }, { once: true }) // { once: true } ensures it only runs once
    }
  })
  deleteCol.appendChild(deleteButton)

  languageList.appendChild(col)
}

function changeLanguageOrder (languageList, code, dir, callbacks = {}) {
  // Move the language specified by code by dir places
  // dir = 1 means move down the list by one place; dir = -1 is moves up the list.
  // callback should take one parameter, language_order

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const arr = workingDefinition?.language_order || []

  const index = arr.indexOf(code)

  if (index === -1) return // code doesn't exist
  if (dir === 0) return // No motion

  if (dir < 1) {
    if (index === 0) return // Can't move higher
  } else {
    if (index >= arr.length - 1) return // Can't move lower
  }

  // Swap the element with the next one
  [arr[index], arr[index + dir]] = [arr[index + dir], arr[index]]

  workingDefinition.language_order = arr
  rebuildLanguageList(languageList, callbacks)
  if (callbacks.onLanguageReorder) callbacks.onLanguageReorder(arr)
  exSetup.previewDefinition(true)
}

function addLanguage (languageList, code, displayName, englishName, callbacks) {
  // Add a new language to the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')

  exSetup.updateWorkingDefinition(['languages', code], {
    code,
    display_name: displayName,
    english_name: englishName
  })
  definition.language_order.push(code)

  createLanguageHTML(languageList, code, displayName, englishName, definition.language_order.length === 1, callbacks)
  rebuildLanguageList(languageList, callbacks)
  if (callbacks.onLanguageAdd) callbacks.onLanguageAdd(code, displayName, englishName)
  exSetup.previewDefinition(true)
}

function deleteLanguage (languageList, code, callbacks = {}) {
  // Remove this language from the working defintion and destroy its GUI representation.
  // Callback should take one parameter, language_order

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  delete workingDefinition.languages[code]
  workingDefinition.language_order = workingDefinition.language_order.filter(lang => lang !== code)

  rebuildLanguageList(languageList, callbacks)
  if (callbacks.onLanguageDelete) callbacks.onLanguageDelete(workingDefinition.language_order)
  exSetup.previewDefinition(true)
}

function rebuildLanguageList (languageList, callbacks = {}) {
  // Use the definition to rebuild the GUI representation for each language
  // and add it to the specified div, which should be a DOM element

  const def = $('#definitionSaveButton').data('workingDefinition')
  if (def == null) return
  languageList.innerHTML = ''
  let i = 0
  for (const code of (def?.language_order || [])) {
    const lang = def.languages[code]
    createLanguageHTML(languageList, code, lang.display_name, lang.english_name, i === 0, callbacks)
    i++
  }
  if (callbacks.onLanguageRebuild) callbacks.onLanguageRebuild(def.language_order)
}
