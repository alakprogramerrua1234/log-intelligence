"use client"

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { api, type LogsQuery } from "@/lib/api"

export function useLogsQuery(query: LogsQuery) {
  return useQuery({
    queryKey: ["logs", query],
    queryFn: () => api.logs.list(query),
    staleTime: 30_000,
  })
}

/**
 * Paginación por cursor. El cursor es opaco: se reenvía tal cual llegó en
 * `next_cursor` y nunca se construye en cliente, así que el backend puede
 * cambiar de estrategia de paginación sin tocar esto.
 */
export function useLogsInfiniteQuery(query: LogsQuery) {
  return useInfiniteQuery({
    queryKey: ["logs", "infinite", query],
    queryFn: ({ pageParam }) =>
      api.logs.list({ ...query, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? null,
    staleTime: 30_000,
    // Mantiene la página anterior mientras carga la nueva. Además de evitar el
    // parpadeo a tabla vacía al filtrar, elimina el ciclo undefined -> datos que
    // reiniciaba la transición del router en cada cambio de filtro.
    placeholderData: keepPreviousData,
  })
}

export function usePlatforms() {
  return useQuery({
    queryKey: ["platforms"],
    queryFn: () => api.platforms.list(),
    staleTime: 5 * 60_000,
  })
}

export function useFilterCategories() {
  return useQuery({
    queryKey: ["filter-categories"],
    queryFn: () => api.filters.categories(),
    staleTime: 10 * 60_000,
  })
}

export function useFilterValues(category: string | null, q: string) {
  return useQuery({
    queryKey: ["filter-values", category, q],
    queryFn: () => api.filters.values(category!, q || undefined),
    enabled: !!category,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  })
}
