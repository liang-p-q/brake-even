// All Brake Even math. Pure functions only; spec is docs/PLAN.md §3.
// "12-month cost" = cash out of pocket over the next 12 months for costs that differ between paths.

import { ASSUMPTION_META, type AssumptionKey, type Assumptions } from "./defaults";

export type SafeToDrive = "yes" | "no" | "unsure";

export type Inputs = {
  quoteTotal: number;
  carValueRepaired: number;
  loanBalance: number;
  loanPayment: number; // monthly payment on current car; 0 if none / unknown
  cashAvailable: number;
  keepMonths: number;
  safeToDrive: SafeToDrive;
};

export type PathId = "repair" | "secondOpinion" | "replace";

export type PathResult = {
  id: PathId;
  upfront: number;
  // 12-month cost as a range; low === high when there's no uncertainty band
  twelveMonthLow: number;
  twelveMonthHigh: number;
  cashGap: number; // cashAvailable - upfront (negative = short)
  notes: string[];
};

export type Results = Record<PathId, PathResult>;

export const PATH_LABELS: Record<PathId, string> = {
  repair: "Repair now",
  secondOpinion: "Second opinion",
  replace: "Replace the car",
};

/** Standard amortized monthly payment. */
export function monthlyPayment(principal: number, apr: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = apr / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** Rough trade-in value of the car as it sits, unrepaired. */
export function asIsValue(inputs: Inputs): number {
  return Math.max(inputs.carValueRepaired - inputs.quoteTotal, 0);
}

function transportCost(inputs: Inputs, a: Assumptions): number {
  if (inputs.safeToDrive === "yes") return 0;
  return a.towCost + a.daysWithoutCar * a.dailyTransportCost;
}

export function repairNow(inputs: Inputs, a: Assumptions): PathResult {
  const upfront = inputs.quoteTotal;
  const twelve = upfront + a.followOnRepairsPerYear + 12 * inputs.loanPayment;
  return {
    id: "repair",
    upfront,
    twelveMonthLow: twelve,
    twelveMonthHigh: twelve,
    cashGap: inputs.cashAvailable - upfront,
    notes: [],
  };
}

export function secondOpinion(inputs: Inputs, a: Assumptions): PathResult {
  const transport = transportCost(inputs, a);
  const upfront = a.diagFee + transport;
  const base = upfront + a.followOnRepairsPerYear + 12 * inputs.loanPayment;
  const notes = ["Range: best case uses the assumed independent-shop savings; worst case assumes the second shop confirms this quote."];
  if (transport > 0) notes.push("Includes towing and getting around while the car can't be driven.");
  return {
    id: "secondOpinion",
    upfront,
    twelveMonthLow: base + inputs.quoteTotal * (1 - a.indieSavingsPct),
    twelveMonthHigh: base + inputs.quoteTotal,
    cashGap: inputs.cashAvailable - upfront,
    notes,
  };
}

export function replaceCar(inputs: Inputs, a: Assumptions): PathResult {
  const equity = asIsValue(inputs) - inputs.loanBalance;
  const taxFees = a.replacementPrice * a.taxFeesPct;
  const down = a.replacementPrice * a.downPaymentPct;
  // Positive equity covers the down payment + fees first; any leftover reduces the loan.
  const upfront = Math.max(down + taxFees - Math.max(equity, 0), 0);
  // Negative equity (owing more than the car is worth) rolls into the new loan.
  const financed = Math.max(a.replacementPrice + taxFees - upfront - equity, 0);
  const payment = monthlyPayment(financed, a.apr, a.termMonths);
  const notes: string[] = [];
  if (equity < 0) notes.push(`You owe about $${Math.round(-equity).toLocaleString()} more than the car is worth as-is; that's rolled into the new loan.`);
  return {
    id: "replace",
    upfront,
    twelveMonthLow: upfront + 12 * payment + a.replacementRepairsPerYear,
    twelveMonthHigh: upfront + 12 * payment + a.replacementRepairsPerYear,
    cashGap: inputs.cashAvailable - upfront,
    notes,
  };
}

export function computeAll(inputs: Inputs, a: Assumptions): Results {
  return {
    repair: repairNow(inputs, a),
    secondOpinion: secondOpinion(inputs, a),
    replace: replaceCar(inputs, a),
  };
}

const midpoint = (p: PathResult) => (p.twelveMonthLow + p.twelveMonthHigh) / 2;

/** Path with the lowest estimated 12-month cost (range midpoint). A fact for sensitivity, not a recommendation. */
export function lowestTwelveMonth(results: Results): PathId {
  return (Object.values(results) as PathResult[]).reduce((min, p) => (midpoint(p) < midpoint(min) ? p : min)).id;
}

export type Flip = {
  key: AssumptionKey;
  from: number;
  to: number;
  lowestBefore: PathId;
  lowestAfter: PathId;
};

/** Assumptions that, nudged ±25%, change which path has the lowest 12-month cost. */
export function sensitivity(inputs: Inputs, a: Assumptions, nudge = 0.25): Flip[] {
  const before = lowestTwelveMonth(computeAll(inputs, a));
  const flips: Flip[] = [];
  for (const key of Object.keys(ASSUMPTION_META) as AssumptionKey[]) {
    for (const factor of [1 - nudge, 1 + nudge]) {
      const to = a[key] * factor;
      const after = lowestTwelveMonth(computeAll(inputs, { ...a, [key]: to }));
      if (after !== before) {
        flips.push({ key, from: a[key], to, lowestBefore: before, lowestAfter: after });
        break; // one flip per assumption is enough to list it
      }
    }
  }
  return flips;
}
