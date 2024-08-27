import * as exCommon from '../js/exhibitera_app_common.js'

const overlay = document.getElementById('overlayDiv')
const base = document.getElementById('baseDiv')

let clicked = 0
let currentLang = 'en'
let timer = 0 // Reference to setTimeout for reseting the view
resetTimer()

/* Get the width and height of the img element */
const w = overlay.offsetWidth
const h = overlay.offsetHeight
const overlayImg = document.getElementById('overlayImg')

/* Position the slider in the middle: */
const slider = document.getElementById('slider')
slider.style.top = (h / 2) - (slider.offsetHeight / 2) + 'px'
slider.style.left = (w / 2) - (slider.offsetWidth / 2) + 'px'

// Reset the timer
document.body.addEventListener('click', resetTimer)

// Listen for click/tap and start the sliding
slider.addEventListener('mousedown', slideReady)
slider.addEventListener('touchstart', slideReady)
overlay.addEventListener('mousedown', slideReady)
overlay.addEventListener('touchstart', slideReady)
base.addEventListener('mousedown', slideReady)
base.addEventListener('touchstart', slideReady)

// Listen for the slide
overlay.addEventListener('mousemove', slideMove)
base.addEventListener('mousemove', slideMove)
overlay.addEventListener('touchmove', slideMove)
base.addEventListener('touchmove', slideMove)

// Listen for click/touch end and stop sliding.
overlay.addEventListener('mouseup', slideFinish)
overlay.addEventListener('touchend', slideFinish)
base.addEventListener('mouseup', slideFinish)
base.addEventListener('touchend', slideFinish)

// Buttons
document.getElementById('homeButton').addEventListener('click', () => {
  document.getElementById('mainMenu').style.display = 'block'
})

function slideReady (e) {
  /* Prevent any other actions that may occur when moving over the image: */
  e.preventDefault()
  slide(getCursorPos(e))
  /* The slider is now clicked and ready to move: */
  clicked = 1
  resetTimer()
  document.getElementById('slidingHandContainer').style.display = 'none'
}

function slideFinish () {
  /* The slider is no longer clicked: */
  clicked = 0
}

function slideMove (e) {
  /* If the slider is no longer clicked, exit this function: */
  if (clicked === 0) return false
  /* Get the cursor's x position: */
  let pos = getCursorPos(e)
  /* Prevent the slider from being positioned outside the image: */
  if (pos < 0) pos = 0
  if (pos > w) pos = w
  /* Execute a function that will resize the overlay image according to the cursor: */
  slide(pos)
  resetTimer()
}

function getCursorPos (e) {
  let x = 0
  e = (e.changedTouches) ? e.changedTouches[0] : e
  /* Get the x positions of the image: */
  const a = overlay.getBoundingClientRect()
  /* Calculate the cursor's x coordinate, relative to the image: */
  x = e.pageX - a.left
  /* Consider any page scrolling: */
  x = x - window.scrollX
  return x
}

function slide (x) {
  // Adjust the view based on the current input position

  const xPercent = 100 * x / w
  const xPercentStr = String(xPercent) + '%'

  // Move overlay image mask
  overlayImg.style.clipPath = 'polygon(0% 0%, ' + xPercentStr + ' 0%, ' + xPercentStr + ' 100%, 0% 100%)'

  // Move slider icon
  slider.style.left = (x) - (slider.offsetWidth / 2) + 'px'

  // Hide the labels as needed
  if (xPercent < 12) {
    document.getElementById('image2Label').style.display = 'none'
  } else {
    document.getElementById('image2Label').style.display = 'block'
  }
  if (xPercent > 88) {
    document.getElementById('image1Label').style.display = 'none'
  } else {
    document.getElementById('image1Label').style.display = 'block'
  }
}

function loadImages (item) {
  // Load the images corresponding to the given object

  // document.getElementById('pulsingHandContainer').style.display = 'none'

  const overlayImg = document.getElementById('overlayImg')
  const baseImg = document.getElementById('baseImg')

  overlayImg.src = exCommon.config.helperAddress + '/content/' + item.image2
  baseImg.src = exCommon.config.helperAddress + '/content/' + item.image1

  // Reset the slider to the middle
  slide(w / 2)

  // Hide the menu
  document.getElementById('mainMenu').style.display = 'none'
}

function loadDefinition (definition) {
  // A function to configure content based on the provided configuration.

  populateItemList(definition)
}

function populateItemList (def) {
  // Using the details in the defintion, build an icon for each image pair.

  const itemRow = document.getElementById('itemList')
  itemRow.innerHTML = ''

  for (const uuid of def.content_order) {
    const item = def.content[uuid]

    const col = document.createElement('div')
    col.classList = 'col mx-0 px-0'
    col.style.position = 'relative'
    col.addEventListener('click', () => {
      loadImages(item)
    })
    itemRow.appendChild(col)

    const img1 = document.createElement('img')
    img1.classList = 'w-100 icon-image icon-image-top'
    img1.src = exCommon.config.helperAddress + '/thumbnails/' + item.image1
    col.appendChild(img1)

    const img2 = document.createElement('img')
    img2.classList = 'w-100 icon-image icon-image-bottom'
    img2.src = exCommon.config.helperAddress + '/thumbnails/' + item.image2
    img2.style.position = 'absolute'
    img2.style.top = 0
    img2.style.left = 0
    col.appendChild(img2)

    const label = document.createElement('div')
    label.classList = 'button-label'
    label.innerHTML = item.name
  }
}

function localize (lang) {
  // Use the localization to switch to the given language

  const local = localization[lang]

  Object.keys(local).forEach((key) => {
    document.getElementById(key).innerHTML = local[key]
  })
}

function resetTimer () {
  // Reset the timer for resetting the view

  clearTimeout(timer)
  timer = setTimeout(resetView, 30 * 1000) // 30 sec
}

function resetView () {
  currentLang = 'en'
  localize('en')
  document.getElementById('mainMenu').style.display = 'block'
  $('#image1Modal').modal('hide')
  $('#image2Modal').modal('hide')
  document.getElementById('slidingHandContainer').style.display = 'block'
  document.getElementById('pulsingHandContainer').style.display = 'block'
}

function parseUpdate (update) {
  // A function to respond to commands from Control Server.

}

exCommon.configureApp({
  name: 'image_compare',
  loadDefinition,
  parseUpdate
})
