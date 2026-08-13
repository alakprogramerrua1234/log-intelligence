"use client"

import { useFilterParams } from "@/hooks/useFilterParams"

// Lee la plataforma activa del cliente, no del servidor. El valor del filtro es
// ya el nombre real de la plataforma tal como lo devuelve la API, así que no
// hace falta ningún diccionario de slugs que traducir (y que mantener).

export function ExploreHeader() {
  const { filters } = useFilterParams()
  const platform = filters.platform?.[0]

  return (
    <div className="border-b border-line px-4 py-4">
      <div className="flex items-baseline gap-2">
        <h1 className="text-base font-semibold text-foreground">
          {platform ?? "All platforms"}
        </h1>
        {platform && <span className="font-mono text-xs text-faint">logs</span>}
      </div>
      <p className="mt-0.5 text-xs text-dim">
        {platform
          ? `Browsing logs for ${platform}. Use filters or ⌘K to narrow down.`
          : "Browse all logs across platforms. Select a platform or filter with ⌘K."}
      </p>
    </div>
  )
}
