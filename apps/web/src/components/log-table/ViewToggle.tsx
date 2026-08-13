"use client"

import { useQueryState, parseAsStringEnum } from "nuqs"
import { LayoutList, Table2 } from "lucide-react"

export function ViewToggle() {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum(["compact", "full"]).withDefault("full"),
  )

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface-1 p-0.5">
      <button
        type="button"
        onClick={() => setView("compact")}
        title="Compact view"
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
          view === "compact"
            ? "bg-accent-weak font-semibold text-accent"
            : "text-dim hover:text-fg-2"
        }`}
      >
        <LayoutList className="h-3 w-3" />
        <span className="hidden sm:inline">Compact</span>
      </button>
      <button
        type="button"
        onClick={() => setView("full")}
        title="Full view"
        className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
          view === "full"
            ? "bg-accent-weak font-semibold text-accent"
            : "text-dim hover:text-fg-2"
        }`}
      >
        <Table2 className="h-3 w-3" />
        <span className="hidden sm:inline">Full</span>
      </button>
    </div>
  )
}
