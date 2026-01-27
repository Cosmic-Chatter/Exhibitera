/* global showdown */

import * as exFiles from '../../common/files.js'
import exCOnfig from '../../common/config.js'
import * as appsCommon from './exhibitera_app_common.js'

const markdownConverter = new showdown.Converter(
  {
    parseImgDimensions: true
  }
)

export function formatText (inputStr, options = {}) {
  // Take a string of Markdown-formatted text and return a dom object containing
  // the formatted text.
  // Set options.removeParagraph to remove the enclosing <p> element from short texts

  const outputStr = markdownConverter.makeHtml(inputStr)
  let el = document.createElement('div')
  el.innerHTML = outputStr
  if ((options?.removeParagraph ?? false) === true) {
    el = el?.firstElementChild ?? el
  }
  if ((options?.string ?? false) === true) return el.innerHTML
  return el
}

export function formatMarkdownImages (el) {
  // Take a formatted element outputted by formatText and format the images to Exhibitera style.
  // Returns a DOM element containing the formatted text.

  // Find img tags and format them appropriately
  for (const tag of el.children) {
    if (tag.tagName.toLowerCase() !== 'p') continue

    for (let child of tag.children) {
      if (child.tagName.toLowerCase() !== 'img') continue

      // Parse the alt text for a user-indicated formatting preference.
      // Should be of format "left 25" or "right 75 loop"
      const format = child.alt.toLowerCase().split(' ') // -> ['left', '25']

      // Check if the content is actually a video and replace with a video tag
      const div = document.createElement('div')
      if (exFiles.guessMimetype(child.src) === 'video') {
        child = formatMarkdownVideo(child, format)
        div.append(child)
      } else {
        child.classList.add('markdown-image')
        div.append(child)
      }

      const caption = document.createElement('div')
      caption.classList.add('markdown-media-caption')
      caption.append(formatText(child.title))
      div.append(caption)

      tag.innerHTML = ''
      tag.replaceWith(div)

      if (format[0] === 'left') {
        div.classList.add('markdown-media-left')
      } else if (format[0] === 'right') {
        div.classList.add('markdown-media-right')
      } else if (format[0] === 'middle') {
        div.classList.add('markdown-media-middle')
      }

      if (format[1] === '25%') {
        div.classList.add('markdown-media-25')
      } else if (format[1] === '33%') {
        div.classList.add('markdown-media-33')
      } else if (format[1] === '50%') {
        div.classList.add('markdown-media-50')
      } else if (format[1] === '67%') {
        div.classList.add('markdown-media-67')
      } else if (format[1] === '75%') {
        div.classList.add('markdown-media-75')
      } else if (format[1] === '100%') {
        div.classList.add('markdown-media-100')
      } else {
        div.classList.add('markdown-media-25')
      }
    }
  }

  return el
}

function formatMarkdownVideo (el, format) {
  // Take a DOM element that is coded as an image and convert it to a video tag.
  // This is needed when we use Markdown syntax meant for images when defining
  // a video.
  // format should be a list similar to ['left', '25'] or ['right', '50', 'loop']

  const looping = format.includes('loop')

  const container = document.createElement('div')
  container.title = el.title
  const newTag = document.createElement('video')
  container.appendChild(newTag)
  newTag.src = el.src
  newTag.alt = el.alt
  newTag.title = el.title
  newTag.disablePictureInPicture = true
  newTag.disableRemotePlayback = true
  newTag.playsInline = true
  const pathParts = el.src.split('/')
  const filename = pathParts[pathParts.length - 1]

  if (looping === false) {
    // Get the video size to hold space while the poster is rendered
    appsCommon.makeHelperRequest({
      method: 'GET',
      endpoint: `/files/${encodeURIComponent(filename)}/videoDetails`
    })
      .then((data) => {
        if (data.success && data.details.width && data.details.height) {
        // Setting these attributes helps the browser reserve space
          newTag.setAttribute('width', data.details.width)
          newTag.setAttribute('height', data.details.height)

          // Apply aspect-ratio to prevent 0px height collapse
          newTag.style.aspectRatio = `${data.details.width} / ${data.details.height}`
          newTag.style.width = '100%'
          newTag.style.height = 'auto'
        }
      })
      .catch(err => console.warn('Video metadata fetch failed:', err))

    // Then load the poster, which may trigger a long process on the helper
    newTag.poster = exCOnfig.api + `/files/${encodeURIComponent(filename)}/thumbnail/${String(window.innerWidth)}?force_image=true`
  }
  newTag.setAttribute('webkit-playsinline', '')
  newTag.classList.add('markdown-video')
  newTag.addEventListener('contextmenu', (e) => {
    e.preventDefault() // Suppress right-click menu
  })

  if (looping === false) {
    container.classList = 'markdown-video-wrapper'
    const playButton = document.createElement('span')
    playButton.classList = 'markdown-video-play-button'
    playButton.setAttribute('aria-hidden', true)
    container.appendChild(playButton)

    newTag.addEventListener('click', () => {
      const wrapper = newTag.parentElement
      const playButton = wrapper.querySelector('.markdown-video-play-button')

      if (newTag.paused) {
      // First, pause every video that isn't looping
        const videos = document.querySelectorAll('.markdown-video')
        for (const video of videos) {
          if (video.autoplay === false) pauseMarkdownVideo(video)
        }
        newTag.play()
        if (playButton) playButton.style.opacity = '0'
      } else {
        newTag.pause()
        if (playButton) playButton.style.opacity = '1'
      }
    })
  }

  newTag.addEventListener('ended', () => {
    console.log('Video has finished playing')
    const wrapper = newTag.parentElement
    const playButton = wrapper.querySelector('.markdown-video-play-button')
    if (playButton) playButton.style.opacity = '1'
  })

  const offscreenObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target

      if (entry.isIntersecting) {
      // Element is on screen
      } else {
      // Element is off screen
        if (video.autoplay === false) {
          pauseMarkdownVideo(video)
        }
      }
    })
  }, {
    threshold: 0.25 // % of video visible before considered "on screen"
  })
  offscreenObserver.observe(newTag)

  if (looping) {
    newTag.loop = true
    newTag.muted = true
    newTag.autoplay = true
  }

  return container
}

function pauseMarkdownVideo (el) {
  // Pause the video and make sure the play button is showing

  const wrapper = el.parentElement
  const playButton = wrapper.querySelector('.markdown-video-play-button')
  if (playButton) playButton.style.opacity = '1'

  el.pause()
}
