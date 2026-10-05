// All Brake Even math. Pure functions only; spec is docs/PLAN.md §3.
// "12-month cost" = cash out of pocket over the next 12 months for costs that differ between paths.

import { ASSUMPTION_META, type AssumptionKey, type Assumptions } from "./defaults";
import { usd } from "./format";

export type SafeToDrive = "yes" | "no" | "unsure";

/** How long the owner hoped to keep the car: a number of months, or "as long as it runs". */
export type KeepPlan = number | "forever";

export type PriceRange = { low: number; high: number };

export type Inputs = {
  quoteTotal: number;
  carValueRepaired: number;
  loanBalance: number;
  loanPayment: number; // monthly payment on current car; 0 if none / unknown
  cashAvailable: number;
  keep?: KeepPlan; // unanswered = no per-month spread
  safeToDrive: SafeToDrive;
  typicalPrice?: PriceRange; // typical independent-shop price from the price check, if run
};

export type PathId = "repair" | "secondOpinion" | "replace";

export type PathResult = {
  id: PathId;
  upfront: number;
  // 12-month cost as a range; low === high when there's no uncertainty band
  twelveMonthLow: number;
  twelveMonthHigh: number;
  cashGap: number; // cashAvailable - upfront (negative = short)
  // One-time costs of this path spread over the months the owner plans to keep the car
  spreadPerMonth?: PriceRange & { months: number };
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

/** Months the owner expects to keep the car; "as long as it runs" uses an editable assumption. */
export function horizonMonths(keep: KeepPlan, a: Assumptions): number {
  return keep === "forever" ? a.foreverYears * 12 : keep;
}

function spread(oneTimeLow: number, oneTimeHigh: number, inputs: Inputs, a: Assumptions) {
  if (inputs.keep === undefined) return undefined;
  const months = horizonMonths(inputs.keep, a);
  if (months <= 0) return undefined;
  return { low: oneTimeLow / months, high: oneTimeHigh / months, months };
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
    spreadPerMonth: spread(upfront, upfront, inputs, a),
    notes: [],
  };
}

export function secondOpinion(inputs: Inputs, a: Assumptions): PathResult {
  const transport = transportCost(inputs, a);
  const upfront = a.diagFee + transport;
  // Best case: the second shop charges the typical price (if a price check ran) or the assumed savings.
  const bestRepair = inputs.typicalPrice
    ? Math.min(inputs.quoteTotal, (inputs.typicalPrice.low + inputs.typicalPrice.high) / 2)
    : inputs.quoteTotal * (1 - a.indieSavingsPct);
  const recurring = a.followOnRepairsPerYear + 12 * inputs.loanPayment;
  const notes = [
    inputs.typicalPrice
      ? "Range: best case assumes a second shop charges the typical price from the price check; worst case assumes it confirms this quote."
      : "Range: best case uses the assumed independent-shop savings; worst case assumes the second shop confirms this quote.",
  ];
  if (transport > 0) notes.push("Includes towing and getting around while the car can't be driven.");
  return {
    id: "secondOpinion",
    upfront,
    twelveMonthLow: upfront + bestRepair + recurring,
    twelveMonthHigh: upfront + inputs.quoteTotal + recurring,
    cashGap: inputs.cashAvailable - upfront,
    spreadPerMonth: spread(upfront + bestRepair, upfront + inputs.quoteTotal, inputs, a),
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
  if (equity < 0) notes.push(`You owe about ${usd(-equity)} more than the car is worth as-is; that's rolled into the new loan.`);
  if (payment > 0) notes.push(`New loan: about ${usd(payment)}/month for ${a.termMonths} months.`);
  const twelve = upfront + 12 * payment + a.replacementRepairsPerYear;
  return {
    id: "replace",
    upfront,
    twelveMonthLow: twelve,
    twelveMonthHigh: twelve,
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

/** Share of a path's upfront cash your cash covers, 0–1 (1 when nothing is due upfront). Drives the fuel gauge. */
export function cashCoverage(cashAvailable: number, upfront: number): number {
  if (upfront <= 0) return 1;
  return Math.min(Math.max(cashAvailable / upfront, 0), 1);
}

export type QuotePosition = { position: "below" | "within" | "above"; diff: number; pct: number };

/** Where the quote sits relative to a typical price range. A fact, not a judgment. */
export function compareQuote(quote: number, typical: PriceRange): QuotePosition {
  if (quote > typical.high) {
    return { position: "above", diff: quote - typical.high, pct: typical.high > 0 ? (quote - typical.high) / typical.high : 0 };
  }
  if (quote < typical.low) {
    return { position: "below", diff: typical.low - quote, pct: typical.low > 0 ? (typical.low - quote) / typical.low : 0 };
  }
  return { position: "within", diff: 0, pct: 0 };
}

const midpoint = (p: PathResult) => (p.twelveMonthLow + p.twelveMonthHigh) / 2;

/** Path with the lowest estimated 12-month cost (range midpoint). A fact for sensitivity, not a recommendation. */
export function lowestTwelveMonth(results: Results): PathId {
  return (Object.values(results) as PathResult[]).reduce((min, p) => (midpoint(p) < midpoint(min) ? p : min)).id;
}

export type FlipKey = AssumptionKey | "typicalPrice";

export type Flip = {
  key: FlipKey;
  factor: number; // e.g. 0.75 = this number 25% lower
  lowestBefore: PathId;
  lowestAfter: PathId;
};

/** Assumptions (and the price-check range) that, nudged ±25%, change which path has the lowest 12-month cost. */
export function sensitivity(inputs: Inputs, a: Assumptions, nudge = 0.25): Flip[] {
  const before = lowestTwelveMonth(computeAll(inputs, a));
  const variants: { key: FlipKey; apply: (factor: number) => [Inputs, Assumptions] }[] = (
    Object.keys(ASSUMPTION_META) as AssumptionKey[]
  ).map((key) => ({ key, apply: (factor) => [inputs, { ...a, [key]: a[key] * factor }] }));
  const typical = inputs.typicalPrice;
  if (typical) {
    variants.push({
      key: "typicalPrice",
      apply: (factor) => [{ ...inputs, typicalPrice: { low: typical.low * factor, high: typical.high * factor } }, a],
    });
  }

  const flips: Flip[] = [];
  for (const v of variants) {
    for (const factor of [1 - nudge, 1 + nudge]) {
      const after = lowestTwelveMonth(computeAll(...v.apply(factor)));
      if (after !== before) {
        flips.push({ key: v.key, factor, lowestBefore: before, lowestAfter: after });
        break; // one flip per assumption is enough to list it
      }
    }
  }
  return flips;
}
