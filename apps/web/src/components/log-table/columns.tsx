import { createColumnHelper, type RowData } from "@tanstack/react-table"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import type { Log, TechniqueRef } from "@/lib/types"
import { EventIdCell } from "./cells/EventIdCell"
import { FilterableCell } from "./cells/FilterableCell"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    openPaletteWithCategory?: (categoryKey: string) => void
  }
}

const col = createColumnHelper<Log>()

function SortableHeader({
  label,
  column,
  onFilterClick,
}: {
  label: string
  column: {
    getToggleSortingHandler: () => ((e: unknown) => void) | undefined
    getIsSorted: () => false | "asc" | "desc"
  }
  onFilterClick?: () => void
}) {
  const sorted = column.getIsSorted()
  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={onFilterClick}
        className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-300 transition-colors"
        title={onFilterClick ? `Filter by ${label}` : undefined}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={column.getToggleSortingHandler()}
        className={`transition-colors ${sorted ? "text-zinc-300" : "text-zinc-700 hover:text-zinc-400"}`}
        title={sorted === "asc" ? "Sorted ascending — click for descending" : sorted === "desc" ? "Sorted descending — click to clear" : "Sort"}
      >
        <SortIcon className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

function FilterableHeader({ label, onFilterClick }: { label: string; onFilterClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onFilterClick}
      className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600 hover:text-zinc-300 transition-colors"
      title={`Filter by ${label}`}
    >
      {label}
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
    header: ({ column, table }) => (
      <SortableHeader
        label="Log Source"
        column={column}
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("log_source")}
      />
    ),
    size: 150,
    cell: (info) => (
      <FilterableCell category="log_source" value={info.getValue()}>
        <span className="font-mono text-xs text-zinc-400">{info.getValue()}</span>
      </FilterableCell>
    ),
  }),
  col.accessor("event_id", {
    header: ({ column, table }) => (
      <SortableHeader
        label="Event ID"
        column={column}
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("event_id")}
      />
    ),
    size: 95,
    cell: (info) => (
      <FilterableCell category="event_id" value={info.getValue()}>
        <EventIdCell eventId={info.getValue()} />
      </FilterableCell>
    ),
  }),
  col.accessor("techniques", {
    id: "tactic",
    header: ({ table }) => (
      <FilterableHeader
        label="Tactic"
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("tactic")}
      />
    ),
    size: 160,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t) return <span className="text-zinc-700">—</span>
      const tactic = t.tactic[0] ?? null
      if (!tactic) return <span className="text-zinc-700">—</span>
      const extra = t.tactic.length - 1
      return (
        <FilterableCell category="tactic" value={tactic}>
          <span className="font-mono text-xs text-zinc-300">
            {tactic}
            {extra > 0 && <span className="ml-1 text-zinc-600">+{extra}</span>}
          </span>
        </FilterableCell>
      )
    },
  }),
  col.accessor("techniques", {
    id: "technique_id",
    header: ({ table }) => (
      <FilterableHeader
        label="Technique ID"
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("technique")}
      />
    ),
    size: 110,
    enableSorting: false,
    cell: (info) => {
      const techniques = info.getValue()
      const t = primary(techniques)
      if (!t) return <span className="text-zinc-700">—</span>
      const extra = techniques.length - 1
      return (
        <FilterableCell category="technique" value={t.technique_id}>
          <span className="font-mono text-xs text-zinc-300">
            {t.technique_id}
            {extra > 0 && <span className="ml-1 text-zinc-600">+{extra}</span>}
          </span>
        </FilterableCell>
      )
    },
  }),
  col.accessor("techniques", {
    id: "technique_name",
    header: ({ table }) => (
      <FilterableHeader
        label="Technique Name"
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("technique")}
      />
    ),
    size: 210,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t) return <span className="text-zinc-700">—</span>
      return (
        <FilterableCell category="technique" value={t.technique_id}>
          <span className="text-xs text-zinc-300">{t.technique_name}</span>
        </FilterableCell>
      )
    },
  }),
  col.accessor("techniques", {
    id: "subtechnique_id",
    header: ({ table }) => (
      <FilterableHeader
        label="Subtechnique ID"
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("subtechnique")}
      />
    ),
    size: 130,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t || t.id === t.technique_id) return <span className="text-zinc-700">—</span>
      return (
        <FilterableCell category="subtechnique" value={t.id}>
          <span className="font-mono text-xs text-zinc-300">{t.id}</span>
        </FilterableCell>
      )
    },
  }),
  col.accessor("techniques", {
    id: "subtechnique_name",
    header: ({ table }) => (
      <FilterableHeader
        label="Subtechnique Name"
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("subtechnique")}
      />
    ),
    size: 200,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t || t.id === t.technique_id) return <span className="text-zinc-700">—</span>
      return (
        <FilterableCell category="subtechnique" value={t.id}>
          <span className="text-xs text-zinc-300">{t.name}</span>
        </FilterableCell>
      )
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
    header: ({ column, table }) => (
      <SortableHeader
        label="Log Source"
        column={column}
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("log_source")}
      />
    ),
    size: 150,
    cell: (info) => (
      <FilterableCell category="log_source" value={info.getValue()}>
        <span className="font-mono text-xs text-zinc-400">{info.getValue()}</span>
      </FilterableCell>
    ),
  }),
  col.accessor("event_id", {
    header: ({ column, table }) => (
      <SortableHeader
        label="Event ID"
        column={column}
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("event_id")}
      />
    ),
    size: 95,
    cell: (info) => (
      <FilterableCell category="event_id" value={info.getValue()}>
        <EventIdCell eventId={info.getValue()} />
      </FilterableCell>
    ),
  }),
  col.accessor("techniques", {
    id: "tactic",
    header: ({ table }) => (
      <FilterableHeader
        label="Tactic"
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("tactic")}
      />
    ),
    size: 140,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t) return <span className="text-zinc-700">—</span>
      const tactic = t.tactic[0] ?? null
      if (!tactic) return <span className="text-zinc-700">—</span>
      return (
        <FilterableCell category="tactic" value={tactic}>
          <span className="font-mono text-xs text-zinc-300">{tactic}</span>
        </FilterableCell>
      )
    },
  }),
  col.accessor("techniques", {
    id: "technique_id",
    header: ({ table }) => (
      <FilterableHeader
        label="Technique ID"
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("technique")}
      />
    ),
    size: 110,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t) return <span className="text-zinc-700">—</span>
      return (
        <FilterableCell category="technique" value={t.technique_id}>
          <span className="font-mono text-xs text-zinc-300">{t.technique_id}</span>
        </FilterableCell>
      )
    },
  }),
  col.accessor("techniques", {
    id: "subtechnique_id",
    header: ({ table }) => (
      <FilterableHeader
        label="Subtechnique ID"
        onFilterClick={() => table.options.meta?.openPaletteWithCategory?.("subtechnique")}
      />
    ),
    size: 130,
    enableSorting: false,
    cell: (info) => {
      const t = primary(info.getValue())
      if (!t || t.id === t.technique_id) return <span className="text-zinc-700">—</span>
      return (
        <FilterableCell category="subtechnique" value={t.id}>
          <span className="font-mono text-xs text-zinc-300">{t.id}</span>
        </FilterableCell>
      )
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
