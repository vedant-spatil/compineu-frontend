import { useQueries, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "../../api/client";
import { complianceStatuses, COUNTED_STATUSES, hasReport, reportPath, ReportSchema } from "../../api/report";
import { Icon } from "../../components/icons";
import { Card, EmptyState, PageHeader, Pill, Skeleton, StatCard, tableHeadClass } from "../../components/ui";
import QueryError from "../../components/QueryError";
import { CONTROL_TAGS, type Tone } from "../../lib/glossary";
import catalog from "../../data/controls.json";

const CasesSchema = z.object({ items: z.array(z.object({ id: z.number(), status: z.string() }).passthrough()) });
const SarSchema = z.object({ body: z.record(z.any()) });
const MAX_REPORTS = 25;
type Control = { id: string; requirement: string; source: string; clause_text: string; tag: string };

const STATUS_VIEW: Record<string, { label: string; tone: Tone }> = {
  passing: { label: "Passing", tone: "ok" },
  failing: { label: "Failing", tone: "danger" },
  unknown: { label: "Not checked yet", tone: "neutral" },
};

/**
 * The control catalog. Status is worked out here, with no controls endpoint: a control fails if any incident report
 * lists it in controls_failed, and passes otherwise. If the incidents cannot be read, statuses read "Not checked yet".
 */
export default function CompliancePage() {
  const controls = catalog as Control[];
  const cases = useQuery({
    queryKey: ["compliance-cases"],
    queryFn: async () => CasesSchema.parse(await api<unknown>(`/api/cases?limit=${MAX_REPORTS}&offset=0`)),
    retry: false,
  });
  // Only the current run's incidents: superseded (old rehearsals) and dismissed alerts are not violations.
  const counted = (cases.data?.items ?? []).filter((c) => COUNTED_STATUSES.includes(c.status) && hasReport(c.status));
  const ids = counted.map((c) => c.id);
  const reports = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["sar", id],
      queryFn: async () => SarSchema.parse(await api<unknown>(reportPath(id))),
      retry: false,
    })),
  });
  const reportError = reports.find((r) => r.isError);
  const ready = cases.isSuccess && reports.every((r) => r.isSuccess);
  const caseReports = counted.map((c, i) => {
    const body = reports[i]?.data ? ReportSchema.safeParse(reports[i].data!.body).data : undefined;
    return { status: c.status, controlsFailed: body?.controls_failed, detectedAt: body?.detected_at };
  });
  const computed = complianceStatuses(controls.map((c) => c.id), caseReports, Date.now());
  const status = new Map<string, string>(ready ? Object.entries(computed) : []);
  const loading = cases.isLoading || reports.some((r) => r.isLoading);
  const passing = controls.filter((c) => status.get(c.id) === "passing").length;
  const failing = controls.filter((c) => status.get(c.id) === "failing").length;
  const legal = controls.filter((c) => c.tag === "Legal").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        subtitle="The rules compineu checks and where each comes from. This shows DPDP-aligned readiness, not a compliance claim."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Controls passing" value={ready ? `${passing} / ${controls.length}` : "-"} icon={<Icon name="shield" />} tone="ok" />
        <StatCard label="Controls failing" value={ready ? failing : "-"} icon={<Icon name="xCircle" />} tone={failing > 0 ? "danger" : "neutral"} />
        <StatCard label="Required by regulation" value={legal} icon={<Icon name="file" />} tone="info" />
      </div>
      <Card
        icon="shield"
        title="Controls"
        subtitle={ready ? `${ids.length} incidents read. Archived and dismissed ones are not counted.` : undefined}
        flush
      >
        {cases.isError && (
          <div className="mb-3 px-5 sm:px-6"><QueryError error={cases.error} onRetry={() => void cases.refetch()} /></div>
        )}
        {reportError && (
          <div className="mb-3 px-5 sm:px-6"><QueryError error={reportError.error} onRetry={() => reports.forEach((r) => void r.refetch())} /></div>
        )}
        {controls.length === 0 ? (
          <EmptyState text="No controls in the catalog." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className={tableHeadClass}>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Requirement</th>
                  <th className="px-5 py-2.5 font-medium">Source</th>
                  <th className="px-5 py-2.5 font-medium">Basis</th>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((c) => {
                  const s = STATUS_VIEW[status.get(c.id) ?? "unknown"];
                  const tag = CONTROL_TAGS[c.tag] ?? { label: c.tag, tone: "neutral" as Tone };
                  return (
                    <tr key={c.id} className="border-b border-line align-top last:border-0" title={c.id}>
                      <td className="px-5 py-3.5 sm:px-6">
                        <div className="font-medium text-ink-900">{c.requirement}</div>
                        <details className="group mt-1">
                          <summary className="cursor-pointer text-xs font-medium text-brand-600">
                            <span className="group-open:hidden">What it says</span>
                            <span className="hidden group-open:inline">Hide</span>
                          </summary>
                          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-600">{c.clause_text}</p>
                        </details>
                      </td>
                      <td className="px-5 py-3.5 text-ink-600">{c.source}</td>
                      <td className="px-5 py-3.5"><Pill tone={tag.tone}>{tag.label}</Pill></td>
                      <td className="px-5 py-3.5 sm:px-6">
                        {loading ? <Skeleton className="h-4 w-20" /> : <Pill tone={s.tone} dot>{s.label}</Pill>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
