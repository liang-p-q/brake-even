# Brake Even: Build Plan

Source: `PeterLiang.BrakeEven.AiProSeminar.pdf` (product brief, Sep 29 2026)
Budget: 3 Monday sessions × 1–3 hrs (3–9 hrs total) + ~1 hr of non-coding prep
Pipeline: vibe-code with Claude Code → push to GitHub → Vercel auto-deploys

> **Scope change (Oct 5):** the brief listed quote-fairness checks as out of scope. They're now **in**, as an
> AI price check: Claude's estimate of the typical independent-shop price range, plus where the quote sits relative to it.
> This is facts only, with no verdict. OEM part links, shop listings, and a DIY path are still out.
>
> **Budget (Oct 5):** AI price checks are capped at **$15 per calendar month**. When the month's budget is used up,
> the page shows "Price checks are paused until [the 1st]" and everything else keeps working.

---

## 1. What we're building (one paragraph)

A mobile-first web app. The user enters the car, what the repair is for, the quote, and a few answers about money and plans. They can tap **Check typical price**, which estimates what this repair usually costs at independent shops and shows where the quote sits. Then they get three side-by-side cards: **Repair now**, **Second opinion**, and **Replace**. Each card shows the upfront cash needed next to the cash they have, an approximate 12-month cost, and (if they said how long they'll keep the car) what the one-time costs work out to per month. Below the cards: editable assumptions, a list of "assumptions that could flip this", and a checklist of facts to verify. The app gives no verdict. Only the price check sends anything off the phone: the car, the repair, and an optional ZIP, never money details.

---

## 2. Tech stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Vercel's native framework, zero-config deploy. API routes keep the API key secret. |
| Styling | **Tailwind CSS** | Fast for vibe coding, and mobile-first by default |
| Math | **Plain TypeScript module** (`lib/calc.ts`) | Pure functions with no UI, so they're easy to test against real quotes |
| Tests | **Vitest** | Checks the "within ~15% of what I paid" success criterion automatically |
| State | The whole form lives in `localStorage` (`lib/useSavedForm.ts`), with validation in `lib/savedForm.ts` | Survives reloads with no database or account. "Start over" clears it. |
| Price check | **Claude Opus 5.5 via MIT Parley** (`https://parley.api.mit.edu`), called from `app/api/price-check/route.ts` | Typical price range for any repair on any car, from Claude's own knowledge (Parley doesn't support web search). About 1–2¢ per lookup, paid from Parley credits. |
| Spend cap | An app meter (`lib/budget.ts`) stored in **Upstash Redis** (free, via Vercel), inside your Parley monthly credits ($25 for grad students) | The meter holds the price check to $15 and tells visitors when to come back. Parley's credits are the only other limit, so the meter must be shared (Upstash) in production. |
| Hosting | **Vercel (Hobby, free)** connected to GitHub | Every push to `main` deploys to production, and every branch gets a preview URL. Functions can run up to 5 min. |
| VIN decoding | NHTSA's free vPIC API, called from the browser (`lib/vin.ts`) | Fills in year, make, and model with no key or cost. The VIN never goes to the AI. |
| Stretch | Photo upload via Claude vision, using the same API key | Reads the line items from a quote photo |

Skip on purpose: auth, a database, analytics, payments, and a component library.

---

## 3. The calculation model (fixed before writing code)

This is the core of the app. Writing it down first gives the AI an exact spec to code against.

### Inputs (the questions the user answers)
| Field | Notes |
|---|---|
| VIN | Optional. Decoding fills in year / make / model |
| Year / make / model | Used by the price check only |
| Repair description | "What's the repair for?", e.g. "front brake pads and rotors". Used by the price check. |
| `quoteTotal` | Repair quote, $ (manual entry; optional parts/labor split) |
| `safeToDrive` | yes / no / not sure (what the shop said) |
| ZIP | Optional, used by the price check only (local labor rates) |
| `carValueRepaired` | What the car is worth once fixed (user looks up KBB/Edmunds; we link out) |
| `loanBalance` | $ still owed (0 if none) |
| `loanPayment` | Monthly payment on current car (0 if none) |
| `cashAvailable` | Cash they're willing to spend now |
| `keep` | How long they hoped to keep it: Under a year (6 mo) / 1 / 2 / 3 / 5 years / **As long as it runs**. Optional. |
| `typicalPrice` | `{low, high}` from the price check, if run. The user can remove it. |

### Editable default assumptions (shown on screen, each with its source)
| Assumption | Placeholder default | Used by |
|---|---|---|
| `diagFee`: second-opinion diagnostic fee | ~$150 | Second opinion |
| `indieSavingsPct`: typical independent-shop price vs. the quote | ~20% lower | Second opinion (only when no price check ran) |
| `towCost` + `daysWithoutCar` × `dailyTransportCost`: if unsafe | $125 + 3 days × $50 | Second opinion |
| `followOnRepairsPerYear`: other repairs on the current car | ~$1,200 | Repair, Second opinion |
| as-is trade-in value | value − quote (floored at 0) | Replace |
| `replacementPrice` | ~avg. used-car price | Replace |
| `taxFeesPct` | ~8% | Replace |
| `downPaymentPct`, `apr`, `termMonths` | 10%, ~market used APR, 60 | Replace |
| `replacementRepairsPerYear` | ~$500 | Replace |
| `foreverYears`: what "as long as it runs" counts as | 8 years | Per-month spread |

> **Placeholder numbers above are for scaffolding only.** Replace each one with a sourced figure during prep (§6). Show the source next to each assumption in the UI.

### Formulas (12-month window, cash out of pocket)
- **Repair now**
  - Upfront = `quoteTotal`
  - 12-mo = `quoteTotal + followOnRepairsPerYear + 12 × loanPayment`
- **Second opinion**: shown as a **range**
  - Upfront = `diagFee` (+ tow and transport if unsafe)
  - Best-case repair price = the price check's typical midpoint, capped at the quote. Without a price check, use `quoteTotal × (1 − indieSavingsPct)`.
  - 12-mo best case = `upfront + best-case repair price + followOnRepairsPerYear + 12 × loanPayment`
  - 12-mo worst case = the same with the full quote (second shop confirms it)
- **Replace**
  - Equity = `asIsValue − loanBalance` (can be negative, meaning the loan is underwater)
  - Upfront = `replacementPrice × (downPaymentPct + taxFeesPct) − max(equity, 0)`. If equity < 0, the shortfall rolls into the new loan; show this as a flagged assumption.
  - 12-mo = `upfront + 12 × newPayment + replacementRepairsPerYear`, and show the new monthly payment
- **Per-month spread** (only if `keep` is answered): the path's one-time costs ÷ months kept. "As long as it runs" = `foreverYears × 12`. This doesn't change the 12-month numbers.
- **Cash check** (each card): a bar showing `upfront` against `cashAvailable`, labeled "covered" or "short by $X". The wording describes the numbers and never says whether to proceed.

### Price check (AI, optional)
- When the user taps the button, the server asks Claude (through Parley) for the typical total at independent shops, from its own knowledge. It returns: a range, what Claude understood the repair to be, the parts range, labor hours, and a short note.
- Parley doesn't support Claude's web search, so there are no source links. The panel labels the result a general-knowledge AI estimate and links to RepairPal's estimator for a cross-check.
- The quote's position is shown as a fact: within / $X (Y%) above the top / $X below the low end of the range.
- The user's quote is **not** sent to the AI, so it can't anchor on the quote.

### Monthly budget for the price check ($15)
- **Meter:** each lookup reserves $1 before it runs, then swaps that for its real cost, worked out from the API's usage numbers at Claude API list prices. Any model other than Claude Opus 5.5 is priced at the higher older-Opus rate, so the meter never undercounts. This assumes Parley bills at list prices, so compare the logged costs with Parley's usage page once.
- **When it stops:** once less than $1 of the month's budget is left, new lookups stop, so the month can't go past $15 even counting the last lookup. Cached repeat lookups are free and keep working.
- **Outer limit:** your Parley monthly credits, shared with anything else you use Parley for. If Parley refuses because credits ran out (or, on a direct Anthropic key, because a spend limit was hit), the app marks the month as used up.
- **Months reset at 00:00 UTC on the 1st.**
- **What visitors see:** the price-check panel shows "Price checks are paused until November 1… check back then", both on page load (from `GET /api/price-check`) and if a lookup gets paused.
- **Testing the notice:** `PRICE_CHECK_BUDGET_USD` can lower the budget (it can never raise it above $15). Set it to `0` in `.env.local` to preview the notice.

### "Assumptions that could change the answer"
For each assumption, and for the price-check range, nudge it ±25%. If any nudge changes which path has the lowest 12-month cost, list that assumption. Example: *"If the typical price were 25% lower, Second opinion becomes cheaper than Repair now."*

### "Facts to verify before approving work" (rule-based checklist)
- Always: ask for an itemized quote (parts / labor hours / labor rate), the warranty on parts and labor, OEM vs. aftermarket parts, and whether the diagnostic fee is credited toward the repair.
- If `safeToDrive ≠ yes`: "Ask exactly what fails and what happens if you drive it 20 miles to another shop."
- If quote > 50% of `carValueRepaired`: "Confirm the car's value with 2 sources."
- If equity < 0: "Get the exact loan payoff amount from your lender."
- If `keep` < 12 months: "Most of this repair's value goes to the next owner. Check what it adds to resale value."
- If the quote is above the typical range: "Ask the shop what's included that a typical job might not be."

---

## 4. Screens

1. **Landing / form**, a single page in 4 short sections:
   - *The car*: year, make, model
   - *The repair*: what it's for, quote, safe to drive, and the price-check panel
   - *Your money*: value, loan, payment, cash
   - *How long you hoped to keep it*: tap-to-pick buttons
   Use big numeric inputs (`inputMode="decimal"`).
2. **Results**
   - Three path cards, stacked on mobile and side by side on desktop: upfront, cash bar, 12-mo cost/range, per-month spread
   - Collapsible "Assumptions": editable fields with sources. Results recalculate live.
   - "What could change this" (sensitivity list)
   - "Before you approve anything" checklist
   - Footer: "Estimates, not advice. No verdict by design."
3. (Stretch) **"Snap your quote"** button on the form, which pre-fills the quote and line items.

Visual identity: reuse the brief's dark navy + brake-red accent and the brake-rotor motif.

---

## 5. Repo layout

> The folder name `Brake Even` has a space, which npm rejects as a package name. The app lives in the `brake-even/` subfolder, which is the git repo. The brief and this plan are in `brake-even/docs/`.

```
brake-even/
  app/
    page.tsx                    # form + results (single page)
    api/price-check/route.ts    # AI price check: the only server code
    api/parse-quote/route.ts    # stretch only
  components/
    PriceCheck.tsx  QuoteForm.tsx  PathCard.tsx  CashBar.tsx
    AssumptionsPanel.tsx  Sensitivity.tsx  VerifyChecklist.tsx
  lib/
    calc.ts               # all math, pure functions
    defaults.ts           # default assumptions + source citations
    priceCheck.ts         # price-check types, validation, source filtering
    budget.ts             # $15/month spend meter for the price check
    checklist.ts          # verify-facts rules
  tests/
    calc.test.ts  priceCheck.test.ts  budget.test.ts
    real-quotes.test.ts   # your past quotes vs. what you actually paid
  docs/  PLAN.md  brief.pdf
  .env.example            # copy to .env.local and add ANTHROPIC_API_KEY
  CLAUDE.md               # standing instructions for the AI
```

---

## 6. Prep (~1 hr, no coding)

- [x] **Accounts and tools:** GitHub, Node.js, git, and the GitHub CLI
- [ ] **Vercel:** sign up with GitHub and import `brake-even` (see Week 1)
- [x] **MIT Parley API key** (from platform.parley.mit.edu) in `.env.local`, with `ANTHROPIC_BASE_URL=https://parley.api.mit.edu`
- [ ] **Vercel environment variables:** add `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` in Vercel → Project → Settings → Environment Variables.
- [ ] **Shared spend meter (needed for a reliable $15 cap):** in Vercel → your project → Storage, add **Upstash for Redis** (free) and connect it to the project. It fills in the environment variables. Without it, the app's own count resets whenever Vercel starts a fresh server copy, and the only real limit left is your Parley credits.
- [ ] **Dig up past quotes.** For each one, record the car, what the repair was, the quote, car value at the time, what you actually paid, where you had it done, and the path you took. This is your test set. Aim for 3+. They also double as a test of the price check.
- [ ] **Pick sources for defaults** (the brief's open question). Suggested sources:
  - Replacement price: Edmunds / Cox Automotive average used-vehicle listing price
  - Used-car APR: Experian *State of the Automotive Finance Market*
  - Annual repair/maintenance: AAA *Your Driving Costs*, or a CarEdge / Consumer Reports age-based figure
  - Diagnostic fee and dealer vs. independent labor-rate gap: RepairPal or your own shop experience (cite it as such)

---

## 7. Sprint schedule

### Week 1: Skeleton, math, and live on Vercel ✅ (mostly done Oct 5)
- [x] Next.js app, `CLAUDE.md`, docs
- [x] `lib/calc.ts` + `lib/defaults.ts` with Vitest tests
- [x] Rough form with the 3 results
- [x] GitHub repo (`liang-p-q/brake-even`)
- [x] Added early: "what's the repair for", the AI price check, and "as long as it runs"
- [ ] Vercel import + API key (your part, ~10 min)

**Done when:** tests pass, the production URL loads on your phone, and a price check returns a range.

### Week 2: Real UI and the "no verdict" features ✅ (built early, Oct 5)
- [x] Car-nerd redesign: "service manual" day theme and "night dash" theme. The background (rotor, tach, tire tread) moves only when scrolling.
- [x] Path cards side by side on desktop, and swipeable on phones with a summary strip (`components/PathCards.tsx`)
- [x] Fuel-gauge cash bar with a low-fuel light (`components/CashGauge.tsx`, `cashCoverage` in `lib/calc.ts`)
- [x] "Tune the numbers": every assumption on a slider with its source. Only changed values are saved.
- [x] "What could change this" as check-engine lights (sensitivity UI)
- [x] "Before you approve anything" inspection checklist (`lib/checklist.ts`) with tickable items
- [x] Remember inputs on the device (including the price-check result, so it isn't paid for twice), with "Start over"
- [x] VIN decoder (NHTSA vPIC)
- [ ] Workflow change: develop on a branch (`git switch -c week2`), push, and check the **Vercel preview URL** on your phone before merging to `main`.

**Done when:** you can complete the full flow on your phone, and every must-have from the brief is visibly present.

### Week 3: Validate against reality, polish, and stretch
1. Add your past quotes to `tests/real-quotes.test.ts`, and assert the estimate is within 15% of what you paid.
2. Run each quote through the live app on your phone, timed. Check that it takes under 5 minutes and that the comparison supports the path you actually took. Note whether the price check's range contained what you paid.
3. Tune defaults if they're systematically off. Document every change in `defaults.ts`.
4. Polish: empty and invalid input states, $ formatting, accessibility (labels, contrast), page title and favicon.
5. **Stretch, only if steps 1–4 are done.** Photo upload via a new `app/api/parse-quote/route.ts`, using the same API key. The parsed result **pre-fills** the form, and the user confirms it.
6. Tag `v1.0`, and record your results on the success criteria for the seminar.

---

## 8. Decisions made

1. **Count current loan payments in the 12-month cost?** Yes. The monthly payment is optional and treated as 0 if blank.
2. **Model depreciation or end-of-year equity?** No for v1. This is a v2 candidate.
3. **Single page or a multi-step wizard?** Single page.
4. **Quote-fairness check (Oct 5):** moved into scope as an AI price check (Claude), not a static table or a link out. It's facts only, and the AI never sees the quote.
5. **"Forever" / "As long as it runs" (Oct 5):** an answer option, counted as `foreverYears` (editable, default 8) for per-month math only.
6. **$15/month cap on the price check (Oct 5):** the app's meter (shared via Upstash) stops early and shows the "paused until the 1st" notice. Parley's monthly credits are the outer limit.
7. **MIT Parley instead of a direct Anthropic account (Oct 5):** the price check runs on Parley's free monthly credits. Parley doesn't support Claude's web search, so the estimate comes from Claude's own knowledge, with a RepairPal cross-check link. Adding a separate search service is a possible upgrade.

---

## 9. Success checklist (from the brief)

- [ ] Estimates within ~15% of actual cost on each past quote tested
- [ ] Comparison supports the path you actually took
- [ ] Full flow on your phone in < 5 minutes (the price check adds ~30 s)
- [ ] All 6 must-haves present; none of the remaining out-of-scope items crept in

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| 3–9 hrs is tight | Deploy in week 1 so there's always a working version. The stretch goal is strictly last. |
| Too few past quotes | Use friends' or family's quotes, or forum posts with known outcomes |
| Defaults feel arbitrary | Cite every source on screen, and make every default editable |
| AI price estimate is wrong or dated (no live search) | Show it as a range, label it a general-knowledge estimate, link to RepairPal to cross-check, and let the user remove it. It's also listed in "what could change this". Check it against your past quotes in Week 3. |
| Someone abuses the public price check (it costs money) | Hard $15/month cap via the app's meter (shared via Upstash), with Parley credits as the outer limit. Also input limits, max 2 turns per lookup, per-device rate limiting, and caching of repeat lookups. |
| The $15 budget runs out mid-month | Visitors see "paused until the 1st", and the rest of the app works without it. If it happens often, revisit the per-device limit or the cache. |
| A "neutral" tool appearing to steer toward indie shops | The price check reports where the quote sits as a fact, never judges it, and the worst case still assumes no savings |
| Untested with non-car-savvy users | Week 3: hand the phone to 1–2 people, watch silently, and note where they stall |
