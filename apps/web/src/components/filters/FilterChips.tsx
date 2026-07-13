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
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-1 px-2 py-0.5 text-xs text-fg-2"
          >
            <span className="text-dim">{categoryLabel(key)}:</span>
            <span>{value}</span>
            <button
              type="button"
              onClick={() => removeFilterValue(key, value)}
              className="ml-0.5 rounded-full text-dim hover:text-foreground"
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
          className="text-xs text-dim hover:text-fg-2"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
