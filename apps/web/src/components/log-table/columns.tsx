import { createColumnHelper } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import type { Log } from "@/lib/types"
import { EventIdCell } from "./cells/EventIdCell"
import { TechniqueCell } from "./cells/TechniqueCell"

const col = createColumnHelper<Log>()

// Column header that shows a sort icon and toggles sort on click.
// column.id must match a FilterCategory key to enable click-to-palette (§4.4).
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

// Full view: all columns including channel and relevance score.
export const fullColumns = [
  col.accessor("event_id", {
    header: ({ column }) => <SortableHeader label="Event ID" column={column} />,
    size: 95,
    cell: (info) => <EventIdCell eventId={info.getValue()} />,
  }),
  col.accessor("name", {
    header: ({ column }) => <SortableHeader label="Name" column={column} />,
    size: 220,
    cell: (info) => <span className="text-sm text-zinc-200">{info.getValue()}</span>,
  }),
  col.accessor("log_source_name", {
    header: ({ column }) => <SortableHeader label="Log Source" column={column} />,
    size: 140,
    cell: (info) => <span className="font-mono text-xs text-zinc-400">{info.getValue()}</span>,
  }),
  col.accessor("relevance", {
    header: ({ column }) => <SortableHeader label="Relevance" column={column} />,
    size: 90,
    cell: (info) => {
      const val = info.getValue()
      const color =
        val >= 85 ? "text-emerald-400" : val >= 60 ? "text-yellow-400" : "text-zinc-500"
      return <span className={`font-mono text-xs font-semibold ${color}`}>{val}</span>
    },
  }),
  col.accessor("techniques", {
    header: () => (
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        Techniques
      </span>
    ),
    size: 260,
    enableSorting: false,
    cell: (info) => <TechniqueCell techniques={info.getValue()} />,
  }),
]

// Compact view: minimal columns for a denser layout.
export const compactColumns = [
  col.accessor("event_id", {
    header: ({ column }) => <SortableHeader label="Event ID" column={column} />,
    size: 95,
    cell: (info) => <EventIdCell eventId={info.getValue()} />,
  }),
  col.accessor("name", {
    header: ({ column }) => <SortableHeader label="Name" column={column} />,
    size: 320,
    cell: (info) => <span className="text-sm text-zinc-200">{info.getValue()}</span>,
  }),
  col.accessor("log_source_name", {
    header: ({ column }) => <SortableHeader label="Log Source" column={column} />,
    size: 140,
    cell: (info) => <span className="font-mono text-xs text-zinc-400">{info.getValue()}</span>,
  }),
  col.accessor("techniques", {
    header: () => (
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        Techniques
      </span>
    ),
    size: 120,
    enableSorting: false,
    cell: (info) => <TechniqueCell techniques={info.getValue()} compact />,
  }),
]
