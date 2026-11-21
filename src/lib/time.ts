/** Backend times are UTC. A time with no zone is read as UTC, then shown in the viewer's own time zone. */
function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "20 Nov 2026, 3:50 pm" in local time, or "-" when missing. */
export function formatWhen(iso: string | null | undefined, withSeconds = false): string {
  const d = toDate(iso);
  if (!d) return "-";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: true,
  });
}

/** "5 min ago", "3 h ago", or the date for anything older than a day. */
export function formatAgo(iso: string | null | undefined, now = Date.now()): string {
  const d = toDate(iso);
  if (!d) return "-";
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 0) return formatWhen(iso);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return formatWhen(iso);
}
