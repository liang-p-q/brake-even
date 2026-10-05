import { describe, expect, it } from "vitest";
import {
  asIsValue,
  computeAll,
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
  keepMonths: 36,
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
    expect(r.notes).toHaveLength(0);
  });

  it("negative equity: full down + fees upfront, shortfall rolled into the loan and flagged", () => {
    // as-is 7000, owe 9000 → equity -2000; upfront 4500; financed = 27000 - 4500 + 2000 = 24500
    const r = computeAll({ ...base, loanBalance: 9000 }, a).replace;
    expect(r.upfront).toBe(4500);
    expect(r.twelveMonthLow).toBeCloseTo(4500 + 12 * monthlyPayment(24500, 0.11, 60) + 500, 2);
    expect(r.notes[0]).toMatch(/\$2,000 more/);
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
});
