// Mirror types for FastAPI Pydantic schemas.
// Keep in sync with apps/api/src/schemas/ — update in the same PR.

export interface Log {
  id: number
  event_id: string | null
  channel: string | null
  provider: string | null
  platform: string
  description: string | null
  raw: Record<string, unknown>
  techniques: TechniqueRef[]
}

export interface TechniqueRef {
  id: string
  name: string
  tactic: string
}

export interface Platform {
  id: number
  slug: string
  name: string
  log_count: number
}

export interface FilterCategory {
  key: string
  label: string
  values: FilterValue[]
}

export interface FilterValue {
  value: string
  label: string
  count: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
