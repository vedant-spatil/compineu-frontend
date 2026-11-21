/**
 * What an empty table says. With a filter active the filter is the reason. Otherwise it says why there is nothing and
 * what to do next, for example "No incidents yet. Run a scenario."
 */
export function emptyText(noun: string, filtered: boolean, hint: string): string {
  return filtered ? `No ${noun} match these filters.` : `No ${noun} yet. ${hint}`;
}
