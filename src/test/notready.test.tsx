import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/Toast";
import CaseDetail from "../features/cases/CaseDetail";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mount(status: string, sar: () => Response) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = String(url);
    if (u.endsWith("/sar")) return sar();
    if (u.endsWith("/events")) return json([]);
    if (u.endsWith("/api/cases/1")) return json({ id: 1, alert_id: 1, status, risk_score: 0.89, assignee_id: null });
    return json({});
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/cases/1"]}>
        <ToastProvider><Routes><Route path="/cases/:caseId" element={<CaseDetail />} /></Routes></ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("report not ready", () => {
  it("says the AI is writing the report while the investigation runs", async () => {
    mount("open", () => json({ detail: "Not Found" }, 404));
    expect(await screen.findByText("AI is writing the report…")).toBeTruthy();
  });
  it("treats a 404 after the investigation finished as still writing, not an error", async () => {
    mount("awaiting_review", () => json({ detail: "Not Found" }, 404));
    expect(await screen.findByText("AI is writing the report…")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("shows the report once it exists, with the justification of an auto-resolved incident", async () => {
    mount("auto_resolved", () => json({ version: 1, body: { title: "Cover for a colleague on leave", justification: { verdict: "justified", reasoning: "Ticket written by the manager before first access." } } }));
    expect(await screen.findByText("Cover for a colleague on leave")).toBeTruthy();
    expect(await screen.findByText("Justified")).toBeTruthy();
  });
});
