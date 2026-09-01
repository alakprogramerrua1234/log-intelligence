"use client"

import { useMemo, useRef, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useFilterParams } from "@/hooks/useFilterParams"
import { useLogsInfiniteQuery } from "@/hooks/useLogsQuery"
import { MOCK_FILTER_CATEGORIES, MOCK_SAMPLE_COUNTS } from "@/lib/mock-data"
import { FilterChips } from "@/components/filters/FilterChips"
import { ViewToggle } from "@/components/log-table/ViewToggle"
import { CommandPalette } from "@/components/filters/CommandPalette"
import { fullColumns, compactColumns } from "@/components/log-table/columns"
import {
  DEFAULT_PAGE_SIZE,
  PageSizeSelect,
  type PageSize,
} from "@/components/log-table/PageSizeSelect"
import { api, ApiError, USE_MOCK } from "@/lib/api"
import { UNKNOWN_FILTER_CATEGORY, type FilterCategory, type Log } from "@/lib/types"
import { formatCount } from "@/lib/format"

interface LogTableClientProps {
  // Categories come from /filters/categories; MOCK_FILTER_CATEGORIES es el
  // último recurso mientras la API no responde.
  categories?: FilterCategory[]
}

export function LogTableClient({ categories }: LogTableClientProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteCategory, setPaletteCategory] = useState<import("@/lib/types").FilterCategory | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)

  const { filters, setFilter, clearAllFilters, q, view } = useFilterParams()

  const categoriesQuery = useQuery({
    queryKey: ["filter-categories"],
    queryFn: api.filters.categories,
    staleTime: Infinity,
  })

  // Precedence: API data → prop → mock fallback
  const resolvedCategories: FilterCategory[] = categoriesQuery.data?.length
    ? categoriesQuery.data
    : categories?.length
      ? categories
      : MOCK_FILTER_CATEGORIES

  // ── Data ──────────────────────────────────────────────────────────────────
  // Un solo camino. En la demo estática (USE_MOCK) `api` resuelve desde
  // `mock-data.ts` y este hook no llega a tocar la red.
  // La ordenación es server-driven: viaja a la API y vuelve paginada. Cambiarla
  // invalida el cursor en el backend, así que la query arranca de cero sola.
  const sortBy  = sorting[0]?.id
  const sortDir = sorting[0]?.desc ? "desc" : "asc"

  const realQuery = useLogsInfiniteQuery({
    q,
    filters,
    view,
    sort_by: sortBy,
    sort_dir: sortDir,
    limit: pageSize,
  })

  // Posición dentro de las páginas ya traídas.
  //
  // Cambiar filtros, búsqueda, orden o tamaño de página arranca una query
  // distinta, y entonces la posición tiene que volver a la primera página. Se
  // deriva en render comparando la identidad de la query en vez de hacerlo en
  // un efecto: así no existe un frame intermedio pintando la página vieja
  // contra los datos nuevos.
  const queryId = JSON.stringify([q, filters, view, sortBy, sortDir, pageSize])
  const [cursor, setCursor] = useState({ id: queryId, index: 0 })
  const requestedIndex = cursor.id === queryId ? cursor.index : 0

  const pages = realQuery.data?.pages
  const pageCount = pages?.length ?? 0
  // `keepPreviousData` puede dejar menos páginas de las que había mientras
  // carga la query nueva; sin acotar, el índice apuntaría fuera del array.
  const pageIndex = Math.min(requestedIndex, Math.max(0, pageCount - 1))
  const currentPage = pages?.[pageIndex]

  // `logs` tiene que conservar identidad entre renders (de ahí la memo sobre
  // los datos de React Query, que mantiene estable por structural sharing).
  // Con un array nuevo por render, el row model de TanStack Table se recalcula
  // en cada render y su autoResetPageIndex encola un setState, que provoca otro
  // render con otro array nuevo: un bucle de commits infinito pero silencioso.
  // Al primer evento de input real, React drena ese trabajo pendiente en un
  // flush síncrono que nunca termina y /explore se congela por completo.
  const logs = useMemo<Log[]>(() => currentPage?.items ?? [], [currentPage])
  const total = pages?.[0]?.total ?? 0
  // `isPending`, no `isLoading`: cubre también el caso en que React Query deja
  // el fetch en pausa. Sin esto la tabla pinta "No logs match the current
  // filters" mientras la query aún no ha resuelto, que es sencillamente falso.
  const isLoading = realQuery.isPending
  const isError = realQuery.isError

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
    // Siempre server-driven: la muestra de la demo también ordena en `api`.
    manualSorting: true,
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

  // ── Navegación entre páginas ──────────────────────────────────────────────
  // El backend pagina por cursor, que es de ida. Pero React Query guarda las
  // páginas ya traídas en orden, así que "anterior" es moverse por esa caché y
  // no cuesta una petición; solo "siguiente" puede necesitar traer una página
  // nueva. Eso da prev/next real sin tocar el contrato de la API.
  const hasPrev = pageIndex > 0
  const hasNext = pageIndex + 1 < pageCount || !!realQuery.hasNextPage

  function goToPage(index: number): void {
    setCursor({ id: queryId, index })
    scrollRef.current?.scrollTo({ top: 0 })
  }

  async function goNext(): Promise<void> {
    if (pageIndex + 1 < pageCount) {
      goToPage(pageIndex + 1)
      return
    }
    if (!realQuery.hasNextPage) return
    // Todavía no está en caché: se pide, y solo se avanza si de verdad llegó.
    const result = await realQuery.fetchNextPage()
    if ((result.data?.pages.length ?? 0) > pageIndex + 1) goToPage(pageIndex + 1)
  }

  // Las páginas se piden todas con el mismo `limit`, así que la posición
  // absoluta de la primera fila es calculable sin contar las anteriores.
  const rangeFrom = logs.length > 0 ? pageIndex * pageSize + 1 : 0
  const rangeTo = pageIndex * pageSize + logs.length

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

      {/* ── Aviso de demo ── */}
      {USE_MOCK && (
        <div className="flex flex-wrap items-center gap-2 border-b border-dashed border-amber-500/40 bg-amber-500/10 px-4 py-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Sample data
          </span>
          <span className="text-[10px] text-amber-800/90 dark:text-amber-200/80">
            Demo build — a fixed {MOCK_SAMPLE_COUNTS.logs}-log Windows sample, not the ingested
            dataset.
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-background px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <PageSizeSelect value={pageSize} onChange={setPageSize} />
          <span className="font-mono text-dim">
            {rangeFrom === 0
              ? "no results"
              : `${formatCount(rangeFrom)}–${formatCount(rangeTo)} of ${formatCount(total)}`}
            {USE_MOCK ? " (sample)" : ""}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToPage(pageIndex - 1)}
            disabled={!hasPrev}
            aria-label="Previous page"
            className="flex items-center gap-1 rounded-md border border-line bg-surface-1 px-2 py-1 text-fg-2 transition-colors hover:border-faint hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <span className="px-2 font-mono text-dim">page {formatCount(pageIndex + 1)}</span>

          <button
            type="button"
            onClick={() => void goNext()}
            disabled={!hasNext || realQuery.isFetchingNextPage}
            aria-label="Next page"
            className="flex items-center gap-1 rounded-md border border-line bg-surface-1 px-2 py-1 text-fg-2 transition-colors hover:border-faint hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {realQuery.isFetchingNextPage ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="hidden sm:inline">Next</span>
            )}
            <ChevronRight className="h-3 w-3" />
          </button>
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
