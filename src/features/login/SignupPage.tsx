import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE, ApiError } from "../../api/client";
import { TokenSchema } from "../../api/schemas";
import { setToken } from "../../auth/session";
import { Wordmark } from "../../app/Sidebar";
import { Icon } from "../../components/icons";
import { buttonClass, ErrorState, fieldClass } from "../../components/ui";
import AuthLayout from "./AuthLayout";

export const MIN_PASSWORD = 10;

/** The first problem with a sign-up form, or null when it can be sent. Mirrors the backend rules. */
export function signupError(email: string, password: string, confirm: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for the password.`;
  if (password !== confirm) return "The two passwords do not match.";
  return null;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = signupError(email, password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new ApiError(res.status, body.detail ?? "Could not create the account.");
      }
      setToken(TokenSchema.parse(await res.json()).access_token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  const field = `${fieldClass} mt-1.5 w-full py-2.5`;

  return (
    <AuthLayout>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-lg border border-line bg-surface p-8">
        <div>
          <Wordmark className="mb-6 text-brand-900 lg:hidden" />
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Create an account</h1>
          <p className="mt-1 text-sm text-ink-600">Accounts created here have administrator access.</p>
        </div>
        <label className="block text-sm font-medium text-ink-900">
          Email
          <input className={field} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-ink-900">
          Password (at least {MIN_PASSWORD} characters)
          <div className="relative">
            <input
              className={`${field} pr-11`}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((on) => !on)}
              className="absolute inset-y-0 right-1.5 my-auto mt-[0.6rem] grid h-8 w-8 place-items-center rounded-md text-ink-400 hover:bg-page hover:text-ink-900"
            >
              <Icon name={showPassword ? "lock" : "eye"} size={16} />
            </button>
          </div>
        </label>
        <label className="block text-sm font-medium text-ink-900">
          Confirm password
          <input
            className={field}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && <ErrorState text={error} />}
        <button disabled={busy} className={`${buttonClass()} w-full py-2.5`}>
          {busy ? "Creating…" : "Create account"}
          {!busy && <Icon name="arrowRight" size={16} />}
        </button>
        <p className="text-center text-sm text-ink-600">
          Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
