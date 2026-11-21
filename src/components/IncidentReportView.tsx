import { useEffect, useState, type ReactNode } from "react";
import {
  actorName, CERT_IN_HOURS, clockRemainingMs, DPDP_EFFECTIVE, DPDP_HOURS, DRAFT_BANNER, formatRemaining, PLAYBOOKS,
  revealNames, scoreOut100, type Justification, type Report,
} from "../api/report";
import { actorKind, control, humanize, scenarioType, technique, tier, verdict } from "../lib/glossary";
import { formatWhen } from "../lib/time";
import { Icon } from "./icons";
import SectionBoundary from "./SectionBoundary";
import { Card, Hint, Pill, RiskMeter, TONES } from "./ui";

type Props = {
  version: number;
  report: Report;
  /** Token to name map. Empty until an analyst reveals names, which is an audited action. */
  names?: Record<string, string>;
  namesRevealed?: boolean;
  revealing?: boolean;
  revealError?: boolean;
  onReveal?: () => void;
};

const Label = ({ children }: { children: ReactNode }) => (
  <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{children}</div>
);

/** Event ids arrive as numbers ("90211") or references ("EV-90211"). Numbers read as "Event 90211". */
const eventLabel = (id: string | number) => (/^\d+$/.test(String(id)) ? `Event ${id}` : String(id));

function DraftBanner() {
  return <Pill tone="warn">{DRAFT_BANNER}</Pill>;
}

/** One deadline. It starts at detection, not at approval, and ticks every second. */
function Clock({ title, hours, detectedAt, note, now }: { title: string; hours: number; detectedAt?: string; note?: string; now: number }) {
  const ms = clockRemainingMs(detectedAt, hours, now);
  const overdue = ms !== null && ms < 0;
  const used = ms === null ? 0 : Math.min(100, Math.max(0, 100 - (ms / (hours * 3_600_000)) * 100));
  const tone = ms === null ? "neutral" : overdue ? "danger" : used > 75 ? "warn" : "ok";
  return (
    <div className="rounded-md bg-page p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink-900">{title}</span>
        <Icon name="clock" size={16} className="text-ink-400" />
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${TONES[tone].text}`}>{formatRemaining(ms)}</div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${TONES[tone].bar}`} style={{ width: `${used}%` }} />
      </div>
      <div className="mt-2 text-xs text-ink-400">Started at detection{detectedAt ? `: ${formatWhen(detectedAt)}` : ""}</div>
      {note && <div className="mt-1 text-xs leading-relaxed text-ink-600">{note}</div>}
    </div>
  );
}

function JustificationPanel({ j, score, text }: { j?: Justification; score: number | null; text: (s: string) => string }) {
  if (!j) {
    return <p className="text-sm text-ink-400">No business reason check ran for this incident.</p>;
  }
  const v = verdict(j.verdict);
  const incident = score !== null && score >= 60;
  return (
    <div className="space-y-4 text-sm">
      <div className={`flex items-start gap-3 rounded-md p-3 ring-1 ring-inset ${TONES[v.tone].soft}`}>
        <Icon name={v.tone === "ok" ? "check" : v.tone === "brand" ? "xCircle" : "help"} size={20} className="mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold">{v.label}</div>
          {v.description && <div className="text-xs opacity-90">{v.description}</div>}
        </div>
      </div>
      {incident && (
        <p className="rounded-lg bg-info-50 px-3 py-2 text-xs leading-relaxed text-info-600">
          This is a high-risk incident (60 or more), so it is never closed automatically. The result is shown for your information.
        </p>
      )}
      {j.reasoning && <p className="leading-relaxed text-ink-900">{text(j.reasoning)}</p>}
      {j.reasons && j.reasons.length > 0 && (
        <div>
          <Label>Reasons</Label>
          <ul className="mt-2 space-y-1.5 text-ink-900">
            {j.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ink-400" />
                <span>{text(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <Label>Records that support it</Label>
        {j.supporting_record_ids && j.supporting_record_ids.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {j.supporting_record_ids.map((id) => (
              <li key={String(id)}><Pill tone="ok">{String(id)}</Pill></li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-ink-400">None.</p>
        )}
      </div>
      <div>
        <Label>What is missing</Label>
        {j.missing_evidence && j.missing_evidence.length > 0 ? (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-900">
            {j.missing_evidence.map((m) => <li key={m}>{text(m)}</li>)}
          </ul>
        ) : (
          <p className="mt-1 text-ink-400">None.</p>
        )}
      </div>
    </div>
  );
}

function DraftBody({ draft, text }: { draft: string | Record<string, unknown> | undefined; text: (s: string) => string }) {
  if (draft === undefined) return <p className="text-sm text-ink-400">Not available.</p>;
  if (typeof draft === "string") return <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900">{text(draft)}</p>;
  return (
    <dl className="space-y-3 text-sm">
      {Object.entries(draft).map(([k, v]) => (
        <div key={k}>
          <dt><Label>{humanize(k)}</Label></dt>
          <dd className="mt-0.5 whitespace-pre-line leading-relaxed text-ink-900">{text(typeof v === "string" ? v : JSON.stringify(v))}</dd>
        </div>
      ))}
    </dl>
  );
}

function Fact({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-md bg-page p-4">
      <dt><Label>{label}{hint && <Hint text={hint} />}</Label></dt>
      <dd className="mt-1 text-base font-semibold text-ink-900">{children}</dd>
    </div>
  );
}

/** The incident report as readable sections. The raw data stays behind a disclosure for auditors. */
export default function IncidentReportView({ version, report, names = {}, namesRevealed = false, revealing = false, revealError = false, onReveal }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const text = (s: string) => revealNames(s, names);
  const score = scoreOut100(report.risk_score);
  const cited = report.cited_event_ids ?? [];
  const actor = actorName(report.actor);
  const actorId = typeof report.actor === "object" ? report.actor?.id : report.actor;
  const kind = actorId ? actorKind(actorId) : "";
  const scenario = report.scenario ? scenarioType(report.scenario) : null;
  const tiers = Object.entries(report.impact?.tiers ?? {}).filter(([, n]) => n > 0);
  const tierTotal = tiers.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="space-y-6">
      <SectionBoundary><Card>
        <div className="space-y-6 text-sm text-ink-900">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Incident report</span>
                <Pill tone="warn" title="Written by the AI from the evidence. An analyst must review it.">AI draft · version {version}</Pill>
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">{report.title ? text(report.title) : "Untitled incident"}</h2>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-ink-600">
                {actor && (
                  <span>Who: <span className="font-medium text-ink-900">{text(actor)}</span>{kind && <span className="text-ink-400"> · {kind}</span>}</span>
                )}
                {report.detected_at && <span>Detected: <span className="font-medium text-ink-900">{formatWhen(report.detected_at)}</span></span>}
              </div>
            </div>
            <div className="w-48">
              <RiskMeter score={score} />
              {score === null && report.severity && <div className="mt-2 text-right"><Pill tone="danger">{report.severity}</Pill></div>}
            </div>
          </div>

          <div>
            <Label>Summary</Label>
            <p className="mt-1.5 text-[15px] leading-relaxed">{report.summary ? text(report.summary) : "Not available."}</p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            <Fact label="Type of incident" hint={scenario?.description || undefined}>{scenario ? scenario.label : "-"}</Fact>
            <Fact label="Records touched">{report.impact?.records?.toLocaleString() ?? "-"}</Fact>
            <Fact label="Rows exported">{report.impact?.rows_exported?.toLocaleString() ?? "-"}</Fact>
          </dl>

          {tiers.length > 0 && (
            <div>
              <Label>Data involved</Label>
              <ul className="mt-2 space-y-2.5">
                {tiers.map(([code, n]) => {
                  const t = tier(code);
                  return (
                    <li key={code} title={t.description || undefined}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{t.label}</span>
                          {t.level && <Pill tone={t.tone}>{t.level}</Pill>}
                        </span>
                        <span className="font-semibold tabular-nums">{n.toLocaleString()} records</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div className={`h-full rounded-full ${TONES[t.tone].bar}`} style={{ width: `${tierTotal ? (n / tierTotal) * 100 : 0}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {report.attack_techniques && report.attack_techniques.length > 0 && (
            <div>
              <Label>How it was done<Hint text="Matched to MITRE ATT&CK, a public list of known attack methods. Hover a label to see its id." /></Label>
              <ul className="mt-2 flex flex-wrap gap-2">
                {report.attack_techniques.map((id) => {
                  const t = technique(id);
                  return <li key={id}><Pill tone="info" title={t.tooltip}>{t.label}</Pill></li>;
                })}
              </ul>
            </div>
          )}

          {report.recommended_playbooks && report.recommended_playbooks.length > 0 && (
            <div>
              <Label>Actions the AI recommends</Label>
              <ul className="mt-2 flex flex-wrap gap-2">
                {report.recommended_playbooks.map((p) => (
                  <li key={p}><Pill tone="neutral" title={PLAYBOOKS[p]?.detail}>{PLAYBOOKS[p]?.name ?? p}</Pill></li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-md bg-page p-3.5">
            <Icon name="lock" size={18} className="shrink-0 text-ink-400" />
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-ink-600">
              Customer names are hidden from the AI and shown as codes such as PH_001. Showing the real names is a separate
              step that is written to the audit trail.
            </span>
            {namesRevealed ? (
              <Pill tone="ok" dot>Real names shown</Pill>
            ) : (
              <button
                type="button"
                disabled={!onReveal || revealing}
                onClick={onReveal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-brand-600 ring-1 ring-brand-500 transition-colors hover:bg-brand-50 disabled:opacity-50"
              >
                <Icon name="eye" size={14} />
                {revealing ? "Showing…" : "Show real names"}
              </button>
            )}
            {revealError && <span role="alert" className="text-xs text-brand-600">Names could not be shown.</span>}
          </div>
        </div>
      </Card></SectionBoundary>

      <SectionBoundary><Card icon="list" title="What happened" subtitle="From the access log, in order">
          {report.timeline && report.timeline.length > 0 && (
            <ol className="relative space-y-3 border-l-2 border-line pl-5 text-sm">
              {report.timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-page" />
                  <span className="mr-2 text-xs font-medium text-ink-400">{t.event_id !== undefined ? eventLabel(t.event_id) : ""}</span>
                  <span className="text-ink-900">{t.what ? text(t.what) : ""}</span>
                </li>
              ))}
            </ol>
          )}
          <div className={report.timeline && report.timeline.length > 0 ? "mt-5 border-t border-line pt-4" : ""}>
            <Label>Evidence cited ({cited.length})</Label>
            {cited.length === 0 ? (
              <p className="mt-1 text-sm text-ink-400">None cited.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {cited.map((id) => <li key={String(id)}><Pill tone="info">{eventLabel(id)}</Pill></li>)}
              </ul>
            )}
          </div>
      </Card></SectionBoundary>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionBoundary><Card icon="clock" title="Reporting deadlines" subtitle="Clocks start at detection">
          <div className="space-y-3">
            <Clock
              title={`CERT-In report (${CERT_IN_HOURS} hours)`}
              hours={CERT_IN_HOURS}
              detectedAt={report.detected_at}
              note="CERT-In is India's national cyber security agency. Cyber incidents must be reported to it within 6 hours."
              now={now}
            />
            <Clock
              title={`DPDP-aligned readiness (${DPDP_HOURS} hours)`}
              hours={DPDP_HOURS}
              detectedAt={report.detected_at}
              note={`Readiness only. Under India's data protection law (DPDP), the detailed breach report rule takes effect on ${DPDP_EFFECTIVE}.`}
              now={now}
            />
          </div>
        </Card></SectionBoundary>
        <SectionBoundary><Card icon="userCheck" title="Was there a valid business reason?" subtitle="Checked against leave, transfer and assignment records">
          <JustificationPanel j={report.justification} score={score} text={text} />
        </Card></SectionBoundary>
      </div>

      <SectionBoundary><Card icon="shield" title="Controls that failed">
        {report.controls_failed && report.controls_failed.length > 0 ? (
          <ul className="divide-y divide-line">
            {report.controls_failed.map((c) => {
              const ctl = control(c);
              return (
                <li key={c} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0" title={c}>
                  <Icon name="xCircle" size={18} className="mt-0.5 shrink-0 text-brand-500" />
                  <div>
                    <div className="text-sm font-medium text-ink-900">{ctl.label}</div>
                    {ctl.source && <div className="text-xs text-ink-400">{ctl.source}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-ink-400">No failed controls listed.</p>
        )}
      </Card></SectionBoundary>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionBoundary><Card
          title={<span className="flex flex-wrap items-center gap-2">CERT-In incident report <DraftBanner /></span>}
          icon="file"
        >
          <DraftBody draft={report.cert_in_draft} text={text} />
        </Card></SectionBoundary>
        <SectionBoundary><Card
          title={<span className="flex flex-wrap items-center gap-2">DPDP breach notice <DraftBanner /></span>}
          icon="file"
        >
          <DraftBody draft={report.dpdp_intimation_draft} text={text} />
        </Card></SectionBoundary>
      </div>

      {report.open_questions && report.open_questions.length > 0 && (
        <SectionBoundary><Card icon="help" title="Open questions" subtitle="What the evidence could not settle">
          <ul className="space-y-2 text-sm text-ink-900">
            {report.open_questions.map((q) => (
              <li key={q} className="flex gap-2">
                <Icon name="help" size={16} className="mt-0.5 shrink-0 text-warn-600" />
                <span>{text(q)}</span>
              </li>
            ))}
          </ul>
        </Card></SectionBoundary>
      )}

      <details className="rounded-lg bg-surface p-4 ring-1 ring-line">
        <summary className="cursor-pointer text-xs font-medium text-ink-600">Technical details: raw report data, for auditors</summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-page p-3 text-xs text-ink-900">{JSON.stringify(report, null, 2)}</pre>
      </details>
    </div>
  );
}
