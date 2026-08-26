"use client"

export const PAGE_SIZES = [20, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

/**
 * 20 por defecto.
 *
 * Se midió sobre datos reales: una fila ocupa ~78 px, porque el nombre de
 * técnica envuelve a dos líneas. En un portátil caben ~10 filas a la vez, así
 * que 20 son unas dos pantallas de scroll — suficiente para comparar sin que
 * paginar se vuelva constante.
 *
 * No se deriva del viewport a propósito: el tamaño de página forma parte de la
 * `queryKey`, así que un valor calculado tras montar dispararía un segundo
 * fetch inmediato, y en SSR no hay `window` con el que acertar en el primer
 * render. Un valor fijo y un selector visible resuelven lo mismo sin eso.
 */
export const DEFAULT_PAGE_SIZE: PageSize = 20

interface PageSizeSelectProps {
  value: PageSize
  onChange: (value: PageSize) => void
}

export function PageSizeSelect({ value, onChange }: PageSizeSelectProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-dim sm:inline">Rows</span>
      <div className="flex items-center gap-0.5 rounded-md border border-line bg-surface-1 p-0.5">
        {PAGE_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onChange(size)}
            aria-pressed={value === size}
            title={`Show ${size} rows per page`}
            className={`rounded px-2 py-0.5 font-mono text-xs transition-colors ${
              value === size
                ? "bg-accent-weak font-semibold text-accent"
                : "text-dim hover:text-fg-2"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  )
}
