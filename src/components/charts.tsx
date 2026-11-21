import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "./ui";

// Chart colours. The three series colours (blue, teal, amber) were checked with the palette validator against the card
// surface: lightness band, chroma, colour-blind separation and 3:1 contrast all pass. They are always used in this
// order, and text keeps the ink colours, never a series colour.
const BRAND = "#2f5c99";
const INK = "#14233a";
const MUTED = "#5a687e";
const OK = "#149488";
const WARN = "#c97a06";
const INFO = "#2f5c99";
const GRID = "#c7d1dd";
const PALETTE = [BRAND, OK, WARN];

export type Row = { name: string; value: number };

// One tooltip style for every chart.
const TOOLTIP = {
  contentStyle: { borderRadius: 6, border: `1px solid ${GRID}`, background: "#fafbfd", boxShadow: "0 4px 12px rgb(15 31 51 / 0.12)", fontSize: 12 },
  labelStyle: { color: INK, fontWeight: 600 },
  itemStyle: { color: INK },
  cursor: { fill: "rgb(15 31 51 / 0.05)" },
};
// Legend text in ink, with the coloured swatch beside it carrying the identity.
const legendText = (value: string) => <span style={{ color: INK, fontSize: 12 }}>{value}</span>;

/** Horizontal bars, one per row. Used for alerts by signal and top accounts. Labels can be a few words long. */
export function HorizontalBars({ rows, empty, color = BRAND }: { rows: Row[]; empty: string; color?: string }) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 12, fill: INK }} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP} formatter={(v: number) => [v, "Alerts"]} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertical columns. Used for the score distribution. */
export function Columns({ rows, empty, color = INK }: { rows: Row[]; empty: string; color?: string }) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: MUTED }} />
        <YAxis tick={{ fontSize: 12, fill: MUTED }} width={36} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two series side by side per label, for example cases opened against approvals. */
export function PairedBars({
  rows,
  seriesA,
  seriesB,
  empty,
}: {
  rows: { label: string; a: number; b: number }[];
  seriesA: string;
  seriesB: string;
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: MUTED }} width={36} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...TOOLTIP} />
        <Legend iconType="square" iconSize={10} formatter={legendText} />
        <Bar dataKey="a" name={seriesA} fill={BRAND} radius={[3, 3, 0, 0]} maxBarSize={14} />
        <Bar dataKey="b" name={seriesB} fill={OK} radius={[3, 3, 0, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A line over days. Used for the alert trend. */
export function TrendLine({ rows, label, empty }: { rows: { label: string; value: number }[]; label: string; empty: string }) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: MUTED }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: MUTED }} width={36} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...TOOLTIP} />
        <Line type="monotone" dataKey="value" name={label} stroke={BRAND} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#f2f5f9", strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Donut for a small set of categories, for example approvals against closures. */
export function Donut({ rows, empty }: { rows: Row[]; empty: string }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (total === 0) return <EmptyState text={empty} />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="#f2f5f9" strokeWidth={2}>
          {rows.map((r, i) => (
            <Cell key={r.name} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} />
        <Legend iconType="square" iconSize={10} formatter={legendText} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export const CHART_COLORS = { BRAND, INK, MUTED, OK, WARN, INFO };
