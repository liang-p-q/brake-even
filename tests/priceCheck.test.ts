import { describe, expect, it } from "vitest";
import { buildUserMessage, cacheKey, cleanResult, validateRequest } from "../lib/priceCheck";

describe("validateRequest", () => {
  const good = { year: 2014, make: "Honda", model: "Civic", repair: "front brake pads and rotors" };

  it("accepts a complete request and trims text", () => {
    const r = validateRequest({ ...good, make: "  Honda ", zip: "02139" }, 2026);
    expect(r).toEqual({ ok: true, value: { ...good, zip: "02139" } });
  });
  it("treats a blank ZIP as no ZIP", () => {
    expect(validateRequest({ ...good, zip: "" }, 2026)).toEqual({ ok: true, value: good });
  });
  it("rejects bad years, missing fields, long text, and bad ZIPs", () => {
    expect(validateRequest({ ...good, year: 1900 }, 2026).ok).toBe(false);
    expect(validateRequest({ ...good, year: 2028 }, 2026).ok).toBe(false);
    expect(validateRequest({ ...good, make: "" }, 2026).ok).toBe(false);
    expect(validateRequest({ ...good, repair: "x".repeat(201) }, 2026).ok).toBe(false);
    expect(validateRequest({ ...good, zip: "2139" }, 2026).ok).toBe(false);
    expect(validateRequest(null, 2026).ok).toBe(false);
  });
});

describe("prompt helpers", () => {
  it("builds the user message with the current year, leaving out a missing ZIP", () => {
    expect(buildUserMessage({ year: 2014, make: "Honda", model: "Civic", repair: "brakes" }, 2026)).toBe(
      "Vehicle: 2014 Honda Civic\nRepair: brakes\nCurrent year: 2026",
    );
    expect(buildUserMessage({ year: 2014, make: "Honda", model: "Civic", repair: "brakes", zip: "02139" }, 2026)).toContain(
      "ZIP code: 02139",
    );
  });
  it("cache key ignores case and extra spaces", () => {
    const a = cacheKey({ year: 2014, make: "Honda", model: "Civic", repair: "Front  brakes" });
    const b = cacheKey({ year: 2014, make: "honda", model: "civic", repair: "front brakes" });
    expect(a).toBe(b);
  });
});

describe("cleanResult", () => {
  const raw = {
    found: true,
    interpretedAs: "Replace front brake pads and rotors",
    priceLow: 412.4,
    priceHigh: 388, // reversed on purpose
    partsLow: 150,
    partsHigh: 250,
    laborHoursLow: 1.25,
    laborHoursHigh: 2,
    notes: "OEM rotors cost more.",
  };

  it("rounds and orders ranges", () => {
    const r = cleanResult(raw)!;
    expect(r.low).toBe(388);
    expect(r.high).toBe(412);
    expect(r.laborHoursLow).toBe(1.3);
    expect(r.found).toBe(true);
    expect(r.notes).toBe("OEM rotors cost more.");
  });

  it("marks a zero range as not found, and rejects junk", () => {
    expect(cleanResult({ ...raw, priceLow: 0, priceHigh: 0 })!.found).toBe(false);
    expect(cleanResult({ ...raw, found: false })!.found).toBe(false);
    expect(cleanResult("nope")).toBeNull();
  });

  it("caps long text", () => {
    expect(cleanResult({ ...raw, notes: "x".repeat(1000) })!.notes).toHaveLength(400);
  });
});
