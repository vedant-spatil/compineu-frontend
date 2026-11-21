import { z } from "zod";
import type { IconName } from "../components/icons";

const RunSchema = z.object({
  state: z.string().optional(), // starting | running | done | error | stopped
  sent: z.number().optional(),
  events: z.number().optional(),
  scenario: z.string().optional(),
  finished_at: z.string().optional(),
}).passthrough();

/**
 * GET /api/replay/status. The backend answers {runs: {S1: {state, sent, events, ...}}, scenarios: [...]}; an older
 * flat shape ({state, sent, events, scenario}) is still accepted. Every field is optional so a backend change does not
 * break the console.
 */
export const ReplayStatusSchema = RunSchema.extend({ runs: z.record(RunSchema).optional() }).passthrough();
export type ReplayStatus = z.infer<typeof ReplayStatusSchema>;

const RUNNING = ["running", "starting", "queued"];

/** The run the console should show: the one in progress, otherwise the one that finished last. */
export function currentRun(status: ReplayStatus | undefined): ReplayStatus | undefined {
  if (!status || status.state !== undefined || !status.runs) return status;
  const runs = Object.entries(status.runs).map(([id, run]) => ({ ...run, scenario: run.scenario ?? id }));
  if (runs.length === 0) return { state: "idle" };
  const active = runs.find((r) => RUNNING.includes((r.state ?? "").toLowerCase()));
  if (active) return active;
  return runs.reduce((latest, r) => ((r.finished_at ?? "") > (latest.finished_at ?? "") ? r : latest));
}

/** The demo scenarios the console can replay. The id is what the backend expects (POST /api/replay/{id}). */
export type Scenario = {
  id: string;
  title: string;
  story: string;
  expect: string;
  tone: "danger" | "ok" | "warn" | "info";
  icon: IconName;
};
export const SCENARIOS: Scenario[] = [
  {
    id: "S1",
    title: "An agent's bad night",
    story: "1,840 health records opened at night, then a 1,200-row export.",
    expect: "Critical incident",
    tone: "danger",
    icon: "moon",
  },
  {
    id: "S1b",
    title: "Genuine cover (Anita)",
    story: "Covers a colleague on approved leave. The manager wrote the ticket.",
    expect: "Resolved automatically",
    tone: "ok",
    icon: "userCheck",
  },
  {
    id: "S1c",
    title: "Forged ticket (Dev)",
    story: "Reads outside his portfolio and writes his own approval.",
    expect: "Sent for review",
    tone: "warn",
    icon: "pen",
  },
  {
    id: "S1d",
    title: "Forged ticket during real leave",
    story: "The leave is real, but the agent wrote the ticket himself.",
    expect: "Sent for review",
    tone: "warn",
    icon: "calendar",
  },
  {
    id: "S2",
    title: "Partner key used from abroad",
    story: "A TPA key steps through unassigned claims from a new address.",
    expect: "Critical incident",
    tone: "danger",
    icon: "globe",
  },
  {
    id: "S5",
    title: "Ex-employee login",
    story: "A terminated agent's login still opens customer records.",
    expect: "Incident",
    tone: "warn",
    icon: "userX",
  },
];

/** The scenario's plain title for an id, or the id itself when unknown. */
export function scenarioTitle(id: string): string {
  return SCENARIOS.find((s) => s.id === id)?.title ?? id;
}

export type ReplayView = {
  running: boolean;
  /** 0 to 100, or null when the total is not known. */
  percent: number | null;
  label: string;
};

/** What the console shows for a status: whether a run is going, how far along, and a short line of text. */
export function replayView(raw: ReplayStatus | undefined): ReplayView {
  const status = currentRun(raw);
  if (!status) return { running: false, percent: null, label: "" };
  const state = (status.state ?? "idle").toLowerCase();
  const running = RUNNING.includes(state);
  const { sent, events } = status;
  const known = typeof sent === "number" && typeof events === "number" && events > 0;
  const percent = known ? Math.min(100, Math.round((sent / events) * 100)) : null;
  const scenario = status.scenario ? `${scenarioTitle(status.scenario)}: ` : "";
  if (running) return { running, percent, label: known ? `${scenario}${sent} of ${events} events sent` : `${scenario}running…` };
  if (state === "failed" || state === "error") return { running, percent, label: `${scenario}the run failed` };
  if (state === "done" && known) return { running, percent: 100, label: `${scenario}done, ${events} events sent` };
  return { running, percent, label: state === "done" ? `${scenario}done` : "" };
}
