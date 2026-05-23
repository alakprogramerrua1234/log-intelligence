"use client"

// Manages dynamic f.* URL filter params without enumerating keys at compile time.
// Keys are discovered at runtime from /filters/categories.
// URL shape: /explore?f.platform=windows&f.tactic=execution&f.tactic=persistence

import { useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

export function useFilterParams() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters: Record<string, string[]> = {}
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("f.")) {
      const filterKey = key.slice(2)
      if (!filters[filterKey]) filters[filterKey] = []
      filters[filterKey].push(value)
    }
  }

  const setFilter = useCallback(
    (key: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete(`f.${key}`)
      for (const v of values) params.append(`f.${key}`, v)
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname],
  )

  const removeFilterValue = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const remaining = (filters[key] ?? []).filter((v) => v !== value)
      params.delete(`f.${key}`)
      for (const v of remaining) params.append(`f.${key}`, v)
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname, filters],
  )

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of [...params.keys()]) {
      if (key.startsWith("f.")) params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const activeCount = Object.values(filters).reduce((sum, vals) => sum + vals.length, 0)

  return { filters, setFilter, removeFilterValue, clearAllFilters, activeCount }
}
