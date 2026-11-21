import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Icon } from "../../components/icons";
import { buttonClass, Card, Pill, TONES } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { friendlyError } from "../../lib/errors";
import { ReplayStatusSchema, replayView, SCENARIOS, scenarioTitle } from "../../lib/replay";

/** Buttons that replay a demo scenario through the simulated insurer, plus a reset between rehearsals. Admin only. */
export default function ScenarioConsole() {
  const toast = useToast();
  const qc = useQueryClient();

  // Progress of the current run. Polled once a second while a run is going, otherwise read once.
  // If the endpoint is not there yet (404), the console still works and shows no progress.
  const status = useQuery({
    queryKey: ["replay-status"],
    queryFn: async () => ReplayStatusSchema.parse(await api<unknown>("/api/replay/status")),
    retry: false,
    refetchInterval: (q) => (replayView(q.state.data).running ? 1000 : false),
  });
  const view = replayView(status.data);

  const run = useMutation({
    mutationFn: (path: string) => api(`/api/replay/${path}`, { method: "POST" }),
    onSuccess: (_d, path) => {
      toast.success(path === "reset" ? "Demo reset. Open incidents are archived; the audit trail is kept." : `Started: ${scenarioTitle(path)}.`);
      void qc.invalidateQueries({ queryKey: ["replay-status"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (e) => toast.error(friendlyError(e).text),
  });

  // When a run ends, refresh what it produced.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !view.running) {
      for (const key of ["dashboard", "dashboard-trends", "cases", "alerts", "notifications"]) void qc.invalidateQueries({ queryKey: [key] });
    }
    wasRunning.current = view.running;
  }, [view.running, qc]);

  const busy = run.isPending || view.running;
  return (
    <Card
      icon="play"
      title="Demo scenarios"
      subtitle="Replays simulated activity at 60x. Reset archives open incidents; the audit trail is kept."
      action={
        <button type="button" disabled={busy} onClick={() => run.mutate("reset")} className={buttonClass("secondary")}>
          <Icon name="reset" size={16} />
          Reset
        </button>
      }
    >
      <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            onClick={() => run.mutate(s.id)}
            className="group flex items-start gap-3 bg-surface p-3.5 text-left transition-colors hover:bg-field disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-surface"
          >
            <Icon name={s.icon} size={18} className={`mt-0.5 ${TONES[s.tone].text}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink-900">{s.title}</span>
              <span className="mt-0.5 block text-xs text-ink-600">{s.story}</span>
              <span className="mt-2 block"><Pill tone={s.tone}>{s.expect}</Pill></span>
            </span>
            <Icon name="play" size={14} className="mt-1 text-ink-200 transition-colors group-enabled:group-hover:text-brand-600" />
          </button>
        ))}
      </div>
      {(view.running || view.label) && (
        <div className="mt-4 space-y-1.5" role="status" aria-live="polite">
          <div className="flex justify-between text-xs text-ink-600">
            <span className="font-medium">{view.label}</span>
            {view.percent !== null && <span className="tabular-nums">{view.percent}%</span>}
          </div>
          {view.running && (
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-line">
              <div
                className={`h-full bg-brand-600 transition-all ${view.percent === null ? "animate-pulse" : ""}`}
                style={{ width: `${view.percent ?? 30}%` }}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
