import { Database, Shield, Server, GitBranch } from "lucide-react"
import { PlatformCard } from "@/components/platform/PlatformCard"

// TODO: replace with `await fetch("/api/v1/platforms")` once API is live
const MOCK_STATS = [
  { label: "Logs", value: "4,190", icon: Database },
  { label: "Techniques", value: "612", icon: Shield },
  { label: "Platforms", value: "11", icon: Server },
  { label: "Log sources", value: "49", icon: GitBranch },
]

const PLATFORM_GROUPS = [
  {
    category: "os",
    label: "Operating Systems",
    platforms: [
      { slug: "windows", name: "Windows", abbrev: "WIN", log_count: 1240, source_count: 8, technique_count: 284 },
      { slug: "linux", name: "Linux", abbrev: "LNX", log_count: 640, source_count: 12, technique_count: 198 },
      { slug: "macos", name: "macOS", abbrev: "MAC", log_count: 320, source_count: 5, technique_count: 143 },
    ],
  },
  {
    category: "cloud",
    label: "Cloud",
    platforms: [
      { slug: "aws", name: "AWS", abbrev: "AWS", log_count: 890, source_count: 15, technique_count: 201 },
      { slug: "azure", name: "Azure", abbrev: "AZ", log_count: 720, source_count: 12, technique_count: 178 },
      { slug: "gcp", name: "GCP", abbrev: "GCP", log_count: 480, source_count: 9, technique_count: 134 },
    ],
  },
  {
    category: "saas",
    label: "SaaS & Identity",
    platforms: [
      { slug: "okta", name: "Okta", abbrev: "OKT", log_count: 180, source_count: 2, technique_count: 67 },
      { slug: "m365", name: "Microsoft 365", abbrev: "M365", log_count: 420, source_count: 7, technique_count: 115 },
      { slug: "gsuite", name: "Google Workspace", abbrev: "GSW", log_count: 210, source_count: 4, technique_count: 72 },
    ],
  },
  {
    category: "network",
    label: "Network",
    platforms: [
      { slug: "firewall", name: "Firewall", abbrev: "FW", log_count: 290, source_count: 6, technique_count: 89 },
      { slug: "dns", name: "DNS", abbrev: "DNS", log_count: 140, source_count: 3, technique_count: 54 },
    ],
  },
]

export default function HomePage() {
  return (
    <main className="flex-1 bg-zinc-950">
      {/* Stats bar */}
      <div className="border-b border-zinc-800/60 bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-2.5">
          <div className="flex items-center gap-6 overflow-x-auto">
            {MOCK_STATS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex shrink-0 items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-zinc-700" />
                <span className="font-mono text-sm font-semibold text-emerald-400">{value}</span>
                <span className="text-xs text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform grid */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-base font-semibold text-zinc-100">Explore by platform</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Select a platform to browse its logs and the MITRE ATT&amp;CK techniques they detect.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {PLATFORM_GROUPS.map((group) => (
            <section key={group.category}>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                {group.label}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.platforms.map((platform) => (
                  <PlatformCard key={platform.slug} {...platform} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Dataset version footer */}
        <div className="mt-12 flex items-center gap-2 border-t border-zinc-800/60 pt-4">
          <span className="font-mono text-[11px] text-zinc-700">dataset</span>
          <span className="font-mono text-[11px] text-zinc-600">—</span>
          <span className="font-mono text-[11px] text-zinc-600">not ingested yet</span>
        </div>
      </div>
    </main>
  )
}
