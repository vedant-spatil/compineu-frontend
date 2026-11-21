import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportSchema } from "../api/report";
import IncidentReportView from "../components/IncidentReportView";
import SectionBoundary from "../components/SectionBoundary";

// Every JSON file in src/test/fixtures is checked. To add the backend's sample report, save it there as
// incident_report.sample.json and it is covered without any other change.
const fixtures = import.meta.glob<unknown>("./fixtures/*.json", { eager: true, import: "default" });

afterEach(cleanup);

describe("report fixtures", () => {
  const entries = Object.entries(fixtures);
  it("finds the fixtures", () => expect(entries.length).toBeGreaterThanOrEqual(6));

  for (const [path, body] of entries) {
    describe(path.replace("./fixtures/", ""), () => {
      it("parses", () => expect(ReportSchema.safeParse(body).success).toBe(true));
      it("renders with no failed section", () => {
        const report = ReportSchema.parse(body);
        render(<IncidentReportView version={1} report={report} />);
        expect(screen.queryByText("Couldn't display this section.")).toBeNull();
        expect(screen.getByText("Reporting deadlines")).toBeTruthy();
      });
    });
  }
});

describe("report with missing sections", () => {
  it("shows both clocks and says the DPDP draft is not available", () => {
    const report = ReportSchema.parse(fixtures["./fixtures/report.no-dpdp-draft.json"]);
    render(<IncidentReportView version={1} report={report} />);
    expect(screen.getByText(/CERT-In report \(6 hours\)/)).toBeTruthy();
    expect(screen.getByText(/DPDP-aligned readiness \(72 hours\)/)).toBeTruthy();
    expect(screen.getByText("Not available.")).toBeTruthy();
  });
  it("handles a justification with an empty reasons list", () => {
    const report = ReportSchema.parse(fixtures["./fixtures/report.empty-reasons.json"]);
    render(<IncidentReportView version={1} report={report} />);
    expect(screen.getByText("Inconclusive")).toBeTruthy();
    expect(screen.queryByText("Reasons")).toBeNull();
  });
  it("shows Not available for clocks when there is no detection time", () => {
    render(<IncidentReportView version={1} report={ReportSchema.parse({})} />);
    expect(screen.getAllByText("Not available").length).toBe(2);
  });
  it("keeps the good fields when others have the wrong type", () => {
    const report = ReportSchema.parse(fixtures["./fixtures/report.bad-fields.json"]);
    render(<IncidentReportView version={1} report={report} />);
    expect(screen.getByText("Some fields have the wrong type")).toBeTruthy();
  });
  it("shows the justification of an auto-resolved incident", () => {
    const report = ReportSchema.parse(fixtures["./fixtures/report.auto-resolved.json"]);
    render(<IncidentReportView version={1} report={report} />);
    expect(screen.getByText("Justified")).toBeTruthy();
    expect(screen.getByText("Created before first access")).toBeTruthy();
  });
});

describe("SectionBoundary", () => {
  it("shows a short message for the broken section and leaves the rest alone", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): JSX.Element { throw new Error("bad field"); }
    render(<div><SectionBoundary><Boom /></SectionBoundary><p>other section</p></div>);
    expect(screen.getByText("Couldn't display this section.")).toBeTruthy();
    expect(screen.getByText("other section")).toBeTruthy();
    spy.mockRestore();
  });
});
