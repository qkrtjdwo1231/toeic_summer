export const AUTH_COOKIE_NAME = "vocab_web_auth";

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidPassword(input: string): boolean {
  const expected = process.env.SHARED_PASSWORD;
  if (!expected) return false;
  return input === expected;
}
