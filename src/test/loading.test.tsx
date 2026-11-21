import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuditTimeline from "../components/AuditTimeline";
import { LoadingBlock } from "../components/ui";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("loading states", () => {
  it("LoadingBlock announces itself", () => {
    render(<LoadingBlock label="Loading incidents…" />);
    expect(screen.getByRole("status").textContent).toContain("Loading incidents…");
  });
  it("the timeline shows a skeleton while loading, not the empty text", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AuditTimeline caseId={1} polling={false} /></QueryClientProvider>);
    expect(screen.getByRole("status").textContent).toContain("Loading timeline…");
    expect(screen.queryByText("No events yet.")).toBeNull();
  });
});
