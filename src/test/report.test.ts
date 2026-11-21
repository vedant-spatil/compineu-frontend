import { describe, expect, it } from "vitest";
import {
  canSubmit, clockRemainingMs, reportPhase, PLAYBOOK_IDS, controlStatuses, hasReport, defaultPlaybooks, formatRemaining, parseTime, reasonValid, ReportSchema, revealNames,
  scoreOut100,
} from "../api/report";

describe("ReportSchema", () => {
  it("keeps unknown fields and accepts a partial report", () => {
    const r = ReportSchema.parse({ title: "T", extra_field: 1 });
    expect((r as Record<string, unknown>).extra_field).toBe(1);
  });
  it("drops a field of the wrong type and keeps the rest", () => {
    const r = ReportSchema.parse({ risk_score: "high", title: "T" });
    expect(r.risk_score).toBeUndefined();
    expect(r.title).toBe("T");
  });
  it("rejects a body that is not an object", () => {
    expect(ReportSchema.safeParse("oops").success).toBe(false);
    expect(ReportSchema.safeParse(null).success).toBe(false);
  });
  it("survives a parse and serialize round trip", () => {
    const input = { title: "T", risk_score: 89, cited_event_ids: ["EV-1", 2], impact: { records: 10, tiers: { T1: 10 } } };
    const once = ReportSchema.parse(input);
    expect(ReportSchema.parse(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});

describe("clocks", () => {
  const t0 = "2026-11-20T00:40:00Z";
  const start = Date.parse(t0);
  it("count from detection", () => {
    expect(clockRemainingMs(t0, 6, start)).toBe(6 * 3_600_000);
    expect(clockRemainingMs(t0, 72, start + 3_600_000)).toBe(71 * 3_600_000);
  });
  it("go negative when overdue", () => {
    expect(clockRemainingMs(t0, 6, start + 7 * 3_600_000)).toBe(-3_600_000);
    expect(formatRemaining(-3_600_000)).toBe("Overdue by 1h 00m 00s");
  });
  it("is unavailable without a detection time", () => {
    expect(clockRemainingMs(undefined, 6, 0)).toBeNull();
    expect(formatRemaining(null)).toBe("Not available");
  });
  it("reads a time with no zone as UTC", () => {
    expect(parseTime("2026-11-20T00:40:00")).toBe(start);
  });
});

describe("decision rules", () => {
  it("needs 20 characters after trimming", () => {
    expect(reasonValid("x".repeat(19))).toBe(false);
    expect(reasonValid("  " + "x".repeat(20) + "  ")).toBe(true);
    expect(reasonValid(" ".repeat(30))).toBe(false);
  });
  it("needs a playbook to approve, but not to close", () => {
    const base = { reason: "x".repeat(20), reviewed: true };
    expect(canSubmit({ ...base, action: "approve", playbooks: [] })).toBe(false);
    expect(canSubmit({ ...base, action: "approve", playbooks: ["PB1"] })).toBe(true);
    expect(canSubmit({ ...base, action: "close", playbooks: [] })).toBe(true);
  });
  it("needs the review tick", () => {
    expect(canSubmit({ action: "close", reason: "x".repeat(20), reviewed: false, playbooks: [] })).toBe(false);
  });
  it("ticks only recommended playbooks that exist", () => {
    expect(defaultPlaybooks({ recommended_playbooks: ["PB1", "PB6", "PB9"] })).toEqual(["PB1", "PB6"]);
    expect(defaultPlaybooks(undefined)).toEqual([]);
  });
});

describe("revealNames", () => {
  const names = { PH_001: "Asha Verma" };
  it("replaces known tokens only", () => {
    expect(revealNames("PH_001 and PH_002", names)).toBe("Asha Verma and PH_002");
  });
  it("does not rewrite part of a longer token", () => {
    expect(revealNames("PH_0012", names)).toBe("PH_0012");
  });
  it("leaves text unchanged with no names", () => {
    expect(revealNames("PH_001", {})).toBe("PH_001");
  });
});

describe("scoreOut100", () => {
  it("shows 0 to 100 for either scale", () => {
    expect(scoreOut100(0.89)).toBe(89);
    expect(scoreOut100(89)).toBe(89);
    expect(scoreOut100(undefined)).toBeNull();
  });
});

describe("controlStatuses", () => {
  it("fails a control listed in any report and passes the rest", () => {
    const out = controlStatuses(["C-A", "C-B", "C-C"], [["C-A"], undefined, ["C-A", "C-C"]]);
    expect(out).toEqual({ "C-A": "failing", "C-B": "passing", "C-C": "failing" });
  });
  it("passes everything with no reports", () => {
    expect(controlStatuses(["C-A"], [])).toEqual({ "C-A": "passing" });
  });
});

describe("hasReport", () => {
  it("fetches the report for auto-resolved incidents", () => {
    expect(hasReport("auto_resolved")).toBe(true);
  });
  it("fetches it when awaiting review or approved", () => {
    expect(hasReport("awaiting_review")).toBe(true);
    expect(hasReport("approved")).toBe(true);
  });
  it("does not fetch it for other statuses", () => {
    for (const s of ["pending", "open", "failed", "closed", "superseded", undefined]) expect(hasReport(s)).toBe(false);
  });
});

describe("playbook list", () => {
  it("offers only the playbooks the backend accepts", () => {
    expect(PLAYBOOK_IDS).toEqual(["PB1", "PB2", "PB6", "PB7"]);
  });
  it("drops a recommended playbook the backend does not accept", () => {
    expect(defaultPlaybooks({ recommended_playbooks: ["PB1", "PB5", "PB6"] })).toEqual(["PB1", "PB6"]);
  });
});

describe("reportPhase", () => {
  it("is ready once there is a report", () => {
    expect(reportPhase({ status: "awaiting_review", hasData: true, notFound: false })).toBe("ready");
  });
  it("is writing while the investigation runs, and on a 404 after it finished", () => {
    expect(reportPhase({ status: "open", hasData: false, notFound: false })).toBe("writing");
    expect(reportPhase({ status: "awaiting_review", hasData: false, notFound: true })).toBe("writing");
  });
  it("says not started or failed for those statuses", () => {
    expect(reportPhase({ status: "pending", hasData: false, notFound: false })).toBe("not_started");
    expect(reportPhase({ status: "failed", hasData: false, notFound: false })).toBe("failed");
  });
  it("is missing for a closed incident with no report", () => {
    expect(reportPhase({ status: "closed", hasData: false, notFound: true })).toBe("missing");
  });
});
