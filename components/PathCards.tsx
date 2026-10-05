"use client";

// The three paths: side by side on a computer; on a phone, a swipeable row with a tappable summary
// strip above it (the strip also shows which card you're on).

import { useRef, useState } from "react";
import { PATH_LABELS, type KeepPlan, type PathId, type PathResult, type Results } from "@/lib/calc";
import { usd, usdRange, usdShortRange } from "@/lib/format";
import CashGauge from "./CashGauge";
import { labelText, smallCaps } from "./ui";

const SHORT_LABELS: Record<PathId, string> = { repair: "Repair", secondOpinion: "2nd opinion", replace: "Replace" };
const GAP_PX = 12; // matches gap-3 on the swipe row

function horizonLabel(keep: KeepPlan, months: number): string {
  if (keep === "forever") return `if the car lasts another ${months / 12} years`;
  return months < 12 ? `over the ${months} months you plan to keep it` : `over the ${months / 12} year${months === 12 ? "" : "s"} you plan to keep it`;
}

function PathCard({ p, index, cash, keep }: { p: PathResult; index: number; cash: number; keep?: KeepPlan }) {
  return (
    <article className="relative h-full overflow-hidden rounded-2xl border border-line bg-panel p-4 pl-5 shadow-sm sm:p-5 sm:pl-6">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brake" />
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-semibold uppercase tracking-wider">{PATH_LABELS[p.id]}</h3>
        <span className="font-mono text-xs text-muted">PATH {String(index + 1).padStart(2, "0")}</span>
      </header>
      <p className={`mt-3 ${labelText}`}>About 12-month cost</p>
      <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">{usdRange(p.twelveMonthLow, p.twelveMonthHigh)}</p>
      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className={smallCaps}>Upfront cash</span>
          <span className="font-mono text-lg tabular-nums">{usd(p.upfront)}</span>
        </div>
        <CashGauge cash={cash} upfront={p.upfront} />
      </div>
      {p.spreadPerMonth && keep !== undefined && (
        <p className="mt-3 text-sm">
          One-time costs work out to about{" "}
          <span className="font-mono tabular-nums">{usdRange(p.spreadPerMonth.low, p.spreadPerMonth.high)}/mo</span>{" "}
          {horizonLabel(keep, p.spreadPerMonth.months)}.
        </p>
      )}
      {p.notes.map((n) => (
        <p key={n} className="mt-2 text-sm text-muted">
          {n}
        </p>
      ))}
    </article>
  );
}

export default function PathCards({ results, cash, keep }: { results: Results; cash: number; keep?: KeepPlan }) {
  const row = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const paths = Object.values(results);

  const onSwipe = () => {
    const el = row.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    setActive(Math.min(paths.length - 1, Math.round(el.scrollLeft / (first.offsetWidth + GAP_PX))));
  };
  const show = (i: number) => {
    const card = row.current?.children[i] as HTMLElement | undefined;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "nearest", inline: "center" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2 lg:hidden">
        {paths.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => show(i)}
            aria-current={active === i}
            aria-label={`Show ${PATH_LABELS[p.id]}`}
            className={`rounded-lg border px-2 py-2 text-left transition-colors ${active === i ? "border-brake bg-brake/10" : "border-line bg-panel"}`}
          >
            <span className="block font-display text-xs font-semibold uppercase tracking-wider text-muted">{SHORT_LABELS[p.id]}</span>
            <span className="block font-mono text-sm tabular-nums">{usdShortRange(p.twelveMonthLow, p.twelveMonthHigh)}</span>
          </button>
        ))}
      </div>
      <div
        ref={row}
        onScroll={onSwipe}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {paths.map((p, i) => (
          <div key={p.id} className="w-[86%] shrink-0 snap-center lg:w-auto">
            <PathCard p={p} index={i} cash={cash} keep={keep} />
          </div>
        ))}
      </div>
    </div>
  );
}
