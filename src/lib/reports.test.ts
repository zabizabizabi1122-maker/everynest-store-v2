import { describe, expect, it } from "vitest";

import {
  formatReportDay,
  isReportDays,
  maxDailyRevenue,
  parseReportDays,
  reportDataSchema,
  reportsHref,
  salesBarWidth,
} from "./reports";

describe("report query helpers", () => {
  it("accepts only the supported reporting periods", () => {
    expect(parseReportDays("7")).toBe(7);
    expect(parseReportDays("30")).toBe(30);
    expect(parseReportDays("90")).toBe(90);
    expect(parseReportDays(undefined)).toBe(30);
    expect(parseReportDays("12")).toBe(30);
    expect(parseReportDays("abc")).toBe(30);
    expect(isReportDays(30)).toBe(true);
    expect(isReportDays(31)).toBe(false);
  });

  it("builds links without a redundant query string for the default period", () => {
    expect(reportsHref(30)).toBe("/admin/reports");
    expect(reportsHref(7)).toBe("/admin/reports?days=7");
  });
});

describe("report formatting", () => {
  it("formats a report day without shifting the calendar date", () => {
    const formatted = formatReportDay("2026-11-21");
    expect(formatted).toContain("21");
    expect(formatted).toContain("Nov");
  });

  it("uses bigint arithmetic for large revenue values", () => {
    const days = [
      { day: "2026-11-20", orders: 1, revenuePaisa: "9007199254740992" },
      { day: "2026-11-21", orders: 1, revenuePaisa: "9007199254740993" },
    ];
    expect(maxDailyRevenue(days)).toBe(9007199254740993n);
    expect(maxDailyRevenue([])).toBe(0n);
  });

  it("scales bars safely", () => {
    expect(salesBarWidth("50", 100n)).toBe(50);
    expect(salesBarWidth("0", 100n)).toBe(0);
    expect(salesBarWidth("200", 100n)).toBe(100);
    expect(salesBarWidth("10", 0n)).toBe(0);
  });
});

describe("report payload validation", () => {
  const payload = {
    generatedAt: "2026-11-21T10:00:00Z",
    timezone: "Asia/Karachi",
    days: 7,
    totalSalesPaisa: "20000",
    totalOrders: 1,
    statusCounts: {
      pending: 0,
      contacted: 0,
      verified: 1,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      all: 1,
    },
    activeProducts: 6,
    activeVariants: 13,
    lowStockCount: 5,
    topProducts: [],
    lowStock: [],
    recentOrders: [],
    dailySales: [],
  };

  it("accepts a well-formed RPC payload", () => {
    expect(reportDataSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects monetary numbers and unexpected timezones", () => {
    expect(reportDataSchema.safeParse({ ...payload, totalSalesPaisa: 20000 }).success).toBe(false);
    expect(reportDataSchema.safeParse({ ...payload, timezone: "UTC" }).success).toBe(false);
  });
});
