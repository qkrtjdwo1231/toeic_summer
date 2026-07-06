<!-- vocab-web 프로젝트 작업 일지 (세션 연속성용) -->
# context-notes.md

## 2026-07-06

### 한 일

- 기존 설계 문서 2개(단어 시험 채점, 반 명단 문서 자동화) 재검토.
- 구현 계획을 3단계로 나누기로 결정: 1) 공통 기반(Next.js 프로젝트 + 공유 비밀번호 게이트) 2) 단어 시험 채점 기능 3) 반 명단 문서 자동화 기능.
- 1단계 계획 문서 작성 완료: `docs/superpowers/plans/2026-07-06-foundation-nextjs-password-gate.md`.

### 결정사항과 이유

- **3단계 분할 채택**: 기반부터 만들어서 실제로 배포/동작하는 걸 빨리 확인하고, 그 위에 기능을 하나씩 얹기로 함 (사용자 선택, "3단계로 분할 (추천)" 옵션).
- **인증 방식**: 세션/DB 없이 `SHARED_PASSWORD` 환경변수와 단순 비교 + httpOnly 쿠키(비밀번호의 SHA-256 해시)만 사용. 이 프로젝트는 개인정보를 지키는 인증이 아니라 익명 사용/비용 낭비 방지가 목적이라 이 정도 단순함이면 충분하다고 판단.
- **테스트 도구**: Vitest 선택. Next.js 미들웨어와 API 라우트 핸들러는 실제 Next 서버 없이도 `NextRequest`를 직접 생성해 함수 단위로 테스트 가능해서, 별도 e2e 도구 없이 이 방식으로 TDD 진행하기로 함.
- **새 패키지/환경변수는 실행 전 사용자 승인 필요** (CLAUDE.md 지침) — 계획 문서 안에 승인 필요 지점을 명시해둠 (`npm install`, `SHARED_PASSWORD` 값 설정, Vercel 환경변수 등록).

### 미완료 / 다음에 할 일 (최초 작성 시점 기준, 아래 이어서 갱신됨)

- [x] 공통 기반 계획(1단계) 실행 — subagent-driven 방식으로 진행 완료.
- [ ] 2단계(단어 시험 채점 기능) 계획 문서 작성 — 1단계 실행/배포 확인 후 진행.
- [ ] 3단계(반 명단 문서 자동화 기능) 계획 문서 작성.

---

## 2026-07-06 (이어서) — 1단계 구현 완료

### 한 일

- subagent-driven-development로 1단계 계획(Task 1~5) 전부 실행 및 태스크별 리뷰 통과.
  - Task 1: Next.js 스캐폴딩. Task 2: `lib/auth.ts` 비밀번호 검증(TDD). Task 3: 로그인 API+화면 (수정 2회: malformed JSON, null body 크래시). Task 4: 미들웨어 게이트(TDD).
- **수동 테스트로 실제 버그 발견**: `npm run dev`로 실서버를 띄워 확인하던 중 `GET /`가 500 에러. 원인은 Next.js 미들웨어가 Edge 런타임에서 도는데 `lib/auth.ts`가 Node 전용 `crypto.createHash`를 써서 발생. Vitest 단위 테스트는 Node 환경이라 이 문제를 못 잡았음 — **자동 테스트만 믿지 않고 실제로 서버를 띄워본 게 결정적이었음.**
  - 수정: `hashPassword`를 Web Crypto API(`crypto.subtle.digest`) 기반 비동기 함수로 전환, 호출부(`middleware.ts`, `app/api/login/route.ts`, 테스트 2개) 전부 `await` 추가. 커밋 `099808c`.
- 로컬에서 4가지 흐름(비로그인 리다이렉트/틀린 비밀번호/올바른 비밀번호/새로고침 유지) 전부 curl로 확인 완료. `npm run build` 성공.
- GitHub 저장소(`https://github.com/qkrtjdwo1231/toeic_summer`) 연결 후 첫 푸시, Vercel 배포까지 사용자가 직접 진행 완료. 배포된 사이트에서 비밀번호 게이트 정상 동작 확인.
  - 참고: 홈 화면의 "단어 시험 채점"/"반 명단 문서 자동화" 링크는 **아직 만들지 않은 2·3단계 기능**이라 지금 눌러도 404가 뜨는 게 정상. 버그 아님.
- 전체 브랜치 최종 리뷰(opus) 진행 → Important 2건(Edge 호환성 유지용 안내 주석 부재, `SHARED_PASSWORD` 설정 문서 부재) 발견 → 수정 서브에이전트로 `README.md`/`.env.example` 추가, `lib/auth.ts`에 안내 주석 추가, 계획 문서의 오래된 시그니처(`hashPassword`가 이제 비동기) 정정.
- `npm audit` 직접 확인: critical 취약점 1개 포함 총 7개 모두 devDependency(vite/vitest 체인)에서만 발생, 프로덕션 런타임(`next`/`react`, prod dependency 16개)에는 영향 없음. `vitest`를 4.x(semver major)로 올려야 해결되는데, 이건 새 버전 설치라 사용자 승인이 필요한 사안 — **지금은 손대지 않고 보류하기로 결정** (devDependency만 영향, 실사용에 위험 없음).

### 결정사항과 이유

- **Edge 런타임 호환성 문제는 계획 자체의 결함이었음**: 계획 문서 Task 2에 `Node 내장 crypto`라고 명시했던 게 원인. 앞으로 계획을 쓸 때 "이 코드가 미들웨어에서도 도는가?"를 미리 따져야 함 — 2·3단계 계획 작성 시 참고할 것.
- **npm audit 취약점은 지금 안 고침**: 전부 dev 전용(vitest/vite), 프로덕션 코드 경로에 없음. semver-major 업그레이드는 사용자 승인 필요 사안이라 임의로 진행하지 않음.

### 미완료 / 다음에 할 일

- [ ] 2단계(단어 시험 채점 기능) 계획 문서 작성 — writing-plans 스킬로 진행.
- [ ] 3단계(반 명단 문서 자동화 기능) 계획 문서 작성.
- [ ] (선택) `vitest` 메이저 업그레이드로 devDependency 취약점 해소 — 사용자 승인 필요, 급하지 않음.

### 막힌 점 / 사용자 결정 필요

- 없음. 1단계는 완결된 상태.
