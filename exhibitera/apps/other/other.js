import * as exCommon from '../js/exhibitera_app_common.js'

function updateParser (update) {
  // Read updates specific to the custom app interface

}

function loadDefinition (def) {
  // Take the definition and use it to load a new set of contet

  exCommon.config.definition = def
  if (def.path == null || def.path.trim() === '') return

  if ((def?.mode ?? 'advanced') === 'advanced') {
    // Load the given app; it will manage things from here
    window.location = '../' + def.path
  } else if (def.mode === 'basic') {
    document.getElementById('iframe').src = '../' + def.path
  } else if (def.mode === 'url' && def.url) {
    if (!/^https?:\/\//i.test(def.url)) {
      def.url = 'https://' + def.url
    }
    document.getElementById('iframe').src = def.url
  }
}

const currentDefintion = ''
exCommon.configureApp({
  name: 'other',
  debug: true,
  loadDefinition,
  parseUpdate: updateParser
})
