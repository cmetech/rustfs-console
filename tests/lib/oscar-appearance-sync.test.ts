import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test, { type TestContext } from "node:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { Window } from "happy-dom"
import ts from "typescript"
import { readOscarAppearance } from "../../themes/oscar/appearance"

function moduleUrl(file: string, overrides: Record<string, string> = {}) {
  const source = ts.transpileModule(readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return `data:text/javascript,${encodeURIComponent(
    source
      .replace(/import "[^\"]+\.css";?/g, "")
      .replace(
        /from "([^\"]+)"/g,
        (_, specifier: string) => `from "${overrides[specifier] ?? import.meta.resolve(specifier)}"`,
      ),
  )}`
}

async function mount(t: TestContext, options: { launch?: string; cookie?: string; blocked?: boolean } = {}) {
  const browser = new Window({
    url: `https://oscar.test/rustfs/console/?state=keep${options.launch ? `&oscar-mode=${options.launch}` : ""}`,
  })
  if (options.cookie) browser.document.cookie = `oscar-ui-mode=${options.cookie}`
  if (options.blocked)
    Object.defineProperty(browser, "localStorage", {
      get() {
        throw new Error("Storage blocked")
      },
    })
  const globals = { window: browser, document: browser.document, IS_REACT_ACT_ENVIRONMENT: true }
  const previous = [...Object.keys(globals), "localStorage"].map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  )
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => browser.localStorage })
  const intervals = new Map<number, () => void>()
  let nextId = 0
  browser.setInterval = ((callback: () => void, delay: number) => {
    assert.equal(delay, 30_000)
    intervals.set(++nextId, callback)
    return nextId
  }) as unknown as typeof browser.setInterval
  browser.clearInterval = ((id: number) => intervals.delete(id)) as unknown as typeof browser.clearInterval
  // Execute the serialized pre-hydration helper without access to its original module scope.
  new Function("window", `(${readOscarAppearance.toString()})(window, true)`)(browser)
  const syncUrl = moduleUrl("themes/oscar/appearance-sync.tsx", {
    "./appearance": new URL("../../themes/oscar/appearance.ts", import.meta.url).href,
  })
  const { ThemeProvider } = (await import(
    moduleUrl("themes/oscar/components/providers/theme-provider.tsx", {
      "@/themes/oscar/appearance-sync": syncUrl,
    })
  )) as typeof import("../../themes/oscar/components/providers/theme-provider")
  const container = browser.document.createElement("div")
  browser.document.body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  let mounted = true
  const unmount = async () => {
    if (mounted) await act(async () => root.unmount())
    mounted = false
  }
  t.after(async () => {
    // next-themes removes its transition style on a 1 ms global timer.
    await unmount()
    await new Promise((resolve) => setTimeout(resolve, 1))
    await browser.happyDOM.close()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
  await act(async () => root.render(createElement(ThemeProvider, null, createElement("main", null, "Console"))))
  return { browser, intervals, unmount }
}

test("serialized bootstrap applies launch appearance through mounted provider with blocked storage", async (t) => {
  const { browser } = await mount(t, { launch: "dark", cookie: "light", blocked: true })
  assert.equal(browser.document.documentElement.classList.contains("dark"), true)
  assert.equal(browser.document.documentElement.style.colorScheme, "dark")
  assert.equal(browser.document.documentElement.dataset.oscarMode, undefined)
  assert.equal(browser.location.search, "?state=keep")
})

test("mounted provider follows cookie changes while visible and removes subscriptions on unmount", async (t) => {
  const { browser, intervals, unmount } = await mount(t, { cookie: "light" })
  assert.equal(browser.document.documentElement.classList.contains("light"), true)
  browser.document.cookie = "oscar-ui-mode=dark"
  await act(async () => browser.dispatchEvent(new browser.Event("focus")))
  assert.equal(browser.document.documentElement.classList.contains("dark"), true)
  Object.defineProperty(browser.document, "visibilityState", { configurable: true, value: "hidden" })
  browser.document.cookie = "oscar-ui-mode=light"
  await act(async () => {
    for (const tick of [...intervals.values()]) tick()
  })
  assert.equal(browser.document.documentElement.classList.contains("dark"), true)
  Object.defineProperty(browser.document, "visibilityState", { configurable: true, value: "visible" })
  await act(async () => browser.document.dispatchEvent(new browser.Event("visibilitychange")))
  assert.equal(browser.document.documentElement.classList.contains("light"), true)
  await unmount()
  assert.equal(intervals.size, 0)
  browser.document.cookie = "oscar-ui-mode=dark"
  browser.dispatchEvent(new browser.Event("focus"))
  browser.document.dispatchEvent(new browser.Event("visibilitychange"))
  assert.equal(browser.localStorage.getItem("active_theme"), "light")
})
