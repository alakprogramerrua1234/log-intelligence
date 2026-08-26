import Link from "next/link"
import { ThemeToggle } from "@/components/layout/ThemeToggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-bold tracking-tight text-foreground">
            Log <span className="text-accent">Intelligence</span>
          </span>
        </Link>

        <div className="flex-1" />

        <nav className="flex items-center">
          <Link
            href="/explore"
            className="rounded px-3 py-1.5 text-xs text-fg-2 transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Explore
          </Link>
          <Link
            href="/exploit"
            className="rounded px-3 py-1.5 text-xs text-fg-2 transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Exploit
          </Link>
          <Link
            href="/coverage"
            className="rounded px-3 py-1.5 text-xs text-fg-2 transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Coverage
          </Link>
        </nav>

        <ThemeToggle />
      </div>
    </header>
  )
}
