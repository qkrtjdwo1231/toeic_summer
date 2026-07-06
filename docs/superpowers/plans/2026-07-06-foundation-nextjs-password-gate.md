<!-- vocab-web 프로젝트 공통 기반(Next.js 프로젝트 + 공유 비밀번호 게이트) 구현 계획 -->
# 공통 기반(Next.js 프로젝트 + 공유 비밀번호 게이트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** vocab-web 저장소에 Next.js(App Router) 프로젝트를 세팅하고, 이후 만들 두 기능(단어 시험 채점, 반 명단 문서 자동화)이 공통으로 쓸 공유 비밀번호 게이트를 구현한다.

**Architecture:** Next.js App Router + TypeScript, Vercel 배포 대상. 인증은 세션/DB 없이 "요청 비밀번호 === 환경변수 SHARED_PASSWORD" 비교만 하고, 통과하면 httpOnly 쿠키(비밀번호의 SHA-256 해시값)를 심는다. 이후 모든 요청은 루트 `middleware.ts`가 쿠키를 재검증해 통과/리다이렉트를 결정한다. 이번 계획은 두 기능의 실제 화면/로직은 만들지 않고, 홈 화면에 두 기능으로 가는 링크만 놓는다.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Vitest (단위 테스트), Node 내장 `crypto` (해시, 추가 의존성 없음).

## Global Constraints

- 개인정보(학번, 연락처 등)는 서버 어디에도 저장하지 않는다 — 이번 계획에는 개인정보를 다루는 코드가 없다 (설계 문서 공통 제약 1번).
- 사이트 진입 시 공유 비밀번호 1개로 접근을 제한한다 (설계 문서 공통 정책).
- OpenAI API 키 등 비밀값은 서버리스 함수 안에서만 쓴다 — 이번 계획에는 OpenAI 호출이 없다.
- **승인 필요:** Task 1의 `npm install`은 새 패키지를 설치하는 작업이다. 사용자 CLAUDE.md 지침에 따라 실행 직전 어떤 패키지가 설치되는지 한국어로 설명하고 승인을 받은 뒤 실행한다.
- **승인 필요:** `SHARED_PASSWORD` 환경변수는 로컬 `.env.local`과 Vercel 프로젝트 설정에 사용자가 직접 값을 정해서 등록해야 한다 — 이 계획은 코드에서 그 변수를 읽기만 하고, 값 자체를 정하거나 커밋하지 않는다.

---

## File Structure

```
vocab-web/
  package.json              # 의존성, 스크립트(dev/build/test)
  tsconfig.json              # TypeScript 설정 (Next.js 표준)
  next.config.ts             # Next.js 설정 (빈 기본값)
  vitest.config.ts           # Vitest 설정 (node 환경 + @/ alias)
  .gitignore                 # node_modules, .next, .env*.local 제외
  middleware.ts               # 공유 비밀번호 쿠키 검증 게이트
  middleware.test.ts          # 위 게이트의 단위 테스트
  lib/
    auth.ts                  # 비밀번호 검증 + 해시 함수
    auth.test.ts              # 위 함수들의 단위 테스트
  app/
    layout.tsx                # 루트 레이아웃
    page.tsx                  # 홈 화면 (두 기능 링크만 놓는 placeholder)
    login/
      page.tsx                # 비밀번호 입력 화면
    api/
      login/
        route.ts              # POST: 비밀번호 검증 후 쿠키 발급
```

---

### Task 1: Next.js 프로젝트 스캐폴딩

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` 스크립트. 이후 모든 Task가 이 스크립트로 검증한다.

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "vocab-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.3.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.3.1",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config.ts 작성**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: .gitignore 작성**

```
node_modules/
.next/
.env*.local
```

- [ ] **Step 5: app/layout.tsx 작성**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "단어장 웹",
  description: "단어 시험 채점 및 반 명단 문서 자동화 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: app/page.tsx 작성 (홈 화면 placeholder)**

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>단어장 웹</h1>
      <ul>
        <li>
          <a href="/grading">단어 시험 채점</a>
        </li>
        <li>
          <a href="/roster">반 명단 문서 자동화</a>
        </li>
      </ul>
    </main>
  );
}
```

- [ ] **Step 7: 사용자에게 npm install 승인 요청 후 설치**

사용자에게 "package.json에 정의된 next/react/typescript/vitest 등을 설치하겠습니다. 진행할까요?"라고 한국어로 물어 승인을 받은 뒤 실행한다.

Run: `npm install`
Expected: `node_modules/` 생성, 에러 없이 종료.

- [ ] **Step 8: 개발 서버로 홈 화면 확인**

Run: `npm run dev`
Expected: `http://localhost:3000` 접속 시 "단어장 웹" 제목과 두 링크가 보인다. 확인 후 서버 종료(Ctrl+C).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json next.config.ts .gitignore app/layout.tsx app/page.tsx package-lock.json
git commit -m "Next.js 프로젝트 스캐폴딩 추가"
```

---

### Task 2: 비밀번호 검증 로직 (lib/auth.ts)

**Files:**
- Create: `lib/auth.ts`
- Test: `lib/auth.test.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: Task 1의 `npm test` 스크립트.
- Produces: `AUTH_COOKIE_NAME: string`, `hashPassword(password: string): string`, `isValidPassword(input: string): boolean` — Task 3, 4에서 그대로 사용한다.

- [ ] **Step 1: vitest.config.ts 작성**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 2: 실패하는 테스트 작성 (lib/auth.test.ts)**

```ts
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
  it("produces a consistent SHA-256 hex digest", () => {
    const hash1 = hashPassword("test-secret");
    const hash2 = hashPassword("test-secret");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashPassword("a")).not.toBe(hashPassword("b"));
  });
});
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/auth.ts` 모듈이 없어서 import 에러.

- [ ] **Step 4: lib/auth.ts 최소 구현**

```ts
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
```

- [ ] **Step 5: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 5개 테스트 모두 통과.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts lib/auth.ts lib/auth.test.ts
git commit -m "공유 비밀번호 검증/해시 함수 추가"
```

---

### Task 3: 로그인 API 라우트 + 로그인 페이지

**Files:**
- Create: `app/api/login/route.ts`
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: Task 2의 `AUTH_COOKIE_NAME`, `hashPassword`, `isValidPassword`.
- Produces: `POST /api/login` — 성공 시 `{ ok: true }` + `AUTH_COOKIE_NAME` 쿠키 설정, 실패 시 401 + `{ error: string }`. Task 4의 미들웨어와 수동 확인(Task 5)에서 이 엔드포인트를 사용한다.

- [ ] **Step 1: app/api/login/route.ts 작성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, hashPassword, isValidPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const password = typeof body.password === "string" ? body.password : "";

  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, hashPassword(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
```

- [ ] **Step 2: app/login/page.tsx 작성**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("비밀번호가 올바르지 않습니다.");
    }
  }

  return (
    <main>
      <h1>비밀번호 입력</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="공유 비밀번호"
        />
        <button type="submit">입장</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 3: 빌드로 타입 오류 없는지 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료 (이 시점엔 아직 미들웨어가 없어 `/login`도 게이트 없이 열려 있는 게 정상).

- [ ] **Step 4: Commit**

```bash
git add app/api/login/route.ts app/login/page.tsx
git commit -m "로그인 API와 비밀번호 입력 화면 추가"
```

---

### Task 4: 미들웨어 게이트

**Files:**
- Create: `middleware.ts`
- Test: `middleware.test.ts`

**Interfaces:**
- Consumes: Task 2의 `AUTH_COOKIE_NAME`, `hashPassword`.
- Produces: 루트 `middleware` 함수 — 이후 Task 5의 수동 확인에서 실제 브라우저 흐름으로 검증한다.

- [ ] **Step 1: 실패하는 테스트 작성 (middleware.test.ts)**

```ts
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
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `middleware.ts` 모듈이 없어서 import 에러.

- [ ] **Step 3: middleware.ts 최소 구현**

```ts
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, hashPassword } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const expected = process.env.SHARED_PASSWORD
    ? hashPassword(process.env.SHARED_PASSWORD)
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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이전 5개 + 이번 3개, 총 8개 테스트 통과.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts middleware.test.ts
git commit -m "공유 비밀번호 쿠키 검증 미들웨어 추가"
```

---

### Task 5: 로컬 수동 확인 및 Vercel 배포 설정

**Files:**
- Modify: 없음 (환경변수/배포 설정만 다룸, 코드 변경 없음)

**Interfaces:**
- Consumes: Task 1~4에서 만든 전체 프로젝트.
- Produces: 배포 가능한 상태의 vocab-web 저장소. 이후 채점 기능/명단 기능 계획이 이 위에 라우트를 추가한다.

- [ ] **Step 1: 로컬 환경변수 파일 준비 (사용자 승인 및 값 입력 필요)**

사용자에게 "로컬 테스트용 `.env.local` 파일에 `SHARED_PASSWORD` 값을 정해서 넣어주세요"라고 요청한다. 이 파일은 `.gitignore`에 의해 커밋되지 않는다.

```
SHARED_PASSWORD=사용자가_정한_값
```

- [ ] **Step 2: 전체 흐름 수동 확인**

Run: `npm run dev`

브라우저에서 확인:
1. `http://localhost:3000` 접속 → `/login`으로 자동 리다이렉트되는지 확인.
2. 틀린 비밀번호 입력 → "비밀번호가 올바르지 않습니다." 에러 문구가 보이는지 확인.
3. 올바른 비밀번호 입력 → 홈 화면(`단어장 웹` 제목, 두 링크)으로 이동하는지 확인.
4. 새로고침 후에도 다시 로그인 화면으로 안 튕기는지 확인 (쿠키 유지 확인).

Expected: 4가지 모두 통과. 확인 후 서버 종료(Ctrl+C).

- [ ] **Step 3: 빌드 최종 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 4: Vercel 프로젝트 연결 및 환경변수 등록 (사용자 승인 필요)**

사용자에게 "Vercel에 이 저장소를 새 프로젝트로 연결하고, 프로젝트 설정의 Environment Variables에 `SHARED_PASSWORD`를 등록해주세요"라고 안내한다. 이 단계는 Vercel 대시보드에서 사용자가 직접 수행한다 (배포 설정은 CLAUDE.md 지침상 사전 승인 대상).

- [ ] **Step 5: 배포 후 수동 확인**

Vercel이 배포한 URL에 접속해 Step 2와 동일한 4가지를 다시 확인한다.

Expected: 로컬과 동일하게 동작.

- [ ] **Step 6: Commit (변경 사항이 있는 경우에만)**

이 Task는 대부분 환경 설정이라 코드 변경이 없을 수 있다. 코드 변경이 없으면 커밋하지 않는다.

---

## Self-Review 메모

- **스펙 커버리지:** 두 설계 문서의 "비밀번호 입력 화면" 요구사항(공유 비밀번호 통과 후 진입)은 Task 2~5에서 구현. 개인정보 미저장 제약은 이번 계획에 개인정보를 다루는 코드가 없어 자동 충족. Vercel Blob/OpenAI 관련 사항은 이번 계획 범위 밖 (각 기능 계획에서 다룸) — 의도된 누락.
- **플레이스홀더 스캔:** 모든 Step에 실제 코드/명령어 포함 확인 완료.
- **타입 일관성:** `AUTH_COOKIE_NAME`, `hashPassword`, `isValidPassword` 시그니처가 Task 2 정의와 Task 3·4 사용처에서 동일함을 확인 완료.
