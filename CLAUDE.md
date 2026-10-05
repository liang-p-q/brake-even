@AGENTS.md

# Brake Even

Mobile-first web app: a driver enters one repair quote plus a few facts and sees three paths side by side
(Repair now / Second opinion / Replace) with upfront cash vs. cash available and an approximate 12-month cost.
Product brief: `docs/brief.pdf`. Build plan and the calculation spec: `docs/PLAN.md` (§3 is the source of truth for math).

## Rules
- **No verdicts.** Never output "you can afford it", "we recommend", or pick a winner. Describe numbers and assumptions only.
- **All math lives in `lib/calc.ts`** as pure functions, with tests in `tests/`. UI components never compute costs.
- **Every default assumption lives in `lib/defaults.ts`** with a `source` string. No uncited magic numbers.
- Mobile-first: design for a ~375px-wide phone, then widen. Numeric inputs use `inputMode="decimal"`.
- No backend, database, or auth in v1. Inputs stay on the device (localStorage at most).
- Keep dependencies minimal; ask before adding one.
- Out of scope: quote-fairness checks, OEM part links, shop listings/referrals, a DIY path.

## Commands
- `npm run dev`: local server at http://localhost:3000
- `npm test`: Vitest
- `npm run build`: what Vercel runs; must pass before pushing to `main`
