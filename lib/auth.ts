export const AUTH_COOKIE_NAME = "vocab_web_auth";

// 이 함수는 미들웨어(middleware.ts)의 Edge 런타임에서도 실행되므로 Web Crypto(crypto.subtle)만 사용한다 — node:crypto(createHash 등)는 Edge 런타임에서 지원되지 않으므로 절대 사용하지 말 것
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
