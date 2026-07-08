<!-- vocab-web 프로젝트 전체 진행 체크리스트 -->
# vocab-web 진행 체크리스트

세부 실행 단계는 각 계획 문서(`docs/superpowers/plans/`) 안의 체크박스를 따른다. 이 파일은 큰 단위 진행 상황만 추적한다.

## 설계

- [x] 단어 시험 채점 웹앱 설계 문서 (`docs/superpowers/specs/2026-07-03-vocab-grading-web-design.md`)
- [x] 반 명단 문서 자동화 웹앱 설계 문서 (`docs/superpowers/specs/2026-07-03-roster-docs-web-design.md`)

## 구현 계획 (3단계로 분할, 2026-07-06 결정)

- [x] 1단계: 공통 기반(Next.js 프로젝트 + 공유 비밀번호 게이트) 계획 작성 (`docs/superpowers/plans/2026-07-06-foundation-nextjs-password-gate.md`)
- [x] 1단계 실행 및 배포 확인 (Vercel 배포 완료, 비밀번호 게이트 정상 동작 확인, 2026-07-06)
- [x] 2단계: 단어 시험 채점 기능 계획 작성 (`docs/superpowers/plans/2026-07-06-vocab-grading-feature.md`, 답안 입력은 이번 라운드에 파일 업로드만 구현하기로 결정, 구글시트 링크는 범위 밖)
- [x] 2단계 실행 (Task 1~7 전체 완료, 최종 브랜치 리뷰 반영, 배포 및 실사용 확인 완료, 2026-07-07)
- [x] 3단계: 반 명단 문서 자동화 기능 계획 작성 (`docs/superpowers/plans/2026-07-08-roster-docs-feature.md`, 실제 test.xlsx로 컬럼 구조 확인, 반 유형 5개 기준으로 표 구성 결정, 헤더 수동 선택 UI 포함)
- [ ] 3단계 실행

## 다음 할 일

- 3단계(반 명단 문서 자동화) 계획 실행부터 이어간다.
