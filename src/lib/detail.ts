/** The backend's own message from an error body. FastAPI sends {"detail": "text"} or {"detail": [{"msg": "text"}]}. */
export function detailFromBody(body: string): string {
  const raw = body.trim();
  if (!raw) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    const detail = (parsed as { detail?: unknown })?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const msgs = detail.map((d) => (typeof d === "string" ? d : (d as { msg?: unknown })?.msg)).filter((m): m is string => typeof m === "string");
      if (msgs.length > 0) return msgs.join(". ");
    }
    return "";
  } catch {
    // Not JSON. Plain text from a proxy is fine to show unless it looks like markup.
    return raw.startsWith("<") ? "" : raw.slice(0, 200);
  }
}
