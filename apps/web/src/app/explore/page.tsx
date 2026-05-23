import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { LogTableClient } from "@/components/log-table/LogTableClient"

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
    <main className="flex flex-1 flex-col min-h-0 bg-zinc-950">
      {/* Page header */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold text-zinc-100">
              {platformName ?? "All platforms"}
            </h1>
            {platformName && (
              <span className="font-mono text-xs text-zinc-600">logs</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-600">
            {platformName
              ? `Browsing logs for ${platformName}. Use filters or ⌘K to narrow down.`
              : "Browse all logs across platforms. Select a platform from the homepage or filter with ⌘K."}
          </p>
        </div>
      </div>

      {/* Table — wrapped in Suspense because LogTableClient uses useSearchParams */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col min-h-0">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            </div>
          }
        >
          <LogTableClient platformName={platformName} />
        </Suspense>
      </div>
    </main>
  )
}
