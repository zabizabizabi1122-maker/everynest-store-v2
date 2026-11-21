import { describe, expect, it } from "vitest";

import {
  averageRating,
  describeReviewError,
  reviewResultSchema,
  reviewStatusLabel,
  reviewSubmitSchema,
} from "./reviews";

const VALID_ID = "b0000000-0000-4000-8000-000000000004";

describe("review form validation", () => {
  it("accepts a valid submission", () => {
    const result = reviewSubmitSchema.safeParse({
      productId: VALID_ID,
      rating: "5",
      title: "Great quality",
      body: "Really comfortable and true to size, delivered on time.",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rating).toBe(5);
  });

  it("rejects out-of-range ratings and short text", () => {
    expect(
      reviewSubmitSchema.safeParse({
        productId: VALID_ID,
        rating: "6",
        title: "Good",
        body: "Long enough body text here.",
      }).success,
    ).toBe(false);

    expect(
      reviewSubmitSchema.safeParse({
        productId: VALID_ID,
        rating: "1",
        title: "Good",
        body: "short",
      }).success,
    ).toBe(false);
  });

  it("rejects a client-supplied status field (strict schema)", () => {
    expect(
      reviewSubmitSchema.safeParse({
        productId: VALID_ID,
        rating: "5",
        title: "Great quality",
        body: "A sufficiently long review body.",
        status: "approved",
      }).success,
    ).toBe(false);
  });
});

describe("review result validation", () => {
  it("accepts the RPC payload and rejects a tampered status", () => {
    expect(
      reviewResultSchema.safeParse({
        id: VALID_ID,
        status: "pending",
        productId: VALID_ID,
      }).success,
    ).toBe(true);

    expect(
      reviewResultSchema.safeParse({
        id: VALID_ID,
        status: "approved",
        productId: VALID_ID,
      }).success,
    ).toBe(false);
  });
});

describe("review display helpers", () => {
  it("computes an average rating", () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([{ rating: 5 }, { rating: 4 }])).toBe(4.5);
    expect(averageRating([{ rating: 5 }, { rating: 5 }, { rating: 4 }])).toBe(4.7);
  });

  it("labels statuses and maps errors to safe messages", () => {
    expect(reviewStatusLabel("pending")).toBe("Pending review");
    expect(reviewStatusLabel("approved")).toBe("Approved");
    expect(reviewStatusLabel("rejected")).toBe("Rejected");
    expect(describeReviewError("P0002")).toContain("delivered order");
    expect(describeReviewError(null)).toContain("could not be submitted");
  });
});
