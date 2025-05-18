// File-related functions common to Hub and Apps

export function withExtension (path, ext) {
  // Return the given path with its extension replaced by ext

  return path.split('.').slice(0, -1).join('.') + '.' + ext
}

export function guessMimetype (filename) {
  // Use filename extension to guess the mimetype

  const ext = filename.split('.').slice(-1)[0].toLowerCase()

  if (['aac', 'm4a', 'mp3', 'oga', 'ogg', 'wav'].includes(ext)) {
    return 'audio'
  } else if (['otf', 'ttf', 'woff', 'woff2'].includes(ext)) {
    return 'font'
  } else if (['jpeg', 'jpg', 'tiff', 'tif', 'png', 'bmp', 'gif', 'webp', 'eps', 'ps', 'svg'].includes(ext)) {
    return 'image'
  } else if (['fbx', 'glb', 'obj', 'stl', 'usdz'].includes(ext)) {
    return 'model'
  } else if (['csv', 'xls', 'xlsx'].includes(ext)) {
    return 'spreadsheet'
  } else if (['mp4', 'mpeg', 'mpg', 'webm', 'mov', 'm4v', 'avi', 'flv'].includes(ext)) {
    return 'video'
  }
  return ''
}

export function csvToJSON (csv) {
  // From https://stackoverflow.com/questions/59016562/parse-csv-records-in-to-an-array-of-objects-in-javascript

  const lines = csv.split('\n')
  const result = []
  const headers = lines[0].split(',')

  for (let i = 1; i < lines.length; i++) {
    const obj = {}

    if (lines[i] === undefined || lines[i].trim() === '') {
      continue
    }

    // regex to split on comma, but ignore inside of ""
    const words = splitCsv(lines[i])
    for (let j = 0; j < words.length; j++) {
      // Clean up "" used to escape commas in the CSV
      let word = words[j].trim()
      if (word.slice(0, 1) === '"' && word.slice(-1) === '"') {
        word = word.slice(1, -1)
      }

      word = word.replaceAll('""', '"')
      obj[headers[j].trim()] = word.trim()
    }

    result.push(obj)
  }
  const detectBad = detectBadCSV(result)

  if (detectBad.error === true) {
    return {
      json: result,
      error: true,
      error_index: detectBad.error_index
    }
  }

  return { json: result, error: false }
}

function detectBadCSV (jsonArray) {
  // Take the JSON array from csvToJSON and check if it seems properly formed.

  const lengthCounts = {}
  const lengthList = []
  jsonArray.forEach((el) => {
    // Count the number of fields (which should be the same for each row)
    const length = Object.keys(el).length
    if (length in lengthCounts) {
      lengthCounts[length] += 1
    } else {
      lengthCounts[length] = 1
    }
    lengthList.push(length)
  })

  // Assume that the length that occurs most often is the correct one
  const mostCommon = parseInt(Object.keys(lengthCounts).reduce((a, b) => lengthCounts[a] > lengthCounts[b] ? a : b))
  const badIndices = []
  lengthList.forEach((el, i) => {
    if (el !== mostCommon) badIndices.push(i)
  })
  if (badIndices.length > 0) {
    return { error: true, error_index: badIndices[0] }
  }
  return { error: false }
}

function splitCsv (str) {
  // From https://stackoverflow.com/a/31955570

  return str.split(',').reduce((accum, curr) => {
    if (accum.isConcatting) {
      accum.soFar[accum.soFar.length - 1] += ',' + curr
    } else {
      accum.soFar.push(curr)
    }
    if (curr.split('"').length % 2 === 0) {
      accum.isConcatting = !accum.isConcatting
    }
    return accum
  }, { soFar: [], isConcatting: false }).soFar
}
