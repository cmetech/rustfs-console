import assert from "node:assert/strict"
import { test } from "node:test"
import { Window } from "happy-dom"
import { readOscarAppearance } from "../../themes/oscar/appearance"

function browser(url = "https://oscar.test/rustfs/console/") {
  return new Window({ url }) as unknown as globalThis.Window
}

test("launch theme persists before OIDC and only removes the appearance parameter", () => {
  const w = browser("https://oscar.test/rustfs/console/?state=opaque&oscar-mode=dark&code=example#return")
  w.document.cookie = "oscar-ui-mode=light"
  assert.equal(readOscarAppearance(w, true), "dark")
  assert.equal(w.document.documentElement.dataset.oscarMode, "dark")
  assert.equal(w.localStorage.getItem("active_theme"), "dark")
  assert.equal(w.location.search, "?state=opaque&code=example")
  assert.equal(w.location.hash, "#return")
})

test("same-host cookie synchronizes both mode changes", () => {
  const w = browser()
  for (const mode of ["dark", "light", "dark"]) {
    w.document.cookie = `oscar-ui-mode=${mode}`
    assert.equal(readOscarAppearance(w), mode)
  }
})

test("untrusted launch values cannot override a valid cookie", () => {
  const w = browser("https://oscar.test/?oscar-mode=%3Cscript%3E&state=keep")
  w.document.cookie = "oscar-ui-mode=light"
  assert.equal(readOscarAppearance(w, true), "light")
  assert.equal(w.location.search, "?state=keep")
})

test("missing or malformed preferences preserve the Console preference and system fallback", () => {
  const w = browser()
  w.localStorage.setItem("active_theme", "dark")
  w.document.cookie = "oscar-ui-mode=darkevil"
  assert.equal(readOscarAppearance(w, true), undefined)
  assert.equal(w.localStorage.getItem("active_theme"), "dark")
})

test("cookie mode remains available when local storage is blocked", () => {
  const w = browser()
  w.document.cookie = "oscar-ui-mode=dark"
  Object.defineProperty(w, "localStorage", {
    get() {
      throw new Error("blocked")
    },
  })
  assert.equal(readOscarAppearance(w, true), "dark")
})
