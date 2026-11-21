import { describe, expect, it } from "vitest";

import {
  addressIdSchema,
  createAddressSchema,
  describeAddressError,
  toAddressPrefill,
  type SavedAddress,
} from "./addresses";

const VALID_ID = "c0000000-0000-4000-8000-000000000001";

const validInput = {
  label: "Home",
  fullName: "Shahzaib Abrar",
  phone: "03001234567",
  address: "12 Sample Street, Garden Town",
  city: "Lahore",
};

describe("saved address validation", () => {
  it("accepts a valid address and normalizes the phone", () => {
    const result = createAddressSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("+923001234567");
  });

  it("rejects short fields, bad phones and extra fields", () => {
    expect(createAddressSchema.safeParse({ ...validInput, address: "short" }).success).toBe(false);
    expect(createAddressSchema.safeParse({ ...validInput, phone: "12345" }).success).toBe(false);
    expect(createAddressSchema.safeParse({ ...validInput, userId: "other" }).success).toBe(false);
  });

  it("validates an address id", () => {
    expect(addressIdSchema.safeParse({ addressId: VALID_ID }).success).toBe(true);
    expect(addressIdSchema.safeParse({ addressId: "bad" }).success).toBe(false);
  });
});

describe("address helpers", () => {
  it("produces checkout prefill values", () => {
    const address: SavedAddress = {
      id: VALID_ID,
      label: "Home",
      fullName: "Shahzaib Abrar",
      phone: "+923001234567",
      address: "12 Sample Street, Garden Town",
      city: "Lahore",
      isDefault: true,
    };
    expect(toAddressPrefill(address)).toEqual({
      fullName: "Shahzaib Abrar",
      phone: "+923001234567",
      city: "Lahore",
      address: "12 Sample Street, Garden Town",
    });
  });

  it("maps database errors to safe messages", () => {
    expect(describeAddressError("23514")).toContain("phone number");
    expect(describeAddressError(null)).toContain("could not be saved");
  });
});
