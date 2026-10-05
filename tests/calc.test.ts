import { describe, expect, it } from "vitest";
import {
  asIsValue,
  cashCoverage,
  compareQuote,
  computeAll,
  horizonMonths,
  lowestTwelveMonth,
  monthlyPayment,
  sensitivity,
  type Inputs,
} from "../lib/calc";
import { DEFAULT_ASSUMPTIONS, type Assumptions } from "../lib/defaults";

const a: Assumptions = { ...DEFAULT_ASSUMPTIONS };

const base: Inputs = {
  quoteTotal: 3000,
  carValueRepaired: 10000,
  loanBalance: 0,
  loanPayment: 0,
  cashAvailable: 2000,
  safeToDrive: "yes",
};

describe("monthlyPayment", () => {
  it("matches a known amortization", () => {
    // $20,000 at 6% for 60 months ≈ $386.66
    expect(monthlyPayment(20000, 0.06, 60)).toBeCloseTo(386.66, 1);
  });
  it("handles 0% APR and zero principal", () => {
    expect(monthlyPayment(12000, 0, 60)).toBe(200);
    expect(monthlyPayment(0, 0.1, 60)).toBe(0);
  });
});

describe("repair now", () => {
  it("upfront is the quote; 12-mo adds follow-on repairs and loan payments", () => {
    const r = computeAll({ ...base, loanPayment: 300 }, a).repair;
    expect(r.upfront).toBe(3000);
    expect(r.twelveMonthLow).toBe(3000 + 1200 + 3600);
    expect(r.cashGap).toBe(-1000); // short by $1,000
  });
});

describe("second opinion", () => {
  it("safe to drive: upfront is just the diag fee; range spans savings vs. no savings", () => {
    const s = computeAll(base, a).secondOpinion;
    expect(s.upfront).toBe(150);
    expect(s.twelveMonthLow).toBe(150 + 3000 * 0.8 + 1200);
    expect(s.twelveMonthHigh).toBe(150 + 3000 + 1200);
  });
  it("unsafe to drive adds tow + transport", () => {
    const s = computeAll({ ...base, safeToDrive: "no" }, a).secondOpinion;
    expect(s.upfront).toBe(150 + 125 + 3 * 50);
  });
  it("'not sure' is treated like unsafe", () => {
    expect(computeAll({ ...base, safeToDrive: "unsure" }, a).secondOpinion.upfront).toBe(425);
  });
});

describe("replace", () => {
  it("as-is value is repaired value minus quote, floored at 0", () => {
    expect(asIsValue(base)).toBe(7000);
    expect(asIsValue({ ...base, quoteTotal: 15000 })).toBe(0);
  });

  it("positive equity covers down + fees, leftover reduces the loan", () => {
    // equity 7000; down 2500 + fees 2000 = 4500 → upfront 0; financed = 25000 + 2000 - 0 - 7000 = 20000
    const r = computeAll(base, a).replace;
    expect(r.upfront).toBe(0);
    expect(r.twelveMonthLow).toBeCloseTo(12 * monthlyPayment(20000, 0.11, 60) + 500, 2);
    expect(r.notes).toEqual([expect.stringMatching(/^New loan: about \$\d/)]); // no negative-equity note
  });

  it("negative equity: full down + fees upfront, shortfall rolled into the loan and flagged", () => {
    // as-is 7000, owe 9000 → equity -2000; upfront 4500; financed = 27000 - 4500 + 2000 = 24500
    const r = computeAll({ ...base, loanBalance: 9000 }, a).replace;
    expect(r.upfront).toBe(4500);
    expect(r.twelveMonthLow).toBeCloseTo(4500 + 12 * monthlyPayment(24500, 0.11, 60) + 500, 2);
    expect(r.notes[0]).toMatch(/\$2,000 more/);
    expect(r.notes[1]).toMatch(/^New loan: about \$\d/);
  });
});

describe("how long you keep it", () => {
  it("no answer means no per-month spread", () => {
    expect(computeAll(base, a).repair.spreadPerMonth).toBeUndefined();
  });

  it("spreads one-time costs over the months you keep the car", () => {
    const r = computeAll({ ...base, keep: 36 }, a);
    expect(r.repair.spreadPerMonth).toEqual({ low: 3000 / 36, high: 3000 / 36, months: 36 });
    // second opinion: diag + (savings case .. confirmed quote)
    expect(r.secondOpinion.spreadPerMonth).toEqual({ low: (150 + 2400) / 36, high: (150 + 3000) / 36, months: 36 });
    expect(r.replace.spreadPerMonth).toBeUndefined();
  });

  it("'as long as it runs' uses the editable foreverYears assumption", () => {
    expect(horizonMonths("forever", a)).toBe(8 * 12);
    expect(horizonMonths("forever", { ...a, foreverYears: 15 })).toBe(180);
    const r = computeAll({ ...base, keep: "forever" }, a);
    expect(r.repair.spreadPerMonth?.low).toBeCloseTo(3000 / 96, 6);
  });

  it("doesn't change the 12-month numbers", () => {
    const withKeep = computeAll({ ...base, keep: "forever" }, a);
    const without = computeAll(base, a);
    for (const id of ["repair", "secondOpinion", "replace"] as const) {
      expect(withKeep[id].twelveMonthLow).toBe(without[id].twelveMonthLow);
      expect(withKeep[id].twelveMonthHigh).toBe(without[id].twelveMonthHigh);
    }
  });
});

describe("price check feeds the second opinion", () => {
  it("best case uses the typical range's midpoint instead of the assumed savings", () => {
    const s = computeAll({ ...base, typicalPrice: { low: 1800, high: 2200 } }, a).secondOpinion;
    expect(s.twelveMonthLow).toBe(150 + 2000 + 1200);
    expect(s.twelveMonthHigh).toBe(150 + 3000 + 1200);
    expect(s.notes[0]).toMatch(/price check/);
  });

  it("never assumes a second shop costs more than the quote", () => {
    const s = computeAll({ ...base, typicalPrice: { low: 3500, high: 4500 } }, a).secondOpinion;
    expect(s.twelveMonthLow).toBe(s.twelveMonthHigh);
  });
});

describe("cashCoverage (fuel gauge)", () => {
  it("is the share of the upfront cost your cash covers, capped at full", () => {
    expect(cashCoverage(450, 900)).toBe(0.5);
    expect(cashCoverage(2000, 900)).toBe(1);
    expect(cashCoverage(0, 900)).toBe(0);
    expect(cashCoverage(-50, 900)).toBe(0);
  });
  it("is full when nothing is due upfront", () => {
    expect(cashCoverage(0, 0)).toBe(1);
  });
});

describe("compareQuote", () => {
  const typical = { low: 1800, high: 2200 };
  it("above the range", () => {
    expect(compareQuote(3000, typical)).toEqual({ position: "above", diff: 800, pct: 800 / 2200 });
  });
  it("within the range (edges included)", () => {
    expect(compareQuote(1800, typical).position).toBe("within");
    expect(compareQuote(2200, typical).position).toBe("within");
  });
  it("below the range", () => {
    expect(compareQuote(1500, typical)).toEqual({ position: "below", diff: 300, pct: 300 / 1800 });
  });
});

describe("sensitivity", () => {
  it("lists assumptions that flip the lowest 12-month path", () => {
    const results = computeAll(base, a);
    expect(lowestTwelveMonth(results)).toBe("secondOpinion");
    // Second-opinion midpoint (4050) vs repair (4200); every listed flip must actually change the answer.
    const flips = sensitivity(base, a);
    for (const f of flips) expect(f.lowestAfter).not.toBe(f.lowestBefore);
  });

  it("detects a flip when two paths are close", () => {
    // Quote $1,600: second opinion saves 1600 × 20% / 2 = $160 at the midpoint vs. a $150 fee, a $10 edge.
    // A 25% higher diag fee ($187.50) or lower savings (15%) makes repair-now the lowest.
    const flips = sensitivity({ ...base, quoteTotal: 1600 }, a);
    const keys = flips.map((f) => f.key);
    expect(keys).toContain("diagFee");
    expect(keys).toContain("indieSavingsPct");
    expect(flips.every((f) => f.lowestBefore === "secondOpinion" && f.lowestAfter === "repair")).toBe(true);
  });

  it("lists the price-check range when nudging it changes the answer", () => {
    // The second-opinion range's midpoint beats repair-now only if the typical price is under
    // quote − 2 × diag fee = $1,320. At $1,450 it isn't; 25% lower ($1,087.50) it is.
    const inputs: Inputs = { ...base, quoteTotal: 1620, typicalPrice: { low: 1300, high: 1600 } };
    const flips = sensitivity(inputs, a);
    expect(flips.find((f) => f.key === "typicalPrice")).toMatchObject({
      factor: 0.75,
      lowestBefore: "repair",
      lowestAfter: "secondOpinion",
    });
    // the assumed savings % no longer matters once a typical price is known
    expect(flips.map((f) => f.key)).not.toContain("indieSavingsPct");
  });
});
