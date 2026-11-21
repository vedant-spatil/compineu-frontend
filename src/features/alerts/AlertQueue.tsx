import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { api } from "../../api/client";
import { AlertSchema, CaseSchema } from "../../api/schemas";
import { Icon } from "../../components/icons";
import {
  Card, ErrorState, fieldClass, LoadingBlock, PageHeader, Pagination, Pill, RiskMeter, rowLinkClass, tableHeadClass,
} from "../../components/ui";
import { actorKind, signal, SIGNALS } from "../../lib/glossary";
import { scoreOut100 } from "../../api/report";
import QueryError from "../../components/QueryError";
import { emptyText } from "../../lib/empty";
import { friendlyError } from "../../lib/errors";
import { formatWhen } from "../../lib/time";
import { useDebounced } from "../../lib/useDebounced";
import { usePageParam, usePageSize } from "../../lib/usePaging";

const PageSchema = z.object({
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  items: z.array(AlertSchema),
});

// Mirrors TRIAGE_THRESHOLD in the API settings (backend app/config.py). Alerts below it are hidden unless "All alerts" is chosen.
const TRIAGE_THRESHOLD = 0.4;
const SORTS: [string, string][] = [
  ["score_desc", "Highest risk first"],
  ["score_asc", "Lowest risk first"],
  ["ts_desc", "Newest first"],
  ["ts_asc", "Oldest first"],
  ["amount_desc", "Most records first"],
];

const RULES = Object.entries(SIGNALS);
// The legend groups the signals by who they watch. Codes starting with P are partner-key signals.
const AGENT_SIGNALS = RULES.filter(([id]) => !id.startsWith("P"));
const PARTNER_SIGNALS = RULES.filter(([id]) => id.startsWith("P"));

function SignalLegend() {
  const group = (title: string, items: typeof RULES) => (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</div>
      <dl className="space-y-2.5">
        {items.map(([id, s]) => (
          <div key={id}>
            <dt className="text-sm font-medium text-ink-900">{s.label}</dt>
            <dd className="text-xs leading-relaxed text-ink-600">{s.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return (
    <details className="group rounded-lg bg-surface ring-1 ring-line">
      <summary className="flex cursor-pointer items-center gap-2 px-5 py-3.5 text-sm font-medium text-ink-900 sm:px-6">
        <Icon name="help" size={16} className="text-ink-400" />
        What the signals mean
        <Icon name="chevronDown" size={16} className="ml-auto text-ink-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-6 border-t border-line px-5 py-5 sm:px-6 md:grid-cols-2">
        {group("Agents", AGENT_SIGNALS)}
        <div className="space-y-6">
          {group("Partner (TPA) keys", PARTNER_SIGNALS)}
          <p className="rounded-md bg-page p-3 text-xs leading-relaxed text-ink-600">
            Each alert gets a risk score from 0 to 100, based on what was detected, how sensitive the data is and how many
            records were touched. 80 or more is critical, 60 or more is high, 40 or more is medium.
          </p>
        </div>
      </div>
    </details>
  );
}

export default function AlertQueue() {
  const navigate = useNavigate();
  const [page, setPage] = usePageParam();
  const [pageSize, setPageSize] = usePageSize("alerts");
  const [rule, setRule] = useState("");
  const [searchParams] = useSearchParams();
  const [account, setAccount] = useState(searchParams.get("account") ?? "");
  const accountQuery = useDebounced(account.trim());
  const [sort, setSort] = useState("score_desc");
  const [scope, setScope] = useState<"above" | "all">("above");

  const query = new URLSearchParams({
    offset: String(page * pageSize),
    limit: String(pageSize),
    sort,
    ...(scope === "above" ? { min_score: String(TRIAGE_THRESHOLD) } : {}),
    ...(rule ? { rule } : {}),
    ...(accountQuery ? { account: accountQuery } : {}),
  }).toString();

  const alerts = useQuery({
    queryKey: ["alerts", page, pageSize, rule, accountQuery, sort, scope],
    queryFn: async () => PageSchema.parse(await api<unknown>(`/api/alerts?${query}`)),
    placeholderData: keepPreviousData,
  });

  const open = useMutation({
    mutationFn: async (alertId: number) =>
      CaseSchema.parse(await api<unknown>(`/api/alerts/${alertId}/cases`, { method: "POST" })),
    onSuccess: (c) => navigate(`/cases/${c.id}`),
  });

  const threshold = Math.round(TRIAGE_THRESHOLD * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        subtitle="Unusual access to customer data by an agent or a partner key."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            aria-label="Search by agent or partner ID"
            placeholder="Agent or partner ID"
            value={account}
            onChange={(e) => { setAccount(e.target.value); setPage(0); }}
            className={`${fieldClass} w-64 pl-9`}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-600">
          Show
          <select
            className={fieldClass}
            value={scope}
            onChange={(e) => { setScope(e.target.value as "above" | "all"); setPage(0); }}
          >
            <option value="above">Risk {threshold} and above</option>
            <option value="all">All alerts</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-600">
          Behaviour
          <select
            className={fieldClass}
            value={rule}
            onChange={(e) => { setRule(e.target.value); setPage(0); }}
          >
            <option value="">Any</option>
            {RULES.map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-600">
          Sort
          <select
            className={fieldClass}
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(0); }}
          >
            {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>

      <SignalLegend />

      {alerts.isError && <QueryError error={alerts.error} onRetry={() => void alerts.refetch()} />}
      {open.isError && <ErrorState text={friendlyError(open.error).text} />}
      {alerts.isLoading && <Card><LoadingBlock label="Loading alerts…" rows={6} /></Card>}

      {alerts.data && (
        <Card flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className={tableHeadClass}>
                  <th className="px-5 py-3 font-medium">Who</th>
                  <th className="px-5 py-3 text-right font-medium">Records</th>
                  <th className="px-5 py-3 font-medium">First seen</th>
                  <th className="px-5 py-3 font-medium">What was detected</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                  <th className="w-10 px-3 py-3"><span className="sr-only">Open incident</span></th>
                </tr>
              </thead>
              <tbody>
                {alerts.data.items.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => !open.isPending && open.mutate(a.id)}
                    className={`${rowLinkClass} align-top`}
                  >
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="id font-medium text-ink-900">{a.account_id}</div>
                      {actorKind(a.account_id) && <div className="text-xs text-ink-400">{actorKind(a.account_id)}</div>}
                    </td>
                    <td className="id px-5 py-3.5 text-right font-medium text-ink-900">{a.amount.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-ink-600">{formatWhen(a.ts)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {a.rules.map((r) => {
                          const s = signal(r);
                          return <Pill key={r} title={s.description || undefined}>{s.label}</Pill>;
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><RiskMeter score={scoreOut100(a.risk_score)} compact /></td>
                    <td className="px-3 py-3.5 text-ink-200 group-hover:text-brand-600">
                      <Icon name={open.isPending && open.variables === a.id ? "loader" : "chevronRight"} size={16}
                            className={open.isPending && open.variables === a.id ? "animate-spin text-brand-600" : ""} />
                    </td>
                  </tr>
                ))}
                {alerts.data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-ink-400">{rule || accountQuery
                        ? emptyText("alerts", true, "")
                        : scope === "above"
                          ? `No alerts at risk ${threshold} or above yet. Run a demo scenario, or choose All alerts.`
                          : emptyText("alerts", false, "Run a demo scenario.")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={alerts.data.total}
            noun="alerts"
            onPage={setPage}
            onPageSize={(size) => { setPageSize(size); setPage(0); }}
          />
        </Card>
      )}
    </div>
  );
}
