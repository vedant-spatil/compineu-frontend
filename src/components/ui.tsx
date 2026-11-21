import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { riskBand, status as statusTerm, type Tone } from "../lib/glossary";
import { Icon, type IconName } from "./icons";

/** Class sets per tone. Soft = tinted background for chips, dot and bar = the solid colour, text = coloured text. */
export const TONES: Record<Tone, { soft: string; dot: string; bar: string; text: string; bubble: string }> = {
  brand: { soft: "bg-brand-50 text-brand-600 ring-brand-100", dot: "bg-brand-500", bar: "bg-brand-500", text: "text-brand-600", bubble: "bg-brand-50 text-brand-600" },
  danger: { soft: "bg-danger-50 text-danger-600 ring-danger-100", dot: "bg-danger-500", bar: "bg-danger-500", text: "text-danger-600", bubble: "bg-danger-50 text-danger-600" },
  ok: { soft: "bg-ok-50 text-ok-700 ring-ok-100", dot: "bg-ok-500", bar: "bg-ok-500", text: "text-ok-700", bubble: "bg-ok-50 text-ok-700" },
  warn: { soft: "bg-warn-50 text-warn-700 ring-warn-100", dot: "bg-warn-500", bar: "bg-warn-500", text: "text-warn-700", bubble: "bg-warn-50 text-warn-700" },
  info: { soft: "bg-info-50 text-info-600 ring-info-100", dot: "bg-info-500", bar: "bg-info-500", text: "text-info-600", bubble: "bg-info-50 text-info-600" },
  neutral: { soft: "bg-page text-ink-600 ring-line", dot: "bg-ink-400", bar: "bg-ink-400", text: "text-ink-600", bubble: "bg-page text-ink-600" },
};

/** Table header row style, shared by every table. */
export const tableHeadClass = "border-b border-line bg-page/60 text-left text-xs font-medium text-ink-600";

/** Table body row that opens something on click. */
export const rowLinkClass = "group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-page/70";

/**
 * A bordered panel on the surface colour. Optional icon, title, subtitle (one short line) and action.
 * `flush` removes the padding, for tables that should reach the panel edges (the header keeps its own padding).
 */
export function Card({
  id,
  icon,
  title,
  subtitle,
  action,
  children,
  className = "",
  flush = false,
}: {
  id?: string;
  icon?: IconName;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  const pad = flush ? "" : "p-5";
  return (
    <section id={id} className={`overflow-hidden rounded-lg border border-line bg-surface ${pad} ${className}`}>
      {(title || action) && (
        <header className={`mb-4 flex items-start justify-between gap-3 ${flush ? "px-5 pt-5" : ""}`}>
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-900">
                {icon && <Icon name={icon} size={16} className="text-ink-400" />}
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** A small tinted square behind an icon. */
export function IconBubble({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${TONES[tone].bubble}`}>{children}</span>;
}

/** One number with a label, an optional icon and an optional note under it. */
export function StatCard({
  label,
  value,
  trend,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  trend?: { text: string; tone: "up" | "down" | "neutral" };
  icon?: ReactNode;
  tone?: Tone;
}) {
  const trendTone = { up: "text-ok-700", down: "text-danger-600", neutral: "text-ink-400" }[trend?.tone ?? "neutral"];
  return (
    <div className="h-full rounded-lg border border-line bg-surface p-4">
      <div className={`flex items-center gap-2 text-xs font-medium ${TONES[tone].text}`}>
        {icon}
        <span className="text-ink-600">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-ink-900">{value}</div>
      {trend && <p className={`mt-1 text-xs ${trendTone}`}>{trend.text}</p>}
    </div>
  );
}

/** A row of figures in one panel, split by hairlines. Use this instead of a grid of separate cards. */
export function StatStrip({ children, columns = "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" }: { children: ReactNode; columns?: string }) {
  return <div className={`grid gap-px overflow-hidden rounded-lg border border-line bg-line ${columns}`}>{children}</div>;
}

/** One figure in a StatStrip. `attention` marks the figure that needs action with an amber edge. `to` makes it a link. */
export function Stat({
  label,
  value,
  note,
  icon,
  attention = false,
  to,
}: {
  label: string;
  value: number | string;
  note?: string;
  icon: IconName;
  attention?: boolean;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-xs font-medium text-ink-600">
        <Icon name={icon} size={15} className={attention ? "text-warn-500" : "text-ink-400"} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-ink-900">{value}</div>
      {note && <p className={`mt-0.5 text-xs ${attention ? "font-medium text-warn-700" : "text-ink-400"}`}>{note}</p>}
    </>
  );
  const cls = `block h-full bg-surface p-4 ${attention ? "shadow-[inset_3px_0_0_var(--color-warn-400)]" : ""}`;
  return to ? <Link to={to} className={`${cls} transition-colors hover:bg-field`}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** A small tag. `dot` adds a coloured dot in front. `title` is shown on hover. */
export function Pill({
  tone = "neutral",
  children,
  title,
  dot = false,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  title?: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone].soft} ${title ? "cursor-help" : ""} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${TONES[tone].dot}`} />}
      {children}
    </span>
  );
}

// Each status has its own icon, so it reads without relying on colour.
const STATUS_ICONS: Record<string, IconName> = {
  pending: "minus",
  open: "loader",
  awaiting_review: "flag",
  auto_resolved: "check",
  approved: "shield",
  closed: "xCircle",
  closed_low_risk: "xCircle",
  failed: "alert",
  superseded: "archive",
  rejected: "alert",
  error: "alert",
  ok: "check",
  done: "check",
};

/**
 * Status of a case or import in plain words ("Awaiting review", "Resolved automatically"), with an icon. The
 * description shows on hover. The stored values never change. `plain` is still accepted from older callers.
 */
export function StatusBadge({ status }: { status: string; plain?: boolean }) {
  const s = statusTerm(status);
  return (
    <span
      title={s.description || undefined}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] font-medium ${TONES[s.tone].text} ${s.description ? "cursor-help" : ""}`}
    >
      <Icon name={STATUS_ICONS[status] ?? "info"} size={14} />
      {s.label}
    </span>
  );
}

/**
 * The risk score (0 to 100) with its band (Critical, High, Medium, Low) and a bar. `compact` is for table cells.
 * Bands follow the backend: critical 80, high 60, medium 40.
 */
export function RiskMeter({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const band = riskBand(score);
  const width = score === null ? 0 : Math.max(4, Math.min(100, score));
  if (compact) {
    return (
      <div className="flex min-w-32 items-center gap-2.5" title={`Risk ${score ?? "unknown"} out of 100: ${band.label}`}>
        <span className="id w-7 text-right font-medium text-ink-900">{score ?? "-"}</span>
        <div className="h-1.5 w-14 overflow-hidden rounded-sm bg-line">
          <div className={`h-full ${TONES[band.tone].bar}`} style={{ width: `${width}%` }} />
        </div>
        <span className={`text-xs font-medium ${TONES[band.tone].text}`}>{band.label}</span>
      </div>
    );
  }
  return (
    <div className="min-w-44">
      <div className="flex items-baseline justify-end gap-1">
        <span className={`text-4xl font-semibold tracking-tight tabular-nums ${TONES[band.tone].text}`}>{score ?? "-"}</span>
        <span className="text-sm text-ink-400">/ 100</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-line">
        <div className={`h-full ${TONES[band.tone].bar}`} style={{ width: `${width}%` }} />
      </div>
      <div className={`mt-1.5 text-right text-xs font-semibold ${TONES[band.tone].text}`}>{band.label} risk</div>
    </div>
  );
}

/** A small "?" that explains a term on hover or focus. */
export function Hint({ text }: { text: string }) {
  return (
    <span tabIndex={0} role="img" aria-label={text} title={text} className="ml-1 inline-flex cursor-help align-middle text-ink-400">
      <Icon name="help" size={14} />
    </span>
  );
}

/** Small rule badge, for example R3 fan in. */
export function RuleBadge({ rule }: { rule: string }) {
  return <span className="mr-3 text-xs font-medium text-brand-600">{rule}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-2xl text-sm text-ink-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Icon name="inbox" size={20} className="text-ink-200" />
      <p className="max-w-sm text-sm text-ink-400">{text}</p>
    </div>
  );
}

export function ErrorState({ text }: { text: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600 ring-1 ring-inset ring-danger-100">
      <Icon name="alert" size={16} className="mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

/** Numbered steps, for example upload, map columns, sync. Steps before `current` are done. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-3 text-sm">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                done ? "bg-ok-600 text-white" : active ? "bg-brand-700 text-white" : "bg-line text-ink-600"
              }`}
            >
              {i + 1}
            </span>
            <span className={active ? "font-medium text-ink-900" : "text-ink-600"}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Primary (navy) and secondary (outlined) buttons, with a disabled style. Focus uses the global amber outline. */
export function buttonClass(kind: "primary" | "secondary" = "primary"): string {
  return kind === "primary"
    ? "inline-flex items-center justify-center gap-2 rounded-md bg-brand-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-ink-200"
    : "inline-flex items-center justify-center gap-2 rounded-md bg-surface px-3.5 py-2 text-sm font-medium text-ink-900 ring-1 ring-inset ring-line transition-colors hover:bg-field disabled:cursor-not-allowed disabled:opacity-50";
}

/** Shared style for selects and text inputs. */
export const fieldClass =
  "rounded-md bg-field px-3 py-2 text-sm text-ink-900 ring-1 ring-inset ring-ink-200 outline-none transition placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500";

/** A pulsing block shown while a query loads. Never a blank page and never stale zeros. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-line ${className}`} />;
}

/** A card-sized loading placeholder with an accessible label. */
export function LoadingBlock({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={i === 0 ? "h-5 w-1/3" : "h-4 w-full"} />)}
    </div>
  );
}

// ---- Pagination --------------------------------------------------------------------------------------------------

/** The page numbers to show around `current` (0-based), with "gap" where pages are skipped: 1 … 4 5 6 … 20. */
export function pageWindow(current: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
  const pages = new Set([0, totalPages - 1, current - 1, current, current + 1]);
  if (current <= 2) [1, 2, 3].forEach((p) => pages.add(p));
  if (current >= totalPages - 3) [totalPages - 2, totalPages - 3, totalPages - 4].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 0 && p < totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export const PAGE_SIZES = [10, 25, 50];

/**
 * Footer for a paged table: which rows are shown out of how many, rows per page, and page buttons.
 * `page` is 0-based. Renders nothing for an empty list.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  noun = "rows",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages - 1);
  const from = current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);
  const step = "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-ink-200";
  const idle = `${step} text-ink-600 hover:bg-page enabled:hover:text-ink-900`;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-5 py-2.5 text-sm text-ink-600">
      <p className="tabular-nums" aria-live="polite">
        <span className="font-medium text-ink-900">{from.toLocaleString()}–{to.toLocaleString()}</span> of {total.toLocaleString()} {noun}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {onPageSize && (
          <label className="flex items-center gap-2 text-xs">
            Per page
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              className="rounded-md bg-field py-1 pl-2 pr-1 text-sm text-ink-900 ring-1 ring-inset ring-ink-200 outline-none focus:ring-2 focus:ring-brand-500"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <div className="flex items-center gap-0.5">
          <button type="button" className={idle} disabled={current === 0} onClick={() => onPage(0)} aria-label="First page">
            <Icon name="chevronsLeft" size={16} />
          </button>
          <button type="button" className={idle} disabled={current === 0} onClick={() => onPage(current - 1)} aria-label="Previous page">
            <Icon name="chevronLeft" size={16} />
          </button>
          {pageWindow(current, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-ink-200" aria-hidden="true">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-label={`Page ${p + 1}`}
                aria-current={p === current ? "page" : undefined}
                className={p === current ? `${step} bg-brand-700 font-medium text-white` : idle}
              >
                {p + 1}
              </button>
            ),
          )}
          <button type="button" className={idle} disabled={current >= totalPages - 1} onClick={() => onPage(current + 1)} aria-label="Next page">
            <Icon name="chevronRight" size={16} />
          </button>
          <button type="button" className={idle} disabled={current >= totalPages - 1} onClick={() => onPage(totalPages - 1)} aria-label="Last page">
            <Icon name="chevronsRight" size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
