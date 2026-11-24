import { z } from "zod";
import type { IconName } from "../components/icons";

/**
 * The incident report written by the AI investigator (the REPORT schema of the build plan). Almost every field is
 * optional and unknown fields pass through, so the screen still renders if the backend adds or omits something.
 * Field names follow the plan; if the backend's sample differs, only this file and the fixtures change.
 */
const looseObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
/** Optional, and a value of the wrong type is dropped instead of failing the whole report. */
const lenient = <T extends z.ZodTypeAny>(t: T) => t.optional().catch(undefined);

const TimelineItem = looseObject({ event_id: z.union([z.string(), z.number()]).optional(), what: z.string().optional() });

export const JustificationSchema = looseObject({
  verdict: lenient(z.string()), // justified | unjustified | inconclusive
  supporting_record_ids: lenient(z.array(z.union([z.string(), z.number()]))),
  missing_evidence: lenient(z.array(z.string())),
  reasoning: lenient(z.string()),
  reasons: lenient(z.array(z.string())), // may be empty or missing
  closes_incident: lenient(z.boolean()),
});

export const ReportSchema = looseObject({
  title: lenient(z.string()),
  summary: lenient(z.string()),
  detected_at: lenient(z.string()),
  risk_score: lenient(z.number()),
  severity: lenient(z.string()),
  actor: lenient(z.union([z.string(), looseObject({ id: z.string().optional(), name: z.string().optional() })])),
  scenario: lenient(z.string()),
  attack_techniques: lenient(z.array(z.string())),
  cited_event_ids: lenient(z.array(z.union([z.string(), z.number()]))),
  timeline: lenient(z.array(TimelineItem)),
  impact: lenient(looseObject({
    records: lenient(z.number()),
    rows_exported: lenient(z.number()),
    tiers: lenient(z.record(z.number())),
  })),
  justification: lenient(JustificationSchema),
  recommended_playbooks: lenient(z.array(z.string())),
  controls_failed: lenient(z.array(z.string())),
  cert_in_draft: lenient(z.union([z.string(), z.record(z.any())])),
  dpdp_intimation_draft: lenient(z.union([z.string(), z.record(z.any())])),
  open_questions: lenient(z.array(z.string())),
});
export type Report = z.infer<typeof ReportSchema>;
export type Justification = z.infer<typeof JustificationSchema>;

/** The endpoint that returns the report. Kept in one place so a rename is a one-line change. */
export const reportPath = (caseId: number) => `/api/cases/${caseId}/sar`;

// ---- Playbooks (response actions) ----------------------------------------------------------------------------
// The ids (PB1, ...) are what the backend accepts. Screens show only the name and the detail.
export const PLAYBOOKS: Record<string, { name: string; detail: string; icon: IconName }> = {
  PB1: { name: "Suspend the agent's access", detail: "The agent's next request is blocked.", icon: "userX" },
  PB2: { name: "Disable the partner key", detail: "The key's next request is blocked.", icon: "key" },
  PB6: { name: "Lock the evidence", detail: "Saves the record where nobody can edit or delete it (S3 Object Lock).", icon: "lock" },
  // The backend sends an in-app notification to every administrator; it does not page a DPO or a branch head.
  PB7: { name: "Notify administrators", detail: "Sends an in-app alert to every administrator.", icon: "bell" },
};
export const PLAYBOOK_IDS = Object.keys(PLAYBOOKS);

/** The playbooks ticked when the form opens: the recommended ones that exist in the catalog. */
export function defaultPlaybooks(report: Report | undefined): string[] {
  return (report?.recommended_playbooks ?? []).filter((p) => p in PLAYBOOKS);
}

// ---- Decision form rules -------------------------------------------------------------------------------------
export const MIN_REASON = 20;
export const reasonValid = (reason: string) => reason.trim().length >= MIN_REASON;

/** Approve needs at least one playbook; close (false positive) needs none. Both need a reason and the review tick. */
export function canSubmit(d: { action: "approve" | "close"; reason: string; reviewed: boolean; playbooks: string[] }): boolean {
  if (!reasonValid(d.reason) || !d.reviewed) return false;
  return d.action === "close" || d.playbooks.length > 0;
}

// ---- Clocks --------------------------------------------------------------------------------------------------
export const CERT_IN_HOURS = 6;
export const DPDP_HOURS = 72;
export const DPDP_EFFECTIVE = "13 May 2027";

/** Parses an ISO time. A time with no zone is read as UTC. Returns null if missing or invalid. */
export function parseTime(iso: string | undefined): number | null {
  if (!iso) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const t = Date.parse(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(t) ? null : t;
}

/** Milliseconds left on a clock that started at detection. Negative once overdue. Null without a detection time. */
export function clockRemainingMs(detectedAt: string | undefined, hours: number, now: number): number | null {
  const start = parseTime(detectedAt);
  return start === null ? null : start + hours * 3_600_000 - now;
}

export function formatRemaining(ms: number | null): string {
  if (ms === null) return "Not available";
  const overdue = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const text = `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return overdue ? `Overdue by ${text}` : `${text} left`;
}

// ---- Names ---------------------------------------------------------------------------------------------------
const TOKEN = /\bPH_\d{3}\b/g;
/** Replaces PH_### tokens with names from a map. Tokens with no name stay as they are. */
export function revealNames(text: string, names: Record<string, string>): string {
  return text.replace(TOKEN, (t) => names[t] ?? t);
}

// ---- Display helpers -----------------------------------------------------------------------------------------
/** Scores arrive as 0 to 100 or as a 0 to 1 fraction (the alert table stores Risk / 100). Always shown as 0 to 100. */
export function scoreOut100(score: number | undefined): number | null {
  if (score === undefined) return null;
  return Math.round(score <= 1 ? score * 100 : score);
}

export function actorName(actor: Report["actor"]): string | undefined {
  if (!actor) return undefined;
  return typeof actor === "string" ? actor : actor.name ?? actor.id;
}

export const DRAFT_BANNER = "DRAFT, requires DPO review";

// ---- Control status, derived in the browser -------------------------------------------------------------------
/** A control fails if any incident report lists it in controls_failed. Otherwise it passes. */
export function controlStatuses(controlIds: string[], failedLists: (string[] | undefined)[]): Record<string, "passing" | "failing"> {
  const failed = new Set(failedLists.flatMap((l) => l ?? []));
  return Object.fromEntries(controlIds.map((id) => [id, failed.has(id) ? "failing" : "passing"] as const));
}

// ---- Compliance status, honest version ----------------------------------------------------------------------------
/** PolicyGuard's own safeguards. They hold while the system runs; an incident never "breaks" them. */
export const SAFEGUARD_CONTROLS = ["C-AUDIT", "C-HUMAN", "C-PII", "C-AGENTS"];
/** Reporting deadlines: fail only when an incident still awaiting a decision has passed its deadline. */
export const CLOCK_CONTROLS: Record<string, number> = { "C-CERTIN": CERT_IN_HOURS, "C-DPDP72": DPDP_HOURS };
/** Case statuses that count: the current run's incidents. Superseded (old rehearsals), closed as false positive,
 *  auto-resolved (a justified cover) and failed runs are not violations. */
export const COUNTED_STATUSES = ["open", "awaiting_review", "approved"];

export type CaseReport = { status: string; controlsFailed?: string[]; detectedAt?: string };

/**
 * Status per control:
 * - safeguards: passing;
 * - CERT-In and DPDP clocks: failing only if an incident awaiting review is past its deadline;
 * - C-EXPORT ("detected and reviewed"): failing while an export incident awaits review, passing once a human decided;
 * - any other control (C-PORTFOLIO, C-INACTIVE): failing if a counted incident broke it.
 */
export function complianceStatuses(controlIds: string[], cases: CaseReport[], now: number): Record<string, "passing" | "failing"> {
  const counted = cases.filter((c) => COUNTED_STATUSES.includes(c.status));
  const pending = counted.filter((c) => c.status !== "approved");
  const broken = (id: string, from: CaseReport[]) => from.some((c) => (c.controlsFailed ?? []).includes(id));
  return Object.fromEntries(controlIds.map((id) => {
    if (SAFEGUARD_CONTROLS.includes(id)) return [id, "passing"] as const;
    if (id in CLOCK_CONTROLS) {
      const late = pending.some((c) => {
        const left = clockRemainingMs(c.detectedAt, CLOCK_CONTROLS[id], now);
        return left !== null && left <= 0;
      });
      return [id, late ? "failing" : "passing"] as const;
    }
    if (id === "C-EXPORT") return [id, broken(id, pending) ? "failing" : "passing"] as const;
    return [id, broken(id, counted) ? "failing" : "passing"] as const;
  }));
}

// ---- When a report exists ------------------------------------------------------------------------------------
/** Statuses that have an incident report to fetch. An auto-resolved alert keeps its report, so the justification panel shows. */
export const REPORT_STATUSES = ["awaiting_review", "approved", "auto_resolved"];
export const hasReport = (status: string | undefined): boolean => status !== undefined && REPORT_STATUSES.includes(status);

// ---- Report not ready yet ------------------------------------------------------------------------------------
export type ReportPhase = "ready" | "writing" | "not_started" | "failed" | "missing";

/**
 * What the incident page shows where the report goes. A new incident has no report for a few seconds while the AI runs,
 * and the report endpoint answers 404 until it is saved. That is "writing", not an error.
 */
export function reportPhase(input: { status: string | undefined; hasData: boolean; notFound: boolean }): ReportPhase {
  if (input.hasData) return "ready";
  const { status } = input;
  if (status === "open") return "writing";
  if (status === "pending") return "not_started";
  if (status === "failed") return "failed";
  if (hasReport(status) && input.notFound) return "writing";
  return "missing";
}

/** How long to keep polling for a report that answers 404: 30 polls, two seconds apart. */
export const REPORT_POLL_MS = 2000;
export const REPORT_POLL_LIMIT = 30;
