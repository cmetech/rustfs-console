// Self-contained so the same logic can run before hydration and in the mounted Console.
export function readOscarAppearance(browser: Window, consumeLaunch = false): "light" | "dark" | undefined {
  const url = new URL(browser.location.href)
  const launch = consumeLaunch ? url.searchParams.get("oscar-mode") : null
  const cookie = browser.document.cookie.match(/(?:^|;\s*)oscar-ui-mode=(light|dark)(?:;|$)/)?.[1]
  const mode = launch === "light" || launch === "dark" ? launch : cookie
  if (consumeLaunch && url.searchParams.has("oscar-mode")) {
    url.searchParams.delete("oscar-mode")
    browser.history.replaceState(browser.history.state, "", url)
  }
  if (mode !== "light" && mode !== "dark") return undefined
  if (consumeLaunch) browser.document.documentElement.dataset.oscarMode = mode
  try {
    browser.localStorage.setItem("active_theme", mode)
  } catch {
    // Cookies and the mounted provider still work when storage is disabled.
  }
  return mode
}
