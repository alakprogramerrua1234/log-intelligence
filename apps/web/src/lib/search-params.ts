import { parseAsString, parseAsStringEnum, createSearchParamsCache } from "nuqs/server"

// Well-known URL params. Dynamic filter params (f.*) are handled separately
// in useFilterParams.ts via useSearchParams() since their keys are runtime-defined.
export const exploreSearchParams = {
  q: parseAsString.withDefault(""),
  view: parseAsStringEnum(["compact", "full"]).withDefault("full"),
  sort_by: parseAsString.withDefault(""),
  sort_dir: parseAsStringEnum(["asc", "desc"]).withDefault("asc"),
}

export const exploreSearchParamsCache = createSearchParamsCache(exploreSearchParams)
