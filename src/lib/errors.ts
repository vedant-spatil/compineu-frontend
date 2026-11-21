import { ApiError } from "../api/client";
export { detailFromBody } from "./detail";

export type FriendlyError = {
  text: string;
  /** True when the backend is down or unreachable. The screen retries on its own and says so. */
  retrying: boolean;
};

/** A short, plain message for a failed call. Never raw JSON. 401 is handled by the API client's redirect. */
export function friendlyError(err: unknown): FriendlyError {
  const status = err instanceof ApiError ? err.status : 0;
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return { text: "Backend unavailable, retrying.", retrying: true };
  }
  if (status === 422) return { text: err instanceof ApiError && err.message ? err.message : "The request was not accepted.", retrying: false };
  if (status === 403) return { text: "You do not have permission to do that.", retrying: false };
  if (status === 404) return { text: "That item was not found.", retrying: false };
  if (status === 409) return { text: "That conflicts with the current state, for example it was already decided. Refresh and try again.", retrying: false };
  if (status === 401) return { text: "Your session expired. Sign in again.", retrying: false };
  return { text: "Something went wrong. Try again.", retrying: false };
}

/** React Query retry rule: retry server and network failures a few times, never a 4xx. */
export function shouldRetry(failureCount: number, err: unknown): boolean {
  const status = err instanceof ApiError ? err.status : 0;
  const transient = status === 0 || status >= 500;
  return transient && failureCount < 3;
}
