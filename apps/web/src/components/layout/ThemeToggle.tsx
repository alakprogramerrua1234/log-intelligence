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
  const root = document.documentElement

  // Las transiciones se apagan durante el cambio (ver `.theme-switching` en
  // globals.css). Sin esto, los elementos con `transition-colors` interpolan
  // sus colores 150 ms mientras el resto de la página salta, y el tema entra a
  // trozos. Leer el layout entre medias fuerza el recálculo con las
  // transiciones ya apagadas, así que al reactivarlas los colores nuevos ya
  // están aplicados y no se dispara ninguna animación.
  root.classList.add("theme-switching")
  root.classList.toggle("dark", next)
  root.getBoundingClientRect()
  root.classList.remove("theme-switching")

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
