"use client";

// Week 1: rough form + plain results. Styled cards, assumptions panel, and checklist come in Week 2.

import { useState } from "react";
import { computeAll, PATH_LABELS, type Inputs, type PathResult, type SafeToDrive } from "@/lib/calc";
import { DEFAULT_ASSUMPTIONS } from "@/lib/defaults";

type NumericField = Exclude<keyof Inputs, "safeToDrive">;

const FIELDS: { key: NumericField; label: string; hint?: string }[] = [
  { key: "quoteTotal", label: "Repair quote total ($)" },
  { key: "carValueRepaired", label: "Car value once repaired ($)", hint: "Look it up on KBB or Edmunds" },
  { key: "loanBalance", label: "Still owed on the car ($)", hint: "0 if paid off" },
  { key: "loanPayment", label: "Monthly car payment ($)", hint: "0 if none" },
  { key: "cashAvailable", label: "Cash you can spend now ($)" },
  { key: "keepMonths", label: "How long you hoped to keep it (months)" },
];

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

function PathSummary({ p }: { p: PathResult }) {
  const range = p.twelveMonthLow === p.twelveMonthHigh ? usd(p.twelveMonthLow) : `${usd(p.twelveMonthLow)}–${usd(p.twelveMonthHigh)}`;
  return (
    <section className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">{PATH_LABELS[p.id]}</h2>
      <p>Upfront cash: {usd(p.upfront)}</p>
      <p>{p.cashGap >= 0 ? `Covered by your cash, ${usd(p.cashGap)} left over` : `Short by ${usd(-p.cashGap)}`}</p>
      <p>About 12-month cost: {range}</p>
      {p.notes.map((n) => (
        <p key={n} className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{n}</p>
      ))}
    </section>
  );
}

export default function Home() {
  const [values, setValues] = useState<Record<NumericField, string>>({
    quoteTotal: "", carValueRepaired: "", loanBalance: "", loanPayment: "", cashAvailable: "", keepMonths: "",
  });
  const [safeToDrive, setSafeToDrive] = useState<SafeToDrive>("yes");

  const num = (s: string) => Number(s.replace(/[$,\s]/g, "")) || 0;
  const ready = num(values.quoteTotal) > 0 && num(values.carValueRepaired) > 0;
  const inputs: Inputs = {
    quoteTotal: num(values.quoteTotal),
    carValueRepaired: num(values.carValueRepaired),
    loanBalance: num(values.loanBalance),
    loanPayment: num(values.loanPayment),
    cashAvailable: num(values.cashAvailable),
    keepMonths: num(values.keepMonths),
    safeToDrive,
  };
  const results = ready ? computeAll(inputs, DEFAULT_ASSUMPTIONS) : null;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-3xl font-bold">Brake Even</h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">
        Got a big repair quote? See what repairing, a second opinion, or replacing would cost against the cash you have. No verdict, just the numbers.
      </p>

      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="font-medium">{f.label}</span>
            {f.hint && <span className="text-sm text-zinc-500">{f.hint}</span>}
            <input
              inputMode="decimal"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-lg dark:border-zinc-700"
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="font-medium">Did the shop say it&apos;s safe to drive?</span>
          <select
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-lg dark:border-zinc-700"
            value={safeToDrive}
            onChange={(e) => setSafeToDrive(e.target.value as SafeToDrive)}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unsure">Not sure</option>
          </select>
        </label>
      </form>

      <div className="mt-8 flex flex-col gap-4">
        {results ? (
          Object.values(results).map((p) => <PathSummary key={p.id} p={p} />)
        ) : (
          <p className="text-zinc-500">Enter the quote and the car&apos;s value to see your options.</p>
        )}
      </div>

      <p className="mt-8 text-xs text-zinc-500">Estimates, not advice. Default assumptions are placeholders for now.</p>
    </main>
  );
}
