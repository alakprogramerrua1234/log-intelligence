"use client"

// ─── Data source switch ───────────────────────────────────────────────────────
// Toggle USE_MOCK to false when the backend API is ready.
// The real data path uses useLogsQuery (TanStack Query → api.logs.list).
const USE_MOCK = false
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
import { useQuery } from "@tanstack/react-query"
import { useFilterParams } from "@/hooks/useFilterParams"
import { useLogsQuery } from "@/hooks/useLogsQuery"
import { getMockLogs, MOCK_FILTER_CATEGORIES } from "@/lib/mock-data"
import { FilterChips } from "@/components/filters/FilterChips"
import { ViewToggle } from "@/components/log-table/ViewToggle"
import { CommandPalette } from "@/components/filters/CommandPalette"
import { fullColumns, compactColumns } from "@/components/log-table/columns"
import { api } from "@/lib/api"
import type { FilterCategory } from "@/lib/types"

interface LogTableClientProps {
  // Categories come from /filters/categories; fallback to mock when USE_MOCK
  categories?: FilterCategory[]
  platformName?: string
}

export function LogTableClient({ categories, platformName }: LogTableClientProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteCategory, setPaletteCategory] = useState<import("@/lib/types").FilterCategory | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const [q] = useQueryState("q", parseAsString.withDefault(""))
  const [view] = useQueryState("view", parseAsStringEnum(["compact", "full"]).withDefault("full"))
  const { filters } = useFilterParams()

  const categoriesQuery = useQuery({
    queryKey: ["filter-categories"],
    queryFn: api.filters.categories,
    enabled: !USE_MOCK,
    staleTime: Infinity,
  })

  // Precedence: API data → prop → mock fallback
  const resolvedCategories: FilterCategory[] = USE_MOCK
    ? MOCK_FILTER_CATEGORIES
    : (categoriesQuery.data?.length ? categoriesQuery.data : (categories?.length ? categories : MOCK_FILTER_CATEGORIES))

  // ── Data ──────────────────────────────────────────────────────────────────
  // MOCK path: synchronous, no network.
  const mockResult = USE_MOCK ? getMockLogs(filters, q) : null

  // REAL path: swap USE_MOCK to false and this hook takes over.
  // TODO: pass cursor for next-page when implementing infinite scroll.
  const sortBy  = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? "desc" : "asc"

  const realQuery = useLogsQuery(
    USE_MOCK
      ? { q: "", filters: {}, view: "full" } // disabled — hook still runs but result is ignored
      : { q, filters, view, sort_by: sortBy, sort_dir: sortDir },
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
    manualSorting: !USE_MOCK,
    meta: {
      openPaletteWithCategory: (categoryKey: string) => {
        const cat = resolvedCategories.find((c) => c.key === categoryKey) ?? null
        setPaletteCategory(cat)
        setPaletteOpen(true)
      },
    },
  })

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-background px-4 py-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Platform breadcrumb */}
          {platformName && (
            <span className="font-mono text-xs text-dim">
              {platformName}
              <span className="mx-1.5 text-faint">/</span>
            </span>
          )}

          {/* Active filter chips */}
          <FilterChips categories={resolvedCategories} />

          {/* Search pill */}
          {q && (
            <span className="inline-flex items-center gap-1 rounded border border-line bg-surface-1 px-2 py-0.5 font-mono text-xs text-fg-2">
              <span className="text-dim">q:</span> {q}
            </span>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface-1 px-2.5 text-xs text-dim transition-colors hover:border-faint hover:text-fg-2"
          >
            Search / Filter
            <kbd className="font-mono text-[10px] text-faint">⌘K</kbd>
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
          <Loader2 className="h-5 w-5 animate-spin text-dim" />
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
            <thead className="sticky top-0 z-10 bg-thead">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-line">
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
                    className="py-16 text-center text-sm text-dim"
                  >
                    No logs match the current filters.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group border-b border-line-soft transition-colors even:bg-zebra hover:bg-row-hover"
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
      <div className="flex items-center justify-between border-t border-line bg-background px-4 py-2">
        <span className="font-mono text-xs text-dim">
          {total.toLocaleString()} log{total !== 1 ? "s" : ""}
          {USE_MOCK ? " (mock)" : ""}
        </span>
        <div className="flex items-center gap-1 text-xs text-faint">
          {/* TODO: cursor-based pagination controls */}
          <span>pagination coming soon</span>
        </div>
      </div>

      {/* ── Command Palette ── */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={(v) => { setPaletteOpen(v); if (!v) setPaletteCategory(null) }}
        categories={resolvedCategories}
        openWithCategory={paletteCategory}
      />
    </div>
  )
}
