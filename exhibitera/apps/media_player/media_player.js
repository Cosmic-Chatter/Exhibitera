import * as exCommon from '../js/exhibitera_app_common.js'

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
  // Take an object parsed from an INI string and use it to load a new set of contet

  exCommon.config.sourceList = []
  def.content_order.forEach((uuid) => {
    exCommon.config.sourceList.push(def.content[uuid])
  })

  // Backgorund settings
  const root = document.querySelector(':root')
  if ('style' in def && 'background' in def.style) {
    exCommon.setBackground(def.style.background, root, '#000', true)
  }

  // Watermark settings
  const watermarkEl = document.getElementById('watermark')
  if ('watermark' in def && 'file' in def.watermark && def.watermark.file !== '') {
    watermarkEl.style.display = 'block'
    watermarkEl.src = 'content/' + def.watermark.file

    if ('x_position' in def.watermark) {
      watermarkEl.style.left = String(def.watermark.x_position) + 'vw'
    } else {
      watermarkEl.style.left = '80vw'
    }
    if ('y_position' in def.watermark) {
      watermarkEl.style.top = String(def.watermark.y_position) + 'vh'
    } else {
      watermarkEl.style.top = '80vh'
    }
    if ('size' in def.watermark) {
      watermarkEl.style.height = String(def.watermark.size) + 'vh'
    } else {
      watermarkEl.style.height = '10vh'
    }
  } else {
    watermarkEl.style.display = 'none'
  }

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
  let filename
  if (('type' in source) === false || source.type === 'file') {
    filename = 'content/' + source.filename
  } else if (source.type === 'url') {
    filename = source.filename
  }

  if ('no_cache' in source && source.no_cache === true) {
    filename += (/\?/.test(filename) ? '&' : '?') + new Date().getTime()
  }

  // Split off the extension
  const split = source.filename.split('.')
  const ext = split[split.length - 1]

  if (['mp4', 'mpeg', 'm4v', 'webm', 'mov', 'ogv', 'mpg'].includes(ext.toLowerCase())) {
    // Video file
    clearTimeout(sourceAdvanceTimer) // Only used for pictures
    videoContainer.style.opacity = 1
    imageContainer.style.opacity = 0
    audio.pause()
    if (video.src !== filename) {
      video.pause()
      video.src = filename
      video.load()
      video.play()
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
  } else if (['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'heic', 'webp'].includes(ext.toLowerCase())) {
    // Image file
    video.pause()
    audio.pause()
    videoContainer.style.opacity = 0
    image.src = filename
    imageContainer.style.opacity = 1
    clearTimeout(sourceAdvanceTimer)
    sourceAdvanceTimer = setTimeout(gotoNextSource, source.duration * 1000)
  } else if (['aac', 'm4a', 'mp3', 'oga', 'ogg', 'weba', 'wav'].includes(ext.toLowerCase())) {
    // Audio file
    video.pause()
    videoContainer.style.opacity = 0
    imageContainer.style.opacity = 0

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
  }

  // Annotations

  // Remove existing
  document.querySelectorAll('.annotation').forEach(function (a) {
    a.remove()
  })
  if ('annotations' in source) {
    for (const key of Object.keys(source.annotations)) {
      const annotation = source.annotations[key]
      annotation.value = await fetchAnnotation(annotation)
      createAnnotation(annotation)
    }
  }
}

function createAnnotation (details) {
  // Render an annotation on the display.

  const annotation = document.createElement('div')
  annotation.classList = 'annotation'
  annotation.innerHTML = details.value
  annotation.style.position = 'absolute'

  let xPos, ypos
  if ('x_position' in details) {
    xPos = details.x_position
  } else xPos = 50
  annotation.style.left = xPos + 'vw'
  if ('y_position' in details) {
    ypos = details.y_position
  } else ypos = 50
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
        endpoint: '/content/' + details.file,
        noCache: true
      })
        .then((text) => {
          let subset = text
          for (const key of details.path) {
            subset = subset[key]
          }
          resolve(subset)
        })
        .catch(() => {
          reject(new Error('Bad file fetch'))
        })
    } else {
      $.getJSON(details.file, function (text) {
        let subset = text
        for (const key of details.path) {
          subset = subset[key]
        }
        resolve(subset)
      })
    }
  })
}

exCommon.config.activeIndex = 0 // Index of the file from the source list currently showing
exCommon.config.sourceList = []
exCommon.config.autoplayEnabled = true
exCommon.config.allowAudio = false

exCommon.configureApp({
  name: 'media_player',
  debug: true,
  loadDefinition,
  parseUpdate: updateParser
})

let currentDefintion = ''
let sourceAdvanceTimer = null // Will hold reference to a setTimeout instance to move to the next media.
