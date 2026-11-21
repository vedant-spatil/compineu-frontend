import { describe, expect, it } from "vitest";
import { emptyText } from "../lib/empty";

describe("emptyText", () => {
  it("names the filter as the reason when one is active", () => {
    expect(emptyText("incidents", true, "Run a scenario.")).toBe("No incidents match these filters.");
  });
  it("says why a table is empty and what to do", () => {
    expect(emptyText("incidents", false, "Run a scenario.")).toBe("No incidents yet. Run a scenario.");
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, vi } from "vitest";
import { ToastProvider } from "../components/Toast";
import CasesList from "../features/cases/CasesList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("an empty incidents list", () => {
  it("says why it is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = String(url).includes("/api/cases") ? { total: 0, offset: 0, limit: 25, items: [] } : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><ToastProvider><CasesList /></ToastProvider></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("No incidents yet. Run a scenario from the dashboard.")).toBeTruthy();
  });
});
