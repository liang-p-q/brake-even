@AGENTS.md

# Brake Even

Mobile-first web app: a driver enters one repair quote plus a few facts and sees three paths side by side
(Repair now / Second opinion / Replace) with upfront cash vs. cash available and an approximate 12-month cost.
An optional AI price check (Claude Opus 5.5 via MIT Parley) estimates what the repair typically costs at independent shops.
Product brief: `docs/brief.pdf`. Build plan and the calculation spec: `docs/PLAN.md` (§3 is the source of truth for math).

## Rules
- **No verdicts.** Never output "you can afford it", "we recommend", or pick a winner. Describe numbers and assumptions only.
- **All math lives in `lib/calc.ts`** as pure functions, with tests in `tests/`. UI components never compute costs.
- **Every default assumption lives in `lib/defaults.ts`** with a `source` string. No uncited magic numbers.
- Mobile-first: design for a ~375px-wide phone, then widen. Numeric inputs use `inputMode="decimal"`.
- No database or auth in v1. The only server code is the price check (`app/api/price-check/route.ts`), plus an
  optional Redis counter for its monthly budget.
- **The price check never spends more than $15 a month.** Every lookup goes through `lib/budget.ts`
  (reserve → run → settle). Parley's monthly credits are the only other limit, so the meter must stay accurate. Don't add any Claude call
  that bypasses the meter, and don't raise `MONTHLY_BUDGET_USD` without the owner's say-so.
- Price check: send only the car, repair, and optional ZIP, never money details or the quote. Run it only when the
  user taps the button (each call costs money). Always label it a general-knowledge AI estimate and show the
  cross-check link.
- Claude calls go through MIT Parley (`ANTHROPIC_BASE_URL=https://parley.api.mit.edu`, an Anthropic-compatible
  gateway). Parley rejects Claude's server tools (web search/fetch): every tool needs an `input_schema`.
- `ANTHROPIC_API_KEY` (a Parley key) lives in `.env.local` (git-ignored) and in Vercel's environment variables.
  Never commit it.
- Form state lives in `localStorage` via `lib/useSavedForm.ts`. New fields go in `lib/savedForm.ts` with validation, so an
  old or corrupted save never breaks the page. Wrap storage access in try/catch.
- The VIN goes only to NHTSA's vPIC API, straight from the browser. Never send it to the AI.
- Background animation is tied to scroll position only (no timers), and is static for `prefers-reduced-motion`.
- Keep dependencies minimal; ask before adding one.
- Out of scope: OEM part links, shop listings/referrals, a DIY path.

## Commands
- `npm run dev`: local server at http://localhost:3000
- `npm test`: Vitest
- `npm run build`: what Vercel runs; must pass before pushing to `main`
