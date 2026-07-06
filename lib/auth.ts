import { createHash } from "crypto";

export const AUTH_COOKIE_NAME = "vocab_web_auth";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function isValidPassword(input: string): boolean {
  const expected = process.env.SHARED_PASSWORD;
  if (!expected) return false;
  return input === expected;
}
