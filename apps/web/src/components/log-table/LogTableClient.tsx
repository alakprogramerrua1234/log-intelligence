"use client"

// ─── Data source switch ───────────────────────────────────────────────────────
// Toggle USE_MOCK to false when the backend API is ready.
// The real data path uses useLogsQuery (TanStack Query → api.logs.list).
const USE_MOCK = false
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table"
import { Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useFilterParams } from "@/hooks/useFilterParams"
import { useLogsInfiniteQuery } from "@/hooks/useLogsQuery"
import { getMockLogs, MOCK_FILTER_CATEGORIES } from "@/lib/mock-data"
import { FilterChips } from "@/components/filters/FilterChips"
import { ViewToggle } from "@/components/log-table/ViewToggle"
import { CommandPalette } from "@/components/filters/CommandPalette"
import { fullColumns, compactColumns } from "@/components/log-table/columns"
import { api, ApiError } from "@/lib/api"
import { UNKNOWN_FILTER_CATEGORY, type FilterCategory, type Log } from "@/lib/types"
import { formatCount } from "@/lib/format"

interface LogTableClientProps {
  // Categories come from /filters/categories; fallback to mock when USE_MOCK
  categories?: FilterCategory[]
}

export function LogTableClient({ categories }: LogTableClientProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteCategory, setPaletteCategory] = useState<import("@/lib/types").FilterCategory | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const { filters, setFilter, clearAllFilters, q, view } = useFilterParams()

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
  const mockResult = useMemo(() => (USE_MOCK ? getMockLogs(filters, q) : null), [filters, q])

  // REAL path: swap USE_MOCK to false and this hook takes over.
  // La ordenación es server-driven: viaja a la API y vuelve paginada. Cambiarla
  // invalida el cursor en el backend, así que la query arranca de cero sola.
  const sortBy  = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? "desc" : "asc"

  const realQuery = useLogsInfiniteQuery(
    USE_MOCK
      ? { q: "", filters: {}, view: "full" } // disabled — hook still runs but result is ignored
      : { q, filters, view, sort_by: sortBy, sort_dir: sortDir },
  )

  // `logs` tiene que conservar identidad entre renders (de ahí la memo sobre
  // `realQuery.data`, que React Query mantiene estable por structural sharing).
  // Con un array nuevo por render, el row model de TanStack Table se recalcula
  // en cada render y su autoResetPageIndex encola un setState, que provoca otro
  // render con otro array nuevo: un bucle de commits infinito pero silencioso.
  // Al primer evento de input real, React drena ese trabajo pendiente en un
  // flush síncrono que nunca termina y /explore se congela por completo.
  const pages = realQuery.data?.pages
  const logs = useMemo<Log[]>(
    () => (USE_MOCK ? (mockResult?.items ?? []) : (pages?.flatMap((page) => page.items) ?? [])),
    [mockResult, pages],
  )
  const total = USE_MOCK ? (mockResult?.total ?? 0) : (pages?.[0]?.total ?? 0)
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
    manualSorting: !USE_MOCK,
    meta: {
      openPaletteWithCategory: (categoryKey: string) => {
        const cat = resolvedCategories.find((c) => c.key === categoryKey) ?? null
        setPaletteCategory(cat)
        setPaletteOpen(true)
      },
      // Se resuelven aquí, una vez, y viajan a las celdas por `meta`. Antes cada
      // celda montaba `useFilterParams` por su cuenta — más de mil instancias.
      filters,
      addFilter: (category: string, value: string) => {
        const current = filters[category] ?? []
        if (current.includes(value)) return
        setFilter(category, [...current, value])
      },
    },
  })

  // Virtualización: solo se renderizan las filas visibles.
  //
  // Sin esto se montaban 200 filas x 8 columnas en cada render, y CUALQUIER
  // cambio de estado — abrir el buscador, cambiar de vista — repintaba las 1.600
  // celdas. En desarrollo eso bloqueaba el hilo principal más de 10 segundos: la
  // página parecía colgada con cualquier clic.
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 37,
    overscan: 12,
  })
  const virtualRows = virtualizer.getVirtualItems()
  const paddingTop = virtualRows[0]?.start ?? 0
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-background px-4 py-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
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

      {isError && unknownFilterKeys.length > 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-accent">
            Unknown filter {unknownFilterKeys.length === 1 ? "category" : "categories"}:{" "}
            <span className="font-mono">{unknownFilterKeys.join(", ")}</span>
          </p>
          <p className="max-w-md text-xs text-dim">
            {unknownFilterKeys.length === 1 ? "That isn't a" : "Those aren't"} filterable
            {unknownFilterKeys.length === 1 ? " category" : " categories"}. This usually
            comes from a shared URL that is out of date.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="rounded-md border border-line bg-surface-1 px-3 py-1.5 text-xs text-fg-2 transition-colors hover:border-faint hover:text-foreground"
          >
            Clear filters
          </button>
        </div>
      )}

      {isError && unknownFilterKeys.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-sm text-red-500">
          Failed to load logs. Is the API running?
        </div>
      )}

      {/* ── Table ── */}
      {!isLoading && !isError && (
        <div ref={scrollRef} className="flex-1 overflow-auto">
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
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-center text-sm text-dim"
                  >
                    No logs match the current filters.
                  </td>
                </tr>
              ) : (
                <>
                  {/* Filas espaciadoras: mantienen la barra de scroll coherente
                      con el total sin renderizar lo que no se ve. */}
                  {paddingTop > 0 && (
                    <tr aria-hidden>
                      <td colSpan={columns.length} style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    return (
                      <tr
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
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
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden>
                      <td colSpan={columns.length} style={{ height: paddingBottom }} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between border-t border-line bg-background px-4 py-2">
        <span className="font-mono text-xs text-dim">
          {formatCount(logs.length)} of {formatCount(total)} log
          {total !== 1 ? "s" : ""}
          {USE_MOCK ? " (mock)" : ""}
        </span>
        <div className="flex items-center gap-2 text-xs">
          {!USE_MOCK && realQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => void realQuery.fetchNextPage()}
              disabled={realQuery.isFetchingNextPage}
              className="flex items-center gap-1.5 rounded-md border border-line bg-surface-1 px-2.5 py-1 text-fg-2 transition-colors hover:border-faint hover:text-foreground disabled:opacity-50"
            >
              {realQuery.isFetchingNextPage && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              Load more
            </button>
          )}
          {!USE_MOCK && !realQuery.hasNextPage && logs.length > 0 && (
            <span className="text-faint">end of results</span>
          )}
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
