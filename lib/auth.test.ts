import { describe, it, expect, afterEach } from "vitest";
import { hashPassword, isValidPassword } from "./auth";

describe("isValidPassword", () => {
  const originalEnv = process.env.SHARED_PASSWORD;

  afterEach(() => {
    process.env.SHARED_PASSWORD = originalEnv;
  });

  it("returns true when input matches SHARED_PASSWORD", () => {
    process.env.SHARED_PASSWORD = "test-secret";
    expect(isValidPassword("test-secret")).toBe(true);
  });

  it("returns false when input does not match", () => {
    process.env.SHARED_PASSWORD = "test-secret";
    expect(isValidPassword("wrong")).toBe(false);
  });

  it("returns false when SHARED_PASSWORD is not set", () => {
    delete process.env.SHARED_PASSWORD;
    expect(isValidPassword("anything")).toBe(false);
  });
});

describe("hashPassword", () => {
  it("produces a consistent SHA-256 hex digest", async () => {
    const hash1 = await hashPassword("test-secret");
    const hash2 = await hashPassword("test-secret");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different inputs", async () => {
    expect(await hashPassword("a")).not.toBe(await hashPassword("b"));
  });
});
