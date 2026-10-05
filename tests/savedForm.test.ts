import { describe, expect, it } from "vitest";
import { EMPTY_FORM, parseSaved, serializeForm, type FormState } from "../lib/savedForm";

const filled: FormState = {
  ...EMPTY_FORM,
  car: { vin: "", year: "2014", make: "Honda", model: "Civic", repair: "front brakes" },
  money: { ...EMPTY_FORM.money, quoteTotal: "900", carValueRepaired: "9000" },
  zip: "02139",
  safeToDrive: "unsure",
  keep: "forever",
  overrides: { diagFee: 200, apr: 0.09 },
  checked: ["itemized"],
  priceResult: { found: true, interpretedAs: "Brakes", low: 300, high: 650, partsLow: 110, partsHigh: 280, laborHoursLow: 1.2, laborHoursHigh: 1.8, notes: "" },
};

describe("saved form", () => {
  it("round-trips", () => {
    expect(parseSaved(serializeForm(filled))).toEqual(filled);
  });
  it("starts fresh on nothing, garbage, or an unknown version", () => {
    expect(parseSaved(null)).toEqual(EMPTY_FORM);
    expect(parseSaved("{not json")).toEqual(EMPTY_FORM);
    expect(parseSaved(JSON.stringify({ v: 99, form: filled }))).toEqual(EMPTY_FORM);
  });
  it("drops malformed pieces but keeps the rest", () => {
    const raw = JSON.stringify({
      v: 1,
      form: { ...filled, safeToDrive: "maybe", keep: -3, overrides: { diagFee: 99999, apr: 0.09, bogus: 1 }, priceResult: { found: true } },
    });
    const parsed = parseSaved(raw);
    expect(parsed.car.make).toBe("Honda");
    expect(parsed.safeToDrive).toBe("yes");
    expect(parsed.keep).toBeUndefined();
    expect(parsed.overrides).toEqual({ apr: 0.09 }); // out-of-range diagFee and unknown keys dropped
    expect(parsed.priceResult).toBeNull();
  });
});
