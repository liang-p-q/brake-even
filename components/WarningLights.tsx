// "What could change this": each assumption that flips the lowest 12-month path when nudged ±25%,
// shown as an amber check-engine light. All clear gets a green light. Facts about the estimate only.

import { PATH_LABELS, type Flip, type Inputs } from "@/lib/calc";
import { ASSUMPTION_META, type Assumptions } from "@/lib/defaults";
import { formatAssumption, usd } from "@/lib/format";

function CheckEngine() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 9h10v8H9.5L7 14.5z" />
      <path d="M9 9V6.5h5V9M7.5 6.5h8" />
      <path d="M7 12H4.5M4.5 10v4" />
      <path d="M17 11.5h1.5l1.5-1.5v6l-1.5-1.5H17" />
    </svg>
  );
}

function AllClear() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx={12} cy={12} r={9} />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}

function describe(flip: Flip, inputs: Inputs, a: Assumptions) {
  const change = `${Math.round(Math.abs(flip.factor - 1) * 100)}% ${flip.factor > 1 ? "higher" : "lower"}`;
  if (flip.key === "typicalPrice") {
    const t = inputs.typicalPrice ?? { low: 0, high: 0 };
    return {
      name: "Typical price from the price check",
      change,
      values: `${usd(t.low * flip.factor)}–${usd(t.high * flip.factor)} instead of ${usd(t.low)}–${usd(t.high)}`,
    };
  }
  const meta = ASSUMPTION_META[flip.key];
  const value = a[flip.key];
  return { name: meta.label, change, values: `${formatAssumption(value * flip.factor, meta.unit)} instead of ${formatAssumption(value, meta.unit)}` };
}

export default function WarningLights({ flips, inputs, assumptions }: { flips: Flip[]; inputs: Inputs; assumptions: Assumptions }) {
  if (flips.length === 0) {
    return (
      <div className="flex gap-3">
        <span className="mt-0.5 text-ok">
          <AllClear />
        </span>
        <p className="text-sm">
          <span className="font-semibold">All clear.</span> Nudging any single assumption 25% either way doesn&apos;t change which path has
          the lowest estimated 12-month cost.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {flips.map((flip) => {
        const d = describe(flip, inputs, assumptions);
        return (
          <li key={flip.key} className="flex gap-3">
            <span className="mt-0.5 text-warn drop-shadow-[0_0_6px_var(--warn)]">
              <CheckEngine />
            </span>
            <div>
              <p className="font-semibold">
                {d.name}, {d.change}
              </p>
              <p className="text-sm text-muted">
                {d.values}: {PATH_LABELS[flip.lowestAfter]} would have the lowest 12-month cost instead of {PATH_LABELS[flip.lowestBefore]}.
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
