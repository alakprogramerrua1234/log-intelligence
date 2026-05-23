import Link from "next/link"
import { Search } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-sm font-bold tracking-tight text-zinc-100">
            LOG<span className="text-emerald-400">INT</span>
          </span>
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
          aria-label="Open search"
        >
          <Search className="h-3 w-3" />
          <span className="hidden sm:inline">Search logs, techniques…</span>
          <kbd className="ml-1 hidden font-mono text-[10px] text-zinc-700 sm:inline">⌘K</kbd>
        </button>

        <nav className="flex items-center">
          <Link
            href="/explore"
            className="rounded px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Explore
          </Link>
          <Link
            href="/coverage"
            className="rounded px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Coverage
          </Link>
        </nav>
      </div>
    </header>
  )
}
