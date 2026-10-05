// Types and pure helpers for the AI price check. The network call lives in
// app/api/price-check/route.ts; everything here is testable without an API key.

export type PriceCheckRequest = {
  year: number;
  make: string;
  model: string;
  repair: string;
  zip?: string;
};

export type PriceCheckResult = {
  found: boolean;
  interpretedAs: string; // the repair as the AI understood it
  low: number; // typical total at an independent shop, USD
  high: number;
  partsLow: number;
  partsHigh: number;
  laborHoursLow: number;
  laborHoursHigh: number;
  notes: string;
};

export type PriceCheckResponse =
  | { ok: true; result: PriceCheckResult }
  | { ok: false; error: string; code?: "monthly_limit"; resumesOn?: string };

/** GET /api/price-check: whether lookups are paused because this month's budget is used up. */
export type PriceCheckStatus = { paused: boolean; resumesOn: string };

/** An outside estimator people can use to cross-check the AI's range. */
export const CROSS_CHECK_URL = "https://repairpal.com/estimator";

const MAX_LEN = { make: 40, model: 60, repair: 200 };

export function validateRequest(
  body: unknown,
  currentYear = new Date().getFullYear(),
): { ok: true; value: PriceCheckRequest } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Expected a JSON body." };
  const b = body as Record<string, unknown>;
  const text = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");

  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 1950 || year > currentYear + 1) {
    return { ok: false, error: "Enter the car's model year." };
  }
  const make = text("make");
  if (!make || make.length > MAX_LEN.make) return { ok: false, error: `Enter the car's make (up to ${MAX_LEN.make} characters).` };
  const model = text("model");
  if (!model || model.length > MAX_LEN.model) return { ok: false, error: `Enter the car's model (up to ${MAX_LEN.model} characters).` };
  const repair = text("repair");
  if (repair.length < 3 || repair.length > MAX_LEN.repair) {
    return { ok: false, error: `Describe the repair in 3 to ${MAX_LEN.repair} characters.` };
  }
  const zip = text("zip");
  if (zip && !/^\d{5}$/.test(zip)) return { ok: false, error: "ZIP code should be 5 digits." };

  return { ok: true, value: { year, make, model, repair, ...(zip ? { zip } : {}) } };
}

export function buildUserMessage(r: PriceCheckRequest, currentYear = new Date().getFullYear()): string {
  return [
    `Vehicle: ${r.year} ${r.make} ${r.model}`,
    `Repair: ${r.repair}`,
    r.zip ? `ZIP code: ${r.zip}` : null,
    `Current year: ${currentYear}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Cache key for identical lookups (case- and spacing-insensitive). */
export function cacheKey(r: PriceCheckRequest): string {
  return [r.year, r.make, r.model, r.repair, r.zip ?? ""].map((v) => String(v).toLowerCase().replace(/\s+/g, " ")).join("|");
}

/** Turn the AI's report into a safe result: whole dollars, low <= high, short text. */
export function cleanResult(input: unknown): PriceCheckResult | null {
  if (!input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  const num = (k: string) => {
    const n = Number(i[k]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const range = (lo: string, hi: string) => [num(lo), num(hi)].sort((x, y) => x - y);
  const str = (k: string, max: number) => (typeof i[k] === "string" ? (i[k] as string).trim().slice(0, max) : "");

  const [low, high] = range("priceLow", "priceHigh");
  const [partsLow, partsHigh] = range("partsLow", "partsHigh");
  const [laborHoursLow, laborHoursHigh] = range("laborHoursLow", "laborHoursHigh");

  return {
    found: i.found === true && high > 0,
    interpretedAs: str("interpretedAs", 160),
    low: Math.round(low),
    high: Math.round(high),
    partsLow: Math.round(partsLow),
    partsHigh: Math.round(partsHigh),
    laborHoursLow: Math.round(laborHoursLow * 10) / 10,
    laborHoursHigh: Math.round(laborHoursHigh * 10) / 10,
    notes: str("notes", 400),
  };
}
