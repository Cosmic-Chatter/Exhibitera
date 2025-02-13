/* global TinyMDE */
// Create rich markdown editors for setup pages.

// Track the last time a change event was fired so that we don't call callbacks on every keystroke unless needed.

const threshold = 2000 // ms to wait before calling the callback
let timer = 0 // holds reference to setTimeout instance

export function createMarkdownEditor (options) {
  // Bind a tinyMDE editor and command bar to the provided divs
  // By default, the callback will only be called every interval of
  // threshold. To call the callback on every keystroke,
  // set options.limitCallbacks to false.

  if (options?.content == null || options?.editorDiv == null || options?.commandDiv == null || options?.callback == null) throw new Error('Missing required parameter')

  const tinyMDE = new TinyMDE.Editor({
    content: options.content,
    element: options.editorDiv
  })
  tinyMDE.addEventListener('change', (content, lineChanges) => {
    if ((options?.limitCallbacks || true) === true) {
      clearTimeout(timer)
      timer = setTimeout(() => { options.callback(content) }, threshold)
    } else {
      options.callback(content)
    }
  })

  const commandBar = new TinyMDE.CommandBar({
    element: options.commandDiv,
    editor: tinyMDE
  })
}
