// Mirror types for FastAPI Pydantic schemas.
// Keep in sync with apps/api/src/schemas/ — update in the same PR.

export interface Platform {
  id: string
  slug: string
  name: string
  category: "os" | "cloud" | "saas" | "network"
  icon?: string
  log_count: number
  source_count: number
}

export interface LogSource {
  id: string
  platform_id: string
  name: string
  description?: string
  collection_method: string[]
}

export interface Log {
  id: string
  log_source_id: string
  log_source_name: string
  channel: string | null
  event_id: string | null
  provider: string | null
  name: string
  description: string | null
  sample_fields: Record<string, unknown> | null
  relevance: number
  techniques: TechniqueRef[]
}

export interface TechniqueRef {
  id: string      // "T1059.001"
  name: string
  tactic: string[]
  confidence: number
}

export interface Technique {
  id: string
  name: string
  tactic: string[]
  description: string
  url: string
}

// FilterCategory mirrors filter_category table and /filters/categories response.
export interface FilterCategory {
  key: string
  label: string
  field_path: string
  value_type: "string" | "enum" | "number"
  ui_hint: "dropdown" | "multiselect" | "text" | "chip"
  order: number
  enabled: boolean
}

// Cursor-based pagination as per ARCHITECTURE.md §3.1
export interface PaginatedLogs {
  items: Log[]
  next_cursor: string | null
  total: number
}
