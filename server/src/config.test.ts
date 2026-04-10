import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("config", () => {
  it("loads when required env vars are provided", async () => {
    process.env.JWT_SECRET = "test-jwt";
    process.env.POS_HMAC_SECRET = "test-hmac";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/cfms_test?schema=public";

    const mod = await import("./config");
    expect(mod.config.jwtSecret).toBe("test-jwt");
    expect(mod.config.posHmacSecret).toBe("test-hmac");
    expect(mod.config.databaseUrl).toContain("cfms_test");
  });
});
