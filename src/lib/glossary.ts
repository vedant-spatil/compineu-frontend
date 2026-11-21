/**
 * Plain-language names for every code the backend sends. Screens show the label; the description goes in a tooltip or
 * a legend. The codes stay in the data and in tooltips, so analysts can still match a label to the backend.
 */
import catalog from "../data/controls.json";

export type Tone = "brand" | "danger" | "ok" | "warn" | "info" | "neutral";
export type Term = { label: string; description: string };

/** "risk_escalated" -> "Risk escalated". */
export const humanize = (s: string) => {
  const t = s.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

// ---- Detection signals (alert.rules, the dashboard rule chart) --------------------------------------------------
export const SIGNALS: Record<string, Term> = {
  A1: {
    label: "Outside own portfolio",
    description: "Opened, searched or exported 10 or more customers who are not in this agent's own portfolio.",
  },
  A2: {
    label: "Unusually high volume",
    description: "Touched far more records than this agent normally does, and far more than colleagues in the same branch.",
  },
  A3: {
    label: "Large data export",
    description: "Exported 200 or more rows at once, or exported health records or claim files.",
  },
  A4: {
    label: "Unusual time, device or place",
    description: "Worked outside usual hours, or from a device or city this agent has not used before.",
  },
  A5: {
    label: "Focus on sensitive records",
    description: "Mostly opened the most sensitive records: health data and claim files.",
  },
  I1: {
    label: "Disabled or ex-employee login",
    description: "A suspended or terminated agent, or a disabled login or partner key, still received customer data.",
  },
  I3: {
    label: "Access while on leave",
    description: "The agent accessed customer data while recorded as on leave.",
  },
  P1: {
    label: "Claim not assigned to partner",
    description: "A partner (TPA) key fetched a claim that is not assigned to that partner.",
  },
  P2: {
    label: "Stepping through claim numbers",
    description: "A partner key requested many claims one number after another, or got many refusals. This looks like scanning.",
  },
  P3: {
    label: "Partner on a new network",
    description: "A partner key was used from an internet address (IP) it has never used before.",
  },
};

/** The signal for a code such as "A1" or "A1_out_of_portfolio". Unknown codes get a readable version of the code. */
export function signal(code: string): Term & { code: string } {
  const key = code.split("_")[0].toUpperCase();
  const known = SIGNALS[key];
  return known ? { code: key, ...known } : { code, label: humanize(code), description: "" };
}

// ---- Data sensitivity tiers (access_events.tier, report.impact.tiers) -------------------------------------------
export const TIERS: Record<string, Term & { level: string; tone: Tone }> = {
  T1: {
    label: "Health records and claims",
    level: "Highly sensitive",
    tone: "warn",
    description: "Health policy profiles and claim files, including diagnoses and claim amounts.",
  },
  T2: {
    label: "Motor and life policies",
    level: "Sensitive",
    tone: "info",
    description: "Motor or life policy profiles and policy documents.",
  },
  T3: {
    label: "Logins and searches",
    level: "Low sensitivity",
    tone: "neutral",
    description: "Activity that opened no customer record, such as signing in or running a search.",
  },
};

export function tier(code: string): Term & { level: string; tone: Tone } {
  return TIERS[code.toUpperCase()] ?? { label: humanize(code), level: "", tone: "neutral", description: "" };
}

// ---- MITRE ATT&CK techniques (report.attack_techniques, ids like T1078 or T1078.004) ---------------------------
const TECHNIQUES: Record<string, [plain: string, official: string]> = {
  T1005: ["Collecting data from a computer", "Data from Local System"],
  T1020: ["Automated data theft", "Automated Exfiltration"],
  T1041: ["Sending data to an attacker's server", "Exfiltration Over C2 Channel"],
  T1048: ["Sending data out by another channel", "Exfiltration Over Alternative Protocol"],
  T1052: ["Copying data to a USB drive or disk", "Exfiltration Over Physical Medium"],
  T1074: ["Gathering data before taking it", "Data Staged"],
  T1078: ["Misusing a valid login", "Valid Accounts"],
  T1083: ["Browsing for files", "File and Directory Discovery"],
  T1087: ["Looking up accounts", "Account Discovery"],
  T1098: ["Changing an account to keep access", "Account Manipulation"],
  T1110: ["Guessing passwords", "Brute Force"],
  T1114: ["Collecting emails", "Email Collection"],
  T1119: ["Automated data collection", "Automated Collection"],
  T1133: ["Remote access from outside", "External Remote Services"],
  T1199: ["Abusing a trusted partner connection", "Trusted Relationship"],
  T1213: ["Collecting data from internal systems", "Data from Information Repositories"],
  T1528: ["Stealing an app access key", "Steal Application Access Token"],
  T1530: ["Collecting data from cloud storage", "Data from Cloud Storage"],
  T1537: ["Moving data to another cloud account", "Transfer Data to Cloud Account"],
  T1552: ["Using exposed passwords or keys", "Unsecured Credentials"],
  T1560: ["Packing data up to take it", "Archive Collected Data"],
  T1567: ["Sending data out over the web", "Exfiltration Over Web Service"],
  T1586: ["Taking over accounts", "Compromise Accounts"],
  T1595: ["Scanning for weak points", "Active Scanning"],
};

/** A plain name for an ATT&CK id. The tooltip keeps the id and the official name for analysts. */
export function technique(id: string): { label: string; tooltip: string } {
  const base = id.toUpperCase().split(".")[0];
  const known = TECHNIQUES[base];
  if (known) return { label: known[0], tooltip: `MITRE ATT&CK ${id}: ${known[1]}` };
  return { label: `Attack technique ${id}`, tooltip: `MITRE ATT&CK ${id}` };
}

// ---- Incident type (report.scenario) ---------------------------------------------------------------------------
export const SCENARIO_TYPES: Record<string, Term> = {
  malicious_insider: {
    label: "Deliberate misuse by an insider",
    description: "Someone with legitimate access used it on purpose for something they should not.",
  },
  compromised_account: {
    label: "Someone else using the login",
    description: "The agent's login appears to be used by someone other than its owner.",
  },
  compromised_partner: {
    label: "Partner access misused",
    description: "A partner's API key appears to be stolen or misused.",
  },
  negligent: {
    label: "Careless handling",
    description: "Most likely a mistake or careless handling rather than bad intent.",
  },
  benign_exception: {
    label: "Legitimate business reason",
    description: "The access looks unusual, but a valid business reason explains it.",
  },
};

export function scenarioType(code: string): Term {
  return SCENARIO_TYPES[code] ?? { label: humanize(code), description: "" };
}

// ---- Justification verdicts --------------------------------------------------------------------------------------
export const VERDICTS: Record<string, Term & { tone: Tone }> = {
  justified: { label: "Justified", tone: "ok", description: "The records show a valid business reason for this access." },
  unjustified: { label: "Not justified", tone: "danger", description: "The records do not cover this access." },
  inconclusive: { label: "Inconclusive", tone: "warn", description: "There is not enough evidence to decide either way." },
};

export function verdict(code: string | undefined): Term & { tone: Tone } {
  const key = (code ?? "inconclusive").toLowerCase();
  return VERDICTS[key] ?? { label: humanize(key), tone: "neutral", description: "" };
}

// ---- Compliance controls (report.controls_failed, the Compliance page) ------------------------------------------
type Control = { id: string; requirement: string; source: string; clause_text: string; tag: string };
const CONTROLS = new Map((catalog as Control[]).map((c) => [c.id, c]));

export function control(id: string): { label: string; source: string } {
  const c = CONTROLS.get(id);
  return c ? { label: c.requirement, source: c.source } : { label: humanize(id.replace(/^C-/, "").toLowerCase()), source: "" };
}

/** "Legal" controls come from a law or regulator; "Voluntary" ones are PolicyGuard's own rules. */
export const CONTROL_TAGS: Record<string, { label: string; tone: Tone }> = {
  Legal: { label: "Required by regulation", tone: "brand" },
  Voluntary: { label: "Internal safeguard", tone: "neutral" },
};

// ---- Who did it (alert.account_id) -------------------------------------------------------------------------------
/** Agent ids start with AG-, partner keys with PK-. */
export function actorKind(id: string): string {
  if (/^AG-/i.test(id)) return "Insurance agent";
  if (/^PK-/i.test(id)) return "Partner (TPA) key";
  return "";
}

// ---- Case statuses -----------------------------------------------------------------------------------------------
export const STATUSES: Record<string, Term & { tone: Tone }> = {
  pending: { label: "Not started", tone: "neutral", description: "Opened from an alert, but the investigation has not run yet." },
  open: {
    label: "Investigating",
    tone: "info",
    description: "The AI is checking the evidence, looking for a business reason and writing the report.",
  },
  awaiting_review: {
    label: "Awaiting review",
    tone: "warn",
    description: "The investigation is finished. An analyst must approve actions or close the incident.",
  },
  auto_resolved: {
    label: "Resolved automatically",
    tone: "ok",
    description: "A valid business reason was proven from the records, so the alert was closed with reasons. It stays in the log.",
  },
  approved: { label: "Action approved", tone: "ok", description: "An analyst approved the response actions." },
  closed: { label: "Closed", tone: "neutral", description: "An analyst closed the incident as a false alarm." },
  closed_low_risk: { label: "Closed, low risk", tone: "neutral", description: "The risk was too low to investigate." },
  failed: { label: "Failed", tone: "danger", description: "The investigation stopped with an error. See the timeline, then restart it." },
  superseded: {
    label: "Archived",
    tone: "neutral",
    description: "Replaced by a newer incident or cleared by a demo reset. Its audit trail is kept.",
  },
  // Import and observability statuses.
  validating: { label: "Validating", tone: "info", description: "" },
  loading: { label: "Loading", tone: "info", description: "" },
  triaging: { label: "Checking", tone: "info", description: "" },
  triaged: { label: "Checked", tone: "ok", description: "" },
  rejected: { label: "Rejected", tone: "danger", description: "" },
  ok: { label: "Succeeded", tone: "ok", description: "" },
  done: { label: "Succeeded", tone: "ok", description: "" },
  error: { label: "Error", tone: "danger", description: "" },
};

export function status(code: string): Term & { tone: Tone } {
  return STATUSES[code] ?? { label: humanize(code), tone: "neutral", description: "" };
}

/** The statuses offered in the incident filter, in workflow order. */
export const CASE_STATUS_ORDER = ["pending", "open", "awaiting_review", "auto_resolved", "approved", "closed", "failed", "superseded"];

// ---- Risk bands (backend app/services/risk.py: critical 80, high 60, medium 40) -----------------------------------
export function riskBand(score: number | null): { label: string; tone: Tone } {
  if (score === null) return { label: "Unknown", tone: "neutral" };
  if (score >= 80) return { label: "Critical", tone: "danger" };
  if (score >= 60) return { label: "High", tone: "warn" };
  if (score >= 40) return { label: "Medium", tone: "info" };
  return { label: "Low", tone: "ok" };
}

// ---- Investigation steps (case_events.node) ---------------------------------------------------------------------
export const STEPS: Record<string, string> = {
  ingest_alert: "Incident opened",
  detection: "Detection",
  triage: "Risk check",
  load_context: "Background gathered",
  evidence: "Evidence collected",
  justification: "Business reason check",
  classify: "Incident type identified",
  route: "Next step decided",
  report_writer: "Incident report written",
  auto_resolve: "Closed automatically",
  review: "Review",
  finalize: "Decision recorded",
  playbook: "Action taken",
  assignment: "Reviewer assigned",
  workflow: "Investigation restarted",
  graph: "Investigation error",
  grouping: "Alerts grouped",
};

export function stepLabel(node: string): string {
  return STEPS[node] ?? humanize(node);
}
