import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import { isLoginAllowed, recordLoginAttempt } from "./login-throttle";

describe("login throttle helpers", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
  });

  it("reports a lockout from the trusted RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(isLoginAllowed("admin@example.com", "hashed-ip")).resolves.toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("check_login_allowed", {
      p_email: "admin@example.com",
      p_ip_hash: "hashed-ip",
    });
  });

  it("fails open when the throttle is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XXXXX", message: "RPC down" } });

    await expect(isLoginAllowed("admin@example.com", "hashed-ip")).resolves.toBe(true);
  });

  it("records success and failure without credentials", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await recordLoginAttempt("admin@example.com", "hashed-ip", true);
    await recordLoginAttempt("admin@example.com", "hashed-ip", false);

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "record_login_attempt", {
      p_email: "admin@example.com",
      p_ip_hash: "hashed-ip",
      p_success: true,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "record_login_attempt", {
      p_email: "admin@example.com",
      p_ip_hash: "hashed-ip",
      p_success: false,
    });
  });
});
