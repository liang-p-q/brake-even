// Default assumptions. Every value is editable in the UI and shown with its source.
// TODO(prep): values marked PLACEHOLDER must be replaced with a cited figure before v1.

export type AssumptionKey =
  | "diagFee"
  | "indieSavingsPct"
  | "towCost"
  | "daysWithoutCar"
  | "dailyTransportCost"
  | "followOnRepairsPerYear"
  | "replacementPrice"
  | "taxFeesPct"
  | "downPaymentPct"
  | "apr"
  | "termMonths"
  | "replacementRepairsPerYear";

export type Assumptions = Record<AssumptionKey, number>;

export type AssumptionMeta = {
  label: string;
  unit: "$" | "%" | "days" | "months";
  source: string;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  diagFee: 150,
  indieSavingsPct: 0.2,
  towCost: 125,
  daysWithoutCar: 3,
  dailyTransportCost: 50,
  followOnRepairsPerYear: 1200,
  replacementPrice: 25000,
  taxFeesPct: 0.08,
  downPaymentPct: 0.1,
  apr: 0.11,
  termMonths: 60,
  replacementRepairsPerYear: 500,
};

export const ASSUMPTION_META: Record<AssumptionKey, AssumptionMeta> = {
  diagFee: { label: "Second-opinion diagnostic fee", unit: "$", source: "PLACEHOLDER: typical shop diagnostic fee" },
  indieSavingsPct: { label: "Independent shop vs. this quote", unit: "%", source: "PLACEHOLDER: dealer vs. independent labor-rate gap" },
  towCost: { label: "Tow to another shop (if unsafe)", unit: "$", source: "PLACEHOLDER: local tow estimate" },
  daysWithoutCar: { label: "Extra days without a car (if unsafe)", unit: "days", source: "PLACEHOLDER" },
  dailyTransportCost: { label: "Rental / rideshare per day", unit: "$", source: "PLACEHOLDER" },
  followOnRepairsPerYear: { label: "Other repairs on this car, per year", unit: "$", source: "PLACEHOLDER: AAA Your Driving Costs or age-based estimate" },
  replacementPrice: { label: "Replacement car price", unit: "$", source: "PLACEHOLDER: average used-vehicle listing price" },
  taxFeesPct: { label: "Sales tax + fees", unit: "%", source: "PLACEHOLDER: state sales tax + typical doc/registration fees" },
  downPaymentPct: { label: "Down payment", unit: "%", source: "PLACEHOLDER" },
  apr: { label: "Loan APR (used car)", unit: "%", source: "PLACEHOLDER: Experian State of the Automotive Finance Market" },
  termMonths: { label: "Loan term", unit: "months", source: "PLACEHOLDER" },
  replacementRepairsPerYear: { label: "Repairs on replacement car, per year", unit: "$", source: "PLACEHOLDER" },
};
