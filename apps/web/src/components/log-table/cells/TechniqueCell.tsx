"use client"

import type { TechniqueRef } from "@/lib/types"
import { useFilterParams } from "@/hooks/useFilterParams"

interface TechniqueCellProps {
  techniques: TechniqueRef[]
  compact?: boolean
}

// Alpha backgrounds + dark: text variants so badges read on both themes.
const TACTIC_COLORS: Record<string, string> = {
  execution:              "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  persistence:            "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  "privilege-escalation": "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  "defense-evasion":      "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "credential-access":    "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  discovery:              "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "lateral-movement":     "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "command-and-control":  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  exfiltration:           "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  impact:                 "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "initial-access":       "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "collection":           "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
}

function tacticColor(tactic: string) {
  return TACTIC_COLORS[tactic] ?? "border-line bg-badge text-dim"
}

export function TechniqueCell({ techniques, compact = false }: TechniqueCellProps) {
  const { setFilter, filters } = useFilterParams()

  if (techniques.length === 0) return <span className="text-faint">—</span>

  // In compact mode show count badge only
  if (compact) {
    return (
      <span className="font-mono text-xs text-dim">
        {techniques.length} technique{techniques.length !== 1 ? "s" : ""}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {techniques.map((t) => {
        const primaryTactic = t.tactic[0] ?? "unknown"
        const isActive = filters.tactic?.includes(primaryTactic)
        return (
          <button
            key={t.id}
            type="button"
            title={`${t.id} · ${t.name}\nClick to filter by tactic: ${primaryTactic}`}
            onClick={() => {
              const current = filters.tactic ?? []
              if (isActive) return
              setFilter("tactic", [...current, primaryTactic])
            }}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-opacity hover:opacity-80 ${tacticColor(primaryTactic)} ${isActive ? "opacity-60" : ""}`}
          >
            <span>{t.id}</span>
          </button>
        )
      })}
    </div>
  )
}
