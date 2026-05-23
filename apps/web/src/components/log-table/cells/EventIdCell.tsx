interface EventIdCellProps {
  eventId: string | null
  platform?: string
}

export function EventIdCell({ eventId, platform }: EventIdCellProps) {
  if (!eventId) return <span className="text-zinc-700">—</span>

  return (
    <span className="inline-flex items-center gap-1">
      {platform && (
        <span className="font-mono text-[10px] text-zinc-600">{platform.toUpperCase().slice(0, 3)}</span>
      )}
      <span className="font-mono text-xs font-semibold text-emerald-400">{eventId}</span>
    </span>
  )
}
