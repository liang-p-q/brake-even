// "Before you approve anything": questions to settle with the shop, picked from the user's answers.
// Rules are spec'd in docs/PLAN.md §3. Questions only, never a verdict.

import { asIsValue, compareQuote, type Inputs } from "./calc";

export type CheckItem = { id: string; title: string; detail: string };

export function checklist(inputs: Inputs): CheckItem[] {
  const items: CheckItem[] = [
    { id: "itemized", title: "Get an itemized quote", detail: "Parts, labor hours, and the shop's hourly rate, listed separately." },
    { id: "warranty", title: "Ask about the warranty", detail: "On both parts and labor, and for how long." },
    { id: "parts", title: "Ask which parts they'll use", detail: "OEM or aftermarket, and the price difference between them." },
    { id: "diag-credit", title: "Ask if the diagnostic fee is credited", detail: "Many shops apply it to the repair if you approve the work." },
  ];

  if (inputs.safeToDrive !== "yes") {
    items.push({
      id: "what-fails",
      title: "Ask exactly what's failing",
      detail: "And what would happen if you drove it 20 miles to another shop.",
    });
  }
  if (inputs.carValueRepaired > 0 && inputs.quoteTotal > inputs.carValueRepaired * 0.5) {
    items.push({
      id: "car-value",
      title: "Double-check the car's value",
      detail: "The repair is more than half of what the car is worth. Check two sources, like KBB and Edmunds.",
    });
  }
  if (inputs.loanBalance > 0 && asIsValue(inputs) < inputs.loanBalance) {
    items.push({
      id: "payoff",
      title: "Get your exact loan payoff",
      detail: "You may owe more than the car is worth as-is. Your lender can give you the payoff amount.",
    });
  }
  if (inputs.keep !== undefined && inputs.keep !== "forever" && inputs.keep < 12) {
    items.push({
      id: "resale",
      title: "Check what the repair adds to resale value",
      detail: "If you sell within a year, the next owner gets most of this repair.",
    });
  }
  if (inputs.typicalPrice && inputs.quoteTotal > 0 && compareQuote(inputs.quoteTotal, inputs.typicalPrice).position === "above") {
    items.push({
      id: "whats-included",
      title: "Ask what the quote includes",
      detail: "It's above the typical range. Ask what it covers that a typical job might not.",
    });
  }
  return items;
}
