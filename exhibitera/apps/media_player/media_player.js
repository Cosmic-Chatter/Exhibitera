/* global Js3dModelViewer */
import * as exFiles from '../../common/files.js'
import * as appsCommon from '../js/exhibitera_app_common.js'
import * as appsMarkdown from '../js/exhibitera_app_markdown.js'

function updateParser (update) {
  // Read updates specific to the media player

  if ('permissions' in update && 'audio' in update.permissions) {
    document.getElementById('fullscreenVideo').muted = !update.permissions.audio
    document.getElementById('audioPlayer').muted = !update.permissions.audio
  }
}

function loadDefinition (def) {
  // Take the definition and use it to load a new set of contet

  const root = document.querySelector(':root')

  appsCommon.config.definition = def
  appsCommon.config.sourceList = []
  def.content_order.forEach((uuid) => {
    appsCommon.config.sourceList.push(def.content[uuid])
  })

  // Create tne progress indicators
  const progressContainer = document.getElementById('progressContainer')
  const progressIndicator = document.getElementById('progressIndicator')
  progressIndicator.innerText = ''

  for (let i = 0; i < def.content_order.length; i++) {
    const dot = document.createElement('div')
    dot.classList = 'progress-dot'
    progressIndicator.appendChild(dot)
  }

  // Indicator position
  const posSplit = (def?.behavior?.progress_indicator?.position ?? 'bottom_left').split('_')
  const vertPos = posSplit[0]
  const horizPos = posSplit[1]

  if (vertPos === 'top') {
    progressContainer.style.top = 0
  } else {
    progressContainer.style.bottom = 0
  }
  if (horizPos === 'left') {
    progressContainer.classList.add('justify-content-start')
    progressContainer.classList.remove('justify-content-center')
    progressContainer.classList.remove('justify-content-end')
  } else if (horizPos === 'middle') {
    progressContainer.classList.add('justify-content-center')
    progressContainer.classList.remove('justify-content-start')
    progressContainer.classList.remove('justify-content-end')
  } else if (horizPos === 'right') {
    progressContainer.classList.add('justify-content-end')
    progressContainer.classList.remove('justify-content-start')
    progressContainer.classList.remove('justify-content-center')
  }

  // Indicator size
  const indicatorSize = parseFloat(def?.behavior?.progress_indicator?.size ?? 1)
  root.style.setProperty('--progress-indicator-size', indicatorSize)
  progressIndicator.style.width = 'max-content'

  // Indicator visibility
  if (def?.behavior?.progress_indicator?.visible ?? false) {
    progressContainer.style.display = 'flex'
  } else {
    progressContainer.style.display = 'none'
  }

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
  root.style.setProperty('--subtitleColor', '#f5f5f0')
  root.style.setProperty('--progressBackgroundColor', '#1a2b3cc4')
  root.style.setProperty('--progressActiveColor', '#c3512f')
  root.style.setProperty('--progressInactiveColor', '#6b7280')

  // Then, apply the definition settings
  Object.keys(def?.style?.color ?? []).forEach((key) => {
    document.documentElement.style.setProperty('--' + key, def.style.color[key])
  })
  appsCommon.setBackground(def?.style?.background ?? {}, root, '#0f1419', true)

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

  if (appsCommon.config.debug) {
    console.log('gotoSource', index)
  }

  if (index < appsCommon.config.sourceList.length) {
    appsCommon.config.activeIndex = index

    // Update the progress indicator to show the current progress
    const dots = document.querySelectorAll('.progress-dot')
    if (dots.length === 0) return
    for (const dot of dots) {
      dot.classList.remove('active')
      dot.innerText = ''
    }
    dots[index].classList.add('active')
    const fillEl = document.createElement('div')
    fillEl.classList = 'fill'
    dots[index].appendChild(fillEl)

    changeMedia(index)
  }
}

function gotoNextSource () {
  // Display the next file in sourceList, looping to the beginning if
  // necessary

  if (appsCommon.config.activeIndex + 1 >= appsCommon.config.sourceList.length) {
    appsCommon.config.activeIndex = 0
  } else {
    appsCommon.config.activeIndex += 1
  }

  gotoSource(appsCommon.config.activeIndex)
}

async function changeMedia (index) {
  // Load and play a media file given in source
  // delayPlay and playOnly are used when synchronizing multiple displays

  const source = appsCommon.config.sourceList[index]

  if (appsCommon.config.debug) {
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
    filename = appsCommon.config.helperAddress + '/content/' + source.filename
  } else if (source.type === 'url') {
    filename = source.filename
  }

  if ('no_cache' in source && source.no_cache === true) {
    filename += (/\?/.test(filename) ? '&' : '?') + new Date().getTime()
  }

  const mimetype = exFiles.guessMimetype(source.filename)
  if (['audio', 'image', 'model', 'video'].includes(mimetype) === false) {
    console.log(`File ${source.filename} has an invalid mimetype of ${mimetype}`)
  }

  // Split off the extension
  const split = source.filename.split('.')
  const ext = split[split.length - 1].toLowerCase()

  if (mimetype === 'video') {
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
    }
    video.play()
    video.style.objectFit = source?.fill_mode ?? 'contain'

    // Subtitles
    if (subtitleEl != null) subtitleEl.remove()
    if (source?.subtitles?.filename != null) {
      subtitleEl = document.createElement('track')
      subtitleEl.src = appsCommon.config.helperAddress + '/content/' + source.subtitles.filename
      video.appendChild(subtitleEl)
      video.textTracks[0].mode = 'showing'
    }
    if (appsCommon.config.sourceList.length > 1) { // Don't loop or onended will never fire
      video.loop = false
      video.onended = function () {
        if (appsCommon.config.autoplayEnabled === true) {
          gotoNextSource()
        } else {
          video.play()
        }
      }
    } else {
      video.loop = true
    }
  } else if (mimetype === 'image') {
    // Image file
    video.pause()
    audio.pause()
    videoContainer.style.opacity = 0
    modelContainer.style.opacity = 0
    image.src = filename

    image.style.objectFit = source?.fill_mode ?? 'contain'
    imageContainer.style.opacity = 1
    clearTimeout(sourceAdvanceTimer)
    sourceAdvanceTimer = setTimeout(gotoNextSource, source.duration * 1000)
    trackProgress(index, source.duration * 1000)
  } else if (mimetype === 'audio') {
    // Audio file
    video.pause()
    videoContainer.style.opacity = 0
    imageContainer.style.opacity = 0
    modelContainer.style.opacity = 0

    if (audio.src !== filename) {
      audio.pause()
      audio.src = filename
      audio.load()
    }
    audio.play()

    if (appsCommon.config.sourceList.length > 1) { // Don't loop or onended will never fire
      audio.loop = false
      audio.onended = function () {
        if (appsCommon.config.autoplayEnabled === true) {
          gotoNextSource()
        } else {
          audio.play()
        }
      }
    } else {
      audio.loop = true
    }
  } else if (mimetype === 'model') {
    // 3D model
    videoContainer.style.opacity = 0
    imageContainer.style.opacity = 0
    modelContainer.style.opacity = 1

    let backgroundColor = 'rgb(0, 0, 0)'
    if (appsCommon.config.definition.style.background.mode === 'color') {
      backgroundColor = appsCommon.config.definition.style.background.color
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
    trackProgress(index, source.duration * 1000)
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

function trackProgress (index, total, elapsed = 0) {
  // Track the progress of an image or model and update the progress dot

  clearTimeout(progressTimer)

  const activeDot = document.querySelector('.progress-dot.active .fill')
  const pct = (elapsed / total) * 100
  activeDot.style.width = `${pct}%`

  progressTimer = setTimeout(() => trackProgress(index, total, elapsed + 100), 100)
}

function createAnnotation (details) {
  // Render an annotation on the display.

  const annotation = document.createElement('div')
  annotation.classList = 'annotation text-center'
  annotation.innerHTML = appsMarkdown.formatText(String(details.value), { removeParagraph: true, string: true })
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
    annotation.style.fontFamily = appsCommon.createFont(details.font, details.font)
  } else {
    annotation.style.fontFamily = 'annotation-default'
  }
  annotation.style.color = details?.color ?? 'black'
  annotation.style.fontSize = (details?.font_size ?? '20') + 'px'

  document.body.appendChild(annotation)
}

function fetchAnnotation (details) {
  // Access the given file and retrieve the annotation.

  return new Promise((resolve, reject) => {
    if (details.type === 'file') {
      appsCommon.makeHelperRequest({
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

appsCommon.config.activeIndex = 0 // Index of the file from the source list currently showing
appsCommon.config.sourceList = []
appsCommon.config.autoplayEnabled = true
let subtitleEl = null

appsCommon.configureApp({
  name: 'media_player',
  debug: true,
  loadDefinition,
  parseUpdate: updateParser
})

const currentDefintion = ''
let sourceAdvanceTimer = null // Will hold reference to a setTimeout instance to move to the next media.
let progressTimer = null // Will track the progress of a source towards completion

// Bind event listeners
const video = document.getElementById('fullscreenVideo')
video.addEventListener('timeupdate', () => {
  clearTimeout(progressTimer)
  const activeDot = document.querySelector('.progress-dot.active .fill')
  const pct = (video.currentTime / video.duration) * 100
  activeDot.style.width = `${pct}%`
})
const audio = document.getElementById('audioPlayer')
audio.addEventListener('timeupdate', () => {
  clearTimeout(progressTimer)
  const activeDot = document.querySelector('.progress-dot.active .fill')
  const pct = (audio.currentTime / audio.duration) * 100
  activeDot.style.width = `${pct}%`
})
