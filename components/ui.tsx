// Shared building blocks for the spec-sheet look: numbered section headings, cards, fields, chips.

import type { ReactNode } from "react";

export const labelText = "font-display text-sm font-semibold uppercase tracking-wider text-muted";
export const smallCaps = "font-display text-xs font-semibold uppercase tracking-wider text-muted";
export const inputBase =
  "w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-lg text-ink placeholder:text-muted/50 focus:border-brake focus:outline-none focus:ring-2 focus:ring-brake/25";
const chipBase =
  "flex cursor-pointer select-none items-center justify-center rounded-lg border border-line bg-panel-2 px-2 py-2.5 text-center font-display text-base font-semibold uppercase tracking-wider transition-colors hover:border-muted has-[:checked]:border-brake has-[:checked]:bg-brake has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brake/40";

export function SectionHeading({ n, id, children }: { n: string; id: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs font-semibold text-brake">{n}</span>
      <span aria-hidden="true" className="h-0.5 w-5 bg-brake" />
      <h2 id={id} className="font-display text-xl font-semibold uppercase tracking-wider">
        {children}
      </h2>
    </div>
  );
}

export function Card({ n, title, aside, children }: { n: string; title: string; aside?: ReactNode; children: ReactNode }) {
  const id = `section-${n}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading n={n} id={id}>
          {title}
        </SectionHeading>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelText}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function MoneyInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-lg text-muted">
        $
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className={`${inputBase} pl-7 font-mono tabular-nums`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function Choices<T extends string | number>(props: {
  name: string;
  labelledBy: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={props.labelledBy} className="grid grid-cols-3 gap-2">
      {props.options.map((o) => (
        <label key={String(o.value)} className={chipBase}>
          <input type="radio" name={props.name} className="sr-only" checked={props.value === o.value} onChange={() => props.onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}
