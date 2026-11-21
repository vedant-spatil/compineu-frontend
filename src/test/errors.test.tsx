import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../api/client";
import QueryError from "../components/QueryError";
import DecisionForm from "../features/approvals/DecisionForm";
import { detailFromBody, friendlyError, shouldRetry } from "../lib/errors";

const reply = (status: number, body: string) =>
  vi.fn().mockResolvedValue(new Response(body, { status, headers: { "Content-Type": "application/json" } }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("detailFromBody", () => {
  it("reads a string detail", () => expect(detailFromBody('{"detail":"Playbook PB5 is not supported"}')).toBe("Playbook PB5 is not supported"));
  it("joins validation messages", () => {
    expect(detailFromBody('{"detail":[{"msg":"reason too short"},{"msg":"reviewed required"}]}')).toBe("reason too short. reviewed required");
  });
  it("never returns markup or raw JSON", () => {
    expect(detailFromBody("<html>Bad gateway</html>")).toBe("");
    expect(detailFromBody('{"other":1}')).toBe("");
  });
});

describe("friendlyError", () => {
  it("shows the backend message for a 422", () => {
    expect(friendlyError(new ApiError(422, "reason too short")).text).toBe("reason too short");
  });
  it("gives plain messages for 403, 404 and 409", () => {
    expect(friendlyError(new ApiError(403, "x")).text).toMatch(/permission/);
    expect(friendlyError(new ApiError(404, "x")).text).toMatch(/not found/);
    expect(friendlyError(new ApiError(409, "x")).text).toMatch(/conflicts/);
  });
  it("says the backend is unavailable and retries for 503 and a network failure", () => {
    for (const status of [503, 0]) {
      expect(friendlyError(new ApiError(status, "x"))).toEqual({ text: "Backend unavailable, retrying.", retrying: true });
    }
  });
  it("retries server and network failures a few times but never a 4xx", () => {
    expect(shouldRetry(0, new ApiError(503, "x"))).toBe(true);
    expect(shouldRetry(3, new ApiError(503, "x"))).toBe(false);
    expect(shouldRetry(0, new ApiError(422, "x"))).toBe(false);
    expect(shouldRetry(0, new ApiError(0, "network"))).toBe(true);
  });
});

describe("api()", () => {
  it("turns a 422 body into the backend's message", async () => {
    vi.stubGlobal("fetch", reply(422, '{"detail":"Playbook PB5 is not supported"}'));
    await expect(api("/api/x")).rejects.toMatchObject({ status: 422, message: "Playbook PB5 is not supported" });
  });
  it("reports a network failure as status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api("/api/x")).rejects.toMatchObject({ status: 0 });
  });
});

function renderWithClient(ui: JSX.Element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("a failing call", () => {
  it("shows a short message and a Retry button, not raw JSON", async () => {
    const fetchMock = reply(404, '{"detail":"Not Found"}');
    vi.stubGlobal("fetch", fetchMock);
    function Probe() {
      const q = useQuery({ queryKey: ["probe"], queryFn: () => api("/api/x"), retry: false });
      return q.isError ? <QueryError error={q.error} onRetry={() => void q.refetch()} /> : <p>loading</p>;
    }
    renderWithClient(<Probe />);
    expect(await screen.findByText("That item was not found.")).toBeTruthy();
    expect(screen.queryByText(/detail/)).toBeNull();
    fetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

describe("approve with a 422", () => {
  it("shows the backend's message", async () => {
    vi.stubGlobal("fetch", reply(422, '{"detail":"Playbook PB5 is not supported"}'));
    renderWithClient(<DecisionForm caseId={7} report={{ recommended_playbooks: ["PB1", "PB6"] }} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Export far above his baseline, suspend now" } });
    fireEvent.click(screen.getByLabelText("I reviewed the evidence"));
    fireEvent.click(screen.getByRole("button", { name: "Approve and take action" }));
    expect(await screen.findByText("Playbook PB5 is not supported")).toBeTruthy();
  });
});

describe("double-click protection", () => {
  async function fillAndSend(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<DecisionForm caseId={7} report={{ recommended_playbooks: ["PB1", "PB6"] }} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Export far above his baseline, suspend now" } });
    fireEvent.click(screen.getByLabelText("I reviewed the evidence"));
    const button = screen.getByRole("button", { name: "Approve and take action" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
  }
  const decisionCalls = (m: ReturnType<typeof vi.fn>) => m.mock.calls.filter((c) => String(c[0]).endsWith("/decision")).length;

  it("sends the decision once however many times it is clicked", async () => {
    const fetchMock = reply(200, "{}");
    await fillAndSend(fetchMock);
    await waitFor(() => expect(screen.getByRole("button", { name: "Decision recorded" })).toBeTruthy());
    expect(decisionCalls(fetchMock)).toBe(1);
    expect((screen.getByRole("button", { name: "Decision recorded" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("lets the analyst try again after a failure", async () => {
    const fetchMock = reply(409, '{"detail":"Already decided"}');
    await fillAndSend(fetchMock);
    await screen.findByText("That conflicts with the current state, for example it was already decided. Refresh and try again.");
    const button = screen.getByRole("button", { name: "Approve and take action" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(decisionCalls(fetchMock)).toBe(1);
  });
});
