import { Icon } from "../../components/icons";
import { Card, EmptyState, Hint, LoadingBlock, PageHeader, StatCard, tableHeadClass } from "../../components/ui";
import QueryError from "../../components/QueryError";
import { useQuality } from "./useQuality";

/** A value of 0 to 1 is a fraction, anything larger is already a percentage. */
const pct = (v: number | undefined) => (v === undefined ? "-" : `${(v <= 1 ? v * 100 : v).toFixed(1)}%`);

const PRECISION = "Precision: of the incidents compineu raised, the share that were real threats. Higher means fewer false alarms.";
const RECALL = "Recall: of the real threats in the test scenarios, the share compineu caught. Higher means fewer missed threats.";

/** Precision and recall with AI review off and on. Numbers come from /api/quality; nothing is quoted from a target. */
export default function QualityPage() {
  const q = useQuality();
  const rows: [string, "triage_off" | "triage_on"][] = [["Rules only", "triage_off"], ["Rules plus AI review", "triage_on"]];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Detection quality"
        subtitle="How often compineu is right, measured against the known answers of the demo scenarios."
      />
      {q.isLoading && <Card><LoadingBlock label="Loading quality numbers…" rows={4} /></Card>}
      {q.isError && <QueryError error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Alerts that were real, rules only" value={pct(q.data.triage_off?.precision)} icon={<Icon name="check" />} tone="ok" />
            <StatCard label="Alerts that were real, with AI" value={pct(q.data.triage_on?.precision)} icon={<Icon name="sparkles" />} tone="ok" />
            <StatCard label="Threats caught, rules only" value={pct(q.data.triage_off?.recall)} icon={<Icon name="shield" />} tone="info" />
            <StatCard label="Threats caught, with AI" value={pct(q.data.triage_on?.recall)} icon={<Icon name="sparkles" />} tone="info" />
          </div>
          <Card title="Rules only versus rules plus AI review" subtitle="Hover the ? next to a column to see what it means" flush>
            {!q.data.triage_off && !q.data.triage_on ? (
              <EmptyState text="No evaluation run yet." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHeadClass}>
                    <th className="px-5 py-2.5 font-medium sm:px-6">Mode</th>
                    <th className="px-5 py-2.5 font-medium">Alerts that were real<Hint text={PRECISION} /></th>
                    <th className="px-5 py-2.5 font-medium">Threats caught<Hint text={RECALL} /></th>
                    <th className="px-5 py-2.5 font-medium">Alerts</th>
                    <th className="px-5 py-2.5 font-medium sm:px-6">Incidents</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, key]) => (
                    <tr key={key} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-medium sm:px-6">{label}</td>
                      <td className="px-5 py-3 tabular-nums">{pct(q.data[key]?.precision)}</td>
                      <td className="px-5 py-3 tabular-nums">{pct(q.data[key]?.recall)}</td>
                      <td className="px-5 py-3 tabular-nums">{q.data[key]?.alerts ?? "-"}</td>
                      <td className="px-5 py-3 tabular-nums sm:px-6">{q.data[key]?.incidents ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {q.data.time_to_detect_s !== undefined && (
              <p className="border-t border-line px-5 py-3 text-xs text-ink-600 sm:px-6">
                Typical time from the first risky access to an alert: {q.data.time_to_detect_s} seconds.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
