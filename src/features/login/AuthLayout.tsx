import type { ReactNode } from "react";
import { Wordmark } from "../../app/Sidebar";
import { Icon, type IconName } from "../../components/icons";

const POINTS: [IconName, string][] = [
  ["eye", "Spots agents and partner keys opening customers they should not."],
  ["file", "Writes the incident report, every claim tied to evidence."],
  ["userCheck", "Blocks nothing until a person approves."],
];

/** The page shared by sign-in and sign-up: the brand panel on the left, the form card (children) on the right. */
export default function AuthLayout({ children }: { children: ReactNode }) {
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

      <div className="flex items-center justify-center px-4 py-10">{children}</div>
    </div>
  );
}
