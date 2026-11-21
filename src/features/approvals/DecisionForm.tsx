import { FormEvent, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Icon } from "../../components/icons";
import { buttonClass, Card, ErrorState, Pill } from "../../components/ui";
import { friendlyError } from "../../lib/errors";
import { canSubmit, defaultPlaybooks, MIN_REASON, PLAYBOOK_IDS, PLAYBOOKS, type Report } from "../../api/report";

/** The analyst approves playbooks or closes the incident as a false positive. */
export default function DecisionForm({ caseId, report }: { caseId: number; report?: Report }) {
  const [action, setAction] = useState<"approve" | "close">("approve");
  const [reason, setReason] = useState("");
  // The recommended playbooks start ticked. The analyst can change them. The review tick is never set by code.
  const [playbooks, setPlaybooks] = useState<string[]>(() => defaultPlaybooks(report));
  const [reviewed, setReviewed] = useState(false);
  const qc = useQueryClient();
  // One decision per incident. The guard is a ref, so a second click in the same tick is refused even before React
  // re-renders. It is released only if the call fails, so the analyst can try again after an error.
  const sent = useRef(false);

  const submit = useMutation({
    mutationFn: () =>
      api(`/api/cases/${caseId}/decision`, {
        method: "POST",
        body: JSON.stringify({ action, reason: reason.trim(), playbooks: action === "approve" ? playbooks : [], reviewed }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", caseId] }),
    onError: () => { sent.current = false; },
  });

  const valid = canSubmit({ action, reason, reviewed, playbooks });
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || sent.current) return;
    sent.current = true;
    submit.mutate();
  }
  const option = (checked: boolean) =>
    `flex cursor-pointer items-start gap-2.5 rounded-md px-3.5 py-3 text-sm ring-1 transition-colors ${
      checked ? "bg-brand-50 text-ink-900 ring-2 ring-inset ring-brand-600" : "bg-field text-ink-900 ring-inset ring-line hover:ring-ink-200"
    }`;
  const recommended = new Set(report?.recommended_playbooks ?? []);
  const len = reason.trim().length;

  return (
    <Card
      id="decision"
      icon="flag"
      title="Your decision"
      subtitle="Nothing changes for the agent or partner until you approve. The decision goes to the audit trail."
      className="scroll-mt-20 xl:col-span-2"
    >
      <form onSubmit={onSubmit} className="space-y-5 text-sm">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-medium text-ink-900">What should happen?</legend>
          <label className={option(action === "approve")}>
            <input type="radio" name="action" className="mt-0.5" checked={action === "approve"} onChange={() => setAction("approve")} />
            <span>
              <span className="font-medium">Take action</span>
              <span className="block text-xs text-ink-600">A real threat. Run the actions below.</span>
            </span>
          </label>
          <label className={option(action === "close")}>
            <input type="radio" name="action" className="mt-0.5" checked={action === "close"} onChange={() => setAction("close")} />
            <span>
              <span className="font-medium">Close as a false alarm</span>
              <span className="block text-xs text-ink-600">The access was fine. Nothing changes.</span>
            </span>
          </label>
        </fieldset>
        {action === "approve" && (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 font-medium text-ink-900">Actions to take</legend>
            {PLAYBOOK_IDS.map((id) => {
              const checked = playbooks.includes(id);
              return (
                <label key={id} className={option(checked)}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={(e) => setPlaybooks(e.target.checked ? [...playbooks, id] : playbooks.filter((x) => x !== id))}
                  />
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Icon name={PLAYBOOKS[id].icon} size={15} className="text-ink-400" />
                      <span className="font-medium">{PLAYBOOKS[id].name}</span>
                      {recommended.has(id) && <Pill tone="ok">Recommended</Pill>}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-600">{PLAYBOOKS[id].detail}</span>
                  </span>
                </label>
              );
            })}
            {playbooks.length === 0 && <span className="text-xs text-warn-600 sm:col-span-2">Choose at least one action to approve.</span>}
          </fieldset>
        )}
        <label className="block">
          <span className="mb-1 block font-medium text-ink-900">Reason (at least {MIN_REASON} characters)</span>
          <textarea
            className="w-full rounded-lg bg-field p-3 text-ink-900 ring-1 ring-inset ring-ink-200 outline-none transition focus:ring-2 focus:ring-brand-500"
            rows={3}
            placeholder="What convinced you? For example: no ticket or leave covers the export."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <span className={`mt-1 block text-xs tabular-nums ${len >= MIN_REASON ? "text-ok-600" : "text-ink-400"}`}>{len} / {MIN_REASON}</span>
        </label>
        <label className="flex items-center gap-2 text-ink-900">
          <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
          I reviewed the evidence
        </label>
        <button disabled={!valid || submit.isPending || submit.isSuccess} className={buttonClass()}>
          <Icon name={action === "approve" ? "check" : "xCircle"} size={16} />
          {submit.isPending ? "Sending…" : submit.isSuccess ? "Decision recorded" : action === "approve" ? "Approve and take action" : "Close incident"}
        </button>
        {submit.isError && <ErrorState text={friendlyError(submit.error).text} />}
      </form>
    </Card>
  );
}
