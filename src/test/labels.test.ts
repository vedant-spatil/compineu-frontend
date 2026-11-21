import { describe, expect, it } from "vitest";
import { ruleLabel } from "../lib/labels";

describe("ruleLabel", () => {
  it("replaces underscores with spaces", () => {
    expect(ruleLabel("R3_fan_in")).toBe("R3 fan in");
    expect(ruleLabel("R7_gather_scatter")).toBe("R7 gather scatter");
  });

  it("leaves a label without underscores unchanged", () => {
    expect(ruleLabel("R1")).toBe("R1");
  });
});
describe("ruleLabel signals", () => {
  it("shows the plain name of a PolicyGuard signal code, without the code", () => {
    expect(ruleLabel("A1")).toBe("Outside own portfolio");
    expect(ruleLabel("I3")).toBe("Access while on leave");
  });
  it("accepts a code with a suffix", () => {
    expect(ruleLabel("P2_enumeration")).toBe("Stepping through claim numbers");
  });
});
