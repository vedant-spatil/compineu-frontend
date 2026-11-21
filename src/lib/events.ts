import { PLAYBOOKS } from "../api/report";
import { humanize, scenarioType, signal, stepLabel, verdict, type Tone } from "./glossary";

/** One case_events row as the API returns it. */
export type CaseEventLike = { node: string; kind: string; payload: Record<string, unknown> };

export type EventView = {
  /** One short sentence, for example "Risk check passed". */
  title: string;
  /** An optional second line with the numbers or the reason. */
  detail?: string;
  tone: Tone;
};

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
/** Scores in events are 0 to 1 (Risk / 100) or already 0 to 100. */
const score100 = (v: unknown) => {
  const n = num(v);
  return n === undefined ? undefined : Math.round(n <= 1 ? n * 100 : n);
};
const playbookName = (id: string) => PLAYBOOKS[id]?.name ?? humanize(id);
const signalNames = (v: unknown) => list(v).map((s) => signal(s).label).join(", ");

const RERUN_REASONS: Record<string, string> = {
  risk_escalated: "the risk went up",
  rerun_pending: "new activity arrived while it was running",
};

/**
 * A plain-language view of an audit event. The technical node and kind stay available as a tooltip; this only decides
 * what a reader sees. Unknown events fall back to "<step>: <kind>" so nothing is ever hidden.
 */
export function describeEvent(e: CaseEventLike): EventView {
  const p = e.payload ?? {};
  const err = str(p.error);
  if (e.kind === "error" || e.node.endsWith("error")) {
    return { title: `${stepLabel(e.node)} failed`, detail: err, tone: "danger" };
  }

  switch (`${e.node}:${e.kind}`) {
    case "ingest_alert:start":
      return { title: "Incident opened from an alert", detail: num(p.alert_id) !== undefined ? `Alert ${p.alert_id}` : undefined, tone: "info" };
    case "triage:opened": {
      const s = score100(p.score);
      return { title: "Risk check passed, investigation started", detail: s !== undefined ? `Risk ${s} out of 100` : undefined, tone: "info" };
    }
    case "triage:decision": {
      const s = score100(p.score);
      return { title: "Closed as low risk", detail: s !== undefined ? `Risk ${s} out of 100, below the investigation threshold` : undefined, tone: "neutral" };
    }
    case "load_context:done": {
      const gaps = list(p.data_gaps);
      return {
        title: "Background gathered",
        detail: gaps.length ? `Some records were unavailable: ${gaps.map(humanize).join(", ")}` : "Profile, portfolio, leave, transfer and ticket records",
        tone: gaps.length ? "warn" : "ok",
      };
    }
    case "evidence:done": {
      const parts: string[] = [];
      if (num(p.event_count) !== undefined) parts.push(`${num(p.event_count)!.toLocaleString()} access events`);
      if (num(p.out_of_scope_records)) parts.push(`${num(p.out_of_scope_records)!.toLocaleString()} records outside the portfolio`);
      if (num(p.export_rows)) parts.push(`${num(p.export_rows)!.toLocaleString()} rows exported`);
      return { title: "Evidence collected", detail: parts.join(" · ") || undefined, tone: "ok" };
    }
    case "justification:done": {
      const v = verdict(str(p.verdict));
      return { title: `Business reason check: ${v.label.toLowerCase()}`, detail: v.description || undefined, tone: v.tone };
    }
    case "justification:skipped_llm":
      return { title: "Business reason check done by code only", detail: str(p.reason) ? humanize(str(p.reason)!) : undefined, tone: "neutral" };
    case "classify:done": {
      const sc = str(p.scenario);
      return { title: sc ? `Identified as: ${scenarioType(sc).label}` : "Incident type could not be identified", tone: sc ? "ok" : "warn" };
    }
    case "route:decision":
      return str(p.action) === "auto_resolve"
        ? { title: "Next step: close automatically", detail: "A valid business reason was proven from the records", tone: "ok" }
        : { title: "Next step: send to an analyst", detail: "The incident needs a human decision", tone: "warn" };
    case "report_writer:done":
      return {
        title: "AI wrote the incident report",
        detail: num(p.sar_version) !== undefined ? `Version ${p.sar_version}` : undefined,
        tone: "ok",
      };
    case "report_writer:skipped_llm":
      return { title: "Report written from the facts only", detail: "The AI step was skipped because there was no evidence", tone: "warn" };
    case "auto_resolve:dismissed":
      return { title: "Closed automatically with reasons", detail: str(p.summary), tone: "ok" };
    case "review:incomplete":
      return {
        title: "Ready for review, but some steps did not finish",
        detail: list(p.failures).length ? `${list(p.failures).join(", ")}. Review before deciding, or restart the investigation.` : undefined,
        tone: "warn",
      };
    case "review:identities_viewed":
      return { title: "Real customer names were shown", detail: num(p.tokens) !== undefined ? `${p.tokens} names` : undefined, tone: "warn" };
    case "finalize:decision": {
      const chosen = list(p.playbooks).map(playbookName);
      return str(p.action) === "approve"
        ? { title: "Analyst approved actions", detail: chosen.join(", ") || undefined, tone: "ok" }
        : { title: "Analyst closed it as a false alarm", tone: "neutral" };
    }
    case "finalize:playbooks_skipped":
      return { title: "Actions were recorded but not run", detail: list(p.requested).map(playbookName).join(", ") || undefined, tone: "warn" };
    case "finalize:playbook_error":
      return { title: "An action failed", detail: err, tone: "danger" };
    case "detection:risk_escalated": {
      const before = num((p.old as Record<string, unknown> | undefined)?.risk);
      const after = num((p.new as Record<string, unknown> | undefined)?.risk);
      const added = signalNames(p.signals);
      const detail = [
        before !== undefined && after !== undefined ? `Risk ${Math.round(before)} → ${Math.round(after)}` : "",
        added ? `New: ${added}` : "",
      ].filter(Boolean).join(" · ");
      return { title: "Risk went up", detail: detail || undefined, tone: "warn" };
    }
    case "workflow:rerun": {
      const r = str(p.reason);
      return { title: "Investigation restarted", detail: r ? `Because ${RERUN_REASONS[r] ?? humanize(r).toLowerCase()}` : undefined, tone: "info" };
    }
    case "assignment:assigned":
      return { title: "Assigned to a reviewer", tone: "info" };
  }

  if (e.node === "playbook") {
    const id = e.kind.startsWith("PB6") ? "PB6" : e.kind;
    const result = str(p.result);
    const name = playbookName(id);
    if (result === "error") return { title: `Action failed: ${name}`, detail: err, tone: "danger" };
    if (result === "not_applicable") return { title: `Action skipped: ${name}`, detail: "It does not apply to this incident", tone: "neutral" };
    if (e.kind === "PB6_evidence_preserved") return { title: "Evidence locked in tamper-proof storage", tone: "ok" };
    return { title: `Action done: ${name}`, detail: str(p.subject), tone: "ok" };
  }

  return { title: `${stepLabel(e.node)}: ${humanize(e.kind).toLowerCase()}`, tone: "neutral" };
}
