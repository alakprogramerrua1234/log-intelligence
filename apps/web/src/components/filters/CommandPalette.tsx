"use client"

import { useEffect, useState } from "react"
import { Command } from "cmdk"
import { Search, Filter, Loader2 } from "lucide-react"
import { useQueryState, parseAsString } from "nuqs"
import { useQuery } from "@tanstack/react-query"
import { useFilterParams } from "@/hooks/useFilterParams"
import { api } from "@/lib/api"
import type { FilterCategory, SuggestItem } from "@/lib/types"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: FilterCategory[]
}

// Color per category key — badge bg + text
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  platform:      { bg: "bg-slate-800",   text: "text-slate-300" },
  log_source:    { bg: "bg-zinc-700",    text: "text-zinc-300"  },
  event_id:      { bg: "bg-emerald-900", text: "text-emerald-400" },
  tactic:        { bg: "bg-amber-900",   text: "text-amber-400"  },
  technique:     { bg: "bg-sky-900",     text: "text-sky-400"    },
  subtechnique:  { bg: "bg-violet-900",  text: "text-violet-400" },
}

function CategoryBadge({ category, label }: { category: string; label: string }) {
  const colors = CATEGORY_COLORS[category] ?? { bg: "bg-zinc-800", text: "text-zinc-400" }
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
      {label}
    </span>
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function CommandPalette({ open, onOpenChange, categories }: CommandPaletteProps) {
  const [inputValue, setInputValue] = useState("")
  const [, setQ] = useQueryState("q", parseAsString.withDefault(""))
  const { setFilter, filters } = useFilterParams()

  useEffect(() => { if (!open) setInputValue("") }, [open])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  // Detect "category:" prefix
  const colonIdx = inputValue.indexOf(":")
  const prefixedCategory = colonIdx > 0 ? inputValue.slice(0, colonIdx).toLowerCase() : null
  const prefixedQuery    = colonIdx > 0 ? inputValue.slice(colonIdx + 1).trim() : inputValue

  const activeCategory = prefixedCategory
    ? categories.find((c) => c.key === prefixedCategory || c.label.toLowerCase() === prefixedCategory)
    : null

  const debouncedPrefixedQuery = useDebounce(prefixedQuery, 200)
  const debouncedFreeQuery     = useDebounce(!activeCategory ? inputValue : "", 300)

  // Category-mode: fetch values for the chosen category
  const valuesQuery = useQuery({
    queryKey: ["filter-values", activeCategory?.key ?? null, debouncedPrefixedQuery],
    queryFn:  () => api.filters.values(activeCategory!.key, debouncedPrefixedQuery || undefined),
    enabled:  !!activeCategory,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  })

  // Free-text mode: cross-category suggest
  const suggestQuery = useQuery({
    queryKey: ["suggest", debouncedFreeQuery],
    queryFn:  () => api.filters.suggest(debouncedFreeQuery),
    enabled:  !activeCategory && debouncedFreeQuery.length >= 1,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const filterValues: string[]    = valuesQuery.data   ?? []
  const suggestions: SuggestItem[] = suggestQuery.data ?? []

  function handleSelectFilter(categoryKey: string, value: string) {
    const current = filters[categoryKey] ?? []
    if (!current.includes(value)) setFilter(categoryKey, [...current, value])
    onOpenChange(false)
  }

  function handleSearch() {
    setQ(inputValue || null)
    onOpenChange(false)
  }

  if (!open) return null

  const isLoading =
    (!!activeCategory && valuesQuery.isFetching) ||
    (!activeCategory && inputValue.length >= 1 && suggestQuery.isFetching)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <Command shouldFilter={false}>
          {/* Input */}
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3">
            {isLoading
              ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-500" />
              : <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            }
            <Command.Input
              value={inputValue}
              onValueChange={setInputValue}
              placeholder="Search across all categories, or type platform: tactic: …"
              className="flex h-12 w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              autoFocus
            />
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-1">
            <Command.Empty className="py-8 text-center text-sm text-zinc-600">
              No results
            </Command.Empty>

            {/* Empty state: filter shortcuts */}
            {!activeCategory && inputValue === "" && (
              <Command.Group heading={<GroupHeading>Filter by category</GroupHeading>}>
                {categories.map((cat) => (
                  <Command.Item
                    key={cat.key}
                    value={`filter:${cat.key}`}
                    onSelect={() => setInputValue(`${cat.key}:`)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 aria-selected:bg-zinc-800"
                  >
                    <Filter className="h-3.5 w-3.5 text-zinc-600" />
                    <span>{cat.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-zinc-600">{cat.key}:</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Category-prefix mode: show values for that category */}
            {activeCategory && (
              <Command.Group heading={<GroupHeading>{activeCategory.label}</GroupHeading>}>
                {filterValues.length === 0 && !valuesQuery.isFetching && prefixedQuery && (
                  <Command.Item
                    value={`filtervalue:${activeCategory.key}:${prefixedQuery}`}
                    onSelect={() => handleSelectFilter(activeCategory.key, prefixedQuery)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 aria-selected:bg-zinc-800"
                  >
                    <Filter className="h-3.5 w-3.5 text-zinc-600" />
                    Add <span className="ml-1 text-emerald-400">{prefixedQuery}</span>
                    <span className="ml-1">as {activeCategory.label} filter</span>
                  </Command.Item>
                )}
                {filterValues.map((val) => {
                  const isActive = filters[activeCategory.key]?.includes(val)
                  return (
                    <Command.Item
                      key={val}
                      value={`filtervalue:${activeCategory.key}:${val}`}
                      onSelect={() => handleSelectFilter(activeCategory.key, val)}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 aria-selected:bg-zinc-800"
                    >
                      <Filter className="h-3.5 w-3.5 text-zinc-600" />
                      <span className={isActive ? "text-emerald-400" : ""}>{val}</span>
                      {isActive && (
                        <span className="ml-auto font-mono text-[10px] text-emerald-700">active</span>
                      )}
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* Free-text mode: cross-category suggestions */}
            {!activeCategory && suggestions.length > 0 && (
              <Command.Group heading={<GroupHeading>Results</GroupHeading>}>
                {suggestions.map((item, i) => {
                  const isActive = filters[item.category]?.includes(item.value)
                  return (
                    <Command.Item
                      key={`${item.category}:${item.value}:${i}`}
                      value={`suggest:${item.category}:${item.value}`}
                      onSelect={() => handleSelectFilter(item.category, item.value)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-zinc-800 aria-selected:bg-zinc-800"
                    >
                      <span className={`flex-1 truncate ${isActive ? "text-emerald-400" : "text-zinc-200"}`}>
                        {item.display}
                      </span>
                      <CategoryBadge category={item.category} label={item.label} />
                      {isActive && (
                        <span className="font-mono text-[10px] text-emerald-700">active</span>
                      )}
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* Free search fallback */}
            {inputValue && !activeCategory && (
              <Command.Group>
                <Command.Item
                  value={`search:${inputValue}`}
                  onSelect={handleSearch}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 aria-selected:bg-zinc-800"
                >
                  <Search className="h-3.5 w-3.5 text-zinc-600" />
                  Search logs for <span className="ml-1 text-zinc-200">&ldquo;{inputValue}&rdquo;</span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>

          <div className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-700">
            <span className="mr-3"><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span className="mr-3"><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  )
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
      {children}
    </span>
  )
}
