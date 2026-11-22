// The Exhibitera Core API for apps shown by Exhibitera Apps' Custom App. Copy this file into your app's folder and
// import it as an ES module.
//
// Inside a Custom App, it reaches Exhibitera through the Custom App page. It also works elsewhere: in the setup
// page's preview, settings come from the definition being edited, and when your app is opened on its own, raw text
// is saved with Exhibitera Apps directly and activity isn't reported.

function exhibitera () {
  // Return Exhibitera Apps' shared code from the page showing this app, or null if there isn't one

  try {
    if (window.parent == null || window.parent === window) return null
    return window.parent.exCommon ?? null
  } catch {
    // The browser doesn't let a page from another website reach the page showing it
    return null
  }
}

async function sendRequest (options, local) {
  // Send a Core API request to Exhibitera Apps, or to Hub if local is false and Apps uses Hub

  const common = exhibitera()
  if (common == null) {
    // Not in a Custom App, so ask Exhibitera Apps directly. Apps serves this app, so it has the same address.
    const init = { method: options.method }
    if (options.params != null) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify(options.params)
    }
    const response = await fetch(options.api + options.endpoint, init)
    return await response.json()
  }

  if (local === true || common.config?.standalone === true) return await common.makeHelperRequest(options)
  return await common.makeServerRequest(options)
}

export function getDefinitionProperties () {
  // Retrieve an object with any key-value pairs set in the definition.
  // Keys and values will always be strings

  return exhibitera()?.config?.definition?.properties ?? {}
}

export function setInteraction (currentlyActive = true) {
  // Tell Exhibitera whether a visitor is using the app: true when one starts, and false when the app returns to
  // its attractor. Outside a Custom App, there's nothing to tell.

  const common = exhibitera()
  if (common?.config != null) common.config.currentInteraction = currentlyActive
}

export async function writeRawText (name, text, mode = 'a', local = true) {
  // Send text to Exhibitera to be saved to disk, and return whether it was saved, as { success, reason }
  // `name` should be the filename to create with no extention
  // `text` should be the raw text to be written
  // `mode` of 'a' means append to the existing text, while 'w' means overwrite
  // If `local` is false, send the data to Hub if it is in use (this allows data
  // to be aggregated between multiple app instances)

  const options = {
    method: 'POST',
    endpoint: '/data/' + name + '/rawText',
    api: '/core',
    params: { mode, text }
  }
  try {
    return await sendRequest(options, local)
  } catch (error) {
    console.warn('writeRawText: Unable to save text.', error)
    return { success: false, reason: String(error) }
  }
}

export async function getRawText (name, local = true) {
  // Retrieve raw text stored by Exhibitera, or '' if it can't be
  // `name` should the a filename previously set by writeRawText()

  const options = {
    method: 'GET',
    endpoint: '/data/' + name + '/rawText',
    api: '/core'
  }
  try {
    const result = await sendRequest(options, local)
    if (result?.success) return result.text
    console.warn('getRawText: Unable to retrieve text. Reason:', result?.reason)
  } catch (error) {
    console.warn('getRawText: Unable to retrieve text.', error)
  }
  return ''
}
