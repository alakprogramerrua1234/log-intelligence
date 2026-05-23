"use client"

import type { TechniqueRef } from "@/lib/types"
import { useFilterParams } from "@/hooks/useFilterParams"

interface TechniqueCellProps {
  techniques: TechniqueRef[]
  compact?: boolean
}

const TACTIC_COLORS: Record<string, string> = {
  execution:              "border-orange-800/60 bg-orange-950/40 text-orange-400",
  persistence:            "border-yellow-800/60 bg-yellow-950/40 text-yellow-400",
  "privilege-escalation": "border-red-800/60 bg-red-950/40 text-red-400",
  "defense-evasion":      "border-purple-800/60 bg-purple-950/40 text-purple-400",
  "credential-access":    "border-pink-800/60 bg-pink-950/40 text-pink-400",
  discovery:              "border-sky-800/60 bg-sky-950/40 text-sky-400",
  "lateral-movement":     "border-indigo-800/60 bg-indigo-950/40 text-indigo-400",
  "command-and-control":  "border-emerald-800/60 bg-emerald-950/40 text-emerald-400",
  exfiltration:           "border-teal-800/60 bg-teal-950/40 text-teal-400",
  impact:                 "border-rose-800/60 bg-rose-950/40 text-rose-400",
  "initial-access":       "border-amber-800/60 bg-amber-950/40 text-amber-400",
  "collection":           "border-cyan-800/60 bg-cyan-950/40 text-cyan-400",
}

function tacticColor(tactic: string) {
  return TACTIC_COLORS[tactic] ?? "border-zinc-700 bg-zinc-800/60 text-zinc-400"
}

export function TechniqueCell({ techniques, compact = false }: TechniqueCellProps) {
  const { setFilter, filters } = useFilterParams()

  if (techniques.length === 0) return <span className="text-zinc-700">—</span>

  // In compact mode show count badge only
  if (compact) {
    return (
      <span className="font-mono text-xs text-zinc-400">
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
