import { SIGNALS, signal } from "./glossary";

/** PolicyGuard signal codes and their plain display names. The descriptions are in glossary.ts. */
export const SIGNAL_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SIGNALS).map(([code, term]) => [code, term.label]),
);

/**
 * A signal or rule name for display. A known PolicyGuard code ("A1", or "A1_out_of_portfolio") shows its plain name
 * without the code; anything else has its underscores replaced by spaces, so "R3_fan_in" shows as "R3 fan in".
 */
export function ruleLabel(rule: string): string {
  const s = signal(rule);
  return s.description ? s.label : rule.replace(/_/g, " ");
}
