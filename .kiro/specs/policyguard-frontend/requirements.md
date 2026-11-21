# Requirements Document

## Introduction

PolicyGuard AI detects insider and partner misuse of policyholder data at an insurer. A simulated insurer app generates activity. A mock agent portal and a partner API record every search, view and export in an access-events table. Detectors check each action against the agent's portfolio, normal behaviour, HR status and leave, and check partner API keys against the claims assigned to that partner. Each hit is a flag with a confidence. A risk score from 0 to 100 is computed from the flags, the number of records touched and the data sensitivity tier (health claims are tier T1, the most sensitive). Scores below 40 are logged only. Scores of 40 to 59 go to an AI justification judge that auto-resolves or promotes the alert. Scores of 60 or more are full incidents. An AI investigator labels the scenario and writes a report that includes a CERT-In draft and a DPDP breach intimation draft. A human analyst approves response playbooks before any action runs.

This spec covers the frontend lane only: converting the existing neu-frontend (React, Tailwind, React Query, Recharts, Cytoscape, an AML Copilot UI) into the PolicyGuard AI frontend. It also covers the compliance content (control catalog JSON) and the deck material owned by the frontend lane. The frontend runs against the local neu-backend API (FastAPI). The backend, detectors and AI pipeline are out of scope except for two small backend edits, which may be handed to Raghav.

**Timebox:** about 12:15 to 17:00 on 20 Nov 2026. Each requirement is tagged **[Core]** (must work in the live demo) or **[Stretch]** (done only if time remains). Requirement 15 (Quality page) is Stretch, and the integrity indicator in Requirement 13, criterion 6 is Stretch. All other requirements are Core.

**Demo example used for acceptance:** agent AG-1147 opens 1,840 health-claim records outside his portfolio at midnight and exports 1,200 rows. The incident opens at about 65 during browsing, and the export raises the score to 89 (Critical). The analyst approves PB1 (suspend agent) and PB6 (preserve evidence).

**Assumptions to confirm with the backend owners:**
- Field names in the incident report follow Bhavya's sample REPORT JSON. Until the final schema is agreed, the zod schema is built from the sample and fields not in the sample are optional.
- The existing `/api/cases/*` endpoints keep their paths. "Incident" is a display name for a case.
- Backend role values stay `admin` and `qa`. Only labels change.
- The decision endpoint accepts playbook IDs, a reason and a reviewed flag.
- The severity label (for example "Critical" at 89) comes from the API. The frontend does not invent score cut-offs above 60.

## Glossary

- **PolicyGuard_UI**: The React frontend in /Users/krishgupta/Downloads/neu-frontend after conversion from the AML Copilot UI.
- **Backend_API**: The local neu-backend FastAPI service that PolicyGuard_UI calls through `VITE_API_BASE_URL`.
- **Simulated_Insurer**: The simulated insurer app, mock agent portal and partner API that generate the activity PolicyGuard AI monitors.
- **Incident**: A case with a risk score of 60 or more. Shown in the UI under the name "Incident". The stored entity is still a case.
- **Alert**: A detection with a risk score from 40 to 59 that the AI justification judge evaluates, or a score below 40 that is logged only.
- **Auto_Resolved**: A status for an Alert that the justification judge closed with a passed proof. Stored as `auto_resolved`.
- **Signal**: A detector flag shown with a code and a label (A1, A2, A3, A4, A5, I1, I3, P1, P2, P3).
- **Signal_Label_Map**: The module `lib/labels.ts` mapping Signal codes to display labels.
- **Incident_Report_View**: The component `IncidentReportView.tsx` that replaces `SarView.tsx`.
- **Report_JSON**: The incident report object returned by Backend_API, matching Bhavya's sample REPORT JSON.
- **Justification_Panel**: The part of Incident_Report_View showing the AI justification judge result.
- **Verdict**: The justification result, one of `justified`, `unjustified` or `inconclusive`.
- **Decision_Form**: The form in which the analyst selects playbooks, enters a reason and confirms.
- **Playbook**: A response action. PB1 suspend agent, PB2 disable partner key, PB6 preserve evidence to S3 Object Lock, PB7 notify CISO, DPO and branch head.
- **CERT_In_Clock**: The 6-hour countdown that starts when the incident is detected.
- **DPDP_Readiness_Clock**: The 72-hour countdown for DPDP-aligned readiness that starts when the incident is detected.
- **Draft_Notice**: Either the CERT-In draft or the DPDP breach intimation draft inside Report_JSON.
- **Draft_Banner**: The text "DRAFT, requires DPO review" shown with each Draft_Notice.
- **Token**: A placeholder such as PH_001 that stands for a customer name in AI-generated text.
- **Name_Reveal**: The audited action that replaces Tokens with customer names for one incident.
- **Scenario_Console**: The admin-only panel of buttons that replay demo scenarios.
- **Scenario_ID**: One of S1, S1b, S1c, S1d, S2 or S5.
- **Control_Catalog**: The JSON file of controls with ID, requirement, clause text, source and a Legal or Voluntary tag.
- **Compliance_Page**: The page that lists controls from `/api/controls` with live status.
- **Quality_Page**: The page that shows precision and recall from `/api/quality` with AI triage off and on.
- **Audit_Timeline**: The append-only event list for one incident.
- **CISO_Log**: The list of all alerts and incidents visible to the admin role, including Auto_Resolved alerts.
- **Admin_Role**: The `admin` role, labelled "CISO / SOC lead".
- **Analyst_Role**: The `qa` role, labelled "SOC analyst".
- **Deck_Draft**: The slide deck draft and screenshots produced by the frontend lane.

## Requirements

### Requirement 1: Local setup against the local API [Core]

**User Story:** As a frontend developer, I want to install and run the app against the local API, so that I can build and check each screen with real data.

#### Acceptance Criteria

1. WHEN `npm ci` is run in the repository root, THE PolicyGuard_UI SHALL install all dependencies without modifying `package-lock.json`.
2. WHEN `npm run dev` is run with `VITE_API_BASE_URL` set to the local Backend_API address, THE PolicyGuard_UI SHALL serve the app on port 5173 and send API requests to that address.
3. THE PolicyGuard_UI SHALL document the local `VITE_API_BASE_URL` value in `.env.example`.
4. WHEN `npm run lint` and `npm test` are run after each requirement is implemented, THE PolicyGuard_UI SHALL pass both commands with zero errors.
5. IF Backend_API is unreachable, THEN THE PolicyGuard_UI SHALL show an error message on the affected page that names the failed request.

### Requirement 2: PolicyGuard AI branding [Core]

**User Story:** As a presenter, I want the app to carry the PolicyGuard AI identity, so that the demo shows one product and no AML Copilot leftovers.

#### Acceptance Criteria

1. THE PolicyGuard_UI SHALL show the name "PolicyGuard AI" in the browser tab title (`index.html`), the top bar (`TopNav.tsx`) and the login page (`LoginPage.tsx`).
2. THE PolicyGuard_UI SHALL contain no user-facing text that reads "AML", "SAR", "NEU", "transaction" or "money laundering" on any visible page.
3. THE PolicyGuard_UI SHALL use the term "simulated insurer" wherever user-facing or pitch text refers to the insurer that generates the activity.
4. THE PolicyGuard_UI SHALL label the Admin_Role as "CISO / SOC lead" and the Analyst_Role as "SOC analyst" wherever a role name is displayed, while the stored role values remain `admin` and `qa`.
5. THE PolicyGuard_UI SHALL keep the existing colour tokens and layout components (`Card`, `StatCard`, `PageHeader`) in `components/ui.tsx`.

### Requirement 3: Hide features that do not apply [Core]

**User Story:** As a presenter, I want Projects, Import and Signup hidden, so that the demo shows only PolicyGuard features.

#### Acceptance Criteria

1. THE PolicyGuard_UI SHALL omit the Projects, My projects and Import items from the navigation list returned by `itemsFor` in `Sidebar.tsx` for every role.
2. THE PolicyGuard_UI SHALL remove the routes `/import`, `/admin/projects`, `/admin/projects/:projectId`, `/qa/projects`, `/qa/projects/:projectId` and `/signup` from `App.tsx`, so that each of these paths redirects to `/`.
3. THE PolicyGuard_UI SHALL remove the "Create an account" link from `LoginPage.tsx`.
4. THE PolicyGuard_UI SHALL remove the "Recent projects" card from the dashboard and the "Add to project" control from the incidents list.
5. THE PolicyGuard_UI SHALL keep the source files of the hidden features in the repository, so that the change can be reverted by restoring routes and navigation items.
6. WHEN the existing tests that reference hidden features are run, THE PolicyGuard_UI SHALL pass them or have them updated in the same change.

### Requirement 4: Signal labels and status labels [Core]

**User Story:** As a SOC analyst, I want readable names for detector signals and statuses, so that I understand why an alert fired without reading codes.

#### Acceptance Criteria

1. THE Signal_Label_Map SHALL map each Signal code to its label: A1 "Out-of-portfolio access", A2 "Volume spike", A3 "Bulk export", A4 "Unusual context", A5 "Sensitive-tier focus", I1 "Inactive identity", I3 "Access while on leave", P1 "Unassigned claim access", P2 "Enumeration", P3 "New origin".
2. WHEN a Signal code is not in the Signal_Label_Map, THE Signal_Label_Map SHALL return the code unchanged.
3. THE PolicyGuard_UI SHALL display the label with the code, for example "A1 Out-of-portfolio access", wherever a Signal is shown.
4. THE PolicyGuard_UI SHALL add the status `auto_resolved` to `STATUS_LABEL`, `STATUS_TONE` and `STATUS_HINT` in `components/ui.tsx` with the label "Auto-resolved".
5. THE PolicyGuard_UI SHALL add `auto_resolved` to the status filter list in the incidents list and use the shared status label map in that list instead of a duplicate map.
6. THE PolicyGuard_UI SHALL replace the AML rule list (R1 to R7) in `AlertQueue.tsx` with the Signal codes from the Signal_Label_Map.

### Requirement 5: Incidents list and alert queue [Core]

**User Story:** As a CISO, I want one list of incidents and one list of alerts with scores from 0 to 100, so that I see what needs a decision and what the AI already closed.

#### Acceptance Criteria

1. THE PolicyGuard_UI SHALL rename "Cases" to "Incidents" and "My cases" to "My incidents" in the navigation, page titles, breadcrumbs and empty-state messages.
2. THE PolicyGuard_UI SHALL display each risk score as a whole number from 0 to 100, replacing the two-decimal display.
3. THE PolicyGuard_UI SHALL replace the 0.6 triage threshold in `AlertQueue.tsx` with a threshold of 40 on the 0 to 100 scale.
4. WHEN the alert queue is shown with the default filter, THE PolicyGuard_UI SHALL list alerts with a score of 40 or more, including Auto_Resolved alerts.
5. WHERE the "All alerts" filter is chosen, THE PolicyGuard_UI SHALL also list the alerts that were logged only because their score is below 40.
6. THE PolicyGuard_UI SHALL show Auto_Resolved alerts in the CISO_Log with the status "Auto-resolved" and never remove or hide them.
7. WHEN an Auto_Resolved alert is opened, THE PolicyGuard_UI SHALL show the Justification_Panel with the reasons for auto-resolution.
8. THE PolicyGuard_UI SHALL show each Signal of an alert as a labelled badge in the Signals column.
9. THE PolicyGuard_UI SHALL remove the "Build cases" button and the amount column from the alert queue and incidents list.

### Requirement 6: Incident report view [Core]

**User Story:** As a SOC analyst, I want the incident report as readable sections, so that I can judge the evidence before approving a response.

#### Acceptance Criteria

1. THE PolicyGuard_UI SHALL replace `SarView.tsx` with `IncidentReportView.tsx` and update `CaseDetail.tsx` to use the new component.
2. WHEN Report_JSON is loaded, THE Incident_Report_View SHALL show the summary, the scenario label, the MITRE ATT&CK technique IDs, the list of cited events, the Justification_Panel, the list of controls failed, the CERT_In_Clock, the DPDP_Readiness_Clock and both Draft_Notices.
3. THE Incident_Report_View SHALL display the scenario as one of `malicious_insider`, `compromised_account`, `compromised_partner`, `negligent` or `benign_exception`, each with a readable label.
4. WHEN a cited event is clicked, THE Incident_Report_View SHALL scroll to or highlight the matching event in the Audit_Timeline or the graph.
5. THE Incident_Report_View SHALL show a "Raw JSON (for audit)" disclosure containing the Report_JSON, collapsed by default.
6. IF Report_JSON is missing a section, THEN THE Incident_Report_View SHALL show "Not available" for that section and render the remaining sections.
7. THE PolicyGuard_UI SHALL parse Report_JSON with a zod schema built from Bhavya's sample REPORT JSON.
8. FOR ALL valid Report_JSON objects, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property).
9. IF Report_JSON fails schema parsing, THEN THE Incident_Report_View SHALL show the error message and the raw JSON disclosure.

### Requirement 7: Justification panel [Core]

**User Story:** As a CISO, I want to see the AI justification result for every alert and incident, so that I can trust or challenge an auto-resolution.

#### Acceptance Criteria

1. THE Justification_Panel SHALL show the Verdict (`justified`, `unjustified` or `inconclusive`), the supporting records, the missing evidence and the reasoning text.
2. WHERE the incident has a risk score of 60 or more, THE Justification_Panel SHALL show the result and the text "Shown for the report only. This result does not close the incident."
3. WHEN the status of the alert is `auto_resolved`, THE Justification_Panel SHALL list the reasons that the proof passed.
4. WHEN the Verdict is `unjustified` and the alert score is 40 to 59, THE Justification_Panel SHALL show that the alert was promoted to an incident.
5. THE PolicyGuard_UI SHALL show no control that closes an incident with a score of 60 or more based on the Verdict.
6. THE Justification_Panel SHALL show an empty-state message "No justification was requested" WHEN Report_JSON has no justification section.

### Requirement 8: Decision form with playbooks [Core]

**User Story:** As a SOC analyst, I want to choose playbooks and confirm with a reason, so that the response runs only after a human approves.

#### Acceptance Criteria

1. THE Decision_Form SHALL replace the typology checkboxes of `DecisionForm.tsx` with one checkbox for each Playbook: PB1 "Suspend agent", PB2 "Disable partner key", PB6 "Preserve evidence (S3 Object Lock)" and PB7 "Notify CISO, DPO and branch head".
2. WHEN the Decision_Form opens, THE Decision_Form SHALL tick the playbooks that Report_JSON lists as recommended and leave all others unticked.
3. THE Decision_Form SHALL accept a reason of 20 or more characters after trimming whitespace and show the character count.
4. THE Decision_Form SHALL enable the submit button only WHEN at least one playbook is ticked, the reason has 20 or more characters and the "I reviewed the evidence" checkbox is ticked.
5. THE Decision_Form SHALL leave the "I reviewed the evidence" checkbox unticked on every load and never tick the checkbox by code.
6. WHEN the analyst submits, THE Decision_Form SHALL send the ticked playbook IDs, the reason and the reviewed flag to the decision endpoint of Backend_API.
7. WHEN Backend_API accepts the decision, THE PolicyGuard_UI SHALL refresh the incident and show the outcome of each playbook.
8. IF Backend_API rejects the decision, THEN THE Decision_Form SHALL show the error message returned by Backend_API and keep the entered values.
9. WHILE the decision request is pending, THE Decision_Form SHALL disable the submit button to prevent double submission.
10. THE Decision_Form SHALL show only WHEN the incident status is `awaiting_review`.

### Requirement 9: Regulatory clocks and draft notices [Core]

**User Story:** As a DPO, I want to see how much time is left on each notification clock and read the drafts, so that I can prepare notices on time.

#### Acceptance Criteria

1. THE Incident_Report_View SHALL show the CERT_In_Clock as the time remaining out of 6 hours and the DPDP_Readiness_Clock as the time remaining out of 72 hours, each computed from the detection timestamp in Report_JSON.
2. WHILE the time remaining is positive, THE Incident_Report_View SHALL update the displayed countdown at least once every 60 seconds.
3. WHEN the time remaining reaches zero, THE Incident_Report_View SHALL show "Overdue" with the elapsed time past the deadline.
4. THE Incident_Report_View SHALL compute both clocks from the detection timestamp and never from the time an action runs.
5. THE Incident_Report_View SHALL label the 72-hour clock "DPDP-aligned readiness (72 h)" and SHALL describe DPDP status only with the word "readiness".
6. THE Incident_Report_View SHALL show the Draft_Banner "DRAFT, requires DPO review" directly above each Draft_Notice, and the banner SHALL remain visible while the draft is scrolled.
7. IF the detection timestamp is missing from Report_JSON, THEN THE Incident_Report_View SHALL show "Clock unavailable" and no countdown.

### Requirement 10: Audited name reveal [Core]

**User Story:** As a DPO, I want customer names hidden behind tokens until I request them with an audit record, so that name access is controlled and traceable.

#### Acceptance Criteria

1. THE Incident_Report_View SHALL display Tokens (for example PH_001) in all AI-written text by default.
2. WHEN the user activates the "Reveal names" control and confirms, THE PolicyGuard_UI SHALL request the Token-to-name map from Backend_API, which records the reveal in the Audit_Timeline.
3. WHEN the map is returned, THE Incident_Report_View SHALL replace each `PH_` followed by three digits with the matching name and keep unmatched Tokens unchanged.
4. WHEN the user navigates away from the incident, THE PolicyGuard_UI SHALL discard the revealed map from memory.
5. IF Backend_API denies the reveal, THEN THE PolicyGuard_UI SHALL show the denial message and keep Tokens displayed.
6. THE PolicyGuard_UI SHALL replace the `PARTY_\d{3}` pattern in the existing code with the `PH_\d{3}` pattern.
7. FOR ALL text and token maps, replacing Tokens with names never alters text that is not a Token.

### Requirement 11: Dashboard cards and scenario console [Core]

**User Story:** As a CISO, I want the dashboard to show the clocks, controls and exposure, and I want to replay demo scenarios, so that the live demo runs from one page.

#### Acceptance Criteria

1. THE PolicyGuard_UI SHALL show three cards on the dashboard: "CERT-In clocks running", "Controls passing" and "Records at risk", with values from `/api/dashboard`.
2. THE PolicyGuard_UI SHALL remove the AML dashboard cards and charts that depend on transactions, rules and projects.
3. THE Scenario_Console SHALL show one button for each of S1, S1b, S1c, S1d, S2 and S5, plus a "Reset" button, to the Admin_Role only.
4. WHEN a scenario button is clicked, THE Scenario_Console SHALL send a POST request to `/api/replay/{scenario}` with the Scenario_ID.
5. WHEN the Reset button is clicked, THE Scenario_Console SHALL ask for confirmation, then send a POST request to `/api/replay/reset`.
6. WHILE a replay request is pending, THE Scenario_Console SHALL disable all its buttons.
7. WHEN a replay request succeeds, THE Scenario_Console SHALL refresh the dashboard, alert and incident queries and show a success message.
8. IF a replay request fails, THEN THE Scenario_Console SHALL show the error message and re-enable the buttons.
9. WHERE the role is Analyst_Role, THE PolicyGuard_UI SHALL hide the Scenario_Console.
10. WHEN a scenario produces a new incident, THE PolicyGuard_UI SHALL show the new incident in the incident list within 5 seconds, using the existing live update and query refresh behaviour.

### Requirement 12: Incident graph [Core]

**User Story:** As a SOC analyst, I want a graph of the actor, the policyholders touched and the export file, so that I see the blast radius at a glance.

#### Acceptance Criteria

1. THE PolicyGuard_UI SHALL render the graph with three node types: the actor, the policyholders and the export file, each with a different label style.
2. THE PolicyGuard_UI SHALL label each edge with the record count and the sensitivity tier, for example "1,840 · T1".
3. THE PolicyGuard_UI SHALL colour edges of tier T1 differently from other tiers, replacing the `laundering` edge flag in `GraphView.tsx`.
4. THE PolicyGuard_UI SHALL rename the "Transaction graph" card to "Access graph" and keep the Recenter button.
5. IF the graph has no elements, THEN THE PolicyGuard_UI SHALL show "No graph for this incident."
6. THE Backend_API graph endpoint `/api/cases/{id}/graph` SHALL return actor, policyholder and export-file nodes and edges with `count` and `tier` fields. This is a small backend edit that may be handed to Raghav.
7. THE Backend_API dashboard service (`app/services/dashboard.py`) SHALL return the number of running CERT-In clocks, the number of passing controls and the number of records at risk. This is a small backend edit that may be handed to Raghav.

### Requirement 13: Audit timeline [Core]

**User Story:** As a CISO, I want a tamper-proof append-only timeline for each incident, so that every detection, decision and reveal is traceable.

#### Acceptance Criteria

1. THE Audit_Timeline SHALL list the events of the incident in the order they were recorded, each with the timestamp, the event node and the event kind.
2. THE Audit_Timeline SHALL show events for detection, justification, investigation, name reveal, decision and each playbook outcome.
3. THE PolicyGuard_UI SHALL provide no control to edit or delete an event.
4. THE Audit_Timeline SHALL describe itself as "Append-only audit trail".
5. WHILE the incident status is `open`, THE Audit_Timeline SHALL refresh at least every 2 seconds.
6. WHERE Backend_API returns an integrity indicator for the audit chain, THE Audit_Timeline SHALL show "Verified" or "Verification failed" accordingly. [Stretch]
7. THE Audit_Timeline SHALL replace the account filter with an event-kind filter.

### Requirement 14: Control catalog and compliance page [Core]

**User Story:** As a CISO, I want a table of controls with their source and live status, so that I can see what the platform covers and which parts are legally required.

#### Acceptance Criteria

1. THE Control_Catalog SHALL be a JSON file with one entry for each control containing the ID, requirement, clause text, source document and a tag with the value `Legal` or `Voluntary`.
2. THE Control_Catalog SHALL tag a control `Legal` only WHEN the source document is a statute, regulation or directive, and `Voluntary` for standards and frameworks.
3. THE Control_Catalog SHALL cover at least the CERT-In 6-hour reporting directive, the DPDP breach notification obligations, the IRDAI 2026 requirement that incidents reach the CISO, and the platform's access-control and audit-trail controls.
4. THE Control_Catalog SHALL state in a "readiness" field that the DPDP breach rule takes effect on 13 May 2027.
5. THE Compliance_Page SHALL show a table from `/api/controls` with the columns ID, Requirement, Source, Legal/Voluntary and Live status.
6. THE Compliance_Page SHALL display a Legal control with a different badge from a Voluntary control.
7. THE Compliance_Page SHALL show the live status of each control as `passing`, `failing` or `unknown`.
8. WHEN a control entry has clause text, THE Compliance_Page SHALL show the clause text in an expandable row.
9. IF `/api/controls` fails or returns an empty list, THEN THE Compliance_Page SHALL show an error or empty-state message.
10. THE PolicyGuard_UI SHALL add the Compliance page to the navigation for the Admin_Role and the Analyst_Role.
11. THE Compliance_Page SHALL describe DPDP status with the phrase "DPDP-aligned readiness".

### Requirement 15: Quality page [Stretch]

**User Story:** As a CISO, I want to see precision and recall with AI triage off and on, so that I can judge whether the AI triage helps.

#### Acceptance Criteria

1. THE Quality_Page SHALL show precision and recall from `/api/quality` for AI triage off and for AI triage on, side by side.
2. THE Quality_Page SHALL display each metric as a percentage with one decimal place.
3. THE Quality_Page SHALL show the difference between triage on and triage off for each metric.
4. WHERE the response includes counts (true positives, false positives, false negatives), THE Quality_Page SHALL show the counts.
5. IF `/api/quality` fails, THEN THE Quality_Page SHALL show an error message and no numbers.
6. THE PolicyGuard_UI SHALL add the Quality page to the navigation for the Admin_Role.
7. THE PolicyGuard_UI SHALL reuse the existing Observability navigation slot for the Quality page.

### Requirement 16: Screenshots and deck draft [Core]

**User Story:** As a presenter, I want screenshots and a draft deck, so that the pitch can be reviewed before the demo.

#### Acceptance Criteria

1. THE Deck_Draft SHALL include one screenshot each of the dashboard, the alert queue, the incident report for AG-1147 at score 89, the decision form, the Compliance_Page and the Quality_Page.
2. THE Deck_Draft SHALL include a provenance slide stating that the project reuses the team's own AML investigation copilot engine, and that everything insurance-specific was built during the event.
3. THE Deck_Draft SHALL use the term "simulated insurer" for the insurer that generates the activity.
4. THE Deck_Draft SHALL use the term "DPDP-aligned readiness" for the 72-hour clock.
5. THE Deck_Draft SHALL state that both notice drafts are marked "DRAFT, requires DPO review".
6. THE Deck_Draft SHALL show the routing of scores (below 40 log only, 40 to 59 AI justification, 60 or more incident).
7. THE Deck_Draft SHALL be saved in the repository under a documented folder so that team members can open it.

### Requirement 17: Live demo acceptance [Core]

**User Story:** As a presenter, I want the AG-1147 demo to run end to end in the UI, so that judges see the complete flow.

#### Acceptance Criteria

1. WHEN the AG-1147 scenario is replayed, THE PolicyGuard_UI SHALL show an incident at a score near 65 during browsing, then at 89 with the severity label "Critical" after the export.
2. WHEN the analyst opens the AG-1147 incident, THE Incident_Report_View SHALL show the scenario `malicious_insider`, the Signals listed in Report_JSON (including A1 and A3), the 1,840 records and the 1,200 exported rows.
3. WHEN the analyst ticks PB1 and PB6, enters a reason of 20 or more characters, ticks "I reviewed the evidence" and submits, THE Decision_Form SHALL send the decision and THE PolicyGuard_UI SHALL show the result of each playbook.
4. WHEN a justified colleague-cover alert (for example Anita) is replayed, THE PolicyGuard_UI SHALL show the alert with the status "Auto-resolved" and the reasons for resolution in the CISO_Log.
5. WHEN a self-written ticket alert (for example Dev) is replayed, THE PolicyGuard_UI SHALL show the Verdict `unjustified` and the alert promoted to an incident.
6. WHEN a terminated or suspended login is replayed, THE PolicyGuard_UI SHALL show a score of 60 or more and no auto-resolved status.
