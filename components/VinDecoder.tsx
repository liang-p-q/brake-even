"use client";

// VIN field: once 17 valid characters are in, it asks NHTSA's free vPIC database and fills in the
// year, make, and model, with a spec line (trim, engine, fuel) for the car nerds.

import { useState } from "react";
import { normalizeVin, parseVinResponse, VIN_PATTERN, vinDecodeUrl, type VinDecode } from "@/lib/vin";
import { inputBase, labelText } from "./ui";

type Status = { state: "idle" } | { state: "loading" } | { state: "done"; result: VinDecode };
type Props = {
  vin: string;
  onVinChange: (vin: string) => void;
  onDecoded: (car: { year: string; make: string; model: string }) => void;
};

export default function VinDecoder({ vin, onVinChange, onDecoded }: Props) {
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function decode(value: string) {
    setStatus({ state: "loading" });
    try {
      const res = await fetch(vinDecodeUrl(value), { signal: AbortSignal.timeout(10_000) });
      const result = parseVinResponse(await res.json());
      setStatus({ state: "done", result });
      if (result.ok) onDecoded({ year: result.year, make: result.make, model: result.model });
    } catch {
      setStatus({ state: "done", result: { ok: false, error: "Couldn't reach NHTSA's database. Fill in the car by hand." } });
    }
  }

  function onInput(raw: string) {
    const next = normalizeVin(raw);
    onVinChange(next);
    if (next !== vin && VIN_PATTERN.test(next)) void decode(next);
    else if (status.state !== "loading") setStatus({ state: "idle" });
  }

  const full = vin.length === 17;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="vin" className={labelText}>
          VIN <span className="normal-case tracking-normal">(optional, fills in the rest)</span>
        </label>
        <span className={`font-mono text-xs tabular-nums ${full ? "text-ok" : "text-muted"}`}>{vin.length}/17</span>
      </div>
      <div className="flex gap-2">
        <input
          id="vin"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="17 characters"
          className={`${inputBase.replace("text-lg", "text-base sm:text-lg")} font-mono uppercase tracking-[0.06em] placeholder:normal-case placeholder:tracking-normal sm:tracking-[0.12em]`}
          value={vin}
          onChange={(e) => onInput(e.target.value)}
        />
        <button
          type="button"
          disabled={!VIN_PATTERN.test(vin) || status.state === "loading"}
          onClick={() => void decode(vin)}
          className="shrink-0 rounded-lg border border-line bg-panel-2 px-3 font-display text-sm font-semibold uppercase tracking-wider hover:border-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status.state === "loading" ? "…" : "Decode"}
        </button>
      </div>
      {full && !VIN_PATTERN.test(vin) && <p className="text-xs text-warn">VINs never use the letters I, O, or Q. Check for a 1 or 0.</p>}
      {status.state === "done" &&
        (status.result.ok ? (
          <div className="flex flex-col gap-1">
            <p className="rounded-md border border-line bg-panel-2 px-3 py-2 font-mono text-sm">
              {status.result.year} {status.result.make} {status.result.model}
              {status.result.spec && <span className="text-muted"> · {status.result.spec}</span>}
            </p>
            {status.result.warning && (
              <p className="text-xs text-warn">NHTSA flagged this VIN ({status.result.warning}). Double-check it against the car.</p>
            )}
          </div>
        ) : (
          <p className="text-xs font-medium text-brake">{status.result.error}</p>
        ))}
      <p className="text-xs text-muted">On your registration, insurance card, or the base of the windshield. Looked up with NHTSA&apos;s free vehicle database.</p>
    </div>
  );
}
