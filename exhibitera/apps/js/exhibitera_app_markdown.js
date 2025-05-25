/* global showdown */

const markdownConverter = new showdown.Converter({ parseImgDimensions: true })

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
  Array.from(el.children).forEach(function (tag, i) {
    if (tag.tagName === 'P') {
      Array.from(tag.children).forEach(function (child, j) {
        if (child.tagName.toLowerCase() === 'img') {
          child.classList.add('markdown-image')
          const div = document.createElement('div')
          div.append(child)
          const caption = document.createElement('div')
          caption.classList.add('markdown-image-caption')
          caption.append(child.title)
          div.append(caption)
          tag.innerHTML = ''
          tag.appendChild(div)

          // Parse the alt text for a user-indicated formatting preference.
          // Should be of format "left 25"
          const format = child.alt.toLowerCase().split(' ') // -> ['left', '25']

          if (format[0] === 'left') {
            div.classList = 'markdown-image-left'
          } else if (format[0] === 'right') {
            div.classList = 'markdown-image-right'
          } else if (format[0] === 'middle') {
            div.classList = 'markdown-image-middle'
          }

          if (format[1] === '25%') {
            div.classList.add('markdown-image-25')
          } else if (format[1] === '33%') {
            div.classList.add('markdown-image-33')
          } else if (format[1] === '50%') {
            div.classList.add('markdown-image-50')
          } else if (format[1] === '67%') {
            div.classList.add('markdown-image-67')
          } else if (format[1] === '75%') {
            div.classList.add('markdown-image-75')
          } else if (format[1] === '100%') {
            div.classList.add('markdown-image-100')
          } else {
            div.classList.add('markdown-image-25')
          }
        }
      })
    }
  })

  return el
}
