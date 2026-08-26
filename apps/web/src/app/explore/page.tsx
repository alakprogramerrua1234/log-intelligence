import { Suspense } from "react"
import { Loader2 } from "lucide-react"

import { LogTableClient } from "@/components/log-table/LogTableClient"
import { PlatformSidebar } from "@/components/platform/PlatformSidebar"
import { ExploreHeader } from "@/components/log-table/ExploreHeader"

// Esta página NO lee `searchParams`.
//
// Antes sí lo hacía, solo para traducir un slug a un título con un diccionario
// hardcodeado. El precio era que cada cambio de filtro re-renderizaba el Server
// Component y disparaba un round-trip RSC: la petición salía, devolvía 200… y la
// transición no llegaba a confirmarse, dejando el router bloqueado para toda
// navegación posterior.
//
// Quien lee la URL son los componentes cliente, que ya lo hacían igualmente. Así
// aplicar un filtro es un cambio de URL en cliente y nada más.

export default function ExplorePage() {
  return (
    // Altura definida, no `flex-1`.
    //
    // `body` es `min-h-full`: una altura MÍNIMA, no una definida. Con eso la
    // cadena `flex-1 min-h-0` no tiene contra qué acotarse, así que cada
    // contenedor crecía hasta su contenido y quien scrolleaba era el documento
    // entero: la barra lateral se iba hacia arriba, el pie con la paginación
    // quedaba fuera de pantalla y el `thead` sticky no pegaba a nada.
    //
    // Fijando el alto al viewport menos la cabecera la región pasa a estar
    // acotada y el único que scrollea es el cuerpo de la tabla. Se hace aquí y
    // no en `body` porque la landing y /exploit sí deben scrollear normal.
    <main className="flex h-[calc(100dvh-var(--header-height))] flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 min-h-0">
        <Suspense
          fallback={<div className="hidden w-52 shrink-0 border-r border-line md:block" />}
        >
          <PlatformSidebar />
        </Suspense>

        <div className="flex min-w-0 flex-1 flex-col min-h-0">
          <Suspense fallback={<div className="h-[73px] border-b border-line" />}>
            <ExploreHeader />
          </Suspense>

          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-dim" />
              </div>
            }
          >
            <LogTableClient />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
