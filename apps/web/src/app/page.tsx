import Link from "next/link"
import { ArrowRight, Database, GitBranch, Plus, Server, Shield, Users } from "lucide-react"
import { getMockLogs } from "@/lib/mock-data"
import { PLATFORM_GROUPS } from "@/lib/platforms"

// TODO: replace with `await fetch("/api/v1/platforms")` once API is live
const MOCK_STATS = [
  { label: "Logs indexed", value: "4,190", icon: Database },
  { label: "Techniques covered", value: "612", icon: Shield },
  { label: "Platforms", value: "11", icon: Server },
  { label: "Log sources", value: "49", icon: GitBranch },
]

function rankColor(relevance: number): string {
  if (relevance >= 85) return "text-hi"
  if (relevance >= 60) return "text-mid"
  return "text-lo"
}

export default function HomePage() {
  const topLogs = [...getMockLogs({}, "").items]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 6)

  return (
    <main className="flex-1 bg-background">
      {/* Stats bar */}
      <div className="border-b border-line bg-surface-1">
        <div className="mx-auto max-w-7xl px-4 py-2.5">
          <div className="flex items-center gap-7 overflow-x-auto">
            {MOCK_STATS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex shrink-0 items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono text-sm font-semibold text-accent">{value}</span>
                <span className="text-xs text-dim">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Hero + Top logs */}
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          {/* Project presentation */}
          <section className="flex flex-col items-start gap-3.5 rounded-2xl border border-line bg-linear-to-br from-accent-weak via-surface-1 to-surface-1 p-7">
            <span className="rounded-full bg-accent-weak px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-accent">
              COMMUNITY-DRIVEN
            </span>
            <h1 className="max-w-[20ch] text-balance text-2xl font-bold leading-tight tracking-tight text-foreground">
              Start from the logs. The techniques follow.
            </h1>
            <p className="max-w-[52ch] text-sm leading-relaxed text-fg-2">
              Explore security logs by platform and discover which MITRE ATT&amp;CK techniques
              they can detect — bottom-up, the way a SOC analyst thinks.
            </p>
            <p className="flex items-center gap-2 text-xs leading-relaxed text-dim">
              <Users className="h-4 w-4 shrink-0 text-accent" />
              Maintained by the community. Contribute your logs and detections to keep the
              catalog up to date.
            </p>
            <div className="mt-1 flex flex-wrap gap-2.5">
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-fg transition-[filter] hover:brightness-105"
              >
                Explore logs
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Contribute
              </Link>
            </div>
          </section>

          {/* Top logs by relevance */}
          <section className="rounded-2xl border border-line bg-surface-1 p-5">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-foreground">Top logs</h2>
              <span className="text-[11px] text-dim">by relevance ranking</span>
            </div>
            <ol className="flex flex-col gap-0.5">
              {topLogs.map((log, i) => (
                <li
                  key={log.id}
                  className="flex items-center gap-3 rounded-md px-2.5 py-2 odd:bg-zebra"
                >
                  <span className="w-4 shrink-0 text-center font-mono text-xs font-bold text-accent">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {log.event_id && (
                        <span className="rounded border border-line bg-badge px-1.5 font-mono text-[11px] text-foreground">
                          {log.event_id}
                        </span>
                      )}
                      <span className="truncate text-xs font-medium text-foreground">
                        {log.name}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-dim">
                      {log.log_source_name} · {log.techniques[0]?.id ?? "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${log.relevance}%` }}
                      />
                    </span>
                    <span
                      className={`w-6 text-right font-mono text-xs font-bold tabular-nums ${rankColor(log.relevance)}`}
                    >
                      {log.relevance}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Platforms — compact text list */}
        <section className="mt-4 rounded-2xl border border-line bg-surface-1 p-5">
          <div className="mb-4 flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-foreground">Explore by platform</h2>
            <span className="text-[11px] text-dim">logs and techniques per platform</span>
          </div>
          <div className="grid grid-cols-2 gap-x-7 gap-y-5 sm:grid-cols-4">
            {PLATFORM_GROUPS.map((group) => (
              <div key={group.category}>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                  {group.label}
                </h3>
                <div className="flex flex-col gap-0.5">
                  {group.platforms.map((platform) => (
                    <Link
                      key={platform.slug}
                      href={`/explore?f.platform=${platform.slug}`}
                      className="group block rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium text-foreground transition-colors group-hover:text-accent">
                          {platform.name}
                        </span>
                        <span className="font-mono text-xs font-bold tabular-nums text-accent">
                          {platform.log_count.toLocaleString()}
                        </span>
                      </span>
                      <span className="mt-px flex gap-3 font-mono text-[10px] text-faint">
                        <span>{platform.source_count} sources</span>
                        <span>{platform.technique_count} techniques</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Dataset version footer */}
        <div className="mt-8 flex items-center gap-2 border-t border-line-soft pt-4">
          <span className="font-mono text-[11px] text-faint">dataset</span>
          <span className="font-mono text-[11px] text-faint">—</span>
          <span className="font-mono text-[11px] text-dim">not ingested yet</span>
        </div>
      </div>
    </main>
  )
}
