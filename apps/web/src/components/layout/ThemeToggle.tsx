"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"

// El tema vive en el DOM (clase `dark` en <html>, puesta pre-hidratación en
// layout.tsx) y se lee con useSyncExternalStore: el snapshot de servidor asume
// claro y React lo corrige tras montar, sin mismatch de hidratación — mismo
// resultado que el viejo flag `mounted`, sin setState dentro de un efecto.

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark")
}

function toggleTheme(): void {
  const next = !isDark()
  document.documentElement.classList.toggle("dark", next)
  try {
    localStorage.setItem("theme", next ? "dark" : "light")
  } catch {
    // localStorage unavailable (private mode) — theme still applies for the session
  }
  for (const listener of listeners) listener()
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false)

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface-1 text-dim transition-colors hover:border-faint hover:text-fg-2"
    >
      {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  )
}
