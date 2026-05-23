import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface PlatformCardProps {
  slug: string
  name: string
  abbrev: string
  log_count: number
  source_count: number
  technique_count?: number
}

export function PlatformCard({
  slug,
  name,
  abbrev,
  log_count,
  source_count,
  technique_count,
}: PlatformCardProps) {
  return (
    <Link
      href={`/explore?f.platform=${slug}`}
      className="group flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-600 hover:bg-zinc-800/60"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded border border-zinc-700 bg-zinc-800 font-mono text-[10px] font-semibold tracking-wider text-zinc-300">
          {abbrev}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-zinc-700 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
      </div>

      <p className="text-sm font-medium text-zinc-100">{name}</p>

      <div className="flex flex-col gap-1 font-mono text-xs text-zinc-600">
        <span>
          <span className="text-emerald-400">{log_count.toLocaleString()}</span>{" "}
          <span>logs</span>
        </span>
        <span>
          <span className="text-zinc-400">{source_count}</span>{" "}
          <span>sources</span>
          {technique_count !== undefined && (
            <>
              <span className="mx-1 text-zinc-800">·</span>
              <span className="text-zinc-400">{technique_count}</span>{" "}
              <span>techniques</span>
            </>
          )}
        </span>
      </div>
    </Link>
  )
}
