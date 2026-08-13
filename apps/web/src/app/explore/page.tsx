import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { LogTableClient } from "@/components/log-table/LogTableClient"
import { PlatformSidebar } from "@/components/platform/PlatformSidebar"

// Platform display names — keyed by slug.
// TODO: replace with GET /platforms/{slug} once API is live.
const PLATFORM_NAMES: Record<string, string> = {
  windows:  "Microsoft Windows",
  linux:    "Linux",
  macos:    "macOS",
  aws:      "Amazon Web Services",
  azure:    "Microsoft Azure",
  gcp:      "Google Cloud Platform",
  okta:     "Okta",
  m365:     "Microsoft 365",
  gsuite:   "Google Workspace",
  firewall: "Firewall",
  dns:      "DNS",
}

interface ExplorePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams
  const platformSlug = Array.isArray(params["f.platform"])
    ? params["f.platform"][0]
    : (params["f.platform"] ?? "")

  const platformName = platformSlug ? (PLATFORM_NAMES[platformSlug] ?? platformSlug) : undefined

  // TODO: when API is live, fetch categories server-side:
  //   const categories = await api.filters.categories()
  // and pass them to LogTableClient as a prop.

  return (
    <main className="flex flex-1 flex-col min-h-0 bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 min-h-0">
        {/* Sidebar — platform switcher + active facets (uses useSearchParams) */}
        <Suspense fallback={<div className="hidden w-52 shrink-0 border-r border-line md:block" />}>
          <PlatformSidebar activeSlug={platformSlug || undefined} />
        </Suspense>

        <div className="flex min-w-0 flex-1 flex-col min-h-0">
          {/* Page header */}
          <div className="border-b border-line px-4 py-4">
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-semibold text-foreground">
                {platformName ?? "All platforms"}
              </h1>
              {platformName && (
                <span className="font-mono text-xs text-faint">logs</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-dim">
              {platformName
                ? `Browsing logs for ${platformName}. Use filters or ⌘K to narrow down.`
                : "Browse all logs across platforms. Select a platform or filter with ⌘K."}
            </p>
          </div>

          {/* Table — wrapped in Suspense because LogTableClient uses useSearchParams */}
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-dim" />
              </div>
            }
          >
            <LogTableClient platformName={platformName} />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
