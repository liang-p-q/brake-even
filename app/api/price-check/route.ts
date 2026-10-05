// POST /api/price-check: asks Claude what a repair typically costs at independent shops.
// GET /api/price-check: whether lookups are paused because this month's budget is used up.
// Runs on the server so the API key never reaches the browser. Requests go through MIT Parley
// (ANTHROPIC_BASE_URL), which doesn't support Claude's web search tool, so the estimate comes
// from the model's own knowledge.

import Anthropic from "@anthropic-ai/sdk";
import {
  budgetMicro,
  costMicro,
  createBudgetStore,
  isPaused,
  isBudgetExhaustedError,
  markExhausted,
  nextMonthStart,
  reserve,
  settle,
} from "@/lib/budget";
import {
  buildUserMessage,
  cacheKey,
  cleanResult,
  validateRequest,
  type PriceCheckRequest,
  type PriceCheckResponse,
  type PriceCheckResult,
  type PriceCheckStatus,
} from "@/lib/priceCheck";

export const maxDuration = 60; // seconds; a lookup usually takes 10–20s
export const dynamic = "force-dynamic"; // the paused/available status must be checked per request

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `You estimate what a car repair typically costs at independent repair shops in the United States, from your own knowledge of parts prices, book labor times, and shop labor rates. You can't search the web. You're part of Brake Even, a tool that shows drivers costs and assumptions without telling them what to do.

Call report_price_range once with your estimate.

- priceLow and priceHigh: the typical total (parts plus labor, before tax) at an independent shop, in whole US dollars at current-year prices. If a ZIP code is given, account for labor rates in that area; otherwise use a national range.
- Make the range wide enough to cover normal variation in parts brands and labor rates. When you're unsure, widen it rather than guessing a narrow one.
- If the description is too vague to price, or isn't a car repair, set found to false, set the numbers to 0, and use notes to say what detail is missing.
- notes: one or two plain sentences on what moves the price within the range (for example OEM vs. aftermarket parts, or labor hours). Don't judge any quote or advise whether to do the repair.`;

const REPORT_TOOL: Anthropic.Beta.BetaTool = {
  name: "report_price_range",
  description: "Report the typical independent-shop price range for the repair. Call this once.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "found",
      "interpretedAs",
      "priceLow",
      "priceHigh",
      "partsLow",
      "partsHigh",
      "laborHoursLow",
      "laborHoursHigh",
      "notes",
    ],
    properties: {
      found: { type: "boolean", description: "false if the repair can't be priced from the description" },
      interpretedAs: { type: "string", description: "The repair as you understood it, e.g. 'Replace front brake pads and rotors'" },
      priceLow: { type: "number", description: "Low end of the typical total, USD" },
      priceHigh: { type: "number", description: "High end of the typical total, USD" },
      partsLow: { type: "number", description: "Low end of parts cost, USD" },
      partsHigh: { type: "number", description: "High end of parts cost, USD" },
      laborHoursLow: { type: "number", description: "Low end of book labor time, hours" },
      laborHoursHigh: { type: "number", description: "High end of book labor time, hours" },
      notes: { type: "string" },
    },
  },
};

class PriceCheckError extends Error {}

/**
 * Runs one lookup. Adds what each API response cost to `meter` as it goes, so the spend is
 * recorded even if a later turn fails.
 */
async function lookUp(client: Anthropic, req: PriceCheckRequest, meter: { micro: number }): Promise<PriceCheckResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: buildUserMessage(req) }];

  // Two turns at most: nudge once if the model finishes without calling the report tool. Turn and
  // token caps keep one lookup's cost well under the budget's per-lookup reserve.
  for (let turn = 0; turn < 2; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // retry on another model if this one declines
      output_config: { effort: "medium" },
      system: SYSTEM_PROMPT,
      tools: [REPORT_TOOL],
      tool_choice: { type: "auto" },
      messages,
    });
    meter.micro += costMicro(response.usage, response.model);
    const u = response.usage;
    console.info(
      `price-check: turn ${turn + 1} ${response.stop_reason} model=${response.model} in=${u.input_tokens} cacheWrite=${u.cache_creation_input_tokens ?? 0} cacheRead=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`,
    );

    if (response.stop_reason === "refusal") throw new PriceCheckError("This repair couldn't be looked up. Try describing it differently.");

    const report = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === REPORT_TOOL.name,
    );
    if (report) {
      const result = cleanResult(report.input);
      if (!result) throw new PriceCheckError("The price check returned something unreadable. Try again.");
      return result;
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: "Call report_price_range now with your best estimate." });
  }
  throw new PriceCheckError("The price check didn't return a result. Try again.");
}

// Best-effort guards against one visitor hammering the price check. This state lives in one server
// instance, so it's a speed bump; the monthly cap is the budget meter (lib/budget.ts), inside Parley's
// monthly credits.
const PER_IP_PER_HOUR = 10;
const PER_INSTANCE_PER_DAY = 100;
const hitsByIp = new Map<string, number[]>();
const dailyHits: number[] = [];
const cache = new Map<string, { at: number; result: PriceCheckResult }>();
const HOUR = 60 * 60 * 1000;

function allow(ip: string, now: number): boolean {
  while (dailyHits.length && now - dailyHits[0] > 24 * HOUR) dailyHits.shift();
  const recent = (hitsByIp.get(ip) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= PER_IP_PER_HOUR || dailyHits.length >= PER_INSTANCE_PER_DAY) return false;
  if (hitsByIp.size > 1000) hitsByIp.clear();
  hitsByIp.set(ip, [...recent, now]);
  dailyHits.push(now);
  return true;
}

function reply(body: PriceCheckResponse, status = 200) {
  return Response.json(body, { status });
}

const budgetStore = createBudgetStore(process.env);
const budget = () => budgetMicro(process.env.PRICE_CHECK_BUDGET_USD);

function monthlyLimit(now: Date) {
  return reply(
    {
      ok: false,
      code: "monthly_limit",
      resumesOn: nextMonthStart(now),
      error: "AI price checks are paused for the rest of the month because of high demand.",
    },
    503,
  );
}

export async function GET() {
  const now = new Date();
  let paused = false;
  try {
    paused = await isPaused(budgetStore, now, budget());
  } catch (error) {
    console.error("price-check: budget store unavailable", error); // the POST reports problems too
  }
  const status: PriceCheckStatus = { paused, resumesOn: nextMonthStart(now) };
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: "Expected a JSON body." }, 400);
  }
  const parsed = validateRequest(body);
  if (!parsed.ok) return reply(parsed, 400);

  const now = new Date();
  const key = cacheKey(parsed.value);
  const cached = cache.get(key);
  if (cached && now.getTime() - cached.at < 24 * HOUR) return reply({ ok: true, result: cached.result }); // free

  const unavailable = () => reply({ ok: false, error: "The price check is unavailable right now. Try again later." }, 503);
  let monthKey: string | null;
  try {
    if (await isPaused(budgetStore, now, budget())) return monthlyLimit(now);
    if (!process.env.ANTHROPIC_API_KEY) {
      return reply({ ok: false, error: "The price check isn't set up yet (no API key on the server)." }, 503);
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allow(ip, now.getTime())) return reply({ ok: false, error: "Too many price checks right now. Try again in an hour." }, 429);
    monthKey = await reserve(budgetStore, now, budget());
  } catch (error) {
    console.error("price-check: budget store unavailable", error); // fail closed: no meter, no spending
    return unavailable();
  }
  if (!monthKey) return monthlyLimit(now);

  const meter = { micro: 0 };
  let limitHit = false;
  try {
    const result = await lookUp(new Anthropic({ timeout: 100_000, maxRetries: 1 }), parsed.value, meter);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: now.getTime(), result });
    return reply({ ok: true, result });
  } catch (error) {
    if (error instanceof Anthropic.APIError && isBudgetExhaustedError(error.status, error.message)) {
      console.error(`price-check: provider budget used up (${error.status}): ${error.message}`);
      limitHit = true; // the provider's own cap tripped before the meter did
      return monthlyLimit(now);
    }
    if (error instanceof PriceCheckError) return reply({ ok: false, error: error.message }, 502);
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("price-check: API key rejected");
      return reply({ ok: false, error: "The price check isn't set up correctly (API key rejected)." }, 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return reply({ ok: false, error: "The price check is busy. Try again in a minute." }, 503);
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return reply({ ok: false, error: "The price check took too long. Try again." }, 504);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`price-check: API error ${error.status}: ${error.message}`);
      return reply({ ok: false, error: "The price check failed. Try again." }, 502);
    }
    console.error("price-check: unexpected error", error);
    return reply({ ok: false, error: "The price check failed. Try again." }, 500);
  } finally {
    try {
      await settle(budgetStore, monthKey, meter.micro);
      if (meter.micro > 0) console.info(`price-check: lookup cost $${(meter.micro / 1_000_000).toFixed(4)}`);
      if (limitHit) await markExhausted(budgetStore, now, budget());
    } catch (error) {
      console.error("price-check: couldn't record spend", error);
    }
  }
}
