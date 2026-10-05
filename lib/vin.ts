// VIN decoding with NHTSA's free vPIC database (no key; it allows browser requests).
// Pure helpers live here; components/VinDecoder.tsx does the fetch.

/** 17 characters; VINs never use I, O, or Q. */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Uppercase, strip spaces/dashes, cap at 17. */
export const normalizeVin = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);

export const vinDecodeUrl = (vin: string) => `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;

export type VinDecode =
  | { ok: true; year: string; make: string; model: string; spec: string; warning?: string }
  | { ok: false; error: string };

/** NHTSA returns makes in capitals ("HONDA"); show "Honda", but keep short ones like BMW and GMC. */
export function titleCaseMake(make: string): string {
  return make
    .split(/([\s-])/)
    .map((word) => (word.length > 3 ? word.charAt(0) + word.slice(1).toLowerCase() : word))
    .join("");
}

const ENGINE_LAYOUT: Record<string, string> = { "V-Shaped": "V", "In-Line": "I", Flat: "H", "W-Shaped": "W" };

/** e.g. "EX-V6 · 3.0L V6 · Gasoline" from the vPIC fields. */
function specLine(r: Record<string, string>): string {
  const liters = Number(r.DisplacementL);
  const cylinders = r.EngineCylinders;
  const layout = ENGINE_LAYOUT[r.EngineConfiguration];
  const engine = [
    Number.isFinite(liters) && liters > 0 ? `${liters.toFixed(1)}L` : "",
    cylinders ? (layout ? `${layout}${cylinders}` : `${cylinders}-cyl`) : "",
  ]
    .filter(Boolean)
    .join(" ");
  return [r.Trim, engine, r.FuelTypePrimary].filter(Boolean).join(" · ");
}

/** Turn a DecodeVinValues response into form values, a spec line, and any warning NHTSA raised. */
export function parseVinResponse(json: unknown): VinDecode {
  const row = (json as { Results?: unknown[] } | null)?.Results?.[0];
  if (!row || typeof row !== "object") return { ok: false, error: "NHTSA didn't return a result for this VIN." };
  const r = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""]));

  if (!r.Make || !r.ModelYear) return { ok: false, error: "NHTSA couldn't decode this VIN. Check it, or fill in the car by hand." };

  // ErrorCode "0" means a clean decode; anything else (like a bad check digit) still decodes but deserves a look.
  const clean = r.ErrorCode.split(",").every((code) => code.trim() === "0");
  const warning = clean ? undefined : r.ErrorText.replace(/^\d+\s*-\s*/, "").split(";")[0].slice(0, 140);
  return { ok: true, year: r.ModelYear, make: titleCaseMake(r.Make), model: r.Model, spec: specLine(r), ...(warning ? { warning } : {}) };
}
