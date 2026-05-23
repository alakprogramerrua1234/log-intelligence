"use client"

import { X } from "lucide-react"
import { useFilterParams } from "@/hooks/useFilterParams"
import type { FilterCategory } from "@/lib/types"

interface FilterChipsProps {
  categories: FilterCategory[]
}

export function FilterChips({ categories }: FilterChipsProps) {
  const { filters, removeFilterValue, clearAllFilters, activeCount } = useFilterParams()

  if (activeCount === 0) return null

  const categoryLabel = (key: string) =>
    categories.find((c) => c.key === key)?.label ?? key

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.entries(filters).map(([key, values]) =>
        values.map((value) => (
          <span
            key={`${key}:${value}`}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
          >
            <span className="text-zinc-500">{categoryLabel(key)}:</span>
            <span>{value}</span>
            <button
              type="button"
              onClick={() => removeFilterValue(key, value)}
              className="ml-0.5 rounded-full text-zinc-500 hover:text-zinc-200"
              aria-label={`Remove ${key}:${value} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )),
      )}

      {activeCount > 1 && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
