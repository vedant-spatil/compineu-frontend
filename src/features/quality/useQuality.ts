import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api, ApiError } from "../../api/client";

const Side = z.object({
  precision: z.number().optional(),
  recall: z.number().optional(),
  incidents: z.number().optional(),
  alerts: z.number().optional(),
}).passthrough();
export const QualitySchema = z.object({
  triage_off: Side.optional(),
  triage_on: Side.optional(),
  // The backend (GET /api/quality) names the two sides ai_off and ai_on and gives the median time to detect in minutes.
  ai_off: Side.optional(),
  ai_on: Side.optional(),
  time_to_detect_s: z.number().optional(),
  time_to_detect_sim_minutes_median: z.number().optional(),
}).passthrough();

/** The page reads triage_off, triage_on and time_to_detect_s. Fill them from the backend's names when only those exist. */
export function normalizeQuality(raw: z.infer<typeof QualitySchema>): z.infer<typeof QualitySchema> {
  const minutes = raw.time_to_detect_sim_minutes_median;
  return {
    ...raw,
    triage_off: raw.triage_off ?? raw.ai_off,
    triage_on: raw.triage_on ?? raw.ai_on,
    time_to_detect_s: raw.time_to_detect_s ?? (minutes !== undefined ? Math.round(minutes * 60) : undefined),
  };
}

/** The quality numbers. The nav item and the page share this one query, so a 404 is only asked once. */
export function useQuality(enabled = true) {
  return useQuery({
    queryKey: ["quality"],
    enabled,
    queryFn: async () => normalizeQuality(QualitySchema.parse(await api<unknown>("/api/quality"))),
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * The Quality page exists only if the backend has it. It is shown once /api/quality answers, and also when the call fails
 * for another reason such as 503, so the page can show its own Retry. A 404 hides it. While the first answer is pending
 * it stays hidden, so the item does not flash in and out.
 */
export function qualityAvailable(q: { isLoading: boolean; error: unknown }): boolean {
  if (q.isLoading) return false;
  return !(q.error instanceof ApiError && q.error.status === 404);
}

/**
 * Switch for the Quality page. Off for the demo: its numbers come from our own test scenarios, so the page is hidden
 * (no nav item, /quality redirects to the dashboard, no /api/quality call). Set to true to show it again.
 */
export const QUALITY_PAGE_ENABLED = false;

/** True when the Quality nav item and route should exist. */
export function useQualityAvailable(isAdmin: boolean): { available: boolean; pending: boolean } {
  const q = useQuality(isAdmin && QUALITY_PAGE_ENABLED);
  if (!QUALITY_PAGE_ENABLED) return { available: false, pending: false };
  return { available: isAdmin && qualityAvailable(q), pending: isAdmin && q.isLoading };
}
