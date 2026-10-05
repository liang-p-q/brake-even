// "Tune the numbers": every default assumption on a slider, with its source, like adjusting a tune.
// Only changed values are saved, so improved defaults still reach everyone else.

import { ASSUMPTION_META, type AssumptionKey, type Assumptions } from "@/lib/defaults";
import { formatAssumption } from "@/lib/format";
import { SectionHeading, smallCaps } from "./ui";

const GROUPS: { title: string; keys: AssumptionKey[] }[] = [
  { title: "Second opinion", keys: ["diagFee", "indieSavingsPct", "towCost", "daysWithoutCar", "dailyTransportCost"] },
  { title: "Keeping this car", keys: ["followOnRepairsPerYear", "foreverYears"] },
  { title: "Replacing it", keys: ["replacementPrice", "taxFeesPct", "downPaymentPct", "apr", "termMonths", "replacementRepairsPerYear"] },
];

function sourceText(source: string): string {
  if (!source.startsWith("PLACEHOLDER")) return `Source: ${source}`;
  const rest = source.replace(/^PLACEHOLDER:?\s*/, "");
  return rest ? `Placeholder value · ${rest}` : "Placeholder value · source to come";
}

type Props = {
  n: string;
  assumptions: Assumptions;
  overrides: Partial<Assumptions>;
  notes: Partial<Record<AssumptionKey, string>>; // e.g. why a value isn't in play right now
  onChange: (key: AssumptionKey, value: number | undefined) => void; // undefined = back to default
  onResetAll: () => void;
};

export default function TuneNumbers({ n, assumptions, overrides, notes, onChange, onResetAll }: Props) {
  const changed = Object.keys(overrides).length;
  return (
    <details className="group rounded-2xl border border-line bg-panel shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <SectionHeading n={n} id="tune-heading">
          Tune the numbers
        </SectionHeading>
        <span className="flex shrink-0 items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted">
          {changed ? <span className="text-brake">{changed} changed</span> : "Defaults"}
          <svg viewBox="0 0 24 24" className="size-4 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-line p-4 sm:p-5">
        <p className="text-sm text-muted">Every number behind the estimates. Slide them to match your situation, and the cards update as you go.</p>
        <div className="mt-5 grid gap-8 lg:grid-cols-3">
          {GROUPS.map((group) => (
            <fieldset key={group.title} className="flex flex-col gap-5">
              <legend className={`${smallCaps} mb-3`}>{group.title}</legend>
              {group.keys.map((key) => {
                const meta = ASSUMPTION_META[key];
                const isChanged = overrides[key] !== undefined;
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor={`tune-${key}`} className="text-sm font-medium">
                        {meta.label}
                      </label>
                      <output htmlFor={`tune-${key}`} className={`font-mono text-sm tabular-nums ${isChanged ? "text-brake" : ""}`}>
                        {formatAssumption(assumptions[key], meta.unit)}
                      </output>
                    </div>
                    <input
                      id={`tune-${key}`}
                      type="range"
                      min={meta.min}
                      max={meta.max}
                      step={meta.step}
                      value={assumptions[key]}
                      onChange={(e) => onChange(key, Number(e.target.value))}
                      className="w-full accent-brake"
                    />
                    <div className="flex items-start justify-between gap-3 text-[11px] leading-snug text-muted">
                      <span>{notes[key] ?? sourceText(meta.source)}</span>
                      {isChanged && (
                        <button type="button" onClick={() => onChange(key, undefined)} className="shrink-0 underline underline-offset-2 hover:text-ink">
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </fieldset>
          ))}
        </div>
        {changed > 0 && (
          <button
            type="button"
            onClick={onResetAll}
            className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-muted underline underline-offset-4 hover:text-ink"
          >
            Reset all to defaults
          </button>
        )}
      </div>
    </details>
  );
}
