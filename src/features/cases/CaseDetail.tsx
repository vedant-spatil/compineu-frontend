import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api, ApiError } from "../../api/client";
import { CaseSchema } from "../../api/schemas";
import { hasReport, REPORT_POLL_LIMIT, REPORT_POLL_MS, reportPath, reportPhase, ReportSchema, type Report } from "../../api/report";
import { useMe } from "../../auth/useAuth";
import AuditTimeline from "../../components/AuditTimeline";
import { Icon } from "../../components/icons";
import IncidentReportView from "../../components/IncidentReportView";
import { buttonClass, Card, ErrorState, fieldClass, LoadingBlock, StatusBadge } from "../../components/ui";
import DecisionForm from "../approvals/DecisionForm";
import QueryError from "../../components/QueryError";
import { friendlyError } from "../../lib/errors";

const SarSchema = z.object({ version: z.number(), body: z.record(z.any()) });
const QaUsersSchema = z.array(z.object({ id: z.number(), email: z.string(), role: z.string() }));

export default function CaseDetail() {
  const { caseId } = useParams();
  const id = Number(caseId);
  const me = useMe();
  const qc = useQueryClient();
  const isAdmin = me.data?.role === "admin";

  const caseQ = useQuery({
    queryKey: ["case", id],
    queryFn: async () => CaseSchema.parse(await api<unknown>(`/api/cases/${id}`)),
    refetchInterval: (q) => (q.state.data?.status === "open" ? 2000 : false),
  });
  const sarQ = useQuery({
    queryKey: ["sar", id],
    enabled: hasReport(caseQ.data?.status),
    queryFn: async () => SarSchema.parse(await api<unknown>(reportPath(id))),
    retry: false,
    // A 404 means the AI has not saved the report yet. Poll for it instead of showing an error.
    refetchInterval: (q) =>
      q.state.error instanceof ApiError && q.state.error.status === 404 && q.state.errorUpdateCount < REPORT_POLL_LIMIT
        ? REPORT_POLL_MS
        : false,
  });
  // Names are fetched only when the analyst clicks "Reveal names". The server writes an audit event for the reveal.
  // The map is kept in component state only: not in the query cache and not in browser storage.
  const [revealed, setRevealed] = useState<{ caseId: number; map: Record<string, string> } | null>(null);
  // A reveal belongs to one incident. Moving to another incident shows tokens again.
  const names = revealed && revealed.caseId === id ? revealed.map : null;
  const reveal = useMutation({
    mutationFn: async () => z.record(z.string()).parse(await api<unknown>(`/api/cases/${id}/identities`)),
    onSuccess: (map) => setRevealed({ caseId: id, map }),
  });
  const qaUsers = useQuery({
    queryKey: ["users", "qa"],
    enabled: isAdmin,
    queryFn: async () => QaUsersSchema.parse(await api<unknown>("/api/users?role=qa")),
  });

  const [assignee, setAssignee] = useState<number | "">("");
  const assign = useMutation({
    mutationFn: (userId: number) =>
      api(`/api/cases/${id}/assign`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
    onSuccess: () => {
      setAssignee("");
      qc.invalidateQueries({ queryKey: ["case", id] });
    },
  });

  const rerun = useMutation({
    mutationFn: () => api(`/api/cases/${id}/rerun`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["events", id] });
    },
  });

  // A case that has not started is investigated (the same run the cases list uses). After that the button restarts it.
  const investigate = useMutation({
    mutationFn: () => api("/api/cases/run", { method: "POST", body: JSON.stringify({ case_ids: [id] }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["events", id] });
    },
  });

  if (caseQ.isLoading) return <Card><LoadingBlock label="Loading incident…" rows={5} /></Card>;
  if (caseQ.isError) return <QueryError error={caseQ.error} onRetry={() => void caseQ.refetch()} />;
  if (!caseQ.data) return <ErrorState text="That incident was not found." />;
  const reportNotFound = sarQ.error instanceof ApiError && sarQ.error.status === 404;
  const phase = reportPhase({ status: caseQ.data.status, hasData: sarQ.data !== undefined, notFound: reportNotFound });
  const parsed = sarQ.data ? ReportSchema.safeParse(sarQ.data.body) : null;
  const report: Report | undefined = parsed?.success ? parsed.data : undefined;

  const status = caseQ.data.status;
  const assigneeEmail = qaUsers.data?.find((u) => u.id === caseQ.data.assignee_id)?.email;

  // With a report, the analyst reads it and decides first; the timeline and assignment follow. While the
  // investigation is still running (or failed), the timeline is the page, so it comes first.
  const timelineFirst = !hasReport(status);
  const timelineRow = (
    <div className={`grid items-start gap-5 ${isAdmin ? "xl:grid-cols-3" : ""}`}>
      {/* The access graph panel is hidden for now. GraphView and the graph endpoint are kept. */}
      <div className={isAdmin ? "xl:col-span-2" : ""}>
        <AuditTimeline
          caseId={id}
          polling={status === "open"}
          actionLabel={status === "pending" ? "Investigate" : "Restart investigation"}
          onRerun={status === "pending" ? () => investigate.mutate() : () => rerun.mutate()}
          confirmMessage={status === "pending" ? undefined : "Restart the investigation for this case? The earlier events are kept."}
          canRerun={status === "pending" || status === "failed" || status === "awaiting_review"}
          rerunning={rerun.isPending || investigate.isPending}
        />
      </div>
      {isAdmin && (
        <Card icon="users" title="Assignment" subtitle="The reviewer sees it under My incidents.">
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex min-w-0 flex-1 flex-col font-medium text-ink-900">
              Reviewer
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value ? Number(e.target.value) : "")}
                className={`${fieldClass} mt-1.5`}
              >
                <option value="">Select a reviewer</option>
                {qaUsers.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </label>
            <button
              type="button"
              disabled={assignee === "" || assign.isPending}
              onClick={() => assignee !== "" && assign.mutate(assignee)}
              className={buttonClass("secondary")}
            >
              Assign
            </button>
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-sm text-ink-400">
          <Link to="/cases" className="hover:text-ink-900">{isAdmin ? "Incidents" : "My incidents"}</Link>
          <Icon name="chevronRight" size={14} />
          <span className="text-ink-600">Incident {caseQ.data.id}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-[1.375rem] font-semibold tracking-tight text-ink-900">Incident <span className="id">{caseQ.data.id}</span></h1>
          <StatusBadge status={status} />
          {status === "failed" && caseQ.data.members_changed && (
            <span className="text-sm font-medium text-warn-700">Updated: restart needed</span>
          )}
          {caseQ.data.assignee_id != null && (
            <span className="flex items-center gap-1.5 text-sm text-ink-600">
              <Icon name="user" size={14} />
              {isAdmin ? assigneeEmail ?? `user ${caseQ.data.assignee_id}` : "Assigned to you"}
            </span>
          )}
          {status === "awaiting_review" && (
            <a href="#decision" className={`${buttonClass()} ml-auto`}>
              <Icon name="flag" size={16} />
              Review and decide
            </a>
          )}
        </div>
        {rerun.isError && <div className="mt-3"><ErrorState text={friendlyError(rerun.error).text} /></div>}
        {assign.isError && <div className="mt-3"><ErrorState text={friendlyError(assign.error).text} /></div>}
      </div>

      {timelineFirst && timelineRow}

      <div className="grid gap-5 xl:grid-cols-2">
        {report && sarQ.data ? (
          <div className="xl:col-span-2">
            <IncidentReportView
              key={id}
              version={sarQ.data.version}
              report={report}
              names={names ?? {}}
              namesRevealed={names !== null}
              revealing={reveal.isPending}
              revealError={reveal.isError}
              onReveal={() => {
                if (window.confirm("Show the real customer names for this incident? This is recorded in the audit trail.")) reveal.mutate();
              }}
            />
          </div>
        ) : sarQ.data ? (
          <Card title="Incident report">
            <ErrorState text="The report could not be displayed. Its raw data is shown below for auditors." />
            <pre className="mt-3 max-h-96 overflow-auto text-xs text-ink-900">{JSON.stringify(sarQ.data.body, null, 2)}</pre>
          </Card>
        ) : sarQ.isLoading ? (
          <Card title="Incident report"><LoadingBlock label="Loading report…" rows={6} /></Card>
        ) : sarQ.isError && !reportNotFound ? (
          <Card title="Incident report"><QueryError error={sarQ.error} onRetry={() => void sarQ.refetch()} /></Card>
        ) : phase === "writing" ? (
          <Card title="Incident report">
            <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-ink-600">
              <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-600" />
              AI is writing the report…
            </div>
          </Card>
        ) : (
          <Card title="Incident report">
            <p className="text-sm text-ink-400">
              {phase === "not_started"
                ? "The investigation has not started yet."
                : phase === "failed"
                  ? "The investigation failed, so there is no report. See the timeline, then restart the investigation."
                  : "No report for this incident."}
            </p>
          </Card>
        )}
        {status === "awaiting_review" && <DecisionForm key={id} caseId={id} report={report} />}
      </div>

      {!timelineFirst && timelineRow}
    </div>
  );
}
