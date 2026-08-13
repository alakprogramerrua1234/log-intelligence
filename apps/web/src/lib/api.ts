import type {
  ApiErrorBody,
  FilterCategory,
  Log,
  PaginatedLogs,
  Platform,
  SuggestItem,
} from "@/lib/types"

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

export const api = {
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
