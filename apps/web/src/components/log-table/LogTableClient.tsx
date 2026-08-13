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
import { useLogsInfiniteQuery } from "@/hooks/useLogsQuery"
import { getMockLogs, MOCK_FILTER_CATEGORIES } from "@/lib/mock-data"
import { FilterChips } from "@/components/filters/FilterChips"
import { ViewToggle } from "@/components/log-table/ViewToggle"
import { CommandPalette } from "@/components/filters/CommandPalette"
import { fullColumns, compactColumns } from "@/components/log-table/columns"
import { api, ApiError } from "@/lib/api"
import { UNKNOWN_FILTER_CATEGORY, type FilterCategory } from "@/lib/types"

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
  const { filters, clearAllFilters } = useFilterParams()

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
  const realQuery = useLogsInfiniteQuery(
    USE_MOCK
      ? { q: "", filters: {}, view: "full" } // disabled — hook still runs but result is ignored
      : { q, filters, view },
  )

  const pages = realQuery.data?.pages ?? []
  const logs = USE_MOCK ? (mockResult?.items ?? []) : pages.flatMap((page) => page.items)
  const total = USE_MOCK ? (mockResult?.total ?? 0) : (pages[0]?.total ?? 0)
  // `isPending`, no `isLoading`: cubre también el caso en que React Query deja
  // el fetch en pausa. Sin esto la tabla pinta "No logs match the current
  // filters" mientras la query aún no ha resuelto, que es sencillamente falso.
  const isLoading = !USE_MOCK && realQuery.isPending
  const isError = !USE_MOCK && realQuery.isError

  // La API rechaza categorías de filtro que no existen en vez de ignorarlas.
  // Suele venir de una URL compartida que quedó obsoleta.
  const unknownFilterKeys =
    realQuery.error instanceof ApiError && realQuery.error.code === UNKNOWN_FILTER_CATEGORY
      ? realQuery.error.keys
      : []

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

      {isError && unknownFilterKeys.length > 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-amber-400">
            Unknown filter {unknownFilterKeys.length === 1 ? "category" : "categories"}:{" "}
            <span className="font-mono">{unknownFilterKeys.join(", ")}</span>
          </p>
          <p className="max-w-md text-xs text-zinc-500">
            {unknownFilterKeys.length === 1 ? "That isn't a" : "Those aren't"} filterable
            {unknownFilterKeys.length === 1 ? " category" : " categories"}. This usually
            comes from a shared URL that is out of date.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
          >
            Clear filters
          </button>
        </div>
      )}

      {isError && unknownFilterKeys.length === 0 && (
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
          {logs.length.toLocaleString()} of {total.toLocaleString()} log
          {total !== 1 ? "s" : ""}
          {USE_MOCK ? " (mock)" : ""}
        </span>
        <div className="flex items-center gap-2 text-xs">
          {!USE_MOCK && realQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => void realQuery.fetchNextPage()}
              disabled={realQuery.isFetchingNextPage}
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50"
            >
              {realQuery.isFetchingNextPage && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              Load more
            </button>
          )}
          {!USE_MOCK && !realQuery.hasNextPage && logs.length > 0 && (
            <span className="text-zinc-700">end of results</span>
          )}
        </div>
      </div>

      {/* ── Command Palette ── */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        categories={resolvedCategories}
      />
    </div>
  )
}
