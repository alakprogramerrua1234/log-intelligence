import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server"

export const logsSearchParams = {
  page: parseAsInteger.withDefault(1),
  page_size: parseAsInteger.withDefault(50),
  platform: parseAsString.withDefault(""),
  search: parseAsString.withDefault(""),
  sort_by: parseAsString.withDefault(""),
  sort_dir: parseAsStringEnum(["asc", "desc"]).withDefault("asc"),
}

export const logsSearchParamsCache = createSearchParamsCache(logsSearchParams)
