"use client"

import { Plus } from "lucide-react"
import { useFilterParams } from "@/hooks/useFilterParams"

interface FilterableCellProps {
  category: string
  value: string | null | undefined
  children: React.ReactNode
}

export function FilterableCell({ category, value, children }: FilterableCellProps) {
  const { setFilter, filters } = useFilterParams()

  if (!value) return <>{children}</>

  const isActive = filters[category]?.includes(value) ?? false

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation()
    if (isActive) return
    const current = filters[category] ?? []
    setFilter(category, [...current, value!])
  }

  return (
    <span className="group/cell inline-flex items-center gap-1">
      {children}
      {isActive ? (
        <span className="font-mono text-[9px] text-emerald-700">✓</span>
      ) : (
        <button
          onClick={handleAdd}
          title={`Add "${value}" to ${category} filter`}
          className="opacity-0 group-hover/cell:opacity-100 transition-opacity rounded p-0.5 text-zinc-600 hover:bg-zinc-700 hover:text-zinc-200"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
