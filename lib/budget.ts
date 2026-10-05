// Monthly spend cap for the AI price check (server only).
//
// Two layers keep a month's spend at or under $15:
// 1. This meter: each lookup reserves RESERVE_USD before it runs, then swaps the reservation for
//    its real cost (from the API's usage numbers). New lookups stop when the reserve no longer fits.
// 2. The provider's own cap: your MIT Parley monthly credits (or, on a direct Anthropic account, a
//    Claude Console spend limit). If it trips first, the route marks the month as used up so the
//    meter agrees.
//
// The meter lives in Upstash Redis when it's connected (shared by every server instance), and in
// memory otherwise (one instance only: fine for local dev, approximate in production).

export const MONTHLY_BUDGET_USD = 15;
export const RESERVE_USD = 1; // far more than a lookup costs (~$0.02 measured; worst case under $0.50)

const MICRO = 1_000_000; // the meter counts whole micro-dollars to avoid float drift
export const toMicro = (usd: number) => Math.round(usd * MICRO);

/** This month's budget: $15, or lower if PRICE_CHECK_BUDGET_USD says so (never higher). */
export function budgetMicro(override?: string): number {
  const n = override === undefined || override.trim() === "" ? NaN : Number(override);
  return toMicro(Number.isFinite(n) && n >= 0 ? Math.min(n, MONTHLY_BUDGET_USD) : MONTHLY_BUDGET_USD);
}

/** Storage key for a calendar month in UTC, which is when Anthropic's monthly limits reset. */
export function monthKey(now: Date): string {
  return `price-check-spend:${now.toISOString().slice(0, 7)}`;
}

/** First day of next month (UTC), e.g. "2026-11-01". */
export function nextMonthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

// Claude API list prices in USD per million tokens. Any other model (e.g. a fallback after a
// decline) is priced at the higher older-Opus rate so the meter never undercounts.
const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
};
const CONSERVATIVE_PRICE = { input: 5, output: 25 };
const WEB_SEARCH_USD = 0.01; // $10 per 1,000 searches

export type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

/** What one API response cost, in micro-dollars (rounded up). */
export function costMicro(usage: UsageLike, model: string): number {
  const p = PRICES_PER_MTOK[model] ?? CONSERVATIVE_PRICE;
  const n = (v?: number | null) => v ?? 0;
  const tokensUsd =
    (n(usage.input_tokens) * p.input +
      n(usage.output_tokens) * p.output +
      n(usage.cache_creation_input_tokens) * p.input * 1.25 +
      n(usage.cache_read_input_tokens) * p.input * 0.1) /
    1_000_000;
  return Math.ceil((tokensUsd + n(usage.server_tool_use?.web_search_requests) * WEB_SEARCH_USD) * MICRO);
}

/**
 * True when the provider refuses because an account-level budget is used up: Anthropic's spend-limit
 * error, a 402 Payment Required, or a gateway (like MIT Parley) saying its credits/budget/quota ran out.
 */
export function isBudgetExhaustedError(status: number | undefined, message: string): boolean {
  if (/reached your specified (workspace )?API usage limits/i.test(message)) return true;
  if (status === 402) return true;
  return (
    (status === 400 || status === 403 || status === 429) &&
    /\b(budget|credits?|quota)\b/i.test(message) &&
    /(exceed|exhaust|insufficient|ran out|run out|no remaining|used up)/i.test(message)
  );
}

export interface BudgetStore {
  get(key: string): Promise<number>;
  incrBy(key: string, micro: number): Promise<number>; // returns the new total
}

export function memoryStore(): BudgetStore {
  const totals = new Map<string, number>();
  return {
    async get(key) {
      return totals.get(key) ?? 0;
    },
    async incrBy(key, micro) {
      const total = (totals.get(key) ?? 0) + micro;
      totals.set(key, total);
      return total;
    },
  };
}

/** Upstash Redis over its REST API (plain fetch, no extra dependency). */
export function redisStore(url: string, token: string): BudgetStore {
  async function run(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
    const replies = (await res.json()) as { result?: unknown; error?: string }[];
    const failed = replies.find((r) => r.error);
    if (failed) throw new Error(`Redis: ${failed.error}`);
    return replies.map((r) => r.result);
  }
  return {
    async get(key) {
      const [value] = await run([["GET", key]]);
      return Number(value ?? 0);
    },
    async incrBy(key, micro) {
      const [total] = await run([["INCRBY", key, micro], ["EXPIRE", key, 60 * 60 * 24 * 40]]);
      return Number(total);
    },
  };
}

/** Redis if Vercel's Upstash integration (or a manual setup) provided credentials, else memory. */
export function createBudgetStore(env: Record<string, string | undefined>): BudgetStore {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? redisStore(url, token) : memoryStore();
}

/** True when this month's budget can't cover another lookup's reserve. */
export async function isPaused(store: BudgetStore, now: Date, budget: number): Promise<boolean> {
  return (await store.get(monthKey(now))) + toMicro(RESERVE_USD) > budget;
}

/** Hold the reserve for one lookup. Returns the key to settle against, or null if it doesn't fit. */
export async function reserve(store: BudgetStore, now: Date, budget: number): Promise<string | null> {
  const key = monthKey(now);
  const total = await store.incrBy(key, toMicro(RESERVE_USD));
  if (total > budget) {
    await store.incrBy(key, -toMicro(RESERVE_USD));
    return null;
  }
  return key;
}

/** Replace a lookup's reservation with what it actually cost. */
export async function settle(store: BudgetStore, key: string, actualMicro: number): Promise<void> {
  await store.incrBy(key, actualMicro - toMicro(RESERVE_USD));
}

/** Anthropic's limit tripped: treat the month as used up for everyone. */
export async function markExhausted(store: BudgetStore, now: Date, budget: number): Promise<void> {
  const key = monthKey(now);
  const spent = await store.get(key);
  if (spent < budget) await store.incrBy(key, budget - spent);
}
