import * as exCommon from '../js/exhibitera_app_common.js'

function updateFunc (update) {
  // Function to parse timelapse-specific updates

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    exCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (definition) {
  // Receive a definition in the form of an object and set up the viewer appropriately.

  const root = document.querySelector(':root')

  if ('files' in definition) {
    updateSourceList(definition.files)
  }
  if ('animation_duration' in definition.behavior) {
    animationCustomDuration = parseFloat(definition.behavior.animation_duration)
  } else {
    animationCustomDuration = null
  }
  if ('attractor_timeout' in definition.attractor) {
    attractorTimeout = parseFloat(definition.attractor.attractor_timeout * 1000)
  } else {
    attractorTimeout = 30000
  }
  if ('use_attractor' in definition.attractor) {
    attractorAvailable = definition.attractor.use_attractor
  } else {
    attractorAvailable = false
  }
  if ('use_finger_animation' in definition.attractor) {
    showFingerAnimation = definition.attractor.use_finger_animation
  } else {
    showFingerAnimation = true
  }
  if ('attractor_background' in definition.attractor) {
    root.style.setProperty('--attractor-background', definition.attractor.attractor_background)
  } else {
    root.style.setProperty('--attractor-background', 'rgba(0, 0, 0, 0.2)')
  }
  if ('attractor_height' in definition.attractor) {
    root.style.setProperty('--attractor-height', parseFloat(definition.attractor.attractor_height))
  } else {
    root.style.setProperty('--attractor-height', 70)
  }
  if ('font_adjust' in definition.attractor) {
    root.style.setProperty('--attractor-font-adjust', parseFloat(definition.attractor.font_adjust))
  } else {
    root.style.setProperty('--attractor-font-adjust', 0)
  }
  if ('font' in definition.attractor) {
    const font = new FontFace('attractor-font', 'url(' + encodeURI(definition.attractor.font) + ')')
    document.fonts.add(font)
    root.style.setProperty('--attractor-font', 'attractor-font')
  } else {
    root.style.setProperty('--attractor-font', 'attractor-default')
  }
  if ('text' in definition.attractor) {
    document.getElementById('attractor').innerHTML = definition.attractor.text
  } else {
    document.getElementById('attractor').innerHTML = ''
  }
  if ('text_color' in definition.attractor) {
    root.style.setProperty('--attractor-text-color', definition.attractor.text_color)
  } else {
    root.style.setProperty('--attractor-text-color', 'white')
  }

  // Backgorund settings
  if ('background' in definition.style) {
    exCommon.setBackground(definition.style.background, root, '#22222E', true)
  }

  showAttractor()
  // Send a thumbnail to the helper
  setTimeout(() => exCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 1000)
}

function updateSourceList (matchString) {
  // Given a string containing a wildcard expression (*), retrieve all the available content
  // and set the source to only the matching files.

  exCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((content) => {
      sourceList = content.all_exhibits.filter(
        item => new RegExp('^' + matchString.replace(/\*/g, '.*') + '$').test(item)
      ).sort(function (a, b) {
        return a.localeCompare(b)
      })
      sourceListLength = sourceList.length
      if (sourceListLength === 0) {
        continueAnimating = false
        return
      }
      activeSourceIndex = 0
      displayImage(sourceList[0])
      if (continueAnimating) {
        animateTimelapse()
      }
    })
}

function handleTouchStart (event, touch = true) {
  hideAttractor()
  exCommon.config.currentInteraction = true

  if (touch) {
    touchStartX = event.touches[0].clientX
  } else {
    // Mouse input
    touchStartX = event.clientX
    currentClick = true
  }
}

function handleTouchEnd (event) {
  lastTouchX = null
  currentClick = false
}

function handleTouchMove (event, touch = true) {
  exCommon.config.currentInteraction = true
  if (touch === true && event.touches.length > 1) {
    event.preventDefault()
    return
  }

  let pos
  let dx
  let dist
  if (touch) {
    pos = event.touches[0].clientX
  } else {
    // Mouse input
    if (currentClick) {
      pos = event.clientX
    } else {
      return
    }
  }

  if (lastTouchX != null) {
    dx = pos - lastTouchX
    dist = Math.abs(pos - touchStartX)

    if (dist > window.innerWidth / 25) {
      // Advance the image and reset the starting point.
      touchStartX = pos

      const touchVelocity = Math.abs(1000 * dx / window.innerWidth)

      let sourceIncrement
      if (touchVelocity < 10) {
        // Slow touch
        if (sourceListLength < 100) {
          sourceIncrement = 1
        } else if (sourceListLength < 1000) {
          sourceIncrement = 2
        } else if (sourceListLength < 3000) {
          sourceIncrement = 3
        } else {
          sourceIncrement = 4
        }
      } else if (touchVelocity < 30) {
        if (sourceListLength < 600) {
          sourceIncrement = 3
        } else {
          sourceIncrement = Math.round(sourceListLength / 300)
        }
      } else {
        if (sourceListLength < 1000) {
          sourceIncrement = 10
        } else {
          sourceIncrement = Math.round(sourceListLength / 100)
        }
      }
      if (stopInput === false) {
        if (dx > 0) {
          changeSource(sourceIncrement)
        } else {
          changeSource(-1 * sourceIncrement)
        }
      }
    }
  }
  lastTouchX = pos
}

function handleScroll (event) {
  // Cycle the images when a user scrolls the mouse scroll wheel.

  hideAttractor()
  exCommon.config.currentInteraction = true

  const dy = event.originalEvent.deltaY
  const velocity = Math.abs(dy)
  let sourceIncrement
  if (velocity < 500) {
    // Slow scroll
    if (sourceListLength < 100) {
      sourceIncrement = 1
    } else if (sourceListLength < 1000) {
      sourceIncrement = 2
    } else if (sourceListLength < 3000) {
      sourceIncrement = 3
    } else {
      sourceIncrement = 4
    }
  } else {
    if (sourceListLength < 1000) {
      sourceIncrement = 10
    } else {
      sourceIncrement = Math.round(sourceListLength / 100)
    }
  }
  if (stopInput === false) {
    if (dy < 0) {
      changeSource(sourceIncrement)
    } else {
      changeSource(-1 * sourceIncrement)
    }
  }
}

function handleKeyDown (event) {
  // Listen for arrow keys and switch images accordingly

  hideAttractor()
  exCommon.config.currentInteraction = true

  const key = event.key
  const repeated = event.repeat
  let sourceIncrement

  if (repeated === false) {
    // Single press
    if (sourceListLength < 100) {
      sourceIncrement = 1
    } else if (sourceListLength < 1000) {
      sourceIncrement = 2
    } else if (sourceListLength < 3000) {
      sourceIncrement = 3
    } else {
      sourceIncrement = 4
    }
  } else {
    if (sourceListLength < 1600) {
      sourceIncrement = 8
    } else {
      sourceIncrement = Math.round(sourceListLength / 200)
    }
  }
  if (stopInput === false) {
    if (['ArrowRight', 'ArrowUp'].includes(key)) {
      changeSource(sourceIncrement)
    } else if (['ArrowLeft', 'ArrowDown'].includes(key)) {
      changeSource(-1 * sourceIncrement)
    }
  }
}

function loadImage (url) {
  // Use a promise to load the given image

  stopInput = true
  return new Promise(resolve => {
    const image = new Image()

    image.addEventListener('load', () => {
      resolve(image)
    })
    image.src = url
  })
}

function displayImage (file) {
  // Handle switching the src on the appropriate image tag to `file`.

  if (file == null) return
  const nextIndex = activeViewerIndex === 0 ? 1 : 0
  activeViewerIndex = nextIndex

  loadImage('/content/' + file).then(newImage => {
    viewerList[nextIndex].src = newImage.src
    viewerList[nextIndex].style.display = 'block'
    viewerList[1 - nextIndex].style.display = 'none'
    stopInput = false
  })
}

function changeSource (dist) {
  // Advance through the sourceList by the number `dist` and

  activeSourceIndex += dist
  if (activeSourceIndex > sourceListLength - 1) {
    // activeSourceIndex = sourceListLength - 1
    activeSourceIndex -= sourceListLength
  } else if (activeSourceIndex < 0) {
    // activeSourceIndex = 0
    activeSourceIndex = sourceListLength - 1
  }
  displayImage(sourceList[activeSourceIndex])
}

function animateNextFrame () {
  // Show the next frame in the timelapse and set a timeout to recursively call
  // this function.

  if (continueAnimating) {
    changeSource(animationStepSize)
    if (activeSourceIndex === sourceListLength - 1) {
      activeSourceIndex = -1
    }
    animationTimer = setTimeout(animateNextFrame, 1000 / animationFramerate)
  }
}

function animateTimelapse () {
  // Start the process of animating the timelapse

  if (animationCustomDuration != null) {
    // The user has set a custom animation length in the defintion
    animationFramerate = sourceListLength / animationCustomDuration
    if (animationFramerate > 30) {
      animationStepSize = Math.round(animationFramerate / 30)
      animationFramerate = animationFramerate / animationStepSize
    }
  } else {
    // Compute a sensible animation speed based on the number of files
    animationStepSize = 1
    if (sourceListLength < 50) {
      animationFramerate = 5
    } else if (sourceListLength < 200) {
      animationFramerate = 10
    } else if (sourceListLength < 500) {
      animationFramerate = 20
    } else if (sourceListLength < 2000) {
      animationFramerate = 30
    } else {
      animationFramerate = 30
      animationStepSize = 2
    }
  }

  continueAnimating = true
  clearTimeout(animationTimer)
  animateNextFrame()
}

function showAttractor () {
  // Start animating the timelapse and show a moving hand icon to guide users

  animateTimelapse()
  if (showFingerAnimation === true) {
    document.getElementById('handContainer').style.display = 'block'
  } else {
    document.getElementById('handContainer').style.display = 'none'
  }

  // Hide the attractor element
  if (attractorAvailable === true) {
    document.getElementById('attractor').style.display = 'flex'
  } else {
    document.getElementById('attractor').style.display = 'none'
  }

  // Report analytics, if necessary
  if (enableAnalytics) {
    exCommon.sendAnalytics({ action: 'showAttractor' })
  }
}

function hideAttractor () {
  // Stop any animation
  continueAnimating = false

  // Hide the attractor element
  document.getElementById('attractor').style.display = 'none'

  // Hide the moving hand icon
  document.getElementById('handContainer').style.display = 'none'

  // Report analytics, if necessary
  if (enableAnalytics && !exCommon.config.currentInteraction) {
    exCommon.sendAnalytics({ action: 'hideAttractor' })
  }

  // Set the attractor to start again in 30 s
  clearTimeout(attractorTimer)
  attractorTimer = setTimeout(showAttractor, attractorTimeout)
}

let touchStartX = null
let lastTouchX = null // X cordinate of the last touchmove event
let currentClick = false
let stopInput = false

let currentDefintion = ''
let continueAnimating = true // true when we are animating for the attractor
let animationFramerate = 30
let animationStepSize = 1
let animationTimer = null // Will be replaced with index of setTimeout
let animationCustomDuration = null

let attractorTimer = null // Will be replaced with index of setTimeout
let attractorTimeout = 30000 // ms
let attractorAvailable = false
let showFingerAnimation = true

let sourceList = []
let sourceListLength = 0
let activeSourceIndex = 0 // Index of the file from the source list currently showing
const viewerList = [document.getElementById('img1'), document.getElementById('img2')]
let activeViewerIndex = 0 // Index of the <img> instance that is currently being used
const enableAnalytics = false

exCommon.configureApp({
  name: 'timelapse_viewer',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

// Create event listeners
$('body')
  .on('touchstart', handleTouchStart)
  .on('touchmove', handleTouchMove)
  .on('touchend', handleTouchEnd)
  .on('wheel', handleScroll)
  .on('keydown', handleKeyDown)
  .on('mousedown', function (event) { handleTouchStart(event, false) })
  .on('mousemove', function (event) { handleTouchMove(event, false) })
  .on('mouseup', handleTouchEnd)
