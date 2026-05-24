"use client"

import { useQuery } from "@tanstack/react-query"
import { api, type LogsQuery } from "@/lib/api"

export function useLogsQuery(query: LogsQuery) {
  return useQuery({
    queryKey: ["logs", query],
    queryFn: () => api.logs.list(query),
    staleTime: 30_000,
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
