import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/client";
import { TrendsSchema } from "../../api/schemas";
import { useMe } from "../../auth/useAuth";
import { Donut, HorizontalBars, PairedBars, TrendLine } from "../../components/charts";
import { Icon, type IconName } from "../../components/icons";
import {
  buttonClass, Card, EmptyState, LoadingBlock, PageHeader, rowLinkClass, Skeleton, Stat, StatStrip, StatusBadge, tableHeadClass,
} from "../../components/ui";
import { actorKind, type Tone } from "../../lib/glossary";
import { ruleLabel } from "../../lib/labels";
import ScenarioConsole from "./ScenarioConsole";
import QueryError from "../../components/QueryError";

const DashboardSchema = z.object({
  cases_by_status: z.record(z.number()),
  decisions_by_action: z.record(z.number()),
  alerts_above_threshold_by_rule: z.record(z.number()),
  top_accounts_by_alerts: z.array(
    z.object({
      account_id: z.string(),
      alerts: z.number(),
      case_id: z.number().nullable(),
      case_status: z.string().nullable(),
    }),
  ),
  score_histogram: z.record(z.number()),
  failed_cases: z.number(),
  // Admin only: alerts above threshold out of all recorded data access.
  alert_rate: z.object({ alerts: z.number(), transactions: z.number() }).optional(),
  // PolicyGuard numbers. Optional: a figure the backend does not send is left out.
  cert_in_clocks_running: z.number().optional(),
  controls_passing: z.object({ passing: z.number(), total: z.number() }).optional(),
  records_at_risk: z.number().optional(),
});

type CardData = {
  label: string;
  value: string | number;
  trend: { text: string; tone: "up" | "down" | "neutral" };
  icon: IconName;
  tone: Tone;
};
/**
 * The PolicyGuard figures. One whose number the backend does not send is left out, so the dashboard never shows a dash
 * where a number should be.
 */
export function policyGuardCards(d: {
  cert_in_clocks_running?: number;
  controls_passing?: { passing: number; total: number };
  records_at_risk?: number;
}): CardData[] {
  const cards: CardData[] = [];
  if (d.cert_in_clocks_running !== undefined) {
    cards.push({
      label: "CERT-In deadlines running",
      value: d.cert_in_clocks_running,
      trend: { text: "Report due 6 hours after detection", tone: d.cert_in_clocks_running > 0 ? "down" : "neutral" },
      icon: "clock",
      tone: d.cert_in_clocks_running > 0 ? "warn" : "neutral",
    });
  }
  if (d.controls_passing !== undefined) {
    cards.push({
      label: "Controls passing",
      value: `${d.controls_passing.passing} / ${d.controls_passing.total}`,
      trend: { text: "DPDP-aligned readiness", tone: "neutral" },
      icon: "shield",
      tone: "ok",
    });
  }
  if (d.records_at_risk !== undefined) {
    cards.push({
      label: "Records at risk",
      value: d.records_at_risk.toLocaleString(),
      trend: { text: "In open incidents", tone: "neutral" },
      icon: "database",
      tone: "neutral",
    });
  }
  return cards;
}
const shortDay = (iso: string) => iso.slice(5); // "2022-09-01" -> "09-01"
// The strip holds four workflow figures plus up to three PolicyGuard ones.
const STRIP_COLUMNS: Record<number, string> = {
  4: "grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  7: "grid-cols-2 lg:grid-cols-4 xl:grid-cols-7",
};

export default function Dashboard() {
  const me = useMe();
  const isAdmin = me.data?.role === "admin";
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => DashboardSchema.parse(await api<unknown>("/api/dashboard")),
  });
  const trends = useQuery({
    queryKey: ["dashboard-trends"],
    queryFn: async () => TrendsSchema.parse(await api<unknown>("/api/dashboard/trends?days=30")),
  });

  const navigate = useNavigate();
  if (dash.isLoading) {
    return (
      <div className="space-y-5" role="status" aria-live="polite">
        <span className="sr-only">Loading dashboard…</span>
        <PageHeader title="Dashboard" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (dash.isError || !dash.data) return <QueryError error={dash.error} onRetry={() => void dash.refetch()} />;
  const d = dash.data;
  const cards = policyGuardCards(d);
  const openCases = d.cases_by_status["open"] ?? 0;
  const awaiting = d.cases_by_status["awaiting_review"] ?? 0;
  const approved = d.decisions_by_action["approve"] ?? 0;
  const closed = d.decisions_by_action["close"] ?? 0;
  const decisions = approved + closed;

  const activity = trends.data?.activity_by_day ?? [];
  const opened30 = activity.reduce((sum, r) => sum + r.cases_opened, 0);
  const decided30 = activity.reduce((sum, r) => sum + r.approved + r.closed, 0);
  const last30 = (n: number) => (trends.isSuccess ? `${n} in the last 30 days` : "Loading…");

  const ruleRows = Object.entries(d.alerts_above_threshold_by_rule)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name: ruleLabel(name), value }));
  const alertTrend = (trends.data?.alerts_by_day ?? []).map((r) => ({ label: shortDay(r.day), value: r.alerts }));
  const activityRows = activity.slice(-14).map((r) => ({ label: shortDay(r.day), a: r.cases_opened, b: r.approved }));
  // Shown only when the backend has counted data access; an always-empty card would just take space.
  const rate = isAdmin && d.alert_rate && d.alert_rate.transactions > 0 ? d.alert_rate : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle="Risky access to customer data, and what needs your decision."
        actions={isAdmin ? <Link to="/alerts" className={buttonClass("secondary")}><Icon name="alert" size={16} />Alerts</Link> : undefined}
      />

      {trends.isError && <QueryError error={trends.error} onRetry={() => void trends.refetch()} />}
      <StatStrip columns={STRIP_COLUMNS[4 + cards.length] ?? STRIP_COLUMNS[6]}>
        <Stat
          label="Awaiting review"
          value={awaiting}
          note={awaiting > 0 ? "Needs a decision" : "Nothing waiting"}
          icon="flag"
          attention={awaiting > 0}
          to="/cases?status=awaiting_review"
        />
        <Stat label="Investigating" value={openCases} note={last30(opened30).replace(" in ", " opened in ")} icon="loader" to="/cases?status=open" />
        <Stat
          label="Failed investigations"
          value={d.failed_cases}
          note={d.failed_cases > 0 ? "Open one to see why" : "No failures"}
          icon="alert"
          to="/cases?status=failed"
        />
        <Stat label="Decisions made" value={decisions} note={last30(decided30)} icon="check" />
        {cards.map((c) => (
          <Stat key={c.label} label={c.label} value={c.value} note={c.trend.text} icon={c.icon} attention={c.tone === "warn"} />
        ))}
      </StatStrip>

      {isAdmin && <ScenarioConsole />}

      <div className={`grid gap-5 ${isAdmin ? "xl:grid-cols-2" : ""}`}>
        <Card icon="bars" title="Incidents opened and approved" subtitle="Last 14 days" className="h-full">
          {trends.isLoading ? <LoadingBlock label="Loading activity…" /> : (
            <PairedBars rows={activityRows} seriesA="Incidents opened" seriesB="Actions approved" empty="No incident activity yet. Run a demo scenario." />
          )}
        </Card>
        {isAdmin && (
          <Card
            icon="activity"
            title="What triggered alerts"
            subtitle="Alerts at risk 40 or more"
            className="h-full"
            action={rate ? (
              <span className="text-right text-xs text-ink-400" title={`${rate.alerts.toLocaleString()} alerts from ${rate.transactions.toLocaleString()} data accesses`}>
                <span className="block text-sm font-semibold tabular-nums text-ink-900">{((rate.alerts / rate.transactions) * 100).toFixed(2)}%</span>
                of access flagged
              </span>
            ) : undefined}
          >
            <HorizontalBars rows={ruleRows} empty="No alerts at risk 40 or more yet. Run a demo scenario." />
          </Card>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-4">
        {isAdmin && (
          <Card icon="chart" title="Alerts per day" subtitle="Last 30 days" className="xl:col-span-3">
            {trends.isLoading ? <LoadingBlock label="Loading alert history…" /> : (
              <TrendLine rows={alertTrend} label="Alerts" empty="No alert history yet. Run a demo scenario." />
            )}
          </Card>
        )}
        <Card icon="check" title="Analyst decisions" className={isAdmin ? "xl:col-span-1" : "xl:col-span-4"}>
          <Donut
            rows={[
              { name: "Actions approved", value: approved },
              { name: "False alarms", value: closed },
            ]}
            empty="No decisions yet."
          />
        </Card>
      </div>

      {isAdmin && (
        <Card icon="users" title="Most alerted agents and partners" flush>
          {d.top_accounts_by_alerts.length === 0 ? (
            <EmptyState text="No agents or partners with alerts yet. Run a demo scenario." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className={tableHeadClass}>
                    <th className="px-5 py-2.5 font-medium">Who</th>
                    <th className="px-5 py-2.5 font-medium">Incident</th>
                    <th className="px-5 py-2.5 text-right font-medium">Alerts</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="w-10 px-3 py-2.5"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {d.top_accounts_by_alerts.map((a) => {
                    const target = a.case_id !== null ? `/cases/${a.case_id}` : `/alerts?account=${encodeURIComponent(a.account_id)}`;
                    return (
                      <tr key={a.account_id} onClick={() => navigate(target)} className={rowLinkClass}>
                        <td className="px-5 py-2.5">
                          <span className="id font-medium text-ink-900">{a.account_id}</span>
                          {actorKind(a.account_id) && <span className="ml-2 text-xs text-ink-400">{actorKind(a.account_id)}</span>}
                        </td>
                        <td className="px-5 py-2.5">
                          {a.case_id !== null ? (
                            <Link to={`/cases/${a.case_id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand-600 hover:underline">
                              Incident {a.case_id}
                            </Link>
                          ) : (
                            <span className="text-ink-400">None yet</span>
                          )}
                        </td>
                        <td className="id px-5 py-2.5 text-right font-medium text-ink-900">{a.alerts}</td>
                        <td className="px-5 py-2.5">
                          {a.case_status !== null ? <StatusBadge status={a.case_status} /> : <span className="text-ink-200">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-ink-200 group-hover:text-brand-600"><Icon name="chevronRight" size={16} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
