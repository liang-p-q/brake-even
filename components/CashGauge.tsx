// Fuel gauge: how much of a path's upfront cash your cash covers, E to F, with an amber low-fuel
// light when you'd be short. Describes the numbers; it doesn't judge them.

import { cashCoverage } from "@/lib/calc";
import { usd } from "@/lib/format";
import { smallCaps } from "./ui";

const SEGMENTS = 10;

function FuelPump() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M3 21h12M4 10h10" />
      <path d="M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3" />
    </svg>
  );
}

export default function CashGauge({ cash, upfront }: { cash: number; upfront: number }) {
  const coverage = cashCoverage(cash, upfront);
  const lit = Math.round(coverage * SEGMENTS);
  const covered = cash >= upfront;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={smallCaps}>Your cash</span>
        {!covered && (
          <span className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-warn">
            <FuelPump /> Low
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label={`Your cash covers ${Math.round(coverage * 100)}% of the upfront cost`}
        className="mt-1.5 flex items-center gap-2"
      >
        <span className="font-mono text-xs text-muted">E</span>
        <div className="grid flex-1 grid-cols-10 gap-0.5">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span key={i} className={`h-2.5 rounded-[2px] ${i < lit ? (covered ? "bg-ok" : "bg-warn") : "bg-line"}`} />
          ))}
        </div>
        <span className="font-mono text-xs text-muted">F</span>
      </div>
      <p className="mt-1.5 text-sm">{covered ? `Covered, ${usd(cash - upfront)} left over` : `Short by ${usd(upfront - cash)}`}</p>
    </div>
  );
}
