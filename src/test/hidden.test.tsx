import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { itemsFor, NavList } from "../app/Sidebar";
import { policyGuardCards } from "../features/dashboard/Dashboard";
import { qualityAvailable, useQualityAvailable } from "../features/quality/useQuality";
import { QUALITY_PAGE_ENABLED } from "../features/quality/useQuality";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Quality nav item", () => {
  it("is listed only when asked for", () => {
    expect(itemsFor("admin").some((i) => i.to === "/quality")).toBe(false);
    expect(itemsFor("admin", { quality: true }).some((i) => i.to === "/quality")).toBe(true);
    expect(itemsFor("qa", { quality: true }).some((i) => i.to === "/quality")).toBe(false);
  });
  it("is hidden on a 404 and while loading, and shown otherwise", () => {
    expect(qualityAvailable({ isLoading: false, error: new ApiError(404, "x") })).toBe(false);
    expect(qualityAvailable({ isLoading: true, error: null })).toBe(false);
    expect(qualityAvailable({ isLoading: false, error: null })).toBe(true);
    expect(qualityAvailable({ isLoading: false, error: new ApiError(503, "x") })).toBe(true);
  });
  function Probe() {
    const { available } = useQualityAvailable(true);
    return <MemoryRouter><NavList items={itemsFor("admin", { quality: available })} showLabels /></MemoryRouter>;
  }
  const mount = () => render(<QueryClientProvider client={new QueryClient()}><Probe /></QueryClientProvider>);
  it("disappears from the menu when /api/quality returns 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"detail":"Not Found"}', { status: 404 })));
    mount();
    await waitFor(() => expect(screen.getByText("Dashboard")).toBeTruthy());
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("Quality")).toBeNull();
  });
  it("stays hidden for the demo even when /api/quality answers (QUALITY_PAGE_ENABLED is false)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    mount();
    await new Promise((r) => setTimeout(r, 50));
    expect(QUALITY_PAGE_ENABLED).toBe(false);
    expect(screen.queryByText("Quality")).toBeNull();
  });
});

describe("dashboard cards", () => {
  it("leaves out a card whose number is missing", () => {
    expect(policyGuardCards({})).toEqual([]);
    const cards = policyGuardCards({ cert_in_clocks_running: 2, records_at_risk: 2800 });
    expect(cards.map((c) => c.label)).toEqual(["CERT-In deadlines running", "Records at risk"]);
    expect(cards[1].value).toBe("2,800");
  });
  it("shows all three when the backend sends them", () => {
    const cards = policyGuardCards({ cert_in_clocks_running: 0, controls_passing: { passing: 6, total: 9 }, records_at_risk: 0 });
    expect(cards.map((c) => c.value)).toEqual([0, "6 / 9", "0"]);
  });
});
