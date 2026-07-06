import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { AUTH_COOKIE_NAME, hashPassword } from "@/lib/auth";

describe("middleware", () => {
  afterEach(() => {
    delete process.env.SHARED_PASSWORD;
  });

  it("redirects to /login when auth cookie is missing", () => {
    const request = new NextRequest("http://localhost:3000/grading");
    const response = middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login"
    );
  });

  it("redirects to /login when auth cookie value is wrong", () => {
    process.env.SHARED_PASSWORD = "test-secret";
    const request = new NextRequest("http://localhost:3000/grading", {
      headers: { cookie: `${AUTH_COOKIE_NAME}=wrong-hash` },
    });
    const response = middleware(request);
    expect(response.status).toBe(307);
  });

  it("passes through when auth cookie matches the expected hash", () => {
    process.env.SHARED_PASSWORD = "test-secret";
    const request = new NextRequest("http://localhost:3000/grading", {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${hashPassword("test-secret")}`,
      },
    });
    const response = middleware(request);
    expect(response.status).toBe(200);
  });
});
