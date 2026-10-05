"use client";

// Single page: four input sections, then a results dashboard (the three paths, what could change
// them, a pre-approval checklist, and the tunable assumptions). Everything entered is saved on
// this device as you type.

import Checklist from "@/components/Checklist";
import PathCards from "@/components/PathCards";
import PriceCheck from "@/components/PriceCheck";
import RotorMark from "@/components/RotorMark";
import TuneNumbers from "@/components/TuneNumbers";
import { Card, Choices, Field, inputBase, labelText, MoneyInput, SectionHeading } from "@/components/ui";
import VinDecoder from "@/components/VinDecoder";
import WarningLights from "@/components/WarningLights";
import { computeAll, sensitivity, type Inputs, type KeepPlan, type SafeToDrive } from "@/lib/calc";
import { checklist } from "@/lib/checklist";
import { DEFAULT_ASSUMPTIONS, type AssumptionKey, type Assumptions } from "@/lib/defaults";
import type { CarField, MoneyField } from "@/lib/savedForm";
import { useSavedForm } from "@/lib/useSavedForm";

const MONEY_INPUTS: { key: Exclude<MoneyField, "quoteTotal">; label: string; hint?: string }[] = [
  { key: "carValueRepaired", label: "Car value once repaired", hint: "Look it up on KBB or Edmunds" },
  { key: "loanBalance", label: "Still owed on the car", hint: "0 if paid off" },
  { key: "loanPayment", label: "Monthly car payment", hint: "0 if none" },
  { key: "cashAvailable", label: "Cash you can spend now" },
];

const SAFE_OPTIONS: { value: SafeToDrive; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

const KEEP_OPTIONS: { value: KeepPlan; label: string }[] = [
  { value: 6, label: "Under 1 yr" },
  { value: 12, label: "1 yr" },
  { value: 24, label: "2 yrs" },
  { value: 36, label: "3 yrs" },
  { value: 60, label: "5 yrs" },
  { value: "forever", label: "Forever" },
];

const num = (s: string) => Number(s.replace(/[$,\s]/g, "")) || 0;

export default function Home() {
  const [form, update, startOver, hasSaved] = useSavedForm();
  const { car, money } = form;

  // A price check only applies to the car and repair it was run for.
  const setCar = (key: Exclude<CarField, "vin">, value: string) =>
    update((f) => ({ ...f, car: { ...f.car, [key]: value }, priceResult: null }));
  const setMoney = (key: MoneyField) => (value: string) => update((f) => ({ ...f, money: { ...f.money, [key]: value } }));
  const setOverride = (key: AssumptionKey, value: number | undefined) =>
    update((f) => {
      const overrides = { ...f.overrides };
      if (value === undefined || value === DEFAULT_ASSUMPTIONS[key]) delete overrides[key];
      else overrides[key] = value;
      return { ...f, overrides };
    });
  const toggleCheck = (id: string) =>
    update((f) => ({ ...f, checked: f.checked.includes(id) ? f.checked.filter((c) => c !== id) : [...f.checked, id] }));
  const onStartOver = () => {
    if (window.confirm("Clear everything you've entered?")) startOver();
  };

  const priceRequest =
    /^\d{4}$/.test(car.year) && car.make.trim() && car.model.trim() && car.repair.trim().length >= 3
      ? { year: Number(car.year), make: car.make.trim(), model: car.model.trim(), repair: car.repair.trim() }
      : null;

  const assumptions: Assumptions = { ...DEFAULT_ASSUMPTIONS, ...form.overrides };
  const inputs: Inputs = {
    quoteTotal: num(money.quoteTotal),
    carValueRepaired: num(money.carValueRepaired),
    loanBalance: num(money.loanBalance),
    loanPayment: num(money.loanPayment),
    cashAvailable: num(money.cashAvailable),
    keep: form.keep,
    safeToDrive: form.safeToDrive,
    typicalPrice: form.priceResult?.found ? { low: form.priceResult.low, high: form.priceResult.high } : undefined,
  };
  const results = inputs.quoteTotal > 0 && inputs.carValueRepaired > 0 ? computeAll(inputs, assumptions) : null;

  const onlyIfUnsafe = "Only counts when the car isn't safe to drive.";
  const tuneNotes: Partial<Record<AssumptionKey, string>> = {
    ...(inputs.typicalPrice && { indieSavingsPct: "Not in use: the price-check estimate sets the second-opinion price." }),
    ...(inputs.safeToDrive === "yes" && { towCost: onlyIfUnsafe, daysWithoutCar: onlyIfUnsafe, dailyTransportCost: onlyIfUnsafe }),
  };

  // Extra bottom padding lets the page end with the background tach in view, needle at redline.
  return (
    <main className="px-4 pb-56 pt-6 sm:pb-72">
      <div className="mx-auto max-w-xl">
        <header className="pb-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <RotorMark className="size-9 text-ink" />
              <span className="font-display text-2xl font-bold uppercase italic tracking-wide">
                Brake <span className="text-brake">Even</span>
              </span>
            </div>
            {hasSaved && (
              <button
                type="button"
                onClick={onStartOver}
                className="rounded-full border border-line bg-panel px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider text-muted hover:border-muted hover:text-ink"
              >
                Start over
              </button>
            )}
          </div>
          <h1 className="mt-10 font-display text-5xl font-bold uppercase leading-[0.92] tracking-tight sm:text-6xl">
            Big repair quote?
            <br />
            <span className="text-brake">Run the numbers.</span>
          </h1>
          <p className="mt-4 max-w-md text-muted sm:text-lg">
            Compare repairing now, getting a second opinion, or replacing the car against the cash you actually have. No verdict, just the
            numbers.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {["3 paths", "12-month cost", "No verdict", "Saved on this device"].map((t) => (
              <li key={t} className="rounded-full border border-line bg-panel px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted">
                {t}
              </li>
            ))}
          </ul>
        </header>

        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
          <Card n="01" title="The car">
            <VinDecoder
              vin={car.vin}
              onVinChange={(vin) => update((f) => ({ ...f, car: { ...f.car, vin } }))}
              onDecoded={(decoded) => update((f) => ({ ...f, car: { ...f.car, ...decoded }, priceResult: null }))}
            />
            <div className="grid grid-cols-[6rem_1fr] gap-3">
              <Field id="year" label="Year">
                <input
                  id="year"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="2014"
                  className={`${inputBase} font-mono tabular-nums`}
                  value={car.year}
                  onChange={(e) => setCar("year", e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field id="make" label="Make">
                <input id="make" className={inputBase} placeholder="Honda" value={car.make} onChange={(e) => setCar("make", e.target.value)} />
              </Field>
            </div>
            <Field id="model" label="Model">
              <input id="model" className={inputBase} placeholder="Civic" value={car.model} onChange={(e) => setCar("model", e.target.value)} />
            </Field>
          </Card>

          <Card n="02" title="The repair">
            <Field id="repair" label="What's the repair for?">
              <input
                id="repair"
                className={inputBase}
                placeholder="e.g. front brake pads and rotors"
                maxLength={200}
                value={car.repair}
                onChange={(e) => setCar("repair", e.target.value)}
              />
            </Field>
            <Field id="quoteTotal" label="Repair quote total">
              <MoneyInput id="quoteTotal" value={money.quoteTotal} onChange={setMoney("quoteTotal")} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <p id="safe-label" className={labelText}>
                Did the shop say it&apos;s safe to drive?
              </p>
              <Choices
                name="safe"
                labelledBy="safe-label"
                options={SAFE_OPTIONS}
                value={form.safeToDrive}
                onChange={(safeToDrive) => update((f) => ({ ...f, safeToDrive }))}
              />
            </div>
            <PriceCheck
              request={priceRequest}
              zip={form.zip}
              onZipChange={(zip) => update((f) => ({ ...f, zip }))}
              quoteTotal={inputs.quoteTotal}
              result={form.priceResult}
              onResult={(priceResult) => update((f) => ({ ...f, priceResult }))}
            />
          </Card>

          <Card n="03" title="Your money">
            {MONEY_INPUTS.map((f) => (
              <Field key={f.key} id={f.key} label={f.label} hint={f.hint}>
                <MoneyInput id={f.key} value={money[f.key]} onChange={setMoney(f.key)} />
              </Field>
            ))}
          </Card>

          <Card n="04" title="How long you'll keep it">
            <div className="flex flex-col gap-1.5">
              <p id="keep-label" className={labelText}>
                How long did you hope to keep the car?
              </p>
              <Choices name="keep" labelledBy="keep-label" options={KEEP_OPTIONS} value={form.keep} onChange={(keep) => update((f) => ({ ...f, keep }))} />
            </div>
            {form.keep === "forever" && (
              <p className="text-sm text-muted">For per-month math, &ldquo;forever&rdquo; counts as {assumptions.foreverYears} more years.</p>
            )}
          </Card>
        </form>
      </div>

      <div className={`mx-auto mt-12 flex max-w-xl flex-col gap-5 ${results ? "lg:max-w-6xl" : ""}`}>
        <section aria-labelledby="results-heading" className="flex flex-col gap-4">
          <SectionHeading n="05" id="results-heading">
            Your options
          </SectionHeading>
          {results ? (
            <PathCards results={results} cash={inputs.cashAvailable} keep={form.keep} />
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-panel/70 p-6 text-center">
              <p className="font-display text-lg font-semibold uppercase tracking-wider">Three paths, waiting</p>
              <p className="mt-1 text-sm text-muted">Enter the repair quote and the car&apos;s value to see them.</p>
            </div>
          )}
        </section>

        {results && (
          <>
            <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
              <Card n="06" title="What could change this">
                <WarningLights flips={sensitivity(inputs, assumptions)} inputs={inputs} assumptions={assumptions} />
              </Card>
              <Card n="07" title="Before you approve anything">
                <Checklist items={checklist(inputs)} checked={form.checked} onToggle={toggleCheck} />
              </Card>
            </div>
            <TuneNumbers
              n="08"
              assumptions={assumptions}
              overrides={form.overrides}
              notes={tuneNotes}
              onChange={setOverride}
              onResetAll={() => update((f) => ({ ...f, overrides: {} }))}
            />
          </>
        )}
      </div>

      <footer className="mx-auto mt-12 max-w-xl border-t border-dashed border-line pt-4 font-mono text-[11px] uppercase leading-relaxed tracking-wider text-muted">
        Estimates, not advice. No verdict by design. Default assumptions are placeholders for now. The price check is an AI estimate from
        general knowledge. Your answers are saved only in this browser.
      </footer>
    </main>
  );
}
