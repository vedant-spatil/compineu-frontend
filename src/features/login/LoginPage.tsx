import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, ApiError } from "../../api/client";
import { setToken } from "../../auth/session";
import { TokenSchema } from "../../api/schemas";
import { Wordmark } from "../../app/Sidebar";
import { Icon } from "../../components/icons";
import { buttonClass, ErrorState, fieldClass } from "../../components/ui";
import AuthLayout from "./AuthLayout";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new ApiError(res.status, "Invalid email or password");
      const tok = TokenSchema.parse(await res.json());
      setToken(tok.access_token);
      navigate(params.get("next") ?? "/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
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
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-600">Use your work email and password.</p>
        </div>
        <label className="block text-sm font-medium text-ink-900">
          Email
          <input className={field} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm font-medium text-ink-900">
          Password
          <div className="relative">
            <input
              className={`${field} pr-11`}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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
        {error && <ErrorState text={error} />}
        <button disabled={busy} className={`${buttonClass()} w-full py-2.5`}>
          {busy ? "Signing in…" : "Sign in"}
          {!busy && <Icon name="arrowRight" size={16} />}
        </button>
        <p className="text-center text-sm text-ink-600">
          New here? <Link to="/signup" className="font-medium text-brand-600 hover:underline">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
