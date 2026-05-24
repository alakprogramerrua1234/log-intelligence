import { createColumnHelper } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { Log, TechniqueRef } from "@/lib/types"
import { EventIdCell } from "./cells/EventIdCell"

const col = createColumnHelper<Log>()

function SortableHeader({
  label,
  column,
}: {
  label: string
  column: {
    getToggleSortingHandler: () => ((e: unknown) => void) | undefined
    getIsSorted: () => false | "asc" | "desc"
  }
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-400"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />
    </button>
  )
}

function StaticHeader({ label }: { label: string }) {
  return (
    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
      {label}
    </span>
  )
}

function primary(techniques: TechniqueRef[]): TechniqueRef | null {
  return techniques[0] ?? null
}

// Full view: log_source → event_id → tactic → technique_id → technique_name → subtechnique_id → subtechnique_name → ranking
export const fullColumns = [
  col.accessor("log_source_name", {
    header: ({ column }) => <SortableHeader label="Log Source" column={column} />,
    size: 150,
    cell: (info) => (
      <span className="font-mono text-xs text-zinc-400">{info.getValue()}</span>
    ),
  }),
  col.accessor("event_id", {
    header: ({ column }) => <SortableHeader label="Event ID" column={column} />,
    size: 95,
    cell: (info) => <EventIdCell eventId={info.getValue()} />,
  }),
  col.accessor("techniques", {
    id: "tactic",
    header: () => <StaticHeader label="Tactic" />,
    size: 160,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t) return <span className="text-zinc-700">—</span>
      const tactic = t.tactic[0] ?? null
      if (!tactic) return <span className="text-zinc-700">—</span>
      const extra = t.tactic.length - 1
      return (
        <span className="font-mono text-xs text-zinc-300">
          {tactic}
          {extra > 0 && <span className="ml-1 text-zinc-600">+{extra}</span>}
        </span>
      )
    },
  }),
  col.accessor("techniques", {
    id: "technique_id",
    header: () => <StaticHeader label="Technique ID" />,
    size: 110,
    enableSorting: false,
    cell: (info) => {
      const techniques = info.getValue()
      const t = primary(techniques)
      if (!t) return <span className="text-zinc-700">—</span>
      const extra = techniques.length - 1
      return (
        <span className="font-mono text-xs text-zinc-300">
          {t.technique_id}
          {extra > 0 && <span className="ml-1 text-zinc-600">+{extra}</span>}
        </span>
      )
    },
  }),
  col.accessor("techniques", {
    id: "technique_name",
    header: () => <StaticHeader label="Technique Name" />,
    size: 210,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t) return <span className="text-zinc-700">—</span>
      return <span className="text-xs text-zinc-300">{t.technique_name}</span>
    },
  }),
  col.accessor("techniques", {
    id: "subtechnique_id",
    header: () => <StaticHeader label="Subtechnique ID" />,
    size: 130,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t || t.id === t.technique_id) return <span className="text-zinc-700">—</span>
      return <span className="font-mono text-xs text-zinc-300">{t.id}</span>
    },
  }),
  col.accessor("techniques", {
    id: "subtechnique_name",
    header: () => <StaticHeader label="Subtechnique Name" />,
    size: 200,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t || t.id === t.technique_id) return <span className="text-zinc-700">—</span>
      return <span className="text-xs text-zinc-300">{t.name}</span>
    },
  }),
  col.accessor("relevance", {
    header: ({ column }) => <SortableHeader label="Ranking" column={column} />,
    size: 90,
    cell: (info) => {
      const val = info.getValue()
      const color =
        val >= 85 ? "text-emerald-400" : val >= 60 ? "text-yellow-400" : "text-zinc-500"
      return <span className={`font-mono text-xs font-semibold ${color}`}>{val}</span>
    },
  }),
]

// Compact view: same order, technique_name and subtechnique_name omitted to preserve density
export const compactColumns = [
  col.accessor("log_source_name", {
    header: ({ column }) => <SortableHeader label="Log Source" column={column} />,
    size: 150,
    cell: (info) => (
      <span className="font-mono text-xs text-zinc-400">{info.getValue()}</span>
    ),
  }),
  col.accessor("event_id", {
    header: ({ column }) => <SortableHeader label="Event ID" column={column} />,
    size: 95,
    cell: (info) => <EventIdCell eventId={info.getValue()} />,
  }),
  col.accessor("techniques", {
    id: "tactic",
    header: () => <StaticHeader label="Tactic" />,
    size: 140,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t) return <span className="text-zinc-700">—</span>
      const tactic = t.tactic[0] ?? null
      if (!tactic) return <span className="text-zinc-700">—</span>
      return <span className="font-mono text-xs text-zinc-300">{tactic}</span>
    },
  }),
  col.accessor("techniques", {
    id: "technique_id",
    header: () => <StaticHeader label="Technique ID" />,
    size: 110,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t) return <span className="text-zinc-700">—</span>
      return <span className="font-mono text-xs text-zinc-300">{t.technique_id}</span>
    },
  }),
  col.accessor("techniques", {
    id: "subtechnique_id",
    header: () => <StaticHeader label="Subtechnique ID" />,
    size: 130,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t || t.id === t.technique_id) return <span className="text-zinc-700">—</span>
      return <span className="font-mono text-xs text-zinc-300">{t.id}</span>
    },
  }),
  col.accessor("relevance", {
    header: ({ column }) => <SortableHeader label="Ranking" column={column} />,
    size: 90,
    cell: (info) => {
      const val = info.getValue()
      const color =
        val >= 85 ? "text-emerald-400" : val >= 60 ? "text-yellow-400" : "text-zinc-500"
      return <span className={`font-mono text-xs font-semibold ${color}`}>{val}</span>
    },
  }),
]
