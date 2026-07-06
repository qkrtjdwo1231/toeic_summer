// 공유 비밀번호 쿠키를 검증해서 미인증 요청을 로그인 페이지로 리다이렉트하는 미들웨어
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, hashPassword } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const expected = process.env.SHARED_PASSWORD
    ? await hashPassword(process.env.SHARED_PASSWORD)
    : null;

  if (expected && cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico).*)"],
};
