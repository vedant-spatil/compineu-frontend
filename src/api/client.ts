import { clearToken, getToken } from "../auth/session";
import { detailFromBody } from "../lib/detail";

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** One fetch wrapper for the app. A 401 clears the token and sends the user to /login (plan 16.9). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    // No response at all: the backend is down or the network dropped. Status 0 means "unavailable".
    throw new ApiError(0, "network");
  }
  if (res.status === 401) {
    clearToken();
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?next=${next}`);
    throw new ApiError(401, "session expired");
  }
  if (!res.ok) {
    const body = await res.text();
    // The message is the backend's own detail text, not the raw body.
    throw new ApiError(res.status, detailFromBody(body) || res.statusText);
  }
  return (await res.json()) as T;
}
