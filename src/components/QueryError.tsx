import { useEffect } from "react";
import { friendlyError } from "../lib/errors";

/**
 * A short message for a failed call, with a Retry button. When the backend is unavailable it says so and retries on its
 * own every few seconds. It never shows raw JSON.
 */
export default function QueryError({ error, onRetry, intervalMs = 5000 }: { error: unknown; onRetry: () => void; intervalMs?: number }) {
  const { text, retrying } = friendlyError(error);
  useEffect(() => {
    if (!retrying) return;
    const t = setInterval(onRetry, intervalMs);
    return () => clearInterval(t);
  }, [retrying, onRetry, intervalMs]);
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-danger-50 px-4 py-3 text-sm text-danger-600 ring-1 ring-inset ring-danger-100">
      <span>{text}</span>
      <button type="button" onClick={onRetry} className="rounded-lg px-3 py-1 text-xs font-medium text-danger-600 ring-1 ring-inset ring-danger-500 hover:bg-surface">
        Retry
      </button>
    </div>
  );
}
