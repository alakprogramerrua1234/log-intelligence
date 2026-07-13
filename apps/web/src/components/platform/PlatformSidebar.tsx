"use client"

import Link from "next/link"
import { useFilterParams } from "@/hooks/useFilterParams"
import { ALL_PLATFORMS } from "@/lib/platforms"
import { MOCK_FILTER_CATEGORIES } from "@/lib/mock-data"

interface PlatformSidebarProps {
  activeSlug?: string
}

export function PlatformSidebar({ activeSlug }: PlatformSidebarProps) {
  const { filters } = useFilterParams()

  // Facet counts per category (platform is shown in its own list above)
  const facetCategories = MOCK_FILTER_CATEGORIES.filter((c) => c.key !== "platform")

  return (
    <aside className="hidden w-52 shrink-0 flex-col gap-6 border-r border-line px-3 py-5 md:flex">
      <div>
        <h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
          Platform
        </h4>
        <ul className="flex flex-col gap-px">
          {ALL_PLATFORMS.map((platform) => {
            const isActive = platform.slug === activeSlug
            return (
              <li key={platform.slug}>
                <Link
                  href={`/explore?f.platform=${platform.slug}`}
                  className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "bg-accent-weak font-semibold text-foreground"
                      : "text-fg-2 hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`text-[10px] ${isActive ? "text-accent" : "text-transparent"}`}>
                      ▸
                    </span>
                    {platform.name}
                  </span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${isActive ? "text-accent" : "text-faint"}`}
                  >
                    {platform.log_count.toLocaleString()}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
          Active facets
        </h4>
        <div className="flex flex-col gap-px">
          {facetCategories.map((category) => {
            const count = filters[category.key]?.length ?? 0
            return (
              <div
                key={category.key}
                className="flex items-center justify-between px-2.5 py-1 text-xs text-dim"
              >
                <span>{category.label}</span>
                <span
                  className={`font-mono text-[11px] font-semibold tabular-nums ${
                    count > 0 ? "text-foreground" : "text-faint"
                  }`}
                >
                  {count > 0 ? count : "—"}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
