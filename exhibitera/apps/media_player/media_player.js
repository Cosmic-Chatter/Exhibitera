/* global Js3dModelViewer */
import * as exCommon from '../js/exhibitera_app_common.js'
import * as exMarkdown from '../js/exhibitera_app_markdown.js'

function updateParser (update) {
  // Read updates specific to the media player

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    exCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }

  if ('permissions' in update && 'audio' in update.permissions) {
    document.getElementById('fullscreenVideo').muted = !update.permissions.audio
    document.getElementById('audioPlayer').muted = !update.permissions.audio
  }
}

function loadDefinition (def) {
  // Take the definition and use it to load a new set of contet

  const root = document.querySelector(':root')

  exCommon.config.definition = def
  exCommon.config.sourceList = []
  def.content_order.forEach((uuid) => {
    exCommon.config.sourceList.push(def.content[uuid])
  })

  // Watermark settings
  const watermarkEl = document.getElementById('watermark')
  if ((def?.watermark?.file ?? '') !== '') {
    watermarkEl.style.display = 'block'
    watermarkEl.src = '../content/' + def.watermark.file

    watermarkEl.style.left = String(def?.watermark?.x_position ?? 80) + 'vw'
    watermarkEl.style.top = String(def?.watermark?.y_position ?? 80) + 'vh'
    watermarkEl.style.height = String(def?.watermark?.size ?? 10) + 'vh'
    watermarkEl.style.opacity = parseFloat(def?.watermark?.opacity) / 100 ?? 1
  } else {
    watermarkEl.style.display = 'none'
  }

  // Appearance settings

  // Color
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--subtitle-color', 'white')

  // Then, apply the definition settings
  Object.keys(def?.style?.color ?? []).forEach((key) => {
    console.log(def.style.color[key])
    document.documentElement.style.setProperty('--' + key, def.style.color[key])
  })
  exCommon.setBackground(def?.style?.background ?? {}, root, '#000', true)

  // Font

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--subtitle-font', 'subtitles-default')

  // Then, apply the definition settings
  Object.keys(def?.style?.font ?? []).forEach((key) => {
    const font = new FontFace(key, 'url(' + encodeURI(def.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  })

  // Text size
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--subtitle-font-adjust', 0)

  // Then, apply the definition settings
  Object.keys(def?.style?.text_size ?? []).forEach((key) => {
    const value = def.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  })

  gotoSource(0)
}

function gotoSource (index) {
  // Load the media file from the sourceList with the given index

  // Make sure the index is an integer
  index = parseInt(index)

  if (exCommon.config.debug) {
    console.log('gotoSource', index)
  }

  if (index < exCommon.config.sourceList.length) {
    exCommon.config.activeIndex = index
    changeMedia(exCommon.config.sourceList[index])
  }
}

function gotoNextSource () {
  // Display the next file in sourceList, looping to the beginning if
  // necessary

  if (exCommon.config.activeIndex + 1 >= exCommon.config.sourceList.length) {
    exCommon.config.activeIndex = 0
  } else {
    exCommon.config.activeIndex += 1
  }

  gotoSource(exCommon.config.activeIndex)
}

async function changeMedia (source) {
  // Load and play a media file given in source
  // delayPlay and playOnly are used when synchronizing multiple displays

  if (exCommon.config.debug) {
    console.log('changeMedia', source)
  }

  const video = document.getElementById('fullscreenVideo')
  const videoContainer = document.getElementById('videoOverlay')
  const image = document.getElementById('fullscreenImage')
  const imageContainer = document.getElementById('imageOverlay')
  const audio = document.getElementById('audioPlayer')
  const model = document.getElementById('modelViewer')
  const modelContainer = document.getElementById('modelOverlay')

  let filename
  if (('type' in source) === false || source.type === 'file') {
    filename = exCommon.config.helperAddress + '/content/' + source.filename
  } else if (source.type === 'url') {
    filename = source.filename
  }

  if ('no_cache' in source && source.no_cache === true) {
    filename += (/\?/.test(filename) ? '&' : '?') + new Date().getTime()
  }

  // Split off the extension
  const split = source.filename.split('.')
  const ext = split[split.length - 1].toLowerCase()

  if (['mp4', 'mpeg', 'm4v', 'webm', 'mov', 'ogv', 'mpg'].includes(ext)) {
    // Video file
    clearTimeout(sourceAdvanceTimer) // Only used for pictures
    videoContainer.style.opacity = 1
    imageContainer.style.opacity = 0
    modelContainer.style.opacity = 0
    audio.pause()
    if (video.src !== filename) {
      video.pause()
      video.src = filename
      video.load()
      video.play()
    }
    // Subtitles
    if (subtitleEl != null) subtitleEl.remove()
    if (source?.subtitles?.filename != null) {
      subtitleEl = document.createElement('track')
      subtitleEl.src = exCommon.config.helperAddress + '/content/' + source.subtitles.filename
      video.appendChild(subtitleEl)
      video.textTracks[0].mode = 'showing'
    }
    if (exCommon.config.sourceList.length > 1) { // Don't loop or onended will never fire
      video.loop = false
      video.onended = function () {
        if (exCommon.config.autoplayEnabled === true) {
          gotoNextSource()
        } else {
          video.play()
        }
      }
    } else {
      video.loop = true
    }
  } else if (['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'heic', 'webp'].includes(ext)) {
    // Image file
    video.pause()
    audio.pause()
    videoContainer.style.opacity = 0
    modelContainer.style.opacity = 0
    image.src = filename
    imageContainer.style.opacity = 1
    clearTimeout(sourceAdvanceTimer)
    sourceAdvanceTimer = setTimeout(gotoNextSource, source.duration * 1000)
  } else if (['aac', 'm4a', 'mp3', 'oga', 'ogg', 'weba', 'wav'].includes(ext)) {
    // Audio file
    video.pause()
    videoContainer.style.opacity = 0
    imageContainer.style.opacity = 0
    modelContainer.style.opacity = 0

    if (audio.src !== filename) {
      audio.pause()
      audio.src = filename
      audio.load()
      audio.play()
    }
    if (exCommon.config.sourceList.length > 1) { // Don't loop or onended will never fire
      audio.loop = false
      audio.onended = function () {
        if (exCommon.config.autoplayEnabled === true) {
          gotoNextSource()
        } else {
          audio.play()
        }
      }
    } else {
      audio.loop = true
    }
  } else if (['obj', 'glb'].includes(ext)) {
    // 3D model
    videoContainer.style.opacity = 0
    imageContainer.style.opacity = 0
    modelContainer.style.opacity = 1

    let backgroundColor = 'rgb(0, 0, 0)'
    if (exCommon.config.definition.style.background.mode === 'color') {
      backgroundColor = exCommon.config.definition.style.background.color
    }

    const scene = Js3dModelViewer.prepareScene(model, {
      grid: false,
      background: backgroundColor,
      trackball: false
    })

    let time = source.duration * 1000
    const rotateMesh = (mesh) => {
      mesh.rotateY(source.rotations * 2 * Math.PI / 60 / source.duration)
      time = time - 16.67
      if (time > 0) { setTimeout(() => { rotateMesh(mesh) }, 16.67) }
    }

    let material = null
    if (('material' in source) && (source.material !== '') && (source.material != null)) material = '/content/' + source.material

    if (ext === 'obj') {
      Js3dModelViewer.loadObject(scene, filename, material, (mesh) => {
        if (source.rotations > 0) {
          rotateMesh(mesh)
        }
      })
    } else if (ext === 'glb') {
      Js3dModelViewer.loadGlb(scene, filename, (mesh) => {
        if (source.rotations) {
          rotateMesh(mesh.scene)
        }
      })
    }
    clearTimeout(sourceAdvanceTimer)
    sourceAdvanceTimer = setTimeout(() => {
      gotoNextSource()
      setTimeout(() => {
        document.getElementById('modelViewer').innerHTML = ''
      }, 500)
    }, source.duration * 1000)
  }

  // Annotations

  // Remove existing
  document.querySelectorAll('.annotation').forEach(function (a) {
    a.remove()
  })
  for (const key of Object.keys(source?.annotations ?? {})) {
    const annotation = source.annotations[key]
    if (['file', 'url'].includes(annotation.type)) {
      annotation.value = await fetchAnnotation(annotation)
    } else annotation.value = annotation.text
    createAnnotation(annotation)
  }
}

function createAnnotation (details) {
  // Render an annotation on the display.

  const annotation = document.createElement('div')
  annotation.classList = 'annotation'
  annotation.innerHTML = exMarkdown.formatText(String(details.value), { removeParagraph: true, string: true })
  annotation.style.position = 'absolute'

  const xPos = details?.x_position ?? 50
  annotation.style.left = xPos + 'vw'

  const ypos = details?.y_position ?? 50
  annotation.style.top = ypos + 'vh'

  if ('align' in details) {
    if (details.align === 'center') annotation.classList.add('align-center')
    if (details.align === 'right') annotation.classList.add('align-right')
  }

  if ('font' in details) {
    annotation.style.fontFamily = exCommon.createFont(details.font, details.font)
  } else {
    annotation.style.fontFamily = 'annotation-default'
  }
  if ('color' in details) {
    annotation.style.color = details.color
  } else {
    annotation.style.color = 'black'
  }
  if ('font_size' in details) {
    annotation.style.fontSize = details.font_size + 'px'
  } else {
    annotation.style.fontSize = '20px'
  }

  document.body.appendChild(annotation)
}

function fetchAnnotation (details) {
  // Access the given file and retrieve the annotation.

  return new Promise((resolve, reject) => {
    if (details.type === 'file') {
      exCommon.makeHelperRequest({
        method: 'GET',
        api: '',
        endpoint: '/content/' + details.file,
        noCache: true
      })
        .then((text) => {
          let subset = text
          for (const key of details.path) {
            subset = subset[key]
          }
          resolve(String(subset))
        })
        .catch(() => {
          reject(new Error('Bad file fetch'))
        })
    } else {
      fetch(details.file)
        .then(response => {
          if (!response.ok) throw new Error('Network response was not ok')
          return response.json()
        })
        .then(text => {
          let subset = text
          for (const key of details.path) {
            subset = subset[key]
          }
          resolve(String(subset))
        })
        .catch(error => {
          console.error('Error fetching JSON:', error)
        })
    }
  })
}

exCommon.config.activeIndex = 0 // Index of the file from the source list currently showing
exCommon.config.sourceList = []
exCommon.config.autoplayEnabled = true
let subtitleEl = null

exCommon.configureApp({
  name: 'media_player',
  debug: true,
  loadDefinition,
  parseUpdate: updateParser
})

let currentDefintion = ''
let sourceAdvanceTimer = null // Will hold reference to a setTimeout instance to move to the next media.
