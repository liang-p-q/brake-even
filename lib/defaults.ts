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
  | "replacementRepairsPerYear"
  | "foreverYears";

export type Assumptions = Record<AssumptionKey, number>;

export type AssumptionMeta = {
  label: string;
  unit: "$" | "%" | "days" | "months" | "years";
  source: string;
  // Slider range in stored units (percentages are fractions: 0.2 = 20%)
  min: number;
  max: number;
  step: number;
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
  foreverYears: 8,
};

export const ASSUMPTION_META: Record<AssumptionKey, AssumptionMeta> = {
  diagFee: { label: "Second-opinion diagnostic fee", unit: "$", source: "PLACEHOLDER: typical shop diagnostic fee", min: 0, max: 400, step: 10 },
  indieSavingsPct: { label: "Independent shop vs. this quote", unit: "%", source: "PLACEHOLDER: dealer vs. independent labor-rate gap", min: 0, max: 0.6, step: 0.01 },
  towCost: { label: "Tow to another shop (if unsafe)", unit: "$", source: "PLACEHOLDER: local tow estimate", min: 0, max: 500, step: 5 },
  daysWithoutCar: { label: "Extra days without a car (if unsafe)", unit: "days", source: "PLACEHOLDER", min: 0, max: 14, step: 1 },
  dailyTransportCost: { label: "Rental / rideshare per day", unit: "$", source: "PLACEHOLDER", min: 0, max: 150, step: 5 },
  followOnRepairsPerYear: { label: "Other repairs on this car, per year", unit: "$", source: "PLACEHOLDER: AAA Your Driving Costs or age-based estimate", min: 0, max: 5000, step: 50 },
  replacementPrice: { label: "Replacement car price", unit: "$", source: "PLACEHOLDER: average used-vehicle listing price", min: 5000, max: 60000, step: 500 },
  taxFeesPct: { label: "Sales tax + fees", unit: "%", source: "PLACEHOLDER: state sales tax + typical doc/registration fees", min: 0, max: 0.15, step: 0.005 },
  downPaymentPct: { label: "Down payment", unit: "%", source: "PLACEHOLDER", min: 0, max: 0.5, step: 0.01 },
  apr: { label: "Loan APR (used car)", unit: "%", source: "PLACEHOLDER: Experian State of the Automotive Finance Market", min: 0, max: 0.25, step: 0.0025 },
  termMonths: { label: "Loan term", unit: "months", source: "PLACEHOLDER", min: 12, max: 84, step: 12 },
  replacementRepairsPerYear: { label: "Repairs on replacement car, per year", unit: "$", source: "PLACEHOLDER", min: 0, max: 3000, step: 50 },
  foreverYears: { label: "\"Forever\" counts as", unit: "years", source: "PLACEHOLDER: typical remaining lifespan for a car this age", min: 1, max: 20, step: 1 },
};
