// A stand-in for the servers that Hub's and Apps' pages talk to, shared by the test browsers.
// Before importing a page module, set globalThis.server to a function (method, url, body) that returns
// {status, body} for a JSON reply, {status, text} for any other reply, {status, bytes} for a file such as a font
// (an ArrayBuffer or typed array), or 'timeout' or 'error'.
// Add delay (in ms) to a reply to make it arrive later.

export const requests = []

export class FakeXMLHttpRequest {
  open (method, url) {
    this.method = method
    // Pages also request relative URLs, which the browser resolves against the page's address
    this.url = new URL(url, globalThis.window?.location?.href ?? 'http://apps.test/').href
  }

  setRequestHeader () {}

  overrideMimeType () {}

  send (body) {
    requests.push({ method: this.method, url: this.url, body })
    const reply = globalThis.server(this.method, this.url, body)
    setTimeout(() => {
      // As in browsers, a finished request calls onreadystatechange, then a timeout only calls
      // ontimeout and a network error only calls onerror
      this.readyState = 4
      if (reply === 'timeout' || reply === 'error') {
        this.status = 0
        this.onreadystatechange?.()
        if (reply === 'timeout') this.ontimeout?.()
        else this.onerror?.()
        return
      }

      this.status = reply.status ?? 200
      if (reply.bytes != null) {
        const bytes = new Uint8Array(reply.bytes)
        this.response = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      } else {
        this.responseText = reply.text ?? JSON.stringify(reply.body)
        this.response = this.responseText
      }
      this.onreadystatechange?.()
      this.onload?.()
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
