import { describe, expect, it } from "vitest";
import { complianceStatuses } from "../api/report";

const IDS = ["C-AUDIT", "C-CERTIN", "C-DPDP72", "C-AGENTS", "C-PORTFOLIO", "C-INACTIVE", "C-EXPORT", "C-HUMAN", "C-PII"];
const NOW = Date.parse("2026-11-20T12:00:00Z");

describe("complianceStatuses", () => {
  it("with no incidents everything passes", () => {
    expect(Object.values(complianceStatuses(IDS, [], NOW)).every((s) => s === "passing")).toBe(true);
  });

  it("S1 awaiting review: portfolio and export fail, safeguards and clocks pass", () => {
    const s = complianceStatuses(IDS, [
      { status: "awaiting_review", controlsFailed: ["C-PORTFOLIO", "C-EXPORT", "C-AUDIT", "C-HUMAN"], detectedAt: "2026-11-20T11:00:00Z" },
    ], NOW);
    expect(s["C-PORTFOLIO"]).toBe("failing");
    expect(s["C-EXPORT"]).toBe("failing");
    for (const id of ["C-AUDIT", "C-HUMAN", "C-PII", "C-AGENTS", "C-CERTIN", "C-DPDP72", "C-INACTIVE"]) expect(s[id]).toBe("passing");
  });

  it("after approval the export counts as reviewed, the portfolio breach stays", () => {
    const s = complianceStatuses(IDS, [{ status: "approved", controlsFailed: ["C-PORTFOLIO", "C-EXPORT"], detectedAt: "2026-11-20T11:00:00Z" }], NOW);
    expect(s["C-EXPORT"]).toBe("passing");
    expect(s["C-PORTFOLIO"]).toBe("failing");
  });

  it("old rehearsals, false positives and auto-resolved covers are not counted", () => {
    const s = complianceStatuses(IDS, [
      { status: "superseded", controlsFailed: ["C-PORTFOLIO", "C-INACTIVE"] },
      { status: "closed", controlsFailed: ["C-EXPORT"] },
      { status: "auto_resolved", controlsFailed: ["C-PORTFOLIO"] },
    ], NOW);
    expect(Object.values(s).every((v) => v === "passing")).toBe(true);
  });

  it("a CERT-In deadline missed on an open incident fails the clock control", () => {
    const s = complianceStatuses(IDS, [{ status: "awaiting_review", controlsFailed: [], detectedAt: "2026-11-20T05:00:00Z" }], NOW);
    expect(s["C-CERTIN"]).toBe("failing");
    expect(s["C-DPDP72"]).toBe("passing");
  });
});
