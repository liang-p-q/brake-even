import { describe, expect, it } from "vitest";
import { normalizeVin, parseVinResponse, titleCaseMake, VIN_PATTERN } from "../lib/vin";

// Trimmed real responses from NHTSA's DecodeVinValues
const accord = {
  Results: [
    {
      ModelYear: "2003",
      Make: "HONDA",
      Model: "Accord",
      Trim: "EX-V6",
      DisplacementL: "2.998832712",
      EngineCylinders: "6",
      EngineConfiguration: "V-Shaped",
      FuelTypePrimary: "Gasoline",
      ErrorCode: "0",
      ErrorText: "0 - VIN decoded clean. Check Digit (9th position) is correct",
    },
  ],
};

describe("VIN format", () => {
  it("normalizes input and rejects I, O, Q", () => {
    expect(normalizeVin(" 1hgcm8-2633a004352 ")).toBe("1HGCM82633A004352");
    expect(VIN_PATTERN.test("1HGCM82633A004352")).toBe(true);
    expect(VIN_PATTERN.test("1HGCM82633A00435")).toBe(false);
    expect(VIN_PATTERN.test("1HGCM82633A00435O")).toBe(false);
  });
  it("title-cases long makes but keeps short ones", () => {
    expect(titleCaseMake("HONDA")).toBe("Honda");
    expect(titleCaseMake("MERCEDES-BENZ")).toBe("Mercedes-Benz");
    expect(titleCaseMake("LAND ROVER")).toBe("Land Rover");
    expect(titleCaseMake("BMW")).toBe("BMW");
  });
});

describe("parseVinResponse", () => {
  it("reads year, make, model, and a spec line", () => {
    expect(parseVinResponse(accord)).toEqual({
      ok: true,
      year: "2003",
      make: "Honda",
      model: "Accord",
      spec: "EX-V6 · 3.0L V6 · Gasoline",
    });
  });
  it("still fills the car but warns when NHTSA flags the VIN", () => {
    const bad = { Results: [{ ...accord.Results[0], ErrorCode: "1", ErrorText: "1 - Check Digit (9th position) does not calculate properly" }] };
    expect(parseVinResponse(bad)).toMatchObject({ ok: true, make: "Honda", warning: "Check Digit (9th position) does not calculate properly" });
  });
  it("fails cleanly when nothing decodes", () => {
    expect(parseVinResponse({ Results: [{ Make: "", ModelYear: "", ErrorCode: "11" }] }).ok).toBe(false);
    expect(parseVinResponse(null).ok).toBe(false);
    expect(parseVinResponse({}).ok).toBe(false);
  });
});
