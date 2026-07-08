<!-- vocab-web 3단계: 반 명단 문서 자동화 기능 구현 계획 -->
# 반 명단 문서 자동화 기능 (3단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1·2단계에서 만든 기반(Next.js 프로젝트 + 비밀번호 게이트) 위에, 전체명단 파일 하나를 업로드하면 인쇄용 출석부·온라인 출석부·관리일지·교재배부명단을 반 유형별로 자동 생성하고 인원수 불일치를 검증해주는 `/roster` 기능을 만든다.

**Architecture:** AI 호출이 필요 없는 순수 규칙 기반 데이터 가공이다. 업로드된 전체명단은 서버리스 함수가 요청 처리 중에만 메모리에 두고 응답 후 버린다 (저장하지 않음). 반은 `기초/중급/실전/오픽 중급/오픽 실전` 5개 유형으로 다루고, 유형마다 오전·오후 학생을 분류해 4종 문서를 생성한다. 각 유형·세션(오전/오후)·문서종류 조합마다 원본 분류 결과와 생성된 문서 사이의 인원수·이름을 대조해 불일치를 경고로 표시한다. 화면은 실제 `<table>` 엘리먼트로 렌더링해 브라우저 기본 동작으로 드래그 선택 → 복사 → 엑셀 붙여넣기가 되게 한다 (별도 클립보드 코드 불필요).

**Tech Stack:** 기존(Next.js 15, TypeScript, Vitest, `xlsx`)을 그대로 쓴다. 새 패키지 설치가 필요 없다 (AI 호출 없음, 저장소 불필요).

## Global Constraints

- 개인정보(학번, 학과, 전화번호 등)는 요청 처리 중에만 서버 메모리에 있고 응답 후 저장하지 않는다. Vercel Blob 등 어떤 저장소에도 쓰지 않는다.
- 전체명단 파일의 컬럼 구조는 실제 샘플(`test.xlsx`)로 확인한 구조를 그대로 가정한다: 5번째 행(0-indexed 4)이 헤더, 6번째 행(0-indexed 5)부터 학생 데이터. 컬럼 위치(0-indexed) — 학번=2, 이름=3, 학과=5, 학년=6, 전화번호=7. `1기 신청`/`2기신청` 컬럼 위치는 헤더 텍스트에 `"1기"`/`"2기"`가 포함된 컬럼을 찾아 자동 매칭하고, 매칭이 안 되거나(0개) 모호하면(2개 이상) 프론트에서 헤더 목록을 보여주고 사용자가 직접 선택하게 한다.
- 반명 매칭은 정확히 일치할 때만 인정한다. 신청 컬럼이 비어 있거나 아래 10개 반명과 정확히 일치하지 않으면 그 학생은 어떤 문서에도 포함하지 않는다 (임의로 추가/삭제하지 않음).
  - 토익: `기초 오전`, `기초 오후`, `중급 오전`, `중급 오후`, `실전 오전`, `실전 오후`
  - 오픽: `오픽 중급 오전`, `오픽 중급 오후`, `오픽 실전 오전`, `오픽 실전 오후`
- 반 유형은 5개(기초/중급/실전/오픽 중급/오픽 실전)로 묶어서 다룬다. 온라인 출석부는 각 유형의 오전+오후를 한 표에 나란히 표시하고, 나머지 문서(인쇄용 출석부/관리일지/교재배부명단)는 오전/오후를 별도 표로 나눈다. (2026-07-08 사용자 결정 — "반 선택" 필터도 이 5개 유형 기준.)
- 문서별 컬럼 구성(실제 파일로 확인 완료):
  - 인쇄용 출석부: `NO, 학과, 이름, 연락처`
  - 온라인 출석부: `번호, 학년, 학번, 수강반, 성명, 연락처` (오전) + 같은 구성 (오후), 나란히. `수강반` 값은 토익 반이면 `"토익 " + 원본반명`(예: `토익 중급 오전`), 오픽 반이면 원본반명 그대로(예: `오픽 중급 오전`).
  - 관리일지: `이름, 학과` 순서대로 (11행 블록 서식 자체는 기존 파일에 있다고 가정, 여기서는 데이터만 제공).
  - 교재배부명단: `연번, 이름, 학과, 학번, 연락처`
- 반별 인원수 검증은 "반 분류 결과(classify.ts 출력)"와 "실제 생성된 문서의 학생 수/이름"을 독립적으로 대조해서, 문서 생성 단계에서 생긴 버그도 잡아낼 수 있게 한다.
- 유닛 테스트는 실제 파일을 읽지 않고 코드 안에서 합성한 작은 픽스처를 쓴다(속도·반복 가능성 때문에 — 2026-07-08 결정, 실제 파일은 Task 7 수동 확인에서만 사용). 단, 픽스처의 컬럼 배치는 실제 `test.xlsx`에서 확인한 배치와 동일하게 맞춘다.
- 저장소 루트의 `test.xlsx`는 실제 학생 개인정보가 담긴 샘플 파일이라 `.gitignore`에 이미 추가되어 있다 (2026-07-08 조치 완료). 이 계획의 어떤 Task에서도 `git add test.xlsx`를 하지 않는다.
- `/roster`, `/api/roster/*` 경로는 1단계에서 만든 미들웨어 매처(`/((?!login|api/login|_next/static|_next/image|favicon.ico).*)`)가 이미 보호하므로 별도 인증 코드가 필요 없다.

---

## File Structure

```
vocab-web/
  lib/
    roster/
      classes.ts               # 5개 반 유형 상수 (오전/오후 원본 반명 + 표시용 반명)
      types.ts                 # RawRosterRow, ClassTypeDef, ClassifiedClassType, 문서별 Row 타입, MismatchWarning 등
      roster-file.ts            # 명단 엑셀/CSV 파싱 + 신청 컬럼 자동/수동 매칭
      roster-file.test.ts
      classify.ts               # 반 유형별 오전/오후 학생 분류
      classify.test.ts
      documents.ts               # 반 유형별 4종 문서 생성
      documents.test.ts
      verify.ts                  # 반별 인원수/이름 대조 및 불일치 탐지
      verify.test.ts
  app/
    api/
      roster/
        generate/route.ts        # POST — 명단 업로드 받아 분류+문서생성+검증 실행 (신청 컬럼 자동/수동 매칭 포함)
    roster/
      page.tsx                   # 업로드 → (필요 시 컬럼 수동선택) → 결과 화면, 반 필터 토글 포함
  app/page.tsx                   # 기존 홈 화면의 "/roster" 링크는 이미 있음 (수정 없음)
```

---

### Task 1: 반 유형 상수 + 공유 타입 + 명단 파일 파싱

**Files:**
- Create: `lib/roster/classes.ts`
- Create: `lib/roster/types.ts`
- Create: `lib/roster/roster-file.ts`
- Test: `lib/roster/roster-file.test.ts`

**Interfaces:**
- Consumes: 없음 (2단계 완료 상태 위에서 새로 시작).
- Produces: `CLASS_TYPES`, `ClassTypeDef`, `RawRosterRow`, `RosterFormatError`, `parseRosterHeaders(buffer: ArrayBuffer): string[]`, `findApplicationColumnIndex(headers: string[], term: "1" | "2"): number | null`, `parseRosterRows(buffer: ArrayBuffer, applicationColumnIndex: number): RawRosterRow[]` — Task 2(분류), Task 5(API 라우트)에서 그대로 쓴다.

- [ ] **Step 1: lib/roster/classes.ts 작성**

```ts
export interface ClassTypeDef {
  id: string;
  label: string;
  amRawName: string;
  pmRawName: string;
  amDisplayName: string;
  pmDisplayName: string;
}

export const CLASS_TYPES: ClassTypeDef[] = [
  {
    id: "toeic-basic",
    label: "토익 기초",
    amRawName: "기초 오전",
    pmRawName: "기초 오후",
    amDisplayName: "토익 기초 오전",
    pmDisplayName: "토익 기초 오후",
  },
  {
    id: "toeic-mid",
    label: "토익 중급",
    amRawName: "중급 오전",
    pmRawName: "중급 오후",
    amDisplayName: "토익 중급 오전",
    pmDisplayName: "토익 중급 오후",
  },
  {
    id: "toeic-adv",
    label: "토익 실전",
    amRawName: "실전 오전",
    pmRawName: "실전 오후",
    amDisplayName: "토익 실전 오전",
    pmDisplayName: "토익 실전 오후",
  },
  {
    id: "opic-mid",
    label: "오픽 중급",
    amRawName: "오픽 중급 오전",
    pmRawName: "오픽 중급 오후",
    amDisplayName: "오픽 중급 오전",
    pmDisplayName: "오픽 중급 오후",
  },
  {
    id: "opic-adv",
    label: "오픽 실전",
    amRawName: "오픽 실전 오전",
    pmRawName: "오픽 실전 오후",
    amDisplayName: "오픽 실전 오전",
    pmDisplayName: "오픽 실전 오후",
  },
];
```

- [ ] **Step 2: lib/roster/types.ts 작성**

```ts
import type { ClassTypeDef } from "./classes";

export interface RawRosterRow {
  studentId: string;
  name: string;
  department: string;
  grade: number;
  phone: string;
  appliedClass: string;
}

export interface ClassifiedClassType {
  classType: ClassTypeDef;
  am: RawRosterRow[];
  pm: RawRosterRow[];
}

export interface PrintAttendanceRow {
  no: number;
  department: string;
  name: string;
  phone: string;
}

export interface OnlineAttendanceRow {
  no: number;
  grade: number;
  studentId: string;
  className: string;
  name: string;
  phone: string;
}

export interface CounselingLogRow {
  name: string;
  department: string;
}

export interface TextbookRow {
  no: number;
  name: string;
  department: string;
  studentId: string;
  phone: string;
}

export interface ClassTypeDocuments {
  classType: ClassTypeDef;
  printAttendanceAm: PrintAttendanceRow[];
  printAttendancePm: PrintAttendanceRow[];
  onlineAttendanceAm: OnlineAttendanceRow[];
  onlineAttendancePm: OnlineAttendanceRow[];
  counselingLogAm: CounselingLogRow[];
  counselingLogPm: CounselingLogRow[];
  textbookAm: TextbookRow[];
  textbookPm: TextbookRow[];
}

export type DocType =
  | "printAttendance"
  | "onlineAttendance"
  | "counselingLog"
  | "textbook";

export interface MismatchWarning {
  classTypeId: string;
  session: "am" | "pm";
  docType: DocType;
  missingNames: string[];
}
```

- [ ] **Step 3: 실패하는 테스트 작성 (lib/roster/roster-file.test.ts)**

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseRosterHeaders,
  findApplicationColumnIndex,
  parseRosterRows,
  RosterFormatError,
} from "./roster-file";

const HEADER_ROW = [
  "구분",
  "회원번호",
  "학번",
  "이름",
  "대학",
  "학과",
  "학년",
  "전화번호",
  "1기 신청",
  "2기신청",
];

function makeRosterBuffer(
  headerRow: string[],
  dataRows: (string | number)[][]
): ArrayBuffer {
  const rows = [
    ["더미0"],
    ["더미1"],
    ["더미2"],
    ["더미3"],
    headerRow,
    ...dataRows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "1기 전체");
  const array = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return array as ArrayBuffer;
}

describe("parseRosterHeaders", () => {
  it("returns the trimmed header row (row index 4)", () => {
    const buffer = makeRosterBuffer(HEADER_ROW, [
      [1, "M001", 2023000001, "박성재", "전자정보대학", "소프트웨어학부", 3, "010-1111-2222", "중급 오전", ""],
    ]);
    expect(parseRosterHeaders(buffer)).toEqual(HEADER_ROW);
  });

  it("throws RosterFormatError when the file has fewer than 5 rows", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([["구분", "이름"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const buffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;

    expect(() => parseRosterHeaders(buffer)).toThrow(RosterFormatError);
  });
});

describe("findApplicationColumnIndex", () => {
  it("finds the single column containing '1기'", () => {
    expect(findApplicationColumnIndex(HEADER_ROW, "1")).toBe(8);
  });

  it("finds the single column containing '2기'", () => {
    expect(findApplicationColumnIndex(HEADER_ROW, "2")).toBe(9);
  });

  it("returns null when there is no matching column", () => {
    const headers = ["구분", "이름", "학과"];
    expect(findApplicationColumnIndex(headers, "1")).toBeNull();
  });

  it("returns null when multiple columns match (ambiguous)", () => {
    const headers = ["구분", "1기 신청", "1기 확인", "2기신청"];
    expect(findApplicationColumnIndex(headers, "1")).toBeNull();
  });
});

describe("parseRosterRows", () => {
  it("extracts fields at the fixed column positions and trims them", () => {
    const buffer = makeRosterBuffer(HEADER_ROW, [
      [1, "M001", 2023000001, " 박성재 ", "전자정보대학", " 소프트웨어학부 ", 3, " 010-1111-2222 ", "중급 오전", ""],
    ]);

    expect(parseRosterRows(buffer, 8)).toEqual([
      {
        studentId: "2023000001",
        name: "박성재",
        department: "소프트웨어학부",
        grade: 3,
        phone: "010-1111-2222",
        appliedClass: "중급 오전",
      },
    ]);
  });

  it("keeps an empty appliedClass when the application cell is blank", () => {
    const buffer = makeRosterBuffer(HEADER_ROW, [
      [1, "M002", 2024000002, "박신영", "농업생명환경대학", "식물자원학과", 3, "010-2222-3333", "", "중급 오전"],
    ]);

    const result = parseRosterRows(buffer, 8);
    expect(result[0].appliedClass).toBe("");
  });

  it("skips rows with an empty name cell", () => {
    const buffer = makeRosterBuffer(HEADER_ROW, [
      [1, "M003", 2024000003, "", "농업생명환경대학", "식물자원학과", 3, "010-3333-4444", "중급 오전", ""],
    ]);

    expect(parseRosterRows(buffer, 8)).toEqual([]);
  });
});
```

- [ ] **Step 4: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/roster/roster-file.ts` 모듈이 없어서 import 에러.

- [ ] **Step 5: lib/roster/roster-file.ts 최소 구현**

```ts
import * as XLSX from "xlsx";
import type { RawRosterRow } from "./types";

export const HEADER_ROW_INDEX = 4;
export const DATA_START_ROW_INDEX = 5;

const STUDENT_ID_COL = 2;
const NAME_COL = 3;
const DEPARTMENT_COL = 5;
const GRADE_COL = 6;
const PHONE_COL = 7;

export class RosterFormatError extends Error {}

function readSheetRows(buffer: ArrayBuffer): (string | number)[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
}

export function parseRosterHeaders(buffer: ArrayBuffer): string[] {
  const rows = readSheetRows(buffer);
  if (rows.length <= HEADER_ROW_INDEX) {
    throw new RosterFormatError("헤더 행을 찾을 수 없습니다.");
  }
  return rows[HEADER_ROW_INDEX].map((cell) => String(cell ?? "").trim());
}

export function findApplicationColumnIndex(
  headers: string[],
  term: "1" | "2"
): number | null {
  const keyword = `${term}기`;
  const matches = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.includes(keyword));
  return matches.length === 1 ? matches[0].index : null;
}

export function parseRosterRows(
  buffer: ArrayBuffer,
  applicationColumnIndex: number
): RawRosterRow[] {
  const rows = readSheetRows(buffer);
  if (rows.length <= HEADER_ROW_INDEX) {
    throw new RosterFormatError("헤더 행을 찾을 수 없습니다.");
  }

  return rows
    .slice(DATA_START_ROW_INDEX)
    .filter((row) => String(row[NAME_COL] ?? "").trim() !== "")
    .map((row) => ({
      studentId: String(row[STUDENT_ID_COL] ?? "").trim(),
      name: String(row[NAME_COL]).trim(),
      department: String(row[DEPARTMENT_COL] ?? "").trim(),
      grade: Number(row[GRADE_COL]) || 0,
      phone: String(row[PHONE_COL] ?? "").trim(),
      appliedClass: String(row[applicationColumnIndex] ?? "").trim(),
    }));
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이 파일의 8개 테스트 모두 통과.

- [ ] **Step 7: Commit**

```bash
git add lib/roster/classes.ts lib/roster/types.ts lib/roster/roster-file.ts lib/roster/roster-file.test.ts
git commit -m "반 유형 상수, 공유 타입, 명단 파일 파싱 추가"
```

---

### Task 2: 반 분류 로직 (반 유형별 오전/오후 학생 분류)

**Files:**
- Create: `lib/roster/classify.ts`
- Test: `lib/roster/classify.test.ts`

**Interfaces:**
- Consumes: Task 1의 `CLASS_TYPES`, `RawRosterRow`, `ClassifiedClassType`.
- Produces: `classifyStudents(students: RawRosterRow[]): ClassifiedClassType[]` — Task 3(문서 생성), Task 4(검증), Task 5(API 라우트)에서 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성 (lib/roster/classify.test.ts)**

```ts
import { describe, it, expect } from "vitest";
import { classifyStudents } from "./classify";
import type { RawRosterRow } from "./types";

function makeStudent(
  name: string,
  appliedClass: string,
  overrides: Partial<RawRosterRow> = {}
): RawRosterRow {
  return {
    studentId: `ID-${name}`,
    name,
    department: "학과",
    grade: 3,
    phone: "010-0000-0000",
    appliedClass,
    ...overrides,
  };
}

describe("classifyStudents", () => {
  it("groups students into the matching class type's am/pm arrays, preserving order", () => {
    const students = [
      makeStudent("박성재", "중급 오전"),
      makeStudent("이주호", "중급 오전"),
      makeStudent("김대연", "중급 오후"),
      makeStudent("윤영석", "오픽 실전 오후"),
    ];

    const result = classifyStudents(students);
    const toeicMid = result.find((c) => c.classType.id === "toeic-mid")!;
    const opicAdv = result.find((c) => c.classType.id === "opic-adv")!;

    expect(toeicMid.am.map((s) => s.name)).toEqual(["박성재", "이주호"]);
    expect(toeicMid.pm.map((s) => s.name)).toEqual(["김대연"]);
    expect(opicAdv.am).toEqual([]);
    expect(opicAdv.pm.map((s) => s.name)).toEqual(["윤영석"]);
  });

  it("excludes students with an empty appliedClass", () => {
    const students = [makeStudent("박신영", "")];
    const result = classifyStudents(students);
    for (const classType of result) {
      expect(classType.am).toEqual([]);
      expect(classType.pm).toEqual([]);
    }
  });

  it("excludes students whose appliedClass does not exactly match any of the 10 class names", () => {
    const students = [makeStudent("테스트생", "존재하지않는반")];
    const result = classifyStudents(students);
    for (const classType of result) {
      expect(classType.am).toEqual([]);
      expect(classType.pm).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/roster/classify.ts` 모듈이 없어서 import 에러.

- [ ] **Step 3: lib/roster/classify.ts 최소 구현**

```ts
import { CLASS_TYPES } from "./classes";
import type { ClassifiedClassType, RawRosterRow } from "./types";

export function classifyStudents(
  students: RawRosterRow[]
): ClassifiedClassType[] {
  return CLASS_TYPES.map((classType) => ({
    classType,
    am: students.filter((s) => s.appliedClass === classType.amRawName),
    pm: students.filter((s) => s.appliedClass === classType.pmRawName),
  }));
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이 파일의 3개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add lib/roster/classify.ts lib/roster/classify.test.ts
git commit -m "반 유형별 오전/오후 학생 분류 로직 추가"
```

---

### Task 3: 문서 생성 로직 (반 유형별 4종 문서)

**Files:**
- Create: `lib/roster/documents.ts`
- Test: `lib/roster/documents.test.ts`

**Interfaces:**
- Consumes: Task 1의 `ClassifiedClassType`, `ClassTypeDocuments` 및 문서별 Row 타입들.
- Produces: `buildDocuments(classified: ClassifiedClassType[]): ClassTypeDocuments[]` — Task 4(검증), Task 5(API 라우트), Task 6(화면)에서 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성 (lib/roster/documents.test.ts)**

```ts
import { describe, it, expect } from "vitest";
import { buildDocuments } from "./documents";
import { CLASS_TYPES } from "./classes";
import type { ClassifiedClassType, RawRosterRow } from "./types";

function makeStudent(name: string, overrides: Partial<RawRosterRow> = {}): RawRosterRow {
  return {
    studentId: `ID-${name}`,
    name,
    department: "학과",
    grade: 3,
    phone: "010-0000-0000",
    appliedClass: "중급 오전",
    ...overrides,
  };
}

describe("buildDocuments", () => {
  const toeicMid = CLASS_TYPES.find((c) => c.id === "toeic-mid")!;
  const classified: ClassifiedClassType[] = [
    {
      classType: toeicMid,
      am: [makeStudent("박성재"), makeStudent("이주호")],
      pm: [makeStudent("김대연", { appliedClass: "중급 오후" })],
    },
  ];

  it("builds print attendance rows with sequential numbering per session", () => {
    const [docs] = buildDocuments(classified);
    expect(docs.printAttendanceAm).toEqual([
      { no: 1, department: "학과", name: "박성재", phone: "010-0000-0000" },
      { no: 2, department: "학과", name: "이주호", phone: "010-0000-0000" },
    ]);
    expect(docs.printAttendancePm).toEqual([
      { no: 1, department: "학과", name: "김대연", phone: "010-0000-0000" },
    ]);
  });

  it("builds online attendance rows using the class type's display names", () => {
    const [docs] = buildDocuments(classified);
    expect(docs.onlineAttendanceAm[0]).toEqual({
      no: 1,
      grade: 3,
      studentId: "ID-박성재",
      className: "토익 중급 오전",
      name: "박성재",
      phone: "010-0000-0000",
    });
    expect(docs.onlineAttendancePm[0].className).toBe("토익 중급 오후");
  });

  it("builds counseling log rows with only name and department", () => {
    const [docs] = buildDocuments(classified);
    expect(docs.counselingLogAm).toEqual([
      { name: "박성재", department: "학과" },
      { name: "이주호", department: "학과" },
    ]);
  });

  it("builds textbook rows with sequential numbering and all fields", () => {
    const [docs] = buildDocuments(classified);
    expect(docs.textbookAm).toEqual([
      { no: 1, name: "박성재", department: "학과", studentId: "ID-박성재", phone: "010-0000-0000" },
      { no: 2, name: "이주호", department: "학과", studentId: "ID-이주호", phone: "010-0000-0000" },
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/roster/documents.ts` 모듈이 없어서 import 에러.

- [ ] **Step 3: lib/roster/documents.ts 최소 구현**

```ts
import type {
  ClassifiedClassType,
  ClassTypeDocuments,
  CounselingLogRow,
  OnlineAttendanceRow,
  PrintAttendanceRow,
  RawRosterRow,
  TextbookRow,
} from "./types";

function buildPrintAttendance(students: RawRosterRow[]): PrintAttendanceRow[] {
  return students.map((s, i) => ({
    no: i + 1,
    department: s.department,
    name: s.name,
    phone: s.phone,
  }));
}

function buildOnlineAttendance(
  students: RawRosterRow[],
  className: string
): OnlineAttendanceRow[] {
  return students.map((s, i) => ({
    no: i + 1,
    grade: s.grade,
    studentId: s.studentId,
    className,
    name: s.name,
    phone: s.phone,
  }));
}

function buildCounselingLog(students: RawRosterRow[]): CounselingLogRow[] {
  return students.map((s) => ({ name: s.name, department: s.department }));
}

function buildTextbook(students: RawRosterRow[]): TextbookRow[] {
  return students.map((s, i) => ({
    no: i + 1,
    name: s.name,
    department: s.department,
    studentId: s.studentId,
    phone: s.phone,
  }));
}

export function buildDocuments(
  classified: ClassifiedClassType[]
): ClassTypeDocuments[] {
  return classified.map(({ classType, am, pm }) => ({
    classType,
    printAttendanceAm: buildPrintAttendance(am),
    printAttendancePm: buildPrintAttendance(pm),
    onlineAttendanceAm: buildOnlineAttendance(am, classType.amDisplayName),
    onlineAttendancePm: buildOnlineAttendance(pm, classType.pmDisplayName),
    counselingLogAm: buildCounselingLog(am),
    counselingLogPm: buildCounselingLog(pm),
    textbookAm: buildTextbook(am),
    textbookPm: buildTextbook(pm),
  }));
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이 파일의 4개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add lib/roster/documents.ts lib/roster/documents.test.ts
git commit -m "반 유형별 4종 문서 생성 로직 추가"
```

---

### Task 4: 인원수/이름 검증 로직

**Files:**
- Create: `lib/roster/verify.ts`
- Test: `lib/roster/verify.test.ts`

**Interfaces:**
- Consumes: Task 1의 `ClassifiedClassType`, `ClassTypeDocuments`, `MismatchWarning`.
- Produces: `verifyDocuments(classified: ClassifiedClassType[], documents: ClassTypeDocuments[]): MismatchWarning[]` — Task 5(API 라우트), Task 6(결과 화면)에서 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성 (lib/roster/verify.test.ts)**

```ts
import { describe, it, expect } from "vitest";
import { verifyDocuments } from "./verify";
import { buildDocuments } from "./documents";
import { CLASS_TYPES } from "./classes";
import type { ClassifiedClassType, RawRosterRow } from "./types";

function makeStudent(name: string): RawRosterRow {
  return {
    studentId: `ID-${name}`,
    name,
    department: "학과",
    grade: 3,
    phone: "010-0000-0000",
    appliedClass: "중급 오전",
  };
}

describe("verifyDocuments", () => {
  const toeicMid = CLASS_TYPES.find((c) => c.id === "toeic-mid")!;
  const classified: ClassifiedClassType[] = [
    {
      classType: toeicMid,
      am: [makeStudent("박성재"), makeStudent("이주호")],
      pm: [],
    },
  ];

  it("returns no warnings when the documents match the classification exactly", () => {
    const documents = buildDocuments(classified);
    expect(verifyDocuments(classified, documents)).toEqual([]);
  });

  it("returns a warning with the missing student's name when a document drops a student", () => {
    const documents = buildDocuments(classified);
    documents[0].printAttendanceAm = documents[0].printAttendanceAm.slice(0, 1);

    const warnings = verifyDocuments(classified, documents);
    expect(warnings).toEqual([
      {
        classTypeId: "toeic-mid",
        session: "am",
        docType: "printAttendance",
        missingNames: ["이주호"],
      },
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/roster/verify.ts` 모듈이 없어서 import 에러.

- [ ] **Step 3: lib/roster/verify.ts 최소 구현**

```ts
import type {
  ClassifiedClassType,
  ClassTypeDocuments,
  DocType,
  MismatchWarning,
  RawRosterRow,
} from "./types";

function diffMissing(expected: RawRosterRow[], actualNames: string[]): string[] {
  const actualSet = new Set(actualNames);
  return expected.filter((s) => !actualSet.has(s.name)).map((s) => s.name);
}

export function verifyDocuments(
  classified: ClassifiedClassType[],
  documents: ClassTypeDocuments[]
): MismatchWarning[] {
  const warnings: MismatchWarning[] = [];

  for (let i = 0; i < classified.length; i++) {
    const { classType, am, pm } = classified[i];
    const docs = documents[i];

    const checks: {
      session: "am" | "pm";
      docType: DocType;
      expected: RawRosterRow[];
      actualNames: string[];
    }[] = [
      { session: "am", docType: "printAttendance", expected: am, actualNames: docs.printAttendanceAm.map((r) => r.name) },
      { session: "pm", docType: "printAttendance", expected: pm, actualNames: docs.printAttendancePm.map((r) => r.name) },
      { session: "am", docType: "onlineAttendance", expected: am, actualNames: docs.onlineAttendanceAm.map((r) => r.name) },
      { session: "pm", docType: "onlineAttendance", expected: pm, actualNames: docs.onlineAttendancePm.map((r) => r.name) },
      { session: "am", docType: "counselingLog", expected: am, actualNames: docs.counselingLogAm.map((r) => r.name) },
      { session: "pm", docType: "counselingLog", expected: pm, actualNames: docs.counselingLogPm.map((r) => r.name) },
      { session: "am", docType: "textbook", expected: am, actualNames: docs.textbookAm.map((r) => r.name) },
      { session: "pm", docType: "textbook", expected: pm, actualNames: docs.textbookPm.map((r) => r.name) },
    ];

    for (const check of checks) {
      const missingNames = diffMissing(check.expected, check.actualNames);
      if (missingNames.length > 0 || check.expected.length !== check.actualNames.length) {
        warnings.push({
          classTypeId: classType.id,
          session: check.session,
          docType: check.docType,
          missingNames,
        });
      }
    }
  }

  return warnings;
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이 파일의 2개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add lib/roster/verify.ts lib/roster/verify.test.ts
git commit -m "반별 인원수/이름 검증 로직 추가"
```

---

### Task 5: API 라우트 (명단 업로드 → 분류+문서생성+검증)

**Files:**
- Create: `app/api/roster/generate/route.ts`

**Interfaces:**
- Consumes: Task 1의 `parseRosterHeaders`/`findApplicationColumnIndex`/`parseRosterRows`/`RosterFormatError`, Task 2의 `classifyStudents`, Task 3의 `buildDocuments`, Task 4의 `verifyDocuments`.
- Produces: `POST /api/roster/generate` (multipart form-data: `file`, `term`("1"|"2"), `columnIndex`(선택, 문자열 숫자)) → 성공 시 `{ status: "ok", documents: ClassTypeDocuments[], warnings: MismatchWarning[] }`, 컬럼 자동 매칭 실패 시 `{ status: "needs_column_selection", headers: string[] }`, 그 외 에러는 `{ error: string }` + 4xx. Task 6(화면)에서 이 엔드포인트를 호출한다.

- [ ] **Step 1: app/api/roster/generate/route.ts 작성**

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  parseRosterHeaders,
  findApplicationColumnIndex,
  parseRosterRows,
  RosterFormatError,
} from "@/lib/roster/roster-file";
import { classifyStudents } from "@/lib/roster/classify";
import { buildDocuments } from "@/lib/roster/documents";
import { verifyDocuments } from "@/lib/roster/verify";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const term = formData.get("term");
  const columnIndexValue = formData.get("columnIndex");

  if (!(file instanceof File) || (term !== "1" && term !== "2")) {
    return NextResponse.json(
      { error: "file과 term(1 또는 2)이 필요합니다." },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();

  let applicationColumnIndex: number;
  try {
    if (typeof columnIndexValue === "string" && columnIndexValue !== "") {
      applicationColumnIndex = Number(columnIndexValue);
    } else {
      const headers = parseRosterHeaders(buffer);
      const detected = findApplicationColumnIndex(headers, term);
      if (detected === null) {
        return NextResponse.json({
          status: "needs_column_selection",
          headers,
        });
      }
      applicationColumnIndex = detected;
    }
  } catch (error) {
    if (error instanceof RosterFormatError) {
      return NextResponse.json(
        { error: "양식이 다릅니다." },
        { status: 400 }
      );
    }
    throw error;
  }

  const students = parseRosterRows(buffer, applicationColumnIndex);
  const classified = classifyStudents(students);

  const hasAnyStudent = classified.some(
    (c) => c.am.length > 0 || c.pm.length > 0
  );
  if (!hasAnyStudent) {
    return NextResponse.json(
      { error: "인식된 반이 없습니다." },
      { status: 422 }
    );
  }

  const documents = buildDocuments(classified);
  const warnings = verifyDocuments(classified, documents);

  return NextResponse.json({ status: "ok", documents, warnings });
}
```

- [ ] **Step 2: 빌드로 타입 오류 없는지 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 3: Commit**

```bash
git add app/api/roster/generate/route.ts
git commit -m "반 명단 문서 생성 API 라우트 추가"
```

---

### Task 6: 화면 UI (업로드 → 컬럼 수동선택 → 결과)

**Files:**
- Create: `app/roster/page.tsx`

**Interfaces:**
- Consumes: Task 5의 `POST /api/roster/generate`.
- Produces: `/roster` 화면. 1단계 계획의 미들웨어 게이트가 이미 이 경로를 보호하므로 별도 인증 코드는 필요 없다.

- [ ] **Step 1: app/roster/page.tsx 작성**

```tsx
"use client";

import { useState } from "react";
import { CLASS_TYPES } from "@/lib/roster/classes";
import type { ClassTypeDocuments, MismatchWarning } from "@/lib/roster/types";

type Step = "upload" | "columnSelect" | "results";

export default function RosterPage() {
  const [step, setStep] = useState<Step>("upload");
  const [term, setTerm] = useState<"1" | "2">("1");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnIndex, setColumnIndex] = useState<number>(0);
  const [documents, setDocuments] = useState<ClassTypeDocuments[]>([]);
  const [warnings, setWarnings] = useState<MismatchWarning[]>([]);
  const [selectedClassTypeId, setSelectedClassTypeId] = useState<string>("all");
  const [error, setError] = useState("");

  async function submitUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("명단 파일을 선택해주세요.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("term", term);

    const res = await fetch("/api/roster/generate", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "명단 처리에 실패했습니다.");
      return;
    }

    if (data.status === "needs_column_selection") {
      setHeaders(data.headers);
      setStep("columnSelect");
      return;
    }

    setDocuments(data.documents);
    setWarnings(data.warnings);
    setStep("results");
  }

  async function submitColumnSelection() {
    setError("");
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("term", term);
    formData.set("columnIndex", String(columnIndex));

    const res = await fetch("/api/roster/generate", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "명단 처리에 실패했습니다.");
      return;
    }

    setDocuments(data.documents);
    setWarnings(data.warnings);
    setStep("results");
  }

  const visibleDocuments =
    selectedClassTypeId === "all"
      ? documents
      : documents.filter((d) => d.classType.id === selectedClassTypeId);

  return (
    <main>
      <h1>반 명단 문서 자동화</h1>

      {step === "upload" && (
        <form onSubmit={submitUpload}>
          <label>
            기수
            <select value={term} onChange={(e) => setTerm(e.target.value as "1" | "2")}>
              <option value="1">1기</option>
              <option value="2">2기</option>
            </select>
          </label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit">문서 생성</button>
        </form>
      )}

      {step === "columnSelect" && (
        <section>
          <p>신청 컬럼을 자동으로 찾지 못했습니다. 아래 헤더 목록에서 직접 선택해주세요.</p>
          <select
            value={columnIndex}
            onChange={(e) => setColumnIndex(Number(e.target.value))}
          >
            {headers.map((header, index) => (
              <option key={index} value={index}>
                {index}: {header}
              </option>
            ))}
          </select>
          <button onClick={submitColumnSelection}>이 컬럼으로 진행</button>
        </section>
      )}

      {step === "results" && (
        <section>
          <label>
            반 선택
            <select
              value={selectedClassTypeId}
              onChange={(e) => setSelectedClassTypeId(e.target.value)}
            >
              <option value="all">전체 반 보기</option>
              {CLASS_TYPES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {warnings.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>반</th>
                  <th>세션</th>
                  <th>문서</th>
                  <th>누락된 학생</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((w, i) => (
                  <tr key={i}>
                    <td>{w.classTypeId}</td>
                    <td>{w.session === "am" ? "오전" : "오후"}</td>
                    <td>{w.docType}</td>
                    <td>{w.missingNames.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {visibleDocuments.map((doc) => (
            <div key={doc.classType.id}>
              <h2>{doc.classType.label}</h2>

              <h3>인쇄용 출석부 (오전)</h3>
              <table>
                <thead>
                  <tr>
                    <th>NO</th>
                    <th>학과</th>
                    <th>이름</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.printAttendanceAm.map((r) => (
                    <tr key={r.no}>
                      <td>{r.no}</td>
                      <td>{r.department}</td>
                      <td>{r.name}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>인쇄용 출석부 (오후)</h3>
              <table>
                <thead>
                  <tr>
                    <th>NO</th>
                    <th>학과</th>
                    <th>이름</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.printAttendancePm.map((r) => (
                    <tr key={r.no}>
                      <td>{r.no}</td>
                      <td>{r.department}</td>
                      <td>{r.name}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>온라인 출석부</h3>
              <table>
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>학년</th>
                    <th>학번</th>
                    <th>수강반</th>
                    <th>성명</th>
                    <th>연락처</th>
                    <th></th>
                    <th>번호</th>
                    <th>학년</th>
                    <th>학번</th>
                    <th>수강반</th>
                    <th>성명</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({
                    length: Math.max(
                      doc.onlineAttendanceAm.length,
                      doc.onlineAttendancePm.length
                    ),
                  }).map((_, i) => {
                    const am = doc.onlineAttendanceAm[i];
                    const pm = doc.onlineAttendancePm[i];
                    return (
                      <tr key={i}>
                        <td>{am?.no ?? ""}</td>
                        <td>{am?.grade ?? ""}</td>
                        <td>{am?.studentId ?? ""}</td>
                        <td>{am?.className ?? ""}</td>
                        <td>{am?.name ?? ""}</td>
                        <td>{am?.phone ?? ""}</td>
                        <td></td>
                        <td>{pm?.no ?? ""}</td>
                        <td>{pm?.grade ?? ""}</td>
                        <td>{pm?.studentId ?? ""}</td>
                        <td>{pm?.className ?? ""}</td>
                        <td>{pm?.name ?? ""}</td>
                        <td>{pm?.phone ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <h3>관리일지 (오전)</h3>
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>학과</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.counselingLogAm.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>관리일지 (오후)</h3>
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>학과</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.counselingLogPm.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>교재배부명단 (오전)</h3>
              <table>
                <thead>
                  <tr>
                    <th>연번</th>
                    <th>이름</th>
                    <th>학과</th>
                    <th>학번</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.textbookAm.map((r) => (
                    <tr key={r.no}>
                      <td>{r.no}</td>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                      <td>{r.studentId}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>교재배부명단 (오후)</h3>
              <table>
                <thead>
                  <tr>
                    <th>연번</th>
                    <th>이름</th>
                    <th>학과</th>
                    <th>학번</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.textbookPm.map((r) => (
                    <tr key={r.no}>
                      <td>{r.no}</td>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                      <td>{r.studentId}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {error && <p role="alert">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: 빌드로 타입 오류 없는지 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 3: Commit**

```bash
git add app/roster/page.tsx
git commit -m "반 명단 문서 자동화 화면 추가"
```

---

### Task 7: 수동 확인 (실제 명단 파일로 전체 흐름 검증)

**Files:**
- Modify: 없음 (실제 확인만 진행, 코드 변경 없음)

**Interfaces:**
- Consumes: Task 1~6에서 만든 전체 기능.
- Produces: 실제로 동작이 확인된 `/roster` 기능.

- [ ] **Step 1: 로컬 서버 실행**

Run: `npm run dev`

- [ ] **Step 2: 실제 명단 파일로 전체 흐름 확인**

브라우저에서 확인 (로그인 후):
1. `/roster` 접속 → 업로드 화면이 보이는지 확인.
2. 기수 "1기" 선택, 저장소 루트의 `test.xlsx` 업로드 → "문서 생성" 클릭.
3. 컬럼 자동 매칭이 성공해서(헤더에 `1기 신청` 컬럼이 정확히 하나뿐이므로) 바로 결과 화면으로 넘어가는지 확인.
4. "토익 중급" 반을 선택해서 인쇄용 출석부(오전)에 "이주호"가, 온라인 출석부에 수강반 "토익 중급 오전"으로 "이주호"가 나오는지 확인 (`토익 중급 오전(인쇄)`/`온라인 출석부` 탭의 실제 데이터와 대조).
5. 상단 검증 경고 표가 비어 있는지(불일치 없음) 확인.
6. 기수 "2기"로 다시 업로드해서, 박신영(1기 신청 컬럼이 비어 있는 학생)이 1기 결과에는 없고, 신청 컬럼에 "중급 오전"이 있는 2기 결과에는 "토익 중급"에 포함되는지 확인.

Expected: 6가지 모두 통과. 확인 후 서버 종료(Ctrl+C).

- [ ] **Step 3: 빌드 최종 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 4: Commit (변경 사항이 있는 경우에만)**

이 Task는 수동 확인이라 코드 변경이 없을 수 있다. 코드 변경이 없으면 커밋하지 않는다.

---

## Self-Review 메모

- **스펙 커버리지:** 설계 문서의 화면 구성 3개(비밀번호는 1단계에서 이미 구현, 업로드 화면/결과 화면)는 Task 5~6에서 구현. 반 분류 규칙(10개 반명, 정확히 일치해야 포함)은 Global Constraints + Task 2. 4종 문서(인쇄용 출석부/온라인 출석부/관리일지/교재배부명단)는 Task 3. 인원수 검증 및 불일치 학생 표시는 Task 4 + 결과 화면. 헤더 자동/수동 매칭은 Task 1(자동) + Task 5~6(수동 선택 흐름, 2026-07-08 사용자 결정으로 이번 계획에 포함). 오류 처리 3종("양식이 다릅니다", 헤더 수동 선택, "인식된 반이 없습니다")은 Task 5의 API 라우트에 반영. 개인정보 미저장은 이번 계획에 저장 관련 코드가 아예 없어 자동 충족. **의도된 범위 밖:** 기존 엑셀의 반복 인쇄 블록·서식 재현, 관리일지 11행 블록 서식 자체 생성 — 설계 문서에서 이미 범위 밖으로 명시됨.
- **플레이스홀더 스캔:** 모든 Step에 실제 코드/명령어 포함 확인 완료.
- **타입 일관성:** `RawRosterRow`, `ClassTypeDef`, `ClassifiedClassType`, `ClassTypeDocuments`, `MismatchWarning` 시그니처가 Task 1 정의와 Task 2~5 사용처에서 동일함을 확인 완료. `classifyStudents`(Task 2), `buildDocuments`(Task 3), `verifyDocuments`(Task 4) 모두 Task 5에서 정확히 같은 이름/시그니처로 import됨을 확인.
