"use client"

import { useQuery } from "@tanstack/react-query"

import { useFilterParams } from "@/hooks/useFilterParams"
import { useFilterCategories } from "@/hooks/useLogsQuery"
import { api } from "@/lib/api"

// Las plataformas salen de la API (`/filters/values?category=platform`), no de
// un catálogo mock. El mock listaba slugs — `m365`, `aws`, `okta`… — que no
// existen como plataformas en el dataset, así que la mayoría de estos enlaces
// llevaban a una tabla vacía sin decir nada. El valor del filtro tiene que ser
// exactamente el que la API reconoce.
//
// Los conteos por plataforma se han quitado: eran inventados (1.240 para
// Windows, cuando el dataset real tiene 2.577). Volverán cuando exista un
// endpoint que los sirva de verdad.
//
// Son botones, no <Link>: elegir plataforma es aplicar un filtro. Navegar con
// el router para re-renderizar una página que ya no lee `searchParams` no
// aportaba nada, y era justo lo que dejaba el router bloqueado.

export function PlatformSidebar() {
  const { filters, setFilter } = useFilterParams()
  const activePlatform = filters.platform?.[0]

  const platforms = useQuery({
    queryKey: ["filter-values", "platform"],
    queryFn: () => api.filters.values("platform"),
    staleTime: 5 * 60_000,
  })

  const categories = useFilterCategories()
  const facetCategories = (categories.data ?? []).filter((c) => c.key !== "platform")

  return (
    <aside className="hidden w-40 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line px-2 py-5 md:flex">
      <div>
        <h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
          Platform
        </h4>
        <ul className="flex flex-col gap-px">
          {(platforms.data ?? []).map((platform) => {
            const isActive = platform === activePlatform
            return (
              <li key={platform}>
                <button
                  type="button"
                  onClick={() => setFilter("platform", isActive ? [] : [platform])}
                  aria-pressed={isActive}
                  title={platform}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isActive
                      ? "bg-accent-weak font-semibold text-foreground"
                      : "text-fg-2 hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <span className={`text-[10px] ${isActive ? "text-accent" : "text-transparent"}`}>
                    ▸
                  </span>
                  <span className="truncate">{platform}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
          Active facets
        </h4>
        <div className="flex flex-col gap-px">
          {facetCategories.map((category) => {
            const count = filters[category.key]?.length ?? 0
            return (
              <div
                key={category.key}
                className="flex items-center justify-between px-2.5 py-1 text-xs text-dim"
              >
                <span>{category.label}</span>
                <span
                  className={`font-mono text-[11px] font-semibold tabular-nums ${
                    count > 0 ? "text-foreground" : "text-faint"
                  }`}
                >
                  {count > 0 ? count : "—"}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
