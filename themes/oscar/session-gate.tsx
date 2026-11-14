"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"

export function OscarSessionGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const currentAuth = useRef(auth)
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading")
  const [principal, setPrincipal] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    currentAuth.current = auth
  }, [auth])
  useEffect(() => {
    const controller = new AbortController()
    let busy = false
    const sync = async () => {
      if (busy || document.visibilityState === "hidden") return
      busy = true
      try {
        const response = await fetch("/oscar-session/", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "X-Oscar-Storage-Session": "1" },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Sign-in refused")
        const { credentials, principal: identity } = await response.json()
        if (
          typeof identity !== "string" ||
          !identity ||
          !credentials?.AccessKeyId ||
          !credentials?.SecretAccessKey ||
          !credentials?.SessionToken ||
          !(Date.parse(credentials.Expiration) > Date.now())
        )
          throw new Error("Invalid storage session")
        if (controller.signal.aborted) return
        await currentAuth.current.loginWithStsCredentials(credentials)
        setPrincipal(identity)
        setState("ready")
      } catch {
        if (!controller.signal.aborted) {
          currentAuth.current.logout()
          setState("denied")
        }
      } finally {
        busy = false
      }
    }
    void sync()
    window.addEventListener("focus", sync)
    document.addEventListener("visibilitychange", sync)
    const interval = window.setInterval(sync, 5 * 60_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener("focus", sync)
      document.removeEventListener("visibilitychange", sync)
    }
  }, [retry])
  if (state === "ready") return <Fragment key={principal}>{children}</Fragment>
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6" aria-live="polite">
      <h1 className="text-2xl font-semibold">OSCAR Object Storage</h1>
      <p>
        {state === "loading"
          ? "Checking your OSCAR session…"
          : "An active OSCAR administrator session is required. Sign in to OSCAR, then retry. If you are already signed in, storage may be unavailable."}
      </p>
      {state === "denied" && (
        <button
          type="button"
          className="border border-input px-4 py-2 focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => {
            setState("loading")
            setRetry((value) => value + 1)
          }}
        >
          Retry
        </button>
      )}
    </main>
  )
}
