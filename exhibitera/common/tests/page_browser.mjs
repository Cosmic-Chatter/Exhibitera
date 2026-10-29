// Open a real Hub or Apps page in jsdom, so tests can run its scripts against its own HTML.
// See fake_server.mjs for how to answer the page's requests.
//
// jsdom can't load ES modules, so the page's bundled libraries (Bootstrap, showdown and so on) run inside
// jsdom, and its own modules are imported in Node with jsdom's window and document as the globals.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { JSDOM } from 'jsdom'

import { FakeXMLHttpRequest } from './fake_server.mjs'
export { requests, settle, wait } from './fake_server.mjs'

const EXHIBITERA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// Where each site's pages are served from. Both servers also serve /common.
const SITES = {
  apps: { origin: 'http://apps.test', root: path.join(EXHIBITERA_DIR, 'apps') },
  hub: { origin: 'http://hub.test', root: path.join(EXHIBITERA_DIR, 'hub') }
}

// Browser features the pages use that jsdom doesn't provide
class FakeEventSource {
  // Hub's console receives updates through an EventSource. Tests send them with sendUpdate().
  static instances = []

  constructor (url) {
    this.url = url
    this.listeners = {}
    FakeEventSource.instances.push(this)
  }

  addEventListener (type, listener) {
    (this.listeners[type] ??= []).push(listener)
  }

  close () {}
}

export function sendUpdate (update) {
  // Send an update to every page that is listening for one, as Hub's update stream does
  for (const source of FakeEventSource.instances) {
    for (const listener of source.listeners.update ?? []) listener({ data: JSON.stringify(update) })
  }
}

export const errors = []

export async function openPage (site, page, { search = '' } = {}) {
  // Load the given page (such as 'media_browser/setup.html') and run its scripts.
  // Returns the jsdom window. Errors thrown by the page are collected in errors.

  const { origin, root } = SITES[site]
  const pagePath = path.join(root, page)
  const dom = new JSDOM(readFileSync(pagePath, 'utf-8'), {
    url: `${origin}/${page}${search}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  })
  const window = dom.window

  window.matchMedia = () => ({ matches: false, addEventListener () {}, removeEventListener () {} })
  window.FontFace = class { constructor (family) { this.family = family } }
  window.ResizeObserver = class { observe () {} unobserve () {} disconnect () {} }
  // jsdom doesn't lay out pages, so it has no innerText. Without CSS, it matches textContent.
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    get () { return this.textContent },
    set (value) { this.textContent = value },
    configurable: true
  })
  Object.defineProperty(window.document, 'fonts', { value: { add () {}, ready: Promise.resolve() } })
  window.XMLHttpRequest = FakeXMLHttpRequest
  window.EventSource = FakeEventSource
  window.addEventListener('error', (event) => errors.push(String(event.error?.stack ?? event.message)))
  process.on('unhandledRejection', (error) => errors.push(String(error?.stack ?? error)))

  // Make the page's globals visible to its modules, which run in Node. jsdom's own versions of things Node
  // also has, such as Event, are needed so events can be sent to the page's elements.
  for (const name of Object.getOwnPropertyNames(window)) {
    if (!(name in globalThis)) defineGlobal(name, window[name])
  }
  for (const name of ['window', 'document', 'navigator', 'location', 'Event', 'CustomEvent', 'EventTarget',
    'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'InputEvent', 'XMLHttpRequest', 'EventSource']) {
    defineGlobal(name, window[name])
  }

  const scripts = [...window.document.querySelectorAll('script[src]')]
  for (const script of scripts) {
    const file = resolveSource(script.getAttribute('src'), pagePath, root)
    if (script.type === 'module') continue

    // Run each bundled library inside jsdom, then share anything it defined, such as bootstrap
    const before = new Set(Object.getOwnPropertyNames(window))
    window.eval(readFileSync(file, 'utf-8'))
    for (const name of Object.getOwnPropertyNames(window)) {
      if (!before.has(name)) defineGlobal(name, window[name])
    }
  }
  for (const script of scripts) {
    if (script.type !== 'module') continue
    await import(pathToFileURL(resolveSource(script.getAttribute('src'), pagePath, root)).href)
  }

  return window
}

function resolveSource (src, pagePath, root) {
  if (src.startsWith('/common/')) return path.join(EXHIBITERA_DIR, src)
  if (src.startsWith('/')) return path.join(root, src)
  return path.resolve(path.dirname(pagePath), src)
}

function defineGlobal (name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}
