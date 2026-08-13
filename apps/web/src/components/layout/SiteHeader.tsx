// Navegación entre secciones con <a>, no <Link>.
//
// /explore escribe sus filtros en la URL con la History API (ver
// `lib/url-state.ts`), lo que deja el árbol interno del App Router apuntando
// a una URL que él no navegó. A partir de ahí un <Link> se queda pidiendo el
// RSC sin confirmar nunca la transición, y no había forma de salir de la
// sección. Una navegación normal del navegador siempre funciona, y entre
// secciones de una herramienta de análisis es un precio irrelevante.

import { Search } from "lucide-react"
import { ThemeToggle } from "@/components/layout/ThemeToggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4">
        <a href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-bold tracking-tight text-foreground">
            Log <span className="text-accent">Intelligence</span>
          </span>
        </a>

        <div className="flex-1" />

        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface-1 px-3 text-xs text-dim transition-colors hover:border-faint hover:text-fg-2"
          aria-label="Open search"
        >
          <Search className="h-3 w-3" />
          <span className="hidden sm:inline">Search logs, techniques…</span>
          <kbd className="ml-1 hidden font-mono text-[10px] text-faint sm:inline">⌘K</kbd>
        </button>

        <nav className="flex items-center">
          <a
            href="/explore"
            className="rounded px-3 py-1.5 text-xs text-fg-2 transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Explore
          </a>
          <a
            href="/exploit"
            className="rounded px-3 py-1.5 text-xs text-fg-2 transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Exploit
          </a>
          <a
            href="/coverage"
            className="rounded px-3 py-1.5 text-xs text-fg-2 transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Coverage
          </a>
        </nav>

        <ThemeToggle />
      </div>
    </header>
  )
}
