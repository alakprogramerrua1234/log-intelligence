import type {
  ApiErrorBody,
  FilterCategory,
  Log,
  PaginatedLogs,
  Platform,
  SuggestItem,
} from "@/lib/types"
import {
  getMockFilterValues,
  getMockLogs,
  getMockSuggestions,
  MOCK_FILTER_CATEGORIES,
  MOCK_LOGS,
  MOCK_PLATFORMS,
} from "@/lib/mock-data"

/**
 * Único punto de conmutación entre la API real y la muestra empaquetada.
 *
 * La demo estática de GitHub Pages se construye con NEXT_PUBLIC_USE_MOCK=true y
 * no tiene backend detrás: `api` resuelve entonces desde `mock-data.ts`. Todo lo
 * demás — hooks, componentes — llama igual en los dos modos, así que no hay
 * ramas de mock repartidas por la UI.
 */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1"

/** Error de la API con el `code` estable ya extraído, para que la UI ramifique sobre él. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly keys: string[]

  constructor(status: number, path: string, body: ApiErrorBody | null) {
    super(body?.detail || `API error ${status}: ${path}`)
    this.name = "ApiError"
    this.status = status
    this.code = body?.code ?? null
    this.keys = body?.keys ?? []
  }
}

/** El cuerpo de error puede no seguir el contrato (502 de un proxy, 422 de FastAPI…). */
function parseErrorBody(value: unknown): ApiErrorBody | null {
  if (typeof value !== "object" || value === null) return null
  const body = value as Record<string, unknown>
  if (typeof body.code !== "string") return null
  return {
    detail: typeof body.detail === "string" ? body.detail : "",
    code: body.code,
    keys: Array.isArray(body.keys)
      ? body.keys.filter((key): key is string => typeof key === "string")
      : [],
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    throw new ApiError(res.status, path, parseErrorBody(body))
  }
  return res.json() as Promise<T>
}

export interface LogsQuery {
  q?: string
  view?: "compact" | "full"
  filters?: Record<string, string[]>  // { tactic: ["execution", "persistence"] }
  sort_by?: string
  sort_dir?: "asc" | "desc"
  cursor?: string
  limit?: number
}

const realApi = {
  platforms: {
    list: () => request<Platform[]>("/platforms"),
    get: (slug: string) => request<Platform>(`/platforms/${slug}`),
  },
  logs: {
    // GET /logs?filter[key]=value&q=...&view=compact&cursor=...
    list: (query: LogsQuery = {}) => {
      const params = new URLSearchParams()
      if (query.q) params.set("q", query.q)
      if (query.view) params.set("view", query.view)
      if (query.sort_by) params.set("sort", query.sort_by)
      if (query.sort_dir) params.set("sort_dir", query.sort_dir)
      if (query.cursor) params.set("cursor", query.cursor)
      if (query.limit) params.set("limit", String(query.limit))
      if (query.filters) {
        for (const [key, values] of Object.entries(query.filters)) {
          for (const v of values) params.append(`filter[${key}]`, v)
        }
      }
      return request<PaginatedLogs>(`/logs?${params.toString()}`)
    },
    get: (id: string) => request<Log>(`/logs/${id}`),
  },
  filters: {
    categories: () => request<FilterCategory[]>("/filters/categories"),
    values: (category: string, q?: string) => {
      const params = new URLSearchParams({ category })
      if (q) params.set("q", q)
      return request<string[]>(`/filters/values?${params}`)
    },
    suggest: (q: string) =>
      request<SuggestItem[]>(`/filters/suggest?q=${encodeURIComponent(q)}`),
  },
}

// ── Implementación de la muestra ──────────────────────────────────────────────
// Misma forma que `realApi`, resuelta en memoria. Respeta orden y paginación
// para que la tabla se comporte igual que contra la API.

/** Claves ordenables de la tabla → valor por el que comparar. */
const SORT_KEYS: Record<string, (log: Log) => string | number> = {
  relevance: (l) => l.relevance,
  event_id: (l) => Number(l.event_id ?? 0),
  name: (l) => l.name,
  log_source_name: (l) => l.log_source_name,
}

function sortLogs(items: Log[], sortBy?: string, sortDir?: "asc" | "desc"): Log[] {
  const key = sortBy ? SORT_KEYS[sortBy] : undefined
  if (!key) return items
  const dir = sortDir === "desc" ? -1 : 1
  return [...items].sort((a, b) => {
    const va = key(a)
    const vb = key(b)
    if (va === vb) return 0
    return (va < vb ? -1 : 1) * dir
  })
}

/** El cursor es opaco para la UI; aquí basta con el offset de la página. */
function parseCursor(cursor?: string): number {
  const offset = Number(cursor)
  return Number.isFinite(offset) && offset > 0 ? offset : 0
}

const mockApi: typeof realApi = {
  platforms: {
    list: async () => MOCK_PLATFORMS,
    get: async (slug: string) => {
      const platform = MOCK_PLATFORMS.find((p) => p.slug === slug)
      if (!platform) throw new ApiError(404, `/platforms/${slug}`, null)
      return platform
    },
  },
  logs: {
    list: async (query: LogsQuery = {}) => {
      const all = sortLogs(
        getMockLogs(query.filters ?? {}, query.q ?? "").items,
        query.sort_by,
        query.sort_dir,
      )
      const offset = parseCursor(query.cursor)
      const limit = query.limit ?? all.length
      const items = all.slice(offset, offset + limit)
      const nextOffset = offset + items.length
      return {
        items,
        next_cursor: nextOffset < all.length ? String(nextOffset) : null,
        total: all.length,
      }
    },
    get: async (id: string) => {
      const log = MOCK_LOGS.find((l) => l.id === id)
      if (!log) throw new ApiError(404, `/logs/${id}`, null)
      return log
    },
  },
  filters: {
    categories: async () => MOCK_FILTER_CATEGORIES,
    values: async (category: string, q?: string) => getMockFilterValues(category, q),
    suggest: async (q: string) => getMockSuggestions(q),
  },
}

export const api = USE_MOCK ? mockApi : realApi
