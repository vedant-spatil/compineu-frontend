import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, ApiError } from "../../api/client";
import { setToken } from "../../auth/session";
import { TokenSchema } from "../../api/schemas";
import { Wordmark } from "../../app/Sidebar";
import { Icon, type IconName } from "../../components/icons";
import { buttonClass, ErrorState, fieldClass } from "../../components/ui";

const POINTS: [IconName, string][] = [
  ["eye", "Spots agents and partner keys opening customers they should not."],
  ["file", "Writes the incident report, every claim tied to evidence."],
  ["userCheck", "Blocks nothing until a person approves."],
];

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
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-brand-900 p-12 text-white lg:flex">
        <Wordmark className="text-xl" />
        <div className="max-w-md">
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight">Know who is reading your policyholder data.</h2>
          <ul className="mt-8 space-y-4 text-sm text-brand-100">
            {POINTS.map(([icon, text]) => (
              <li key={text} className="flex gap-3">
                <Icon name={icon} size={18} className="mt-0.5 text-warn-400" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-100/70">Detection is code. The AI gives judgment. Humans decide.</p>
      </aside>

      <div className="flex items-center justify-center px-4 py-10">
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
        </form>
      </div>
    </div>
  );
}
