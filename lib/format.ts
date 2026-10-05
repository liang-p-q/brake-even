// Display formatting shared by the math notes and the UI.

import type { AssumptionMeta } from "./defaults";

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export const usdRange = (low: number, high: number) => (Math.round(low) === Math.round(high) ? usd(low) : `${usd(low)}–${usd(high)}`);

/** Compact dollars for tight spaces: $950, $2.1k, $25k. */
export function usdShort(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) < 1000) return `$${v}`;
  const k = v / 1000;
  return `$${Math.abs(k) < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`;
}

export const usdShortRange = (low: number, high: number) =>
  usdShort(low) === usdShort(high) ? usdShort(low) : `${usdShort(low)}–${usdShort(high).slice(1)}`;

const trim = (n: number, digits: number) => n.toFixed(digits).replace(/\.0+$|(\.\d*?)0+$/, "$1");

/** An assumption's value in its unit, e.g. "$150", "20%", "3 days". */
export function formatAssumption(value: number, unit: AssumptionMeta["unit"]): string {
  switch (unit) {
    case "$":
      return usd(value);
    case "%":
      return `${trim(value * 100, 2)}%`;
    default:
      return `${trim(value, 1)} ${unit}`;
  }
}
