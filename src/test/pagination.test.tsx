// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Pagination, pageWindow } from "../components/ui";
import { currentRun, replayView } from "../lib/replay";

afterEach(cleanup);

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(0, 1)).toEqual([0]);
    expect(pageWindow(2, 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("keeps the first, last and neighbours, with gaps between", () => {
    expect(pageWindow(9, 20)).toEqual([0, "gap", 8, 9, 10, "gap", 19]);
    expect(pageWindow(0, 20)).toEqual([0, 1, 2, 3, "gap", 19]);
    expect(pageWindow(19, 20)).toEqual([0, "gap", 16, 17, 18, 19]);
  });
});

describe("Pagination", () => {
  it("shows the range and total, marks the current page and disables Previous on the first page", () => {
    render(<Pagination page={0} pageSize={25} total={137} onPage={() => {}} noun="alerts" />);
    expect(screen.getByRole("navigation", { name: "Pagination" }).textContent).toContain("1–25 of 137 alerts");
    expect(screen.getByRole("button", { name: "Page 1" }).getAttribute("aria-current")).toBe("page");
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("reports the page asked for and the last partial range", () => {
    const onPage = vi.fn();
    render(<Pagination page={5} pageSize={25} total={137} onPage={onPage} />);
    expect(screen.getByRole("navigation").textContent).toContain("126–137 of 137 rows");
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
  it("offers rows per page only when a handler is given, and renders nothing for an empty list", () => {
    const onPageSize = vi.fn();
    const { container, rerender } = render(<Pagination page={0} pageSize={25} total={60} onPage={() => {}} onPageSize={onPageSize} />);
    fireEvent.change(screen.getByLabelText("Per page"), { target: { value: "50" } });
    expect(onPageSize).toHaveBeenCalledWith(50);
    rerender(<Pagination page={0} pageSize={25} total={0} onPage={() => {}} />);
    expect(container.textContent).toBe("");
  });
});

describe("replay status in the backend's shape", () => {
  // GET /api/replay/status answers {runs: {<id>: {...}}, scenarios: [...]}, not a flat status.
  const runs = {
    S1b: { scenario: "S1b", state: "done", sent: 131, events: 131, finished_at: "2026-11-20T11:48:45" },
    S1: { scenario: "S1", state: "running", sent: 600, events: 1843 },
  };
  it("shows the run in progress", () => {
    expect(currentRun({ runs })?.scenario).toBe("S1");
    expect(replayView({ runs })).toEqual({ running: true, percent: 33, label: "An agent's bad night: 600 of 1843 events sent" });
  });
  it("shows the run that finished last when none is going, and idle when there are none", () => {
    const done = { ...runs, S1: { ...runs.S1, state: "done", sent: 1843, finished_at: "2026-11-20T13:06:30" } };
    expect(replayView({ runs: done })).toEqual({ running: false, percent: 100, label: "An agent's bad night: done, 1843 events sent" });
    expect(replayView({ runs: {} })).toEqual({ running: false, percent: null, label: "" });
  });
});
