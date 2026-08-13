"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

import { ApiError } from "@/lib/api"

/**
 * Un 4xx es determinista: la misma request va a fallar igual. Reintentarlo solo
 * retrasa el mensaje de error que el analista necesita ver — y en el caso de
 * `unknown_filter_category` el mensaje ES la respuesta útil. Solo se reintentan
 * los fallos que pueden ser transitorios (5xx y errores de red).
 */
function retry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 1
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry, refetchOnWindowFocus: false },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
