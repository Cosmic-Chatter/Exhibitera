// A minimal stand-in for a browser, so page modules from Hub and Apps can run in Node.
// Before importing a page module, set globalThis.server to a function (method, url, body) that returns
// {status, body} for a JSON reply, {status, text} for any other reply, or 'timeout' or 'error'.
// Add delay (in ms) to a reply to make it arrive later.

export const requests = []
export const createdElements = []

function makeEvent (type, details = {}) {
  return {
    type,
    isTrusted: true, // As if the person did it
    defaultPrevented: false,
    preventDefault () { this.defaultPrevented = true },
    stopPropagation () {},
    ...details
  }
}

class EventTarget {
  constructor () {
    this.listeners = {}
  }

  addEventListener (type, listener) {
    (this.listeners[type] ??= []).push(listener)
  }

  removeEventListener (type, listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener)
  }

  dispatchEvent (event) {
    for (const listener of this.listeners[event.type] ?? []) listener.call(this, event)
    return !event.defaultPrevented
  }
}

class FakeElement extends EventTarget {
  constructor (tagName) {
    super()
    this.tagName = tagName.toUpperCase()
    this.attributes = {}
    this.children = []
    this.style = {}
    this.textContent = ''
    this.value = ''
    this.disabled = false
    const classes = new Set()
    this.classList = {
      add: (...names) => names.forEach((n) => classes.add(n)),
      remove: (...names) => names.forEach((n) => classes.delete(n)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => (force ?? !classes.has(name)) ? classes.add(name) : classes.delete(name)
    }
    createdElements.push(this)
  }

  setAttribute (name, value) { this.attributes[name] = String(value) }
  getAttribute (name) { return this.attributes[name] ?? null }
  append (...children) { this.children.push(...children) }
  appendChild (child) { this.children.push(child); return child }
  remove () {}
  focus () {}
  querySelector () { return null }
  querySelectorAll () { return [] }

  click () {
    this.dispatchEvent(makeEvent('click', { target: this }))
  }
}

globalThis.HTMLElement = FakeElement

const elementsByID = {}
const fakeWindow = new EventTarget()
fakeWindow.location = { origin: 'http://apps.test', href: 'http://apps.test/', search: '' }
fakeWindow.matchMedia = () => ({ matches: false })
globalThis.window = fakeWindow

const fakeDocument = new EventTarget()
Object.assign(fakeDocument, {
  body: new FakeElement('body'),
  documentElement: new FakeElement('html'),
  createElement: (tagName) => new FakeElement(tagName),
  // Every ID exists, and asking again returns the same element
  getElementById: (id) => (elementsByID[id] ??= new FakeElement('div')),
  querySelector: () => new FakeElement('div'),
  querySelectorAll: () => []
})
globalThis.document = fakeDocument

export function personDoes (type, target = fakeDocument, details = {}) {
  // Send an event as if the person did it, and return the event
  const event = makeEvent(type, { target, ...details })
  target.dispatchEvent(event)
  return event
}

export function findElement (predicate) {
  return createdElements.find(predicate)
}

globalThis.XMLHttpRequest = class {
  open (method, url) {
    this.method = method
    this.url = url
  }

  setRequestHeader () {}

  send (body) {
    requests.push({ method: this.method, url: this.url, body })
    const reply = globalThis.server(this.method, this.url, body)
    setTimeout(() => {
      // As in browsers, a timeout only calls ontimeout, and a network error only calls onerror
      if (reply === 'timeout') {
        this.ontimeout?.()
      } else if (reply === 'error') {
        this.onerror?.()
      } else {
        this.status = reply.status ?? 200
        this.responseText = reply.text ?? JSON.stringify(reply.body)
        this.response = this.responseText
        this.onload?.()
      }
    }, reply?.delay ?? 0)
  }
}

export function settle (promise, ms = 3000) {
  // Report whether the promise resolved or rejected, or whether it was still waiting after ms
  return Promise.race([
    promise.then((value) => ({ resolved: value }), (error) => ({ rejected: String(error) })),
    new Promise((resolve) => setTimeout(() => resolve({ waiting: true }), ms))
  ])
}

export function wait (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
