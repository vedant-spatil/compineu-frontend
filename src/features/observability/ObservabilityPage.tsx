import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { ObservabilitySchema } from "../../api/schemas";
import { Card, EmptyState, LoadingBlock, PageHeader, StatCard, StatusBadge } from "../../components/ui";
import QueryError from "../../components/QueryError";
import { stepLabel } from "../../lib/glossary";
import { formatWhen } from "../../lib/time";

const WINDOWS = [
  { hours: 24, label: "Last 24 hours" },
  { hours: 168, label: "Last 7 days" },
];

/** A duration for display: milliseconds under a second, seconds above. Missing values show a dash. */
export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

/** Admin view of the case workflow from the API's JSON logs in CloudWatch (app/services/telemetry.py). */
export default function ObservabilityPage() {
  const [hours, setHours] = useState(24);
  const data = useQuery({
    queryKey: ["observability", hours],
    queryFn: async () => ObservabilitySchema.parse(await api<unknown>(`/api/observability/summary?hours=${hours}`)),
    refetchInterval: 60_000,
  });

  const selector = (
    <select
      aria-label="Time window"
      value={hours}
      onChange={(e) => setHours(Number(e.target.value))}
      className="rounded-md bg-surface px-3 py-2 text-sm text-ink-900 ring-1 ring-line"
    >
      {WINDOWS.map((w) => <option key={w.hours} value={w.hours}>{w.label}</option>)}
    </select>
  );

  if (data.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Observability" actions={selector} />
        <QueryError error={data.error} onRetry={() => void data.refetch()} />
      </div>
    );
  }
  if (!data.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Observability" actions={selector} />
        <Card><LoadingBlock label="Loading logs summary…" rows={5} /></Card>
      </div>
    );
  }

  const d = data.data;
  if (!d.enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Observability" />
        <Card>
          <EmptyState text="Observability is not configured. Set OBSERVABILITY_LOG_GROUP on the API to read case runs from CloudWatch Logs." />
        </Card>
      </div>
    );
  }

  const runs = d.case_runs ?? 0;
  const errors = d.errors ?? 0;
  const errorRate = runs > 0 ? `${Math.round((errors / runs) * 100)}%` : "-";

  return (
    <div className="space-y-6">
      <PageHeader title="Observability" actions={selector} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Investigations run" value={runs} trend={{ text: d.window_hours === 24 ? "last 24 hours" : "last 7 days", tone: "neutral" }} />
        <StatCard label="Errors" value={errors} trend={{ text: errors > 0 ? "see the tables below" : "no failures", tone: errors > 0 ? "down" : "up" }} />
        <StatCard label="Error rate" value={errorRate} trend={{ text: "failed runs out of all runs", tone: "neutral" }} />
        <StatCard label="Slowest runs take" value={formatMs(d.p95_ms)} trend={{ text: "95% of runs finish faster than this", tone: "neutral" }} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Per investigation step" flush>
          {(d.nodes ?? []).length === 0 ? (
            <EmptyState text="No node runs in this window." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-2 font-medium">Step</th>
                  <th className="py-2 text-right font-medium">Runs</th>
                  <th className="py-2 text-right font-medium">Slowest (95%)</th>
                  <th className="px-5 py-2 text-right font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {(d.nodes ?? []).map((n) => (
                  <tr key={n.node} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-ink-900" title={n.node}>{stepLabel(n.node)}</td>
                    <td className="py-3 text-right">{n.count}</td>
                    <td className="py-3 text-right">{formatMs(n.p95_ms)}</td>
                    <td className={`px-5 py-3 text-right ${n.errors > 0 ? "font-semibold text-danger-600" : ""}`}>{n.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Errors by type">
          {(d.error_types ?? []).length === 0 ? (
            <EmptyState text="No errors in this window." />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {(d.error_types ?? []).map((e) => (
                <li key={e.error_type} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-ink-900">{e.error_type}</span>
                  <span className="font-semibold text-danger-600">{e.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recent investigations" flush>
        {(d.recent ?? []).length === 0 ? (
          <EmptyState text="No case runs in this window." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-2 font-medium">Time</th>
                  <th className="py-2 font-medium">Incident</th>
                  <th className="py-2 font-medium">Attempt</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {(d.recent ?? []).map((r, i) => (
                  <tr key={`${r.time}-${i}`} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 text-ink-600">{formatWhen(r.time, true)}</td>
                    <td className="py-3">
                      {r.case_id !== null ? (
                        <Link to={`/cases/${r.case_id}`} className="font-medium text-brand-600 hover:underline">#{r.case_id}</Link>
                      ) : (
                        <span className="text-ink-400">-</span>
                      )}
                    </td>
                    <td className="py-3">{r.attempt}</td>
                    <td className="py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3 text-right">{formatMs(r.duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
