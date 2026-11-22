import { describe, expect, it } from "vitest";

import {
  ORDER_STATUSES,
  ORDER_TRANSITION_TARGETS,
  ORDER_TRANSITION_TARGETS as targets,
  describeOrderError,
  formatOrderDate,
  formatOrderPaisa,
  orderDetailSchema,
  orderListResultSchema,
  orderStatusLabel,
  orderStatusSchema,
  orderStatusTone,
  orderSummarySchema,
  staffTransitions,
  transitionInputSchema,
  transitionTargetSchema,
} from "./orders";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";

const summary = {
  id: ORDER_ID,
  orderNumber: "ZS-202611-000001",
  status: "pending",
  totalPaisa: "150050",
  customerName: "Test Customer",
  city: "Lahore",
  itemCount: 2,
  createdAt: "2026-11-20T10:00:00.000Z",
};

const detail = {
  id: ORDER_ID,
  orderNumber: "ZS-202611-000001",
  status: "pending",
  subtotalPaisa: "150000",
  shippingPaisa: "0",
  discountPaisa: "0",
  totalPaisa: "150050",
  customerName: "Test Customer",
  phone: "+923001234567",
  email: "test@example.com",
  address: "12 Main Street, Lahore",
  city: "Lahore",
  requirements: "Size M",
  notes: null,
  createdAt: "2026-11-20T10:00:00.000Z",
  items: [
    {
      id: ITEM_ID,
      productName: "Test Product",
      variantLabel: "size: M, color: blue",
      pricePaisa: 75000,
      quantity: 2,
      lineTotalPaisa: "150000",
    },
  ],
};

describe("order lifecycle contracts", () => {
  it("accepts every database status and transition target only", () => {
    expect(orderStatusSchema.safeParse("pending").success).toBe(true);
    expect(orderStatusSchema.safeParse("delivered").success).toBe(true);
    expect(orderStatusSchema.safeParse("paid").success).toBe(false);

    for (const status of ORDER_STATUSES) expect(orderStatusSchema.safeParse(status).success).toBe(true);
    for (const target of ORDER_TRANSITION_TARGETS) {
      expect(transitionTargetSchema.safeParse(target).success).toBe(true);
    }
    expect(transitionTargetSchema.safeParse("pending").success).toBe(false);
  });

  it("strictly validates transition input", () => {
    expect(
      transitionInputSchema.safeParse({ orderId: ORDER_ID, targetStatus: "contacted" }).success,
    ).toBe(true);
    expect(
      transitionInputSchema.safeParse({ orderId: "not-a-uuid", targetStatus: "contacted" }).success,
    ).toBe(false);
    expect(
      transitionInputSchema.safeParse({ orderId: ORDER_ID, targetStatus: "pending" }).success,
    ).toBe(false);
    expect(
      transitionInputSchema.safeParse({
        orderId: ORDER_ID,
        targetStatus: "contacted",
        actorId: ORDER_ID,
      }).success,
    ).toBe(false);
  });

  it("validates list/detail payloads and keeps money as decimal strings", () => {
    expect(orderSummarySchema.safeParse(summary).success).toBe(true);
    expect(orderDetailSchema.safeParse(detail).success).toBe(true);
    expect(orderDetailSchema.safeParse({ ...detail, totalPaisa: 150050 }).success).toBe(false);
    expect(orderDetailSchema.safeParse({ ...detail, totalPaisa: "1500.50" }).success).toBe(false);
    expect(
      orderDetailSchema.safeParse({ ...detail, items: [{ ...detail.items[0], quantity: 0 }] }).success,
    ).toBe(false);
    expect(
      orderListResultSchema.safeParse({ orders: [summary], total: "1", page: 1, pageSize: 20 }).success,
    ).toBe(true);
    expect(
      orderListResultSchema.safeParse({ orders: [summary], total: 1, page: 1, pageSize: 20 }).success,
    ).toBe(false);
  });

  it("matches the admin-only database transition rules", () => {
    expect(staffTransitions("pending")).toEqual(["contacted", "cancelled"]);
    expect(staffTransitions("contacted")).toEqual(["verified", "cancelled"]);
    expect(staffTransitions("verified")).toEqual(["processing", "cancelled"]);
    expect(staffTransitions("processing")).toEqual(["shipped", "cancelled"]);
    expect(staffTransitions("shipped")).toEqual(["delivered"]);
    expect(staffTransitions("delivered")).toEqual([]);
    expect(staffTransitions("cancelled")).toEqual([]);
  });

  it("maps database errors to safe messages", () => {
    expect(describeOrderError("42501")).toContain("not allowed");
    expect(describeOrderError("22023")).toContain("not available");
    expect(describeOrderError("P0002")).toContain("could not be found");
    expect(describeOrderError("P0001")).toContain("could not be updated");
    expect(describeOrderError("XX000")).toContain("could not update");
    expect(describeOrderError("XX000")).not.toMatch(/sql|postgres|detail/i);
  });

  it("formats status labels and money without losing precision", () => {
    for (const status of ORDER_STATUSES) {
      expect(orderStatusLabel(status)).toBeTruthy();
      expect(orderStatusTone(status)).toContain("bg-");
    }
    expect(formatOrderPaisa("9007199254740993")).toContain("90,071,992,547,409.93");
    expect(formatOrderDate("2026-11-20T10:00:00.000Z")).toMatch(/2026/);
  });

  it("keeps target constants unique and complete", () => {
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets).not.toContain("pending");
  });
});
