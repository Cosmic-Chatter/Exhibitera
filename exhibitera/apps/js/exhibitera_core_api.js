export function getDefinitionProperties () {
  // Retrieve an object with any key-value pairs set in the definition.
  // Keys and values will always be strings

  return window.parent.exCommon.config.definition?.properties ?? {}
}

export function setInteraction (currentlyActive = true) {
  // Tell exCommon whether a user is currently interacting with the component

  window.parent.exCommon.config.currentInteraction = currentlyActive
}

export function writeRawText (name, text, mode = 'a') {
  // Send text to Exhibitera Apps to be saved to disk
  // `name` should be the filename to create with no extention
  // `text` should be the raw text to be written
  // `mode` of 'a' means append to the existing text, while 'w' means overwrite

  window.parent.exCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/data/' + name + '/rawText',
    api: '/core',
    params: { mode, text }
  })
}

export async function getRawText (name) {
  // Retrieve raw text stored by Exhibitera Apps
  // `name` should the a filename previously set by writeRawText()

  const result = await window.parent.exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/data/' + name + '/rawText',
    api: '/core'
  })

  if (result?.success) return result.text

  console.warn('getRawText: Unable to retrieve text. Reason:', result.reason)
  return ''
}
