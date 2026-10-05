import { describe, expect, it } from "vitest";
import {
  budgetMicro,
  costMicro,
  isBudgetExhaustedError,
  isPaused,
  markExhausted,
  memoryStore,
  monthKey,
  nextMonthStart,
  reserve,
  settle,
  toMicro,
} from "../lib/budget";

const oct = new Date("2026-10-05T20:00:00Z");
const BUDGET = toMicro(15);

describe("calendar month (UTC)", () => {
  it("keys spend by UTC month", () => {
    expect(monthKey(oct)).toBe("price-check-spend:2026-10");
    // 8pm Oct 31 in California is already November in UTC
    expect(monthKey(new Date("2026-11-01T03:00:00Z"))).toBe("price-check-spend:2026-11");
  });
  it("finds the first of next month, including across the year", () => {
    expect(nextMonthStart(oct)).toBe("2026-11-01");
    expect(nextMonthStart(new Date("2026-12-31T23:59:59Z"))).toBe("2027-01-01");
  });
});

describe("budgetMicro", () => {
  it("defaults to $15 and can only be lowered", () => {
    expect(budgetMicro()).toBe(toMicro(15));
    expect(budgetMicro("")).toBe(toMicro(15));
    expect(budgetMicro("5")).toBe(toMicro(5));
    expect(budgetMicro("0")).toBe(0);
    expect(budgetMicro("100")).toBe(toMicro(15));
    expect(budgetMicro("abc")).toBe(toMicro(15));
  });
});

describe("costMicro", () => {
  it("prices Claude Opus 5.5 tokens and web searches", () => {
    // 50k in × $4/M = $0.20, 2k out × $20/M = $0.04, 3 searches × $0.01 = $0.03
    const usage = { input_tokens: 50_000, output_tokens: 2_000, server_tool_use: { web_search_requests: 3 } };
    expect(costMicro(usage, "claude-opus-5-5")).toBe(toMicro(0.27));
  });
  it("prices any other model (e.g. a fallback) at the higher rate", () => {
    expect(costMicro({ input_tokens: 1_000_000, output_tokens: 0 }, "claude-opus-4-8")).toBe(toMicro(5));
  });
  it("counts cache writes and reads", () => {
    const usage = { cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 };
    expect(costMicro(usage, "claude-opus-5-5")).toBe(toMicro(4 * 1.25 + 4 * 0.1));
  });
  it("handles missing fields", () => {
    expect(costMicro({ input_tokens: null, server_tool_use: null }, "claude-opus-5-5")).toBe(0);
  });
});

describe("reserve and settle", () => {
  it("swaps the $1 reserve for the real cost", async () => {
    const store = memoryStore();
    const key = await reserve(store, oct, BUDGET);
    expect(key).toBe("price-check-spend:2026-10");
    expect(await store.get(key!)).toBe(toMicro(1));
    await settle(store, key!, toMicro(0.27));
    expect(await store.get(key!)).toBe(toMicro(0.27));
  });

  it("stops before a lookup could push the month past $15", async () => {
    const store = memoryStore();
    await store.incrBy(monthKey(oct), toMicro(14)); // exactly $1 left: one more fits
    expect(await isPaused(store, oct, BUDGET)).toBe(false);
    const first = await reserve(store, oct, BUDGET);
    expect(first).not.toBeNull();
    // a second lookup at the same time doesn't fit, and its reservation is released
    expect(await reserve(store, oct, BUDGET)).toBeNull();
    expect(await store.get(monthKey(oct))).toBe(toMicro(15));
    await settle(store, first!, toMicro(0.3));
    expect(await store.get(monthKey(oct))).toBe(toMicro(14.3));
    expect(await isPaused(store, oct, BUDGET)).toBe(true); // $0.70 left < $1 reserve
  });

  it("starts fresh next month", async () => {
    const store = memoryStore();
    await store.incrBy(monthKey(oct), toMicro(15));
    expect(await isPaused(store, oct, BUDGET)).toBe(true);
    expect(await isPaused(store, new Date("2026-11-01T00:00:00Z"), BUDGET)).toBe(false);
  });

  it("a budget of $0 pauses immediately", async () => {
    expect(await isPaused(memoryStore(), oct, 0)).toBe(true);
  });
});

describe("the provider's own cap", () => {
  it("recognizes Anthropic's spend-limit error, for the org or a workspace", () => {
    expect(isBudgetExhaustedError(400, "400 You have reached your specified API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.")).toBe(true);
    expect(isBudgetExhaustedError(400, "You have reached your specified workspace API usage limits.")).toBe(true);
  });
  it("recognizes a gateway running out of credits", () => {
    expect(isBudgetExhaustedError(402, "Payment required")).toBe(true);
    expect(isBudgetExhaustedError(400, "Budget has been exceeded! Current cost: 25.01, Max budget: 25.0")).toBe(true);
    expect(isBudgetExhaustedError(429, "Monthly credits exhausted for this key")).toBe(true);
    expect(isBudgetExhaustedError(403, "Insufficient credits")).toBe(true);
  });
  it("doesn't mistake ordinary errors for a used-up budget", () => {
    expect(isBudgetExhaustedError(429, "Rate limit exceeded, retry in 10s")).toBe(false);
    expect(isBudgetExhaustedError(400, "messages: roles must alternate")).toBe(false);
    expect(isBudgetExhaustedError(500, "credits service exceeded timeout")).toBe(false);
  });

  it("marks the month used up even after the lookup's reservation is settled", async () => {
    const store = memoryStore();
    const key = await reserve(store, oct, BUDGET);
    await settle(store, key!, 0); // the rejected request cost nothing
    await markExhausted(store, oct, BUDGET);
    expect(await isPaused(store, oct, BUDGET)).toBe(true);
  });
});
