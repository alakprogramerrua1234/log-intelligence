import type { FilterCategory, Log, PaginatedResponse, Platform } from "@/lib/types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

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
  page?: number
  page_size?: number
  platform?: string
  search?: string
  filters?: Record<string, string[]>
  sort_by?: string
  sort_dir?: "asc" | "desc"
}

export const api = {
  platforms: {
    list: () => request<Platform[]>("/platforms"),
  },
  logs: {
    list: (query: LogsQuery = {}) => {
      const params = new URLSearchParams()
      if (query.page) params.set("page", String(query.page))
      if (query.page_size) params.set("page_size", String(query.page_size))
      if (query.platform) params.set("platform", query.platform)
      if (query.search) params.set("search", query.search)
      if (query.sort_by) params.set("sort_by", query.sort_by)
      if (query.sort_dir) params.set("sort_dir", query.sort_dir)
      if (query.filters) {
        for (const [key, values] of Object.entries(query.filters)) {
          for (const v of values) params.append(`filter_${key}`, v)
        }
      }
      return request<PaginatedResponse<Log>>(`/logs?${params.toString()}`)
    },
    get: (id: number) => request<Log>(`/logs/${id}`),
  },
  filters: {
    categories: (platform?: string) => {
      const params = platform ? `?platform=${platform}` : ""
      return request<FilterCategory[]>(`/filters/categories${params}`)
    },
  },
}
