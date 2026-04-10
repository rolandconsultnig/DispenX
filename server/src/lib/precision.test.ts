import { describe, expect, it } from "vitest";
import { litersFromNaira, nairaFromLiters, toLiters, toMoney } from "./precision";

describe("precision helpers", () => {
  it("rounds money values to 2 decimal places", () => {
    expect(toMoney(123.456)).toBe(123.46);
    expect(toMoney(123.451)).toBe(123.45);
  });

  it("rounds liters to 3 decimal places", () => {
    expect(toLiters(11.23456)).toBe(11.235);
    expect(toLiters(11.23444)).toBe(11.234);
  });

  it("converts naira to liters with controlled precision", () => {
    expect(litersFromNaira(1000, 667)).toBe(1.499);
  });

  it("converts liters to naira with controlled precision", () => {
    expect(nairaFromLiters(1.499, 667)).toBe(999.83);
  });
});
