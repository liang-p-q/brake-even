import { describe, expect, it } from "vitest";
import { formatAssumption, usdShort, usdShortRange } from "../lib/format";

describe("format", () => {
  it("compacts dollars", () => {
    expect(usdShort(950)).toBe("$950");
    expect(usdShort(2100)).toBe("$2.1k");
    expect(usdShort(2000)).toBe("$2k");
    expect(usdShort(25431)).toBe("$25k");
    expect(usdShortRange(2070, 2250)).toBe("$2.1k–2.3k");
    expect(usdShortRange(2100, 2140)).toBe("$2.1k");
  });
  it("formats assumptions in their unit", () => {
    expect(formatAssumption(150, "$")).toBe("$150");
    expect(formatAssumption(0.2, "%")).toBe("20%");
    expect(formatAssumption(0.1125, "%")).toBe("11.25%");
    expect(formatAssumption(0.085, "%")).toBe("8.5%");
    expect(formatAssumption(3, "days")).toBe("3 days");
    expect(formatAssumption(2.25, "days")).toBe("2.3 days");
  });
});
