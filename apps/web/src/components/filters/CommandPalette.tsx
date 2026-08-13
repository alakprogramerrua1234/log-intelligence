"use client"

import { useEffect, useState } from "react"
import { Command } from "cmdk"
import { Search, Filter, Loader2, X, ChevronDown } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useFilterParams } from "@/hooks/useFilterParams"
import { api } from "@/lib/api"
import type { FilterCategory, SuggestItem } from "@/lib/types"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: FilterCategory[]
  openWithCategory?: FilterCategory | null
}

// Color per category key — badge bg + text (alpha bg + dark: text so both themes read well)
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  platform:      { bg: "bg-slate-500/15",   text: "text-slate-600 dark:text-slate-300" },
  log_source:    { bg: "bg-zinc-500/15",    text: "text-zinc-600 dark:text-zinc-300"  },
  event_id:      { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300" },
  tactic:        { bg: "bg-amber-500/15",   text: "text-amber-700 dark:text-amber-300"  },
  technique:     { bg: "bg-sky-500/15",     text: "text-sky-700 dark:text-sky-300"    },
  subtechnique:  { bg: "bg-violet-500/15",  text: "text-violet-700 dark:text-violet-300" },
}

const DEFAULT_CATEGORY_COLORS = { bg: "bg-zinc-500/15", text: "text-zinc-600 dark:text-zinc-300" }

function CategoryBadge({ category, label }: { category: string; label: string }) {
  const colors = CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLORS
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

export function CommandPalette({ open, onOpenChange, categories, openWithCategory }: CommandPaletteProps) {
  const [inputValue, setInputValue] = useState("")
  const [pinnedCategory, setPinnedCategory] = useState<FilterCategory | null>(null)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const { setFilter, filters, setQ } = useFilterParams()

  useEffect(() => {
    if (open) {
      if (openWithCategory) setPinnedCategory(openWithCategory)
    } else {
      setInputValue("")
      setPinnedCategory(null)
      setCategoryPickerOpen(false)
    }
  // openWithCategory is only meaningful at the moment open transitions to true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  // Detect "category:" prefix (only when no pinned category)
  const colonIdx = !pinnedCategory ? inputValue.indexOf(":") : -1
  const prefixedCategory = colonIdx > 0 ? inputValue.slice(0, colonIdx).toLowerCase() : null
  const prefixedQuery    = colonIdx > 0 ? inputValue.slice(colonIdx + 1).trim() : inputValue

  const detectedCategory = prefixedCategory
    ? categories.find((c) => c.key === prefixedCategory || c.label.toLowerCase() === prefixedCategory)
    : null

  // Pinned takes priority over colon-prefix detection
  const activeCategory = pinnedCategory ?? detectedCategory

  // When pinned: use full inputValue; when prefix-detected: use the part after ":"
  const filterQuery = pinnedCategory ? inputValue : prefixedQuery

  const debouncedFilterQuery = useDebounce(filterQuery, 200)
  const debouncedFreeQuery   = useDebounce(!activeCategory ? inputValue : "", 300)

  // Category-mode: fetch values for the chosen category
  const valuesQuery = useQuery({
    queryKey: ["filter-values", activeCategory?.key ?? null, debouncedFilterQuery],
    queryFn:  () => api.filters.values(activeCategory!.key, debouncedFilterQuery || undefined),
    enabled:  !!activeCategory && !categoryPickerOpen,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  })

  // Free-text mode: cross-category suggest
  const suggestQuery = useQuery({
    queryKey: ["suggest", debouncedFreeQuery],
    queryFn:  () => api.filters.suggest(debouncedFreeQuery),
    enabled:  !activeCategory && !categoryPickerOpen && debouncedFreeQuery.length >= 1,
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

  function handlePinCategory(cat: FilterCategory) {
    setPinnedCategory(cat)
    setCategoryPickerOpen(false)
    setInputValue("")
  }

  function clearPinnedCategory() {
    setPinnedCategory(null)
    setInputValue("")
  }

  if (!open) return null

  const isLoading =
    (!!activeCategory && !categoryPickerOpen && valuesQuery.isFetching) ||
    (!activeCategory && !categoryPickerOpen && inputValue.length >= 1 && suggestQuery.isFetching)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      {/* Outer wrapper: relative positioning context for the dropdown, no overflow-hidden */}
      <div className="relative w-full max-w-xl">

        {/* Palette card */}
        <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-2xl">
          <Command shouldFilter={false}>
            {/* Input row */}
            <div className="flex items-center gap-2 border-b border-line-soft px-3">
              {isLoading
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-dim" />
                : <Search className="h-4 w-4 shrink-0 text-dim" />
              }

              {/* Pinned category chip */}
              {pinnedCategory && (
                <span className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${CATEGORY_COLORS[pinnedCategory.key]?.bg ?? DEFAULT_CATEGORY_COLORS.bg} ${CATEGORY_COLORS[pinnedCategory.key]?.text ?? DEFAULT_CATEGORY_COLORS.text}`}>
                  {pinnedCategory.label}
                  <button
                    onClick={clearPinnedCategory}
                    className="ml-0.5 opacity-60 hover:opacity-100"
                    aria-label="Clear category filter"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}

              <Command.Input
                value={inputValue}
                onValueChange={setInputValue}
                onFocus={() => setCategoryPickerOpen(false)}
                placeholder={
                  pinnedCategory
                    ? `Search in ${pinnedCategory.label}…`
                    : "Search across all categories, or type platform: tactic: …"
                }
                className="flex h-12 w-full bg-transparent text-sm text-foreground placeholder:text-faint focus:outline-none"
                autoFocus
              />

              {/* Filter by button */}
              <button
                onClick={() => setCategoryPickerOpen((v) => !v)}
                className={`flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  categoryPickerOpen
                    ? "bg-surface-2 text-foreground"
                    : "text-dim hover:bg-surface-2 hover:text-fg-2"
                }`}
                aria-label="Filter by category"
              >
                <Filter className="h-3 w-3" />
                Filter by
                <ChevronDown className={`h-3 w-3 transition-transform ${categoryPickerOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            <Command.List className="max-h-[400px] overflow-y-auto p-1">
              <Command.Empty className="py-8 text-center text-sm text-dim">
                No results
              </Command.Empty>

              {/* Empty state: category shortcuts */}
              {!activeCategory && inputValue === "" && (
                <Command.Group heading={<GroupHeading>Filter by category</GroupHeading>}>
                  {categories.map((cat) => (
                    <Command.Item
                      key={cat.key}
                      value={`filter:${cat.key}`}
                      onSelect={() => setInputValue(`${cat.key}:`)}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-2 hover:bg-row-hover aria-selected:bg-row-hover"
                    >
                      <Filter className="h-3.5 w-3.5 text-faint" />
                      <span>{cat.label}</span>
                      <span className="ml-auto font-mono text-[10px] text-faint">{cat.key}:</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Category-mode: show values for the active category */}
              {activeCategory && (
                <Command.Group heading={<GroupHeading>{activeCategory.label}</GroupHeading>}>
                  {filterValues.length === 0 && !valuesQuery.isFetching && filterQuery && (
                    <Command.Item
                      value={`filtervalue:${activeCategory.key}:${filterQuery}`}
                      onSelect={() => handleSelectFilter(activeCategory.key, filterQuery)}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-2 hover:bg-row-hover aria-selected:bg-row-hover"
                    >
                      <Filter className="h-3.5 w-3.5 text-faint" />
                      Add <span className="ml-1 font-semibold text-accent">{filterQuery}</span>
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
                        className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-2 hover:bg-row-hover aria-selected:bg-row-hover"
                      >
                        <Filter className="h-3.5 w-3.5 text-faint" />
                        <span className={isActive ? "font-semibold text-accent" : ""}>{val}</span>
                        {isActive && (
                          <span className="ml-auto font-mono text-[10px] text-accent">active</span>
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
                        className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-row-hover aria-selected:bg-row-hover"
                      >
                        <span className={`flex-1 truncate ${isActive ? "font-semibold text-accent" : "text-foreground"}`}>
                          {item.display}
                        </span>
                        <CategoryBadge category={item.category} label={item.label} />
                        {isActive && (
                          <span className="font-mono text-[10px] text-accent">active</span>
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
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-dim hover:bg-row-hover aria-selected:bg-row-hover"
                  >
                    <Search className="h-3.5 w-3.5 text-faint" />
                    Search logs for <span className="ml-1 text-foreground">&ldquo;{inputValue}&rdquo;</span>
                  </Command.Item>
                </Command.Group>
              )}
            </Command.List>

            <div className="border-t border-line-soft px-3 py-2 text-[10px] text-faint">
              <span className="mr-3"><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span className="mr-3"><kbd className="font-mono">↵</kbd> select</span>
              <span><kbd className="font-mono">esc</kbd> close</span>
            </div>
          </Command>
        </div>

        {/* Category picker dropdown — sibling of palette card, not clipped by overflow-hidden */}
        {categoryPickerOpen && (
          <div className="absolute right-0 top-[calc(3rem+2px)] z-20 w-56 overflow-hidden rounded-lg border border-line bg-surface-2 shadow-2xl">
            <div className="border-b border-line-soft px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-dim">
              Filter by category
            </div>
            <div className="p-1">
              {categories.map((cat) => {
                const colors = CATEGORY_COLORS[cat.key] ?? DEFAULT_CATEGORY_COLORS
                const isPinned = pinnedCategory?.key === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => handlePinCategory(cat)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isPinned
                        ? "bg-accent-weak text-foreground"
                        : "text-fg-2 hover:bg-row-hover hover:text-foreground"
                    }`}
                  >
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
                      {cat.key}
                    </span>
                    <span className="flex-1">{cat.label}</span>
                    {isPinned && <span className="text-[10px] text-accent">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-faint">
      {children}
    </span>
  )
}
