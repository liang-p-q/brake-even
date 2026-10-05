// Everything the visitor has entered, as saved on their device. Parsing never throws and drops
// anything malformed, so a corrupted or outdated save just starts the form fresh.

import type { KeepPlan, SafeToDrive } from "./calc";
import { ASSUMPTION_META, type AssumptionKey, type Assumptions } from "./defaults";
import type { PriceCheckResult } from "./priceCheck";

export const CAR_FIELDS = ["vin", "year", "make", "model", "repair"] as const;
export const MONEY_FIELDS = ["quoteTotal", "carValueRepaired", "loanBalance", "loanPayment", "cashAvailable"] as const;
export type CarField = (typeof CAR_FIELDS)[number];
export type MoneyField = (typeof MONEY_FIELDS)[number];

export type FormState = {
  car: Record<CarField, string>;
  money: Record<MoneyField, string>;
  zip: string;
  safeToDrive: SafeToDrive;
  keep?: KeepPlan;
  overrides: Partial<Assumptions>; // only the assumptions the visitor changed, so new defaults still apply
  checked: string[]; // ticked checklist item ids
  priceResult: PriceCheckResult | null;
};

const blank = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>;

export const EMPTY_FORM: FormState = {
  car: blank(CAR_FIELDS),
  money: blank(MONEY_FIELDS),
  zip: "",
  safeToDrive: "yes",
  overrides: {},
  checked: [],
  priceResult: null,
};

const VERSION = 1;

export const serializeForm = (form: FormState) => JSON.stringify({ v: VERSION, form });

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function strings<K extends string>(src: unknown, keys: readonly K[], max = 200): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, isObj(src) && typeof src[k] === "string" ? (src[k] as string).slice(0, max) : ""])) as Record<K, string>;
}

function overrides(src: unknown): Partial<Assumptions> {
  if (!isObj(src)) return {};
  const out: Partial<Assumptions> = {};
  for (const key of Object.keys(ASSUMPTION_META) as AssumptionKey[]) {
    const v = src[key];
    const { min, max } = ASSUMPTION_META[key];
    if (isNum(v) && v >= min && v <= max) out[key] = v;
  }
  return out;
}

function priceResult(src: unknown): PriceCheckResult | null {
  if (!isObj(src) || typeof src.found !== "boolean") return null;
  const nums = ["low", "high", "partsLow", "partsHigh", "laborHoursLow", "laborHoursHigh"] as const;
  if (!nums.every((k) => isNum(src[k]) && (src[k] as number) >= 0)) return null;
  if (typeof src.interpretedAs !== "string" || typeof src.notes !== "string") return null;
  return {
    found: src.found,
    interpretedAs: src.interpretedAs.slice(0, 160),
    notes: src.notes.slice(0, 400),
    ...(Object.fromEntries(nums.map((k) => [k, src[k]])) as Record<(typeof nums)[number], number>),
  };
}

export function parseSaved(raw: string | null): FormState {
  if (!raw) return EMPTY_FORM;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_FORM;
  }
  if (!isObj(data) || data.v !== VERSION || !isObj(data.form)) return EMPTY_FORM;
  const f = data.form;
  return {
    car: strings(f.car, CAR_FIELDS),
    money: strings(f.money, MONEY_FIELDS, 20),
    zip: typeof f.zip === "string" ? f.zip.replace(/\D/g, "").slice(0, 5) : "",
    safeToDrive: f.safeToDrive === "no" || f.safeToDrive === "unsure" ? f.safeToDrive : "yes",
    keep: f.keep === "forever" || (isNum(f.keep) && f.keep > 0 && f.keep <= 600) ? (f.keep as KeepPlan) : undefined,
    overrides: overrides(f.overrides),
    checked: Array.isArray(f.checked) ? f.checked.filter((x): x is string => typeof x === "string").slice(0, 50) : [],
    priceResult: priceResult(f.priceResult),
  };
}
