import { describe, expect, it } from "vitest";
import { normalizeQuality, QualitySchema } from "../features/quality/useQuality";

// The payload GET /api/quality returned on AWS after S1 (backend names: ai_off, ai_on, minutes).
const BACKEND = {
  scenarios: [{ scenario: "S1", actor: "AG-1147", expected: "incident", risk: 88.7, status: "open" }],
  ai_off: { incidents: 1, true_positives: 1, false_positives: 0, precision: 1.0, recall: 1.0 },
  ai_on: { incidents: 1, true_positives: 1, false_positives: 0, precision: 1.0, recall: 1.0 },
  time_to_detect_sim_minutes_median: 3.1,
  signals_total: 4,
  signals_per_incident: 4.0,
  golden_set: { offline: null, live: null },
};

describe("quality payload mapping", () => {
  it("maps the backend's ai_off and ai_on to the sides the page reads", () => {
    const q = normalizeQuality(QualitySchema.parse(BACKEND));
    expect(q.triage_off?.precision).toBe(1);
    expect(q.triage_on?.recall).toBe(1);
    expect(q.triage_off?.incidents).toBe(1);
    expect(q.time_to_detect_s).toBe(186); // 3.1 minutes
  });

  it("keeps triage_off and triage_on when the backend sends those names", () => {
    const q = normalizeQuality(QualitySchema.parse({ triage_off: { precision: 0.5 }, triage_on: { precision: 0.9 } }));
    expect(q.triage_off?.precision).toBe(0.5);
    expect(q.triage_on?.precision).toBe(0.9);
  });

  it("stays empty, without crashing, when there is no evaluation yet", () => {
    const q = normalizeQuality(QualitySchema.parse({}));
    expect(q.triage_off).toBeUndefined();
    expect(q.time_to_detect_s).toBeUndefined();
  });
});
