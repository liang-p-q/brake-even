"use client";

import { useEffect, useState } from "react";
import { compareQuote } from "@/lib/calc";
import {
  CROSS_CHECK_URL,
  type PriceCheckRequest,
  type PriceCheckResponse,
  type PriceCheckResult,
  type PriceCheckStatus,
} from "@/lib/priceCheck";
import { usd } from "@/lib/format";
import { smallCaps } from "./ui";

/** "2026-11-01" -> "November 1" */
const longDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

type Props = {
  request: Omit<PriceCheckRequest, "zip"> | null; // null until the car and repair are filled in
  zip: string;
  onZipChange: (zip: string) => void;
  quoteTotal: number;
  result: PriceCheckResult | null;
  onResult: (result: PriceCheckResult | null) => void;
};

const POSITION = {
  above: { badge: "Above range", tone: "bg-warn/15 text-warn" },
  within: { badge: "Within range", tone: "bg-ok/15 text-ok" },
  below: { badge: "Below range", tone: "bg-ink/10 text-muted" },
} as const;

function QuoteComparison({ quote, result }: { quote: number; result: PriceCheckResult }) {
  const c = compareQuote(quote, result);
  const pct = Math.round(c.pct * 100);
  const sentence =
    c.position === "within"
      ? `Your quote (${usd(quote)}) is within this range.`
      : c.position === "above"
        ? `Your quote (${usd(quote)}) is ${usd(c.diff)} (${pct}%) above the top of this range.`
        : `Your quote (${usd(quote)}) is ${usd(c.diff)} (${pct}%) below the low end of this range.`;
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${POSITION[c.position].tone}`}>
        {POSITION[c.position].badge}
      </span>
      <p className="text-sm">{sentence}</p>
    </div>
  );
}

function StartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
      <path d="M12 3v8" />
      <path d="M6.3 6.7a8 8 0 1 0 11.4 0" />
    </svg>
  );
}

export default function PriceCheck({ request, zip, onZipChange, quoteTotal, result, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);

  // Find out up front whether this month's AI budget is used up, so nobody waits on a lookup that can't run.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/price-check")
      .then((res) => res.json() as Promise<PriceCheckStatus>)
      .then((status) => {
        if (!cancelled && status.paused) setPausedUntil(status.resumesOn);
      })
      .catch(() => {}); // a lookup reports the pause too
    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/price-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, zip }),
      });
      const data = (await res.json()) as PriceCheckResponse;
      if (data.ok) onResult(data.result);
      else if (data.code === "monthly_limit" && data.resumesOn) setPausedUntil(data.resumesOn);
      else setError(data.error);
    } catch {
      setError("Couldn't reach the price check. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold uppercase tracking-wider">What does this usually cost?</h3>
        <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          AI estimate
        </span>
      </div>

      {result ? (
        <div className="flex flex-col gap-3">
          {result.found ? (
            <>
              <div>
                <p className={smallCaps}>Typical at independent shops</p>
                <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                  {usd(result.low)}–{usd(result.high)}
                </p>
                {result.interpretedAs && <p className="mt-1 text-sm text-muted">For: {result.interpretedAs}</p>}
              </div>
              {quoteTotal > 0 && <QuoteComparison quote={quoteTotal} result={result} />}
              {result.partsHigh > 0 && (
                <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                  <div>
                    <dt className={smallCaps}>Parts</dt>
                    <dd className="font-mono tabular-nums">
                      {usd(result.partsLow)}–{usd(result.partsHigh)}
                    </dd>
                  </div>
                  {result.laborHoursHigh > 0 && (
                    <div>
                      <dt className={smallCaps}>Book labor</dt>
                      <dd className="font-mono tabular-nums">
                        {result.laborHoursLow}–{result.laborHoursHigh} hrs
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </>
          ) : (
            <p>Couldn&apos;t price this repair from the description.</p>
          )}
          {result.notes && <p className="text-sm">{result.notes}</p>}
          <p className="text-xs text-muted">
            AI estimate from general knowledge, not live prices. Cross-check it with{" "}
            <a href={CROSS_CHECK_URL} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-brake underline-offset-2">
              RepairPal&apos;s estimator
            </a>{" "}
            before relying on it.
          </p>
          <button
            type="button"
            className="self-start font-display text-sm font-semibold uppercase tracking-wider text-muted underline underline-offset-4 hover:text-ink"
            onClick={() => onResult(null)}
          >
            Remove this estimate
          </button>
        </div>
      ) : pausedUntil ? (
        <div role="status" className="flex gap-3 rounded-lg border border-warn/50 bg-warn/10 p-3 text-ink">
          <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-warn" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3 2.5 20h19z" />
            <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
          </svg>
          <div>
            <p className="font-semibold">Price checks are paused until {longDate(pausedUntil)}.</p>
            <p className="mt-1 text-sm">
              So many people have used them this month that we&apos;ve reached our monthly limit. Check back on {longDate(pausedUntil)}.
              You can still compare your options below without it.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="zip" className={smallCaps}>
              ZIP code <span className="normal-case tracking-normal">(optional, for local labor rates)</span>
            </label>
            <input
              id="zip"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              className="w-32 rounded-lg border border-line bg-panel px-3 py-2 font-mono text-lg tabular-nums focus:border-brake focus:outline-none focus:ring-2 focus:ring-brake/25"
              value={zip}
              onChange={(e) => onZipChange(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button
            type="button"
            disabled={!request || loading}
            onClick={run}
            className="flex items-center justify-center gap-2 rounded-full bg-brake px-5 py-3 font-display text-lg font-semibold uppercase tracking-wider text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <StartIcon />
            {loading ? "Estimating…" : "Check typical price"}
          </button>
          {loading && <p className="text-sm text-muted">This takes about 15 seconds.</p>}
          {!request && <p className="text-sm text-muted">Fill in the car and the repair first.</p>}
          {error && <p className="text-sm font-medium text-brake">{error}</p>}
          <p className="text-xs text-muted">Sends the car, repair, and ZIP (not your money details) to an AI.</p>
        </>
      )}
    </div>
  );
}
