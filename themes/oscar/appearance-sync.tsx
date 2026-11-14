"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { readOscarAppearance } from "./appearance"

export function OscarAppearanceSync() {
  const { setTheme } = useTheme()
  const initialized = useRef(false)
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "hidden") return
      const mode = readOscarAppearance(window)
      if (mode) setTheme(mode)
    }
    if (!initialized.current) {
      initialized.current = true
      const initial = document.documentElement.dataset.oscarMode
      delete document.documentElement.dataset.oscarMode
      if (initial === "light" || initial === "dark") setTheme(initial)
      else sync()
    }
    window.addEventListener("focus", sync)
    document.addEventListener("visibilitychange", sync)
    const interval = window.setInterval(sync, 30_000)
    return () => {
      window.removeEventListener("focus", sync)
      document.removeEventListener("visibilitychange", sync)
      window.clearInterval(interval)
    }
  }, [setTheme])
  return null
}
