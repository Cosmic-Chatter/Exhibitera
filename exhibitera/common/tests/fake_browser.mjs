// A minimal stand-in for a browser, so page modules from Hub and Apps can run in Node.
// Before importing a page module, set globalThis.server to a function (method, url, body) that returns
// {status, body} for a JSON reply, {status, text} for any other reply, or 'timeout' or 'error'.

export const requests = []

globalThis.window = {
  location: { origin: 'http://apps.test', href: 'http://apps.test/', search: '' },
  addEventListener () {},
  matchMedia: () => ({ matches: false })
}

globalThis.HTMLElement = class {}
const element = () => ({ style: {}, textContent: '', addEventListener () {}, setAttribute () {} })
globalThis.document = {
  addEventListener () {},
  getElementById: element,
  querySelector: element,
  querySelectorAll: () => [],
  body: element(),
  documentElement: element()
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
    }, 0)
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
