"use client"

// Manages dynamic f.* URL filter params without enumerating keys at compile time.
// Keys are discovered at runtime from /filters/categories.
// URL shape: /explore?f.platform=windows&f.tactic=execution&f.tactic=persistence
//
// Este hook se monta MUCHAS veces: una por celda filtrable de la tabla, que con
// 200 filas son más de mil instancias. Todo lo que devuelve está memoizado a
// propósito. Sin eso, cada render reconstruía el objeto de filtros y tres
// closures por celda, y una navegación no llegaba a completarse dentro de su
// transición: la página se quedaba congelada sin confirmar la URL.

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { useSearchParams, usePathname } from "next/navigation"

import { getUrlSnapshot, setSearchParams, subscribeToUrl } from "@/lib/url-state"

const PREFIX = "f."

function parseFilters(query: string): Record<string, string[]> {
  const filters: Record<string, string[]> = {}
  for (const [key, value] of new URLSearchParams(query).entries()) {
    if (!key.startsWith(PREFIX)) continue
    const filterKey = key.slice(PREFIX.length)
    ;(filters[filterKey] ??= []).push(value)
  }
  return filters
}

export function useFilterParams() {
  const pathname = usePathname()

  // En servidor no hay `window`: el snapshot inicial sale de `useSearchParams`.
  const ssrQuery = useSearchParams().toString()
  const query = useSyncExternalStore(subscribeToUrl, getUrlSnapshot, () => ssrQuery)

  // `query` es un string: la memo solo se invalida cuando la URL cambia de
  // verdad, no en cada render — y este hook se monta una vez por celda.
  const filters = useMemo(() => parseFilters(query), [query])

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      // Se lee `window.location`, no el snapshot memoizado: la escritura es
      // síncrona pero el re-render de React no, así que dos clics en el mismo
      // tick partirían del mismo estado y el segundo pisaría al primero.
      const params = new URLSearchParams(window.location.search)
      mutate(params)
      setSearchParams(pathname, params)
    },
    [pathname],
  )

  const setFilter = useCallback(
    (key: string, values: string[]) => {
      push((params) => {
        params.delete(`${PREFIX}${key}`)
        for (const value of values) params.append(`${PREFIX}${key}`, value)
      })
    },
    [push],
  )

  const removeFilterValue = useCallback(
    (key: string, value: string) => {
      push((params) => {
        // Se relee de `params` en vez de cerrar sobre `filters`, para que el
        // callback no cambie de identidad cuando cambian los filtros.
        const remaining = params.getAll(`${PREFIX}${key}`).filter((v) => v !== value)
        params.delete(`${PREFIX}${key}`)
        for (const v of remaining) params.append(`${PREFIX}${key}`, v)
      })
    },
    [push],
  )

  const clearAllFilters = useCallback(() => {
    push((params) => {
      for (const key of [...params.keys()]) {
        if (key.startsWith(PREFIX)) params.delete(key)
      }
    })
  }, [push])

  const activeCount = useMemo(
    () => Object.values(filters).reduce((sum, values) => sum + values.length, 0),
    [filters],
  )

  // `q` y `view` viajan por el mismo mecanismo que los filtros a propósito.
  // Antes los gestionaba nuqs mientras los `f.*` iban por `router.push`: dos
  // dueños de la misma URL, y el router acababa dejando de confirmar
  // navegaciones en /explore. Un solo dueño.
  const params = useMemo(() => new URLSearchParams(query), [query])
  const q = params.get("q") ?? ""
  const view: "compact" | "full" = params.get("view") === "compact" ? "compact" : "full"

  const setParam = useCallback(
    (key: string, value: string | null) => {
      push((params) => {
        if (value) params.set(key, value)
        else params.delete(key)
      })
    },
    [push],
  )

  const setQ = useCallback((value: string | null) => setParam("q", value), [setParam])
  const setView = useCallback(
    (value: "compact" | "full") => setParam("view", value === "compact" ? "compact" : null),
    [setParam],
  )

  return {
    filters,
    setFilter,
    removeFilterValue,
    clearAllFilters,
    activeCount,
    q,
    setQ,
    view,
    setView,
  }
}
