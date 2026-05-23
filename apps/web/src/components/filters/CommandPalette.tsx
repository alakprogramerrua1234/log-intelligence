"use client"

import { useEffect, useState } from "react"
import { Command } from "cmdk"
import { Search, Filter, FileText } from "lucide-react"
import { useQueryState, parseAsString } from "nuqs"
import { useFilterParams } from "@/hooks/useFilterParams"
import type { FilterCategory, Log } from "@/lib/types"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: FilterCategory[]
  // TODO: replace with real search results from /search/suggest
  mockLogs?: Log[]
}

export function CommandPalette({ open, onOpenChange, categories, mockLogs = [] }: CommandPaletteProps) {
  const [inputValue, setInputValue] = useState("")
  const [, setQ] = useQueryState("q", parseAsString.withDefault(""))
  const { setFilter, filters } = useFilterParams()

  // Reset input when palette closes
  useEffect(() => {
    if (!open) setInputValue("")
  }, [open])

  // Keyboard shortcut: ⌘K / Ctrl+K
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

  // Detect if user typed "category:" prefix to filter by category
  const colonIdx = inputValue.indexOf(":")
  const prefixedCategory = colonIdx > 0 ? inputValue.slice(0, colonIdx).toLowerCase() : null
  const prefixedQuery = colonIdx > 0 ? inputValue.slice(colonIdx + 1).trim() : inputValue

  const activeCategory = prefixedCategory
    ? categories.find((c) => c.key === prefixedCategory || c.label.toLowerCase() === prefixedCategory)
    : null

  // TODO: replace with /search/suggest?category=<key>&q=<prefixedQuery>
  const filterSuggestions: string[] = activeCategory
    ? getMockFilterSuggestions(activeCategory.key, prefixedQuery)
    : []

  // TODO: replace with /logs?q=<inputValue>&limit=5 via Meilisearch
  const logSuggestions: Log[] = !activeCategory
    ? mockLogs
        .filter(
          (l) =>
            !inputValue ||
            l.name.toLowerCase().includes(inputValue.toLowerCase()) ||
            l.event_id?.includes(inputValue) ||
            l.channel?.toLowerCase().includes(inputValue.toLowerCase()),
        )
        .slice(0, 5)
    : []

  function handleSelectFilter(categoryKey: string, value: string) {
    const current = filters[categoryKey] ?? []
    if (!current.includes(value)) {
      setFilter(categoryKey, [...current, value])
    }
    onOpenChange(false)
  }

  function handleSearch() {
    setQ(inputValue || null)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-zinc-800 px-3">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <Command.Input
              value={inputValue}
              onValueChange={setInputValue}
              placeholder="Search logs, or type platform: tactic: event_id: …"
              className="flex h-12 w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              autoFocus
            />
          </div>

          <Command.List className="max-h-[360px] overflow-y-auto p-1">
            <Command.Empty className="py-8 text-center text-sm text-zinc-600">
              No results
            </Command.Empty>

            {/* Filter by category shortcuts */}
            {!activeCategory && inputValue === "" && (
              <Command.Group heading={<GroupHeading>Filter by</GroupHeading>}>
                {categories.map((cat) => (
                  <Command.Item
                    key={cat.key}
                    value={`filter:${cat.key}`}
                    onSelect={() => {
                      setInputValue(`${cat.key}:`)
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 aria-selected:bg-zinc-800"
                  >
                    <Filter className="h-3.5 w-3.5 text-zinc-600" />
                    <span>{cat.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-zinc-600">{cat.key}:</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Filter value suggestions when user typed "category:" */}
            {activeCategory && (
              <Command.Group heading={<GroupHeading>{activeCategory.label}</GroupHeading>}>
                {filterSuggestions.length === 0 && prefixedQuery && (
                  <Command.Item
                    value={`filtervalue:${activeCategory.key}:${prefixedQuery}`}
                    onSelect={() => handleSelectFilter(activeCategory.key, prefixedQuery)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 aria-selected:bg-zinc-800"
                  >
                    <Filter className="h-3.5 w-3.5 text-zinc-600" />
                    Add <span className="text-emerald-400">{prefixedQuery}</span> as {activeCategory.label} filter
                  </Command.Item>
                )}
                {filterSuggestions.map((val) => (
                  <Command.Item
                    key={val}
                    value={`filtervalue:${activeCategory.key}:${val}`}
                    onSelect={() => handleSelectFilter(activeCategory.key, val)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 aria-selected:bg-zinc-800"
                  >
                    <Filter className="h-3.5 w-3.5 text-zinc-600" />
                    {val}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Log search results */}
            {logSuggestions.length > 0 && (
              <Command.Group heading={<GroupHeading>Logs</GroupHeading>}>
                {logSuggestions.map((log) => (
                  <Command.Item
                    key={log.id}
                    value={`log:${log.id}`}
                    onSelect={handleSearch}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-zinc-800 aria-selected:bg-zinc-800"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                    <div className="min-w-0">
                      <span className="text-zinc-200">{log.name}</span>
                      {log.event_id && (
                        <span className="ml-2 font-mono text-[10px] text-emerald-400">{log.event_id}</span>
                      )}
                      {log.channel && (
                        <span className="ml-2 hidden font-mono text-[10px] text-zinc-600 sm:inline truncate">
                          {log.channel}
                        </span>
                      )}
                    </div>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-600">
                      {log.log_source_name}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Free search action */}
            {inputValue && !activeCategory && (
              <Command.Group>
                <Command.Item
                  value={`search:${inputValue}`}
                  onSelect={handleSearch}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 aria-selected:bg-zinc-800"
                >
                  <Search className="h-3.5 w-3.5 text-zinc-600" />
                  Search for <span className="ml-1 text-zinc-200">&ldquo;{inputValue}&rdquo;</span>
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

// TODO: replace with /search/suggest?category=<key>&q=<q>
function getMockFilterSuggestions(categoryKey: string, q: string): string[] {
  const all: Record<string, string[]> = {
    platform:   ["windows", "linux", "macos", "aws", "azure", "gcp", "okta", "m365"],
    log_source: ["Sysmon", "Windows Security", "PowerShell", "WMI", "AppLocker", "CloudTrail"],
    tactic:     ["execution", "persistence", "privilege-escalation", "defense-evasion", "credential-access", "discovery", "lateral-movement", "command-and-control", "exfiltration", "impact", "initial-access", "collection"],
    event_id:   ["1", "3", "4", "7", "8", "10", "11", "4624", "4625", "4688", "4698", "4104"],
  }
  const values = all[categoryKey] ?? []
  return values.filter((v) => !q || v.toLowerCase().includes(q.toLowerCase()))
}
