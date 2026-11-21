import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/Toast";
import ScenarioConsole from "../features/dashboard/ScenarioConsole";
import { replayView } from "../lib/replay";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("replayView", () => {
  it("is idle with no status", () => {
    expect(replayView(undefined)).toEqual({ running: false, percent: null, label: "" });
  });
  it("shows sent out of events while running", () => {
    expect(replayView({ state: "running", sent: 30, events: 120, scenario: "S1" })).toEqual({
      running: true, percent: 25, label: "An agent's bad night: 30 of 120 events sent",
    });
  });
  it("is not running when done or failed", () => {
    expect(replayView({ state: "done", sent: 120, events: 120 }).running).toBe(false);
    expect(replayView({ state: "failed" }).label).toBe("the run failed");
  });
  it("runs without a percent when the total is unknown", () => {
    const v = replayView({ state: "running" });
    expect(v.running).toBe(true);
    expect(v.percent).toBeNull();
  });
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider><ScenarioConsole /></ToastProvider>
    </QueryClientProvider>,
  );
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("scenario console", () => {
  it("disables every button and shows progress while a run is going", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ state: "running", sent: 30, events: 120, scenario: "S1" })));
    mount();
    expect(await screen.findByText("An agent's bad night: 30 of 120 events sent")).toBeTruthy();
    for (const b of screen.getAllByRole("button")) expect((b as HTMLButtonElement).disabled).toBe(true);
  });
  it("starts a scenario with a POST and enables the buttons when idle", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      String(url).endsWith("/api/replay/status") ? json({ state: "idle" }) : json({ ok: true, method: init?.method }));
    vi.stubGlobal("fetch", fetchMock);
    mount();
    const s1 = await screen.findByRole("button", { name: /An agent's bad night/ });
    await waitFor(() => expect((s1 as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(s1);
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/api/replay/S1") && c[1]?.method === "POST")).toBe(true));
  });
  it("still works when the status endpoint does not exist yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ detail: "Not Found" }, 404)));
    mount();
    const reset = await screen.findByRole("button", { name: "Reset" });
    expect((reset as HTMLButtonElement).disabled).toBe(false);
  });
});
