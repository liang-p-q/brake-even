import { describe, expect, it } from "vitest";
import type { Inputs } from "../lib/calc";
import { checklist } from "../lib/checklist";

const base: Inputs = {
  quoteTotal: 900,
  carValueRepaired: 9000,
  loanBalance: 0,
  loanPayment: 0,
  cashAvailable: 1500,
  safeToDrive: "yes",
};
const ids = (inputs: Inputs) => checklist(inputs).map((i) => i.id);

describe("checklist", () => {
  it("always asks the four basics", () => {
    expect(ids(base)).toEqual(["itemized", "warranty", "parts", "diag-credit"]);
  });
  it("asks what's failing when it's not (or maybe not) safe to drive", () => {
    expect(ids({ ...base, safeToDrive: "no" })).toContain("what-fails");
    expect(ids({ ...base, safeToDrive: "unsure" })).toContain("what-fails");
  });
  it("double-checks the car's value when the repair is over half of it", () => {
    expect(ids({ ...base, quoteTotal: 4500 })).not.toContain("car-value");
    expect(ids({ ...base, quoteTotal: 4600 })).toContain("car-value");
  });
  it("asks for the loan payoff when the loan is underwater", () => {
    // as-is value = 9000 - 900 = 8100
    expect(ids({ ...base, loanBalance: 8000 })).not.toContain("payoff");
    expect(ids({ ...base, loanBalance: 8200 })).toContain("payoff");
  });
  it("mentions resale value only when keeping the car under a year", () => {
    expect(ids({ ...base, keep: 6 })).toContain("resale");
    expect(ids({ ...base, keep: 12 })).not.toContain("resale");
    expect(ids({ ...base, keep: "forever" })).not.toContain("resale");
  });
  it("asks what's included when the quote is above the typical range", () => {
    expect(ids({ ...base, typicalPrice: { low: 300, high: 650 } })).toContain("whats-included");
    expect(ids({ ...base, typicalPrice: { low: 800, high: 1000 } })).not.toContain("whats-included");
  });
});
