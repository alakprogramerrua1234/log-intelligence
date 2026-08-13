"use client"

// Un único dueño de los search params, con notificación explícita.
//
// Por qué no `router.push`: envuelve la navegación en una transición de React.
// React Query publica cambios por `useSyncExternalStore` durante esa transición,
// React descarta el render concurrente y reintenta, y con una query en vuelo eso
// no converge: la transición nunca se confirma y el router queda bloqueado para
// toda navegación posterior, incluido salir de /explore.
//
// Por qué no `history.pushState` a secas: cambia la URL pero `useSearchParams`
// no se entera, así que la tabla no se refiltra.
//
// Por qué no `nuqs`: su API pide claves conocidas en tiempo de compilación, y
// aquí las categorías de filtro (`f.*`) se descubren en runtime desde
// `/filters/categories`. Es la premisa del sistema de filtros dinámico.
//
// Así que: History API para escribir + un store mínimo para avisar. Los
// componentes se suscriben con `useSyncExternalStore`, que es el mecanismo que
// React ofrece justo para esto.

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeToUrl(listener: () => void): () => void {
  listeners.add(listener)
  // Atrás/adelante del navegador también tienen que refiltrar la tabla.
  window.addEventListener("popstate", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("popstate", listener)
  }
}

export function getUrlSnapshot(): string {
  return window.location.search
}

/**
 * Cambia los search params y notifica.
 *
 * Conserva `history.state` porque Next guarda ahí el árbol interno del router:
 * pasar `null` lo borra y el siguiente `<Link>` deja de navegar.
 */
export function setSearchParams(pathname: string, params: URLSearchParams): void {
  const query = params.toString()
  window.history.pushState(window.history.state, "", query ? `${pathname}?${query}` : pathname)
  emit()
}
