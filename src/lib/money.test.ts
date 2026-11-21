import { describe, expect, it } from "vitest";

import {
  assertSafePaisa,
  effectivePricePaisa,
  formatPkr,
  paisaToRupees,
  rupeesToPaisa,
} from "./money";

describe("formatPkr", () => {
  it("formats zero", () => {
    expect(formatPkr(0)).toBe("Rs. 0");
  });

  it("formats whole rupees with grouping", () => {
    expect(formatPkr(150_000)).toBe("Rs. 1,500");
    expect(formatPkr(123_456_789)).toBe("Rs. 1,234,567.89");
  });

  it("shows two decimals only when paisa are present", () => {
    expect(formatPkr(150_050)).toBe("Rs. 1,500.50");
    expect(formatPkr(150_005)).toBe("Rs. 1,500.05");
  });

  it("formats negative values with the sign first", () => {
    expect(formatPkr(-500)).toBe("-Rs. 5");
  });

  it("accepts bigint values without precision loss", () => {
    expect(formatPkr(9_007_199_254_740_993n)).toBe("Rs. 90,071,992,547,409.93");
  });
});

describe("paisaToRupees", () => {
  it("returns a plain decimal string", () => {
    expect(paisaToRupees(150_050)).toBe("1500.50");
    expect(paisaToRupees(150_000)).toBe("1500");
    expect(paisaToRupees(-250)).toBe("-2.50");
  });
});

describe("rupeesToPaisa", () => {
  it("parses plain amounts", () => {
    expect(rupeesToPaisa("1500")).toBe(150_000);
    expect(rupeesToPaisa("1500.5")).toBe(150_050);
    expect(rupeesToPaisa("1500.50")).toBe(150_050);
  });

  it("parses formatted amounts with currency prefix and separators", () => {
    expect(rupeesToPaisa("Rs. 1,500.50")).toBe(150_050);
    expect(rupeesToPaisa("PKR 99")).toBe(9_900);
    expect(rupeesToPaisa("+42")).toBe(4_200);
  });

  it("accepts numbers for convenience", () => {
    expect(rupeesToPaisa(12)).toBe(1_200);
  });

  it("rejects more than two decimals instead of rounding", () => {
    expect(() => rupeesToPaisa("1.234")).toThrow(RangeError);
  });

  it("rejects negative and malformed amounts", () => {
    expect(() => rupeesToPaisa("-5")).toThrow(RangeError);
    expect(() => rupeesToPaisa("abc")).toThrow(RangeError);
    expect(() => rupeesToPaisa("")).toThrow(RangeError);
  });
});

describe("assertSafePaisa", () => {
  it("accepts non-negative safe integers", () => {
    expect(assertSafePaisa(0)).toBe(0);
    expect(assertSafePaisa(150_000)).toBe(150_000);
  });

  it("rejects fractions, negatives and unsafe values", () => {
    expect(() => assertSafePaisa(1.5)).toThrow(RangeError);
    expect(() => assertSafePaisa(-1)).toThrow(RangeError);
    expect(() => assertSafePaisa(Number.MAX_SAFE_INTEGER + 10)).toThrow(RangeError);
  });
});

describe("effectivePricePaisa", () => {
  it("returns the regular price when there is no sale price", () => {
    expect(effectivePricePaisa(10_000, null)).toBe(10_000);
  });

  it("returns the sale price when it is lower", () => {
    expect(effectivePricePaisa(10_000, 8_500)).toBe(8_500);
  });

  it("rejects a sale price that is not lower than the regular price", () => {
    expect(() => effectivePricePaisa(10_000, 10_000)).toThrow(RangeError);
    expect(() => effectivePricePaisa(10_000, 12_000)).toThrow(RangeError);
  });
});
