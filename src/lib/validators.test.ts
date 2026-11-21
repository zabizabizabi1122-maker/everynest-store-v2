import { describe, expect, it } from "vitest";

import {
  loginSchema,
  normalizePakistaniPhone,
  pakistaniPhoneSchema,
  profileUpdateSchema,
  safeNextPath,
  signupSchema,
  skuSchema,
  slugSchema,
  uuidSchema,
} from "./validators";

describe("normalizePakistaniPhone", () => {
  it("accepts the local 03xxxxxxxxx format", () => {
    expect(normalizePakistaniPhone("03001234567")).toBe("+923001234567");
  });

  it("accepts spacing, dashes and brackets", () => {
    expect(normalizePakistaniPhone("0300-123 4567")).toBe("+923001234567");
    expect(normalizePakistaniPhone("(0300) 1234567")).toBe("+923001234567");
  });

  it("accepts international formats", () => {
    expect(normalizePakistaniPhone("+923001234567")).toBe("+923001234567");
    expect(normalizePakistaniPhone("+92 300 1234567")).toBe("+923001234567");
    expect(normalizePakistaniPhone("00923001234567")).toBe("+923001234567");
    expect(normalizePakistaniPhone("923001234567")).toBe("+923001234567");
  });

  it("rejects landlines, wrong lengths and non-mobile prefixes", () => {
    expect(normalizePakistaniPhone("0211234567")).toBeNull();
    expect(normalizePakistaniPhone("0300123456")).toBeNull();
    expect(normalizePakistaniPhone("04001234567")).toBeNull();
    expect(normalizePakistaniPhone("hello")).toBeNull();
    expect(normalizePakistaniPhone("")).toBeNull();
  });
});

describe("pakistaniPhoneSchema", () => {
  it("returns the normalized number", () => {
    expect(pakistaniPhoneSchema.parse("0300 1234567")).toBe("+923001234567");
  });

  it("fails with a friendly message", () => {
    const result = pakistaniPhoneSchema.safeParse("12345");
    expect(result.success).toBe(false);
  });
});

describe("slugSchema", () => {
  it("accepts lowercase hyphenated slugs", () => {
    expect(slugSchema.parse("mens-cotton-shirt")).toBe("mens-cotton-shirt");
  });

  it("rejects uppercase, spaces and leading hyphens", () => {
    expect(slugSchema.safeParse("Mens-Shirt").success).toBe(false);
    expect(slugSchema.safeParse("mens shirt").success).toBe(false);
    expect(slugSchema.safeParse("-mens").success).toBe(false);
  });
});

describe("skuSchema", () => {
  it("accepts letters, numbers, hyphens and underscores", () => {
    expect(skuSchema.parse("SHIRT_BLUE-M")).toBe("SHIRT_BLUE-M");
  });

  it("rejects spaces and leading punctuation", () => {
    expect(skuSchema.safeParse("SHIRT BLUE").success).toBe(false);
    expect(skuSchema.safeParse("-SHIRT").success).toBe(false);
  });
});

describe("uuidSchema", () => {
  it("accepts a valid v4 UUID", () => {
    expect(uuidSchema.parse("3f0c0f4a-8a6a-4d3f-9f9b-2b1a6c7d8e9f")).toBe(
      "3f0c0f4a-8a6a-4d3f-9f9b-2b1a6c7d8e9f",
    );
  });

  it("rejects random strings", () => {
    expect(uuidSchema.safeParse("abc").success).toBe(false);
    expect(uuidSchema.safeParse("3f0c0f4a-8a6a-4d3f-9f9b").success).toBe(false);
  });
});

const validSignup = {
  fullName: "Shahzaib Abrar",
  email: "Person@Example.COM",
  phone: "",
  password: "secret123",
  confirmPassword: "secret123",
};

describe("signupSchema", () => {
  it("normalizes the email to lowercase and an empty phone to null", () => {
    const parsed = signupSchema.parse(validSignup);

    expect(parsed.email).toBe("person@example.com");
    expect(parsed.phone).toBeNull();
  });

  it("normalizes a Pakistani mobile number", () => {
    const parsed = signupSchema.parse({ ...validSignup, phone: "0300 1234567" });

    expect(parsed.phone).toBe("+923001234567");
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const result = signupSchema.safeParse({ ...validSignup, confirmPassword: "secret124" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });

  it("rejects weak passwords", () => {
    expect(signupSchema.safeParse({ ...validSignup, password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, password: "allletters", confirmPassword: "allletters" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, password: "12345678", confirmPassword: "12345678" }).success).toBe(false);
  });

  it("rejects invalid emails and phone numbers", () => {
    expect(signupSchema.safeParse({ ...validSignup, email: "not-an-email" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, phone: "12345" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, phone: "0211234567" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a normal email and password", () => {
    const parsed = loginSchema.parse({ email: "  Person@Example.com ", password: "secret123" });

    expect(parsed.email).toBe("person@example.com");
    expect(parsed.password).toBe("secret123");
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "person@example.com", password: "" }).success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  it("allows clearing the phone number", () => {
    const parsed = profileUpdateSchema.parse({ fullName: "  Ali  ", phone: "   " });

    expect(parsed.fullName).toBe("Ali");
    expect(parsed.phone).toBeNull();
  });

  it("requires a real name", () => {
    expect(profileUpdateSchema.safeParse({ fullName: " ", phone: "" }).success).toBe(false);
  });

  it("rejects a landline number", () => {
    expect(profileUpdateSchema.safeParse({ fullName: "Ali", phone: "0211234567" }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/orders/123?tab=items")).toBe("/orders/123?tab=items");
  });

  it("rejects absolute, protocol-relative and backslash tricks", () => {
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBe("/account");
    expect(safeNextPath("/\\evil.example")).toBe("/account");
    expect(safeNextPath("javascript:alert(1)")).toBe("/account");
    expect(safeNextPath("")).toBe("/account");
    expect(safeNextPath(null)).toBe("/account");
  });

  it("uses a caller-supplied fallback", () => {
    expect(safeNextPath("https://evil.example", "/login")).toBe("/login");
  });
});
