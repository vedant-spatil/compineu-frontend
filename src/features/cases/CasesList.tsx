import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { api, ApiError } from "../../api/client";
import { CaseSchema, ProjectSummarySchema } from "../../api/schemas";
import { useMe } from "../../auth/useAuth";
import {
  buttonClass, Card, fieldClass, LoadingBlock, PageHeader, Pagination, RiskMeter, rowLinkClass, StatusBadge, tableHeadClass,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import { validProjectName } from "../projects/helpers";
import { useDebounced } from "../../lib/useDebounced";
import { useToast } from "../../components/Toast";
import { scoreOut100 } from "../../api/report";
import QueryError from "../../components/QueryError";
import { emptyText } from "../../lib/empty";
import { friendlyError } from "../../lib/errors";
import { CASE_STATUS_ORDER, status as statusTerm } from "../../lib/glossary";
import { usePageParam, usePageSize } from "../../lib/usePaging";

const PageSchema = z.object({
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  items: z.array(CaseSchema),
});
const ProjectListSchema = z.array(ProjectSummarySchema);
const AddResultSchema = z.object({
  project_name: z.string(),
  added: z.array(z.string()),
  already_present: z.array(z.string()),
  missing_case_ids: z.array(z.number()),
});

const BuildStatusSchema = z.object({
  running: z.boolean(),
  done: z.number(),
  total: z.number(),
  summary: z.object({
    created: z.number(),
    added: z.number(),
    merged: z.number(),
    deferred: z.number(),
    unchanged: z.number(),
  }).nullable(),
  error: z.string().nullable(),
});
const RunResultSchema = z.object({
  queued: z.number(),
  skipped: z.array(z.object({ case_id: z.number(), reason: z.string() })),
});

// The projects feature is switched off on the backend, so its button stays hidden rather than lead to an error.
const PROJECTS_ENABLED = false;
const STATUSES = CASE_STATUS_ORDER;

export default function CasesList() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = me.data?.role === "admin";

  const [page, setPage] = usePageParam();
  const [pageSize, setPageSize] = usePageSize("incidents");
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [search, setSearch] = useState("");
  const searchQuery = useDebounced(search.trim());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [projectChoice, setProjectChoice] = useState<string>("new");
  const [newName, setNewName] = useState("");
  const toast = useToast();

  const query = new URLSearchParams({
    offset: String(page * pageSize),
    limit: String(pageSize),
    ...(status ? { status } : {}),
    ...(searchQuery ? { q: searchQuery } : {}),
  }).toString();

  const cases = useQuery({
    queryKey: ["cases", page, pageSize, status, searchQuery],
    queryFn: async () => PageSchema.parse(await api<unknown>(`/api/cases?${query}`)),
    placeholderData: keepPreviousData,
  });

  const projects = useQuery({
    queryKey: ["projects"],
    enabled: isAdmin && panelOpen,
    queryFn: async () => ProjectListSchema.parse(await api<unknown>("/api/projects")),
  });

  const addToProject = useMutation({
    mutationFn: async () => {
      const ids = [...selected];
      const body = projectChoice === "new"
        ? { case_ids: ids, project_name: newName.trim() }
        : { case_ids: ids, project_id: Number(projectChoice) };
      return AddResultSchema.parse(await api<unknown>("/api/projects/accounts-from-cases", {
        method: "POST",
        body: JSON.stringify(body),
      }));
    },
    onSuccess: (r) => {
      toast.success(
        `Added ${r.added.length} account${r.added.length === 1 ? "" : "s"} to ${r.project_name}. ` +
        `${r.already_present.length} already in the project` +
        (r.missing_case_ids.length ? `; ${r.missing_case_ids.length} case(s) not found.` : "."),
      );
      setSelected(new Set());
      setPanelOpen(false);
      setNewName("");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  // The build runs on the server. This query polls its progress while it runs, and reports the result when it ends.
  const buildStatus = useQuery({
    queryKey: ["cases-build-status"],
    enabled: isAdmin,
    queryFn: async () => BuildStatusSchema.parse(await api<unknown>("/api/cases/build/status")),
    refetchInterval: (q) => (q.state.data?.running ? 1000 : false),
  });
  const buildRunning = buildStatus.data?.running ?? false;
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !buildRunning) {
      const s = buildStatus.data;
      if (s?.error) toast.error(`Case build failed: ${s.error}`);
      else if (s?.summary) {
        toast.success(
          `Built cases: ${s.summary.created} new, ${s.summary.added} updated, ${s.summary.merged} merged, ` +
          `${s.summary.unchanged} unchanged` +
          (s.summary.deferred ? `, ${s.summary.deferred} waiting for a running case` : "") + ".",
        );
      }
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
    wasRunning.current = buildRunning;
  }, [buildRunning, buildStatus.data, qc, toast]);

  const build = useMutation({
    mutationFn: async () => { await api<unknown>("/api/cases/build", { method: "POST" }); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases-build-status"] });
    },
    onError: (e) => {
      toast.error(friendlyError(e).text);
    },
  });

  const runSelected = useMutation({
    mutationFn: async () => RunResultSchema.parse(await api<unknown>("/api/cases/run", {
      method: "POST",
      body: JSON.stringify({ case_ids: [...selected] }),
    })),
    onSuccess: (r) => {
      const skipped = r.skipped.length;
      toast.success(`Started ${r.queued} investigation${r.queued === 1 ? "" : "s"}.` +
        (skipped ? ` ${skipped} skipped (not waiting to start).` : ""));
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(friendlyError(e).text),
  });

  const pageIds = cases.data?.items.map((c) => c.id) ?? [];
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const canAdd = projectChoice !== "new" || validProjectName(newName);

  function toggle(id: number) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((cur) => {
      const next = new Set(cur);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        subtitle="One per agent or partner key. The AI investigates, then an analyst decides."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {false && isAdmin && (
              <button className={buttonClass("secondary")} disabled={build.isPending || buildRunning}
                      onClick={() => build.mutate()}>
                {build.isPending || buildRunning ? "Building…" : "Build cases"}
              </button>
            )}
            <div className="relative">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                aria-label="Search incidents"
                placeholder="Incident or alert number"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); setSelected(new Set()); }}
                className={`${fieldClass} w-64 pl-9`}
              />
            </div>
            <div className="relative">
              <select
                aria-label="Status"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(0); setSelected(new Set()); }}
                className={`${fieldClass} appearance-none pr-9`}
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{statusTerm(s).label}</option>)}
              </select>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden
                   className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        }
      />

      {buildRunning && (
        <Card>
          <div role="progressbar" aria-label="Case build progress" aria-valuemin={0} aria-valuemax={buildStatus.data?.total ?? 0}
               aria-valuenow={buildStatus.data?.done ?? 0} className="space-y-2 text-sm">
            <div className="flex items-center justify-between text-ink-600">
              <span>Building cases…</span>
              <span>
                {buildStatus.data && buildStatus.data.total > 0
                  ? `${buildStatus.data.done} of ${buildStatus.data.total} account groups`
                  : "Reading alerts…"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{
                  width: buildStatus.data && buildStatus.data.total > 0
                    ? `${Math.round((buildStatus.data.done / buildStatus.data.total) * 100)}%`
                    : "5%",
                }}
              />
            </div>
          </div>
        </Card>
      )}
      {cases.isError && <QueryError error={cases.error} onRetry={() => void cases.refetch()} />}
      {cases.isLoading && <Card><LoadingBlock label="Loading incidents…" rows={6} /></Card>}

      {isAdmin && selected.size > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-medium text-ink-900">{selected.size} incident{selected.size === 1 ? "" : "s"} selected</span>
            <div className="flex gap-2">
              <button className={buttonClass()} disabled={runSelected.isPending}
                      onClick={() => runSelected.mutate()}>
                <Icon name="play" size={14} />
                {runSelected.isPending ? "Starting…" : "Start investigation"}
              </button>
              <button className={buttonClass("secondary")} onClick={() => setSelected(new Set())}>Clear</button>
              {PROJECTS_ENABLED && <button className={buttonClass()} onClick={() => setPanelOpen((open) => !open)}>Add to project</button>}
            </div>
          </div>
          {panelOpen && (
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4 text-sm">
              <label className="flex min-w-56 flex-col font-medium text-ink-900">
                Project
                <select
                  className="mt-1.5 rounded-lg bg-surface px-3 py-2 text-ink-900 ring-1 ring-line"
                  value={projectChoice}
                  onChange={(e) => setProjectChoice(e.target.value)}
                >
                  <option value="new">New project…</option>
                  {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              {projectChoice === "new" && (
                <label className="flex min-w-64 flex-1 flex-col font-medium text-ink-900">
                  New project name (3+ characters)
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={120}
                    className="mt-1.5 rounded-lg bg-field px-3 py-2 text-ink-900 ring-1 ring-inset ring-ink-200 outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </label>
              )}
              <button
                className={buttonClass()}
                disabled={!canAdd || addToProject.isPending}
                onClick={() => addToProject.mutate()}
              >
                Add accounts
              </button>
              {addToProject.isError && <span className="text-danger-600">Could not add the accounts.</span>}
            </div>
          )}
        </Card>
      )}

      {cases.data && (
        <Card flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className={tableHeadClass}>
                  {isAdmin && (
                    <th className="w-10 px-5 py-3">
                      <input type="checkbox" aria-label="Select all on this page" checked={allOnPage}
                             onChange={toggleAllOnPage} disabled={pageIds.length === 0} />
                    </th>
                  )}
                  <th className="px-5 py-3 font-medium">Incident</th>
                  <th className="px-5 py-3 font-medium">Alert</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                  <th className="w-10 px-3 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {cases.data.items.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className={rowLinkClass}
                  >
                    {isAdmin && (
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select incident ${c.id}`} checked={selected.has(c.id)}
                               onChange={() => toggle(c.id)} />
                      </td>
                    )}
                    <td className="px-5 py-3 font-medium text-ink-900">Incident <span className="id">{c.id}</span></td>
                    <td className="px-5 py-3 text-ink-600">Alert <span className="id">{c.alert_id}</span></td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3"><RiskMeter score={scoreOut100(c.risk_score)} compact /></td>
                    <td className="px-3 py-3 text-ink-200 group-hover:text-brand-600"><Icon name="chevronRight" size={16} /></td>
                  </tr>
                ))}
                {cases.data.items.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-5 py-10 text-center text-ink-400">
                      {emptyText("incidents", status !== "" || searchQuery !== "", "Run a scenario from the dashboard.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={cases.data.total}
            noun="incidents"
            onPage={(p) => { setPage(p); setSelected(new Set()); }}
            onPageSize={(size) => { setPageSize(size); setPage(0); setSelected(new Set()); }}
          />
        </Card>
      )}
    </div>
  );
}
