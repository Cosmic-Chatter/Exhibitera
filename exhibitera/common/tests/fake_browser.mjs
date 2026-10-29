// A minimal stand-in for a browser, so page modules from Hub and Apps can run in Node without a page.
// See fake_server.mjs for how to answer the page's requests. For tests that need a page's real HTML,
// use page_browser.mjs instead.

import { FakeXMLHttpRequest } from './fake_server.mjs'
export { requests, settle, wait } from './fake_server.mjs'

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
    this.style = { setProperty () {}, removeProperty () {} }
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

globalThis.XMLHttpRequest = FakeXMLHttpRequest
