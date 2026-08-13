"use client"

import { Plus } from "lucide-react"
import type { Table } from "@tanstack/react-table"

import type { Log } from "@/lib/types"

// Este componente se monta una vez por celda filtrable: con 200 filas son más de
// mil instancias. Por eso NO usa hooks — ni `useFilterParams`, ni contexto. Los
// filtros y la acción de añadir llegan por `table.options.meta`, que el padre
// calcula una sola vez. Cuando cada celda resolvía sus propios hooks, una
// navegación no lograba completarse y la página se quedaba congelada.

interface FilterableCellProps {
  category: string
  value: string | null | undefined
  table: Table<Log>
  children: React.ReactNode
}

export function FilterableCell({ category, value, table, children }: FilterableCellProps) {
  if (!value) return <>{children}</>

  const meta = table.options.meta
  const isActive = meta?.filters?.[category]?.includes(value) ?? false

  if (isActive) {
    return (
      <span className="group/cell inline-flex items-center gap-1">
        {children}
        <span className="font-mono text-[9px] text-accent">✓</span>
      </span>
    )
  }

  // Toda la celda filtra, no solo el icono.
  //
  // Antes solo el `+` era clicable, y estaba en `opacity-0`: quien hacía clic en
  // el texto —lo natural— no obtenía nada y concluía que los filtros no
  // funcionaban. El icono se mantiene oculto hasta el hover, que es como se
  // quiere que se vea; lo que cambia es que ahora el área clicable es la celda.
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        meta?.addFilter?.(category, value)
      }}
      title={`Filter by ${category}: ${value}`}
      className="group/cell inline-flex items-center gap-1 rounded text-left transition-colors hover:text-accent"
    >
      {children}
      <Plus className="h-3 w-3 shrink-0 text-faint opacity-0 transition-opacity group-hover/cell:opacity-100" />
    </button>
  )
}
