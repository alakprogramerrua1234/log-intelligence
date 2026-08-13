// Tipos del contrato con la API.
//
// Lo que la API ya expone se DERIVA de `api.generated.ts`, generado desde el
// OpenAPI de FastAPI. No se escribe a mano: si un schema de Pydantic cambia y
// nadie regenera, `pnpm --filter web check:types` falla en CI.
//
//   uv run --directory apps/api python scripts/export_openapi.py
//   pnpm --filter web generate:types
//
// Lo que todavía no existe en el backend se declara abajo, marcado como tal.

import type { components } from "./api.generated"

type Schemas = components["schemas"]

// ── derivados del backend ─────────────────────────────────────────────────────

export type Log = Schemas["DetectionOut"]
export type TechniqueRef = Schemas["TechniqueRef"]
export type PaginatedLogs = Schemas["PaginatedDetections"]
export type FilterCategory = Schemas["FilterCategoryOut"]
export type SuggestItem = Schemas["SuggestItem"]
export type ApiErrorBody = Schemas["ErrorOut"]

/** `code` estable del error de filtro desconocido. Ramificar sobre él, no sobre `detail`. */
export const UNKNOWN_FILTER_CATEGORY = "unknown_filter_category"

/** `code` de cursor inválido, manipulado o de otro backend de búsqueda. */
export const INVALID_CURSOR = "invalid_cursor"

// ── todavía sin endpoint en la API ────────────────────────────────────────────
// Los consume `mock-data.ts` y la página de plataformas. Cuando existan
// `/platforms` y `/techniques`, estos tipos se sustituyen por sus equivalentes
// generados y se borran de aquí.

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

export interface Technique {
  id: string
  name: string
  tactic: string[]
  description: string
  url: string
}
