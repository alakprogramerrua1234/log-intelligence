import type { FilterCategory, Log, PaginatedLogs, Platform } from "@/lib/types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`)
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
    // GET /filters/categories — dynamic filter discovery
    categories: () => request<FilterCategory[]>("/filters/categories"),
  },
}
