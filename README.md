# vocab-web

단어 시험 채점 및 반 명단 문서 자동화를 위한 공유 웹 도구입니다. 현재는 두 기능이 공통으로 쓰는 기반(Next.js 프로젝트, 공유 비밀번호 게이트)만 구현되어 있습니다.

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # .env.local을 만든 뒤 SHARED_PASSWORD 값을 채워주세요
npm run dev
```

## 배포 (Vercel)

Vercel 프로젝트 설정의 Environment Variables에 `SHARED_PASSWORD`를 반드시 등록해야 합니다.

등록하지 않으면 사이트는 어떤 비밀번호를 입력해도 항상 로그인 화면만 보여주며 401 오류가 발생합니다. 이 경우 환경변수 설정이 누락된 것인지, 아니면 단순히 비밀번호를 잘못 입력한 것인지 화면만으로는 구분할 방법이 없으니 배포 전에 꼭 확인하세요.

## 테스트

```bash
npm test
```
