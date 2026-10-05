# Brake Even: Build Plan

Source: `PeterLiang.BrakeEven.AiProSeminar.pdf` (product brief, Sep 29 2026)
Budget: 3 Monday sessions × 1–3 hrs (3–9 hrs total) + ~1 hr of non-coding prep
Pipeline: vibe-code with Claude Code → push to GitHub → Vercel auto-deploys

---

## 1. What we're building (one paragraph)

A mobile-first web app. The user enters one repair quote and answers 5 questions. They get three side-by-side cards: **Repair now**, **Second opinion**, and **Replace**. Each card shows the upfront cash needed next to the cash they have, plus an approximate 12-month cost. Below the cards: editable assumptions, a list of "assumptions that could flip this", and a checklist of facts to verify. The app gives no verdict. In v1, nothing leaves the phone.

---

## 2. Tech stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Vercel's native framework, zero-config deploy. It also has API routes, which the photo-upload stretch goal needs to keep an API key secret. |
| Styling | **Tailwind CSS** | Fast for vibe coding, and mobile-first by default |
| Math | **Plain TypeScript module** (`lib/calc.ts`) | Pure functions with no UI, so they're easy to test against real quotes |
| Tests | **Vitest** | Checks the "within ~15% of what I paid" success criterion automatically |
| State | React state + `localStorage` (inputs only) | No backend or database in v1. It's private by default, which fits the trust angle. |
| Hosting | **Vercel (Hobby, free)** connected to GitHub | Every push to `main` deploys to production, and every branch gets a preview URL |
| Stretch | Anthropic API (Claude vision) from a Next.js API route | Reads the line items from a quote photo |

Skip on purpose: auth, a database, analytics, payments, and a component library.

---

## 3. The calculation model (fixed before writing code)

This is the core of the app. Writing it down first gives the AI an exact spec to code against.

### Inputs (the questions the user answers)
| Field | Notes |
|---|---|
| `quoteTotal` | Repair quote, $ (manual entry; optional parts/labor split) |
| `carValueRepaired` | What the car is worth once fixed (user looks up KBB/Edmunds; we link out) |
| `loanBalance` | $ still owed (0 if none) |
| `loanPayment` | Monthly payment on current car. **Optional, but recommended** (see §8). |
| `cashAvailable` | Cash they're willing to spend now |
| `keepMonths` | How long they hoped to keep the car |
| `safeToDrive` | yes / no / not sure (what the shop said) |

### Editable default assumptions (shown on screen, each with its source)
| Assumption | Placeholder default | Used by |
|---|---|---|
| `diagFee`: second-opinion diagnostic fee | ~$150 | Second opinion |
| `indieSavingsPct`: typical independent-shop price vs. the quote | ~20% lower | Second opinion |
| `daysWithoutCar` × `dailyTransportCost`: if unsafe | 3 days × $50 | Second opinion (and repair if unsafe) |
| `followOnRepairsPerYear`: other repairs on the current car | ~$1,200 | Repair, Second opinion |
| `asIsValueHaircut`: trade-in value of the car unrepaired | value − quote (floored at 0) | Replace |
| `replacementPrice` | ~avg. used-car price | Replace |
| `taxFeesPct` | ~8% | Replace |
| `downPaymentPct`, `apr`, `termMonths` | 10%, ~market used APR, 60 | Replace |
| `replacementRepairsPerYear` | ~$500 | Replace |

> **Placeholder numbers above are for scaffolding only.** Replace each one with a sourced figure during prep (§6). Show the source next to each assumption in the UI.

### Formulas (12-month window, cash out of pocket)
- **Repair now**
  - Upfront = `quoteTotal`
  - 12-mo = `quoteTotal + followOnRepairsPerYear + 12 × loanPayment`
- **Second opinion**: shown as a **range**
  - Upfront = `diagFee` (+ transport if unsafe)
  - 12-mo best case = `diagFee + quoteTotal × (1 − indieSavingsPct) + followOnRepairsPerYear + 12 × loanPayment + transport`
  - 12-mo worst case = the same with no savings (second shop confirms the quote)
- **Replace**
  - Equity = `asIsValue − loanBalance` (can be negative, meaning the loan is underwater)
  - Upfront = `replacementPrice × (downPaymentPct + taxFeesPct) − max(equity, 0)`. If equity < 0, the shortfall rolls into the new loan; show this as a flagged assumption.
  - 12-mo = `upfront + 12 × newPayment + replacementRepairsPerYear`
- **Cash check** (each card): a bar showing `upfront` against `cashAvailable`, labeled "covered" or "short by $X". The wording describes the numbers and never says whether to proceed.

### "Assumptions that could change the answer"
For each assumption, nudge it ±25%. If any nudge changes which path is cheapest over 12 months, list that assumption. Example: *"If the independent shop is only 5% cheaper (not 20%), Repair now becomes cheaper than Second opinion."* This is simple to compute and directly satisfies the must-have.

### "Facts to verify before approving work" (rule-based checklist)
- Always: ask for an itemized quote (parts / labor hours / labor rate), the warranty on parts and labor, OEM vs. aftermarket parts, and whether the diagnostic fee is credited toward the repair.
- If `safeToDrive ≠ yes`: "Ask exactly what fails and what happens if you drive it 20 miles to another shop."
- If quote > 50% of `carValueRepaired`: "Confirm the car's value with 2 sources."
- If equity < 0: "Get the exact loan payoff amount from your lender."
- If `keepMonths` < 12: "Most of this repair's value goes to the next owner. Check what it adds to resale value."

---

## 4. Screens

1. **Landing / form**, a single page in 3 short sections: *The quote*, *Your car*, *Your cash*. Use big numeric inputs (`inputMode="decimal"`) and a "See my options" button.
2. **Results**
   - Three path cards, stacked on mobile and side by side on desktop: upfront, cash bar, 12-mo cost/range
   - Collapsible "Assumptions": editable fields with sources. Results recalculate live.
   - "What could change this" (sensitivity list)
   - "Before you approve anything" checklist
   - Footer: "Estimates, not advice. No verdict by design."
3. (Stretch) **"Snap your quote"** button on the form, which pre-fills `quoteTotal` and line items.

Visual identity: reuse the brief's dark navy + brake-red accent and the brake-rotor motif.

---

## 5. Repo layout

> The folder name `Brake Even` has a space, which npm rejects as a package name. Scaffold the app into a `brake-even/` subfolder. Make that subfolder the git repo, and copy the brief and this plan into `brake-even/docs/`.

```
brake-even/
  app/
    page.tsx              # form + results (single page is fine)
    api/parse-quote/route.ts   # stretch only
  components/
    QuoteForm.tsx  PathCard.tsx  CashBar.tsx
    AssumptionsPanel.tsx  Sensitivity.tsx  VerifyChecklist.tsx
  lib/
    calc.ts               # all math, pure functions
    defaults.ts           # default assumptions + source citations
    checklist.ts          # verify-facts rules
  tests/
    calc.test.ts
    real-quotes.test.ts   # your past quotes vs. what you actually paid
  docs/  PLAN.md  brief.pdf
  CLAUDE.md               # standing instructions for the AI
```

`CLAUDE.md` should say: mobile-first, never output a verdict or "you can afford it", all math lives in `lib/calc.ts` with tests, every default has a citation in `defaults.ts`, and keep dependencies minimal.

---

## 6. Prep before Week 1 (~1 hr, no coding)

- [ ] **Accounts and tools:** GitHub account, Vercel account (sign up *with GitHub*), Node.js LTS installed (`node -v`), git configured (`git config --global user.name/email`), and the GitHub CLI (`gh auth login`) for convenience.
- [ ] **Dig up past quotes.** For each one, record the quote, car value at the time, what you actually paid, where you had it done, and the path you took. This is your test set. Aim for 3+.
- [ ] **Pick sources for defaults** (the brief's open question). Suggested sources:
  - Replacement price: Edmunds / Cox Automotive average used-vehicle listing price
  - Used-car APR: Experian *State of the Automotive Finance Market*
  - Annual repair/maintenance: AAA *Your Driving Costs*, or a CarEdge / Consumer Reports age-based figure
  - Diagnostic fee and dealer vs. independent labor-rate gap: RepairPal or your own shop experience (cite it as such)
- [ ] Decide the two open model questions in §8.

---

## 7. Sprint schedule

### Week 1: Skeleton, math, and live on Vercel (goal: a URL that works)
1. `npx create-next-app@latest brake-even --ts --tailwind --app --eslint`
2. Write `CLAUDE.md`, and copy in the brief and this plan.
3. Have Claude implement `lib/calc.ts` and `lib/defaults.ts` exactly per §3, with Vitest tests for each formula (including the negative-equity and unsafe-to-drive cases).
4. Build a rough form that prints the 3 results as plain text. No styling yet.
5. **Ship it:** `git init` → first commit → `gh repo create brake-even --public --source=. --push` → in Vercel, choose *Add New → Project → Import* `brake-even` → Deploy. (No config needed. Vercel detects Next.js.)
6. Open the URL on your phone.

**Done when:** tests pass, the production URL loads on your phone, and entering a quote shows three numbers.

### Week 2: Real UI and the "no verdict" features
1. Path cards with `CashBar`, built mobile-first, with desktop as a 3-column layout
2. Assumptions panel: editable, live recalculation, a source shown for each default
3. Sensitivity list ("what could change this")
4. Verify-facts checklist
5. Persist inputs in `localStorage` (wrapped in try/catch)
6. Workflow change: develop on a branch (`git switch -c week2`), push, and check the **Vercel preview URL** on your phone before merging to `main`.

**Done when:** you can complete the full flow on your phone, and every must-have from the brief is visibly present.

### Week 3: Validate against reality, polish, and stretch
1. Add your past quotes to `tests/real-quotes.test.ts`, and assert the estimate is within 15% of what you paid.
2. Run each quote through the live app on your phone, timed. Check that it takes under 5 minutes and that the comparison supports the path you actually took.
3. Tune defaults if they're systematically off. Document every change in `defaults.ts`.
4. Polish: empty and invalid input states, $ formatting, accessibility (labels, contrast), page title and favicon.
5. **Stretch, only if steps 1–4 are done.** Photo upload:
   - API route `app/api/parse-quote/route.ts` sends the image to Claude (a vision-capable model) and asks for JSON with `{lineItems, partsTotal, laborTotal, total}`
   - Add `ANTHROPIC_API_KEY` in Vercel → Project → Settings → Environment Variables. Never commit it; keep it in `.env.local` locally.
   - The parsed result **pre-fills** the form, and the user confirms it. Update the privacy note, since the photo now leaves the device.
6. Tag `v1.0`, and record your results on the success criteria for the seminar.

---

## 8. Decisions to make (my recommendations)

1. **Count current loan payments in the 12-month cost?** *Recommend yes.* Ask for the monthly payment, which is optional and treated as 0 if blank. Without it, Replace looks artificially expensive, because it includes new payments while the other paths leave out old ones.
2. **Model depreciation or end-of-year equity?** *Recommend no for v1.* Show "cash out of pocket over 12 months" and add an explicit assumption note: "Doesn't count what each car is worth after 12 months." This is a strong candidate for v2.
3. **Single page or multi-step wizard?** *Recommend single page.* It's faster to build and also faster to finish in under 5 minutes.

---

## 9. Success checklist (from the brief)

- [ ] Estimates within ~15% of actual cost on each past quote tested
- [ ] Comparison supports the path you actually took
- [ ] Full flow on your phone in < 5 minutes
- [ ] All 6 must-haves present; none of the 4 out-of-scope items crept in

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| 3–9 hrs is tight | Deploy in week 1 so there's always a working version. The stretch goal is strictly last. |
| Too few past quotes | Use friends' or family's quotes, or forum posts with known outcomes |
| Defaults feel arbitrary | Cite every source on screen, and make every default editable |
| A "neutral" tool appearing to steer toward indie shops | Second-opinion savings is an editable assumption with a visible source, and the worst-case range assumes no savings |
| Untested with non-car-savvy users | Week 3: hand the phone to 1–2 people, watch silently, and note where they stall |
