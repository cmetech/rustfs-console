import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test, { type TestContext } from "node:test"
import { act, createElement, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { Window } from "happy-dom"
import ts from "typescript"

const fixtureKey = Symbol.for("oscar-session-gate-test")
const authModule = `data:text/javascript,${encodeURIComponent('export function useAuth() { return globalThis[Symbol.for("oscar-session-gate-test")] }')}`
const source = ts
  .transpileModule(readFileSync(new URL("../../themes/oscar/session-gate.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  })
  .outputText.replace(
    /from "([^"]+)"/g,
    (_, name: string) => `from "${name === "@/contexts/auth-context" ? authModule : import.meta.resolve(name)}"`,
  )
const { OscarSessionGate } = (await import(
  `data:text/javascript,${encodeURIComponent(source)}`
)) as typeof import("../../themes/oscar/session-gate")
const credentials = () => ({
  AccessKeyId: "fixture-access",
  SecretAccessKey: "fixture-secret",
  SessionToken: "fixture-token",
  Expiration: new Date(Date.now() + 900_000).toISOString(),
})

async function mount(t: TestContext) {
  const browser = new Window({ url: "https://oscar.test:9444/rustfs/console/" })
  const requests: { url: string; options: RequestInit; resolve: (value: Response) => void }[] = []
  const logins: unknown[] = []
  let logouts = 0
  let mounts = 0
  let unmounts = 0
  const previousAuth = Reflect.get(globalThis, fixtureKey)
  Reflect.set(globalThis, fixtureKey, {
    loginWithStsCredentials: async (value: unknown) => {
      logins.push(value)
    },
    logout: () => {
      logouts++
    },
  })
  const globals = {
    window: browser,
    document: browser.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, options: RequestInit) =>
      new Promise<Response>((resolve) => requests.push({ url, options, resolve })),
  }
  const previous = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  const intervals = new Map<number, () => void>()
  let nextId = 0
  browser.setInterval = ((callback: () => void, delay: number) => {
    assert.equal(delay, 300_000)
    intervals.set(++nextId, callback)
    return nextId
  }) as unknown as typeof browser.setInterval
  browser.clearInterval = ((id: number) => {
    intervals.delete(id)
  }) as unknown as typeof browser.clearInterval
  function Probe() {
    useEffect(() => {
      mounts++
      return () => {
        unmounts++
      }
    }, [])
    return createElement("div", { id: "protected-console" }, "Protected Console")
  }
  const container = browser.document.createElement("div")
  browser.document.body.append(container)
  const root = createRoot(container as unknown as Element)
  let mounted = true
  const unmount = async () => {
    if (mounted) await act(async () => root.unmount())
    mounted = false
  }
  t.after(async () => {
    await unmount()
    await browser.happyDOM.close()
    Reflect.set(globalThis, fixtureKey, previousAuth)
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  })
  await act(async () => root.render(createElement(OscarSessionGate, null, createElement(Probe))))
  const reply = async (index: number, body: unknown, ok = true) =>
    act(async () => {
      requests[index].resolve({ ok, json: async () => body } as Response)
    })
  return {
    browser,
    requests,
    logins,
    intervals,
    unmount,
    reply,
    counters: () => ({ logouts, mounts, unmounts }),
    visible: () => Boolean(browser.document.querySelector("#protected-console")),
    focus: () => act(async () => browser.dispatchEvent(new browser.Event("focus"))),
  }
}

test("gate withholds children until a cookie-authenticated, no-store POST succeeds", async (t) => {
  const f = await mount(t)
  assert.equal(f.visible(), false)
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].url, "/oscar-session/")
  assert.equal(f.requests[0].options.method, "POST")
  assert.equal(f.requests[0].options.credentials, "same-origin")
  assert.equal(f.requests[0].options.cache, "no-store")
  assert.equal(new Headers(f.requests[0].options.headers).get("X-Oscar-Storage-Session"), "1")
  const value = credentials()
  await f.reply(0, { credentials: value, principal: "oscar:fixture-A" })
  assert.deepEqual(f.logins, [value])
  assert.equal(f.visible(), true)
})

for (const [name, body, ok] of [
  ["unauthorized", {}, false],
  ["missing token", { credentials: { ...credentials(), SessionToken: "" }, principal: "oscar:fixture-A" }, true],
  [
    "expired",
    { credentials: { ...credentials(), Expiration: "2000-01-01T00:00:00Z" }, principal: "oscar:fixture-A" },
    true,
  ],
  ["missing principal", { credentials: credentials() }, true],
] as const)
  test(`gate fails closed and clears credentials for ${name} response`, async (t) => {
    const f = await mount(t)
    await f.reply(0, { credentials: credentials(), principal: "oscar:fixture-A" })
    assert.equal(f.visible(), true)
    await f.focus()
    await f.reply(1, body, ok)
    assert.equal(f.visible(), false)
    assert.equal(f.counters().logouts, 1)
    assert.ok(f.browser.document.querySelector("button"))
  })

test("unmount aborts pending sign-in and removes timers and listeners", async (t) => {
  const f = await mount(t)
  const signal = f.requests[0].options.signal
  await f.unmount()
  assert.equal(signal?.aborted, true)
  assert.equal(f.intervals.size, 0)
  await f.focus()
  assert.equal(f.requests.length, 1)
  await f.reply(0, { credentials: credentials(), principal: "oscar:fixture-A" })
  assert.equal(f.logins.length, 0)
  assert.equal(f.counters().logouts, 0)
})

test("principal changes remount protected children while ordinary renewal preserves them", async (t) => {
  const f = await mount(t)
  await f.reply(0, { credentials: credentials(), principal: "oscar:fixture-A" })
  assert.deepEqual(f.counters(), { logouts: 0, mounts: 1, unmounts: 0 })
  await f.focus()
  await f.reply(1, { credentials: credentials(), principal: "oscar:fixture-A" })
  assert.deepEqual(f.counters(), { logouts: 0, mounts: 1, unmounts: 0 })
  await f.focus()
  await f.reply(2, { credentials: credentials(), principal: "oscar:fixture-B" })
  assert.deepEqual(f.counters(), { logouts: 0, mounts: 2, unmounts: 1 })
})
