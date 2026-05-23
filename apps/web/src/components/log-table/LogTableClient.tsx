"use client"

// ─── Data source switch ───────────────────────────────────────────────────────
// Toggle USE_MOCK to false when the backend API is ready.
// The real data path uses useLogsQuery (TanStack Query → api.logs.list).
const USE_MOCK = true
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table"
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs"
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { useFilterParams } from "@/hooks/useFilterParams"
import { useLogsQuery } from "@/hooks/useLogsQuery"
import { getMockLogs, MOCK_FILTER_CATEGORIES } from "@/lib/mock-data"
import { FilterChips } from "@/components/filters/FilterChips"
import { ViewToggle } from "@/components/log-table/ViewToggle"
import { CommandPalette } from "@/components/filters/CommandPalette"
import { fullColumns, compactColumns } from "@/components/log-table/columns"
import type { FilterCategory } from "@/lib/types"

interface LogTableClientProps {
  // Categories come from /filters/categories; fallback to mock when USE_MOCK
  categories?: FilterCategory[]
  platformName?: string
}

export function LogTableClient({ categories, platformName }: LogTableClientProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  const [q] = useQueryState("q", parseAsString.withDefault(""))
  const [view] = useQueryState("view", parseAsStringEnum(["compact", "full"]).withDefault("full"))
  const { filters } = useFilterParams()

  const resolvedCategories = USE_MOCK ? MOCK_FILTER_CATEGORIES : (categories ?? [])

  // ── Data ──────────────────────────────────────────────────────────────────
  // MOCK path: synchronous, no network.
  const mockResult = USE_MOCK ? getMockLogs(filters, q) : null

  // REAL path: swap USE_MOCK to false and this hook takes over.
  // TODO: pass cursor for next-page when implementing infinite scroll.
  const realQuery = useLogsQuery(
    USE_MOCK
      ? { q: "", filters: {}, view: "full" } // disabled — hook still runs but result is ignored
      : { q, filters, view },
  )

  const logs = USE_MOCK ? (mockResult?.items ?? []) : (realQuery.data?.items ?? [])
  const total = USE_MOCK ? (mockResult?.total ?? 0) : (realQuery.data?.total ?? 0)
  const isLoading = !USE_MOCK && realQuery.isLoading
  const isError = !USE_MOCK && realQuery.isError

  // ── Table ─────────────────────────────────────────────────────────────────
  const columns = view === "compact" ? compactColumns : fullColumns

  const table = useReactTable({
    data: logs,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: !USE_MOCK,  // when real API is used, sorting is server-driven
  })

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Platform breadcrumb */}
          {platformName && (
            <span className="font-mono text-xs text-zinc-500">
              {platformName}
              <span className="mx-1.5 text-zinc-700">/</span>
            </span>
          )}

          {/* Active filter chips */}
          <FilterChips categories={resolvedCategories} />

          {/* Search pill */}
          {q && (
            <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 font-mono text-xs text-zinc-300">
              <span className="text-zinc-500">q:</span> {q}
            </span>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
          >
            Search / Filter
            <kbd className="font-mono text-[10px] text-zinc-700">⌘K</kbd>
          </button>
          <ViewToggle />
        </div>
      </div>

      {/* ── Mock badge ── */}
      {USE_MOCK && (
        <div className="flex items-center gap-2 border-b border-dashed border-amber-900/50 bg-amber-950/20 px-4 py-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-600">Mock data</span>
          <span className="text-[10px] text-amber-800">
            Set USE_MOCK = false in LogTableClient.tsx to connect the real API.
          </span>
        </div>
      )}

      {/* ── States ── */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      )}

      {isError && (
        <div className="flex flex-1 items-center justify-center text-sm text-red-400">
          Failed to load logs. Is the API running?
        </div>
      )}

      {/* ── Table ── */}
      {!isLoading && !isError && (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-950">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-zinc-800">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="px-4 py-2.5 text-left"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-center text-sm text-zinc-600"
                  >
                    No logs match the current filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/60"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="px-4 py-2.5 align-top"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950 px-4 py-2">
        <span className="font-mono text-xs text-zinc-600">
          {total.toLocaleString()} log{total !== 1 ? "s" : ""}
          {USE_MOCK ? " (mock)" : ""}
        </span>
        <div className="flex items-center gap-1 text-xs text-zinc-700">
          {/* TODO: cursor-based pagination controls */}
          <span>pagination coming soon</span>
        </div>
      </div>

      {/* ── Command Palette ── */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        categories={resolvedCategories}
        mockLogs={logs}
      />
    </div>
  )
}
