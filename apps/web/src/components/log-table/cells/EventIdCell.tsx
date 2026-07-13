interface EventIdCellProps {
  eventId: string | null
  platform?: string
}

export function EventIdCell({ eventId, platform }: EventIdCellProps) {
  if (!eventId) return <span className="text-faint">—</span>

  return (
    <span className="inline-flex items-center gap-1">
      {platform && (
        <span className="font-mono text-[10px] text-faint">{platform.toUpperCase().slice(0, 3)}</span>
      )}
      <span className="rounded border border-line bg-badge px-1.5 font-mono text-xs font-semibold text-foreground">
        {eventId}
      </span>
    </span>
  )
}
