<!-- vocab-web 2단계: 단어 시험 채점 기능 구현 계획 -->
# 단어 시험 채점 기능 (2단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1단계에서 만든 공통 기반(Next.js 프로젝트 + 비밀번호 게이트) 위에, 단어 시험을 OpenAI로 채점하고 애매한 항목만 교사가 검토할 수 있는 `/grading` 기능을 만든다.

**Architecture:** 반+데이별 단어장은 Vercel Blob에 JSON으로 저장해 재사용한다. 학생 답안은 엑셀/CSV 파일 업로드로만 받는다 (구글시트 링크 붙여넣기는 이번 계획 범위 밖 — 나중에 필요하면 별도로 추가). 서버는 학생 1명당 OpenAI API를 1번 호출해 단어별 정답/오답과 애매한 항목의 판단 이유를 받고, 반 전체 기준으로 오답 집계까지 마친 뒤 결과를 반환한다. 학생 이름·답안은 요청 처리 중에만 메모리에 있고 응답 후 버린다 — 저장하는 건 단어장(개인정보 아님)뿐이다.

**Tech Stack:** 기존(Next.js 15, TypeScript, Vitest)에 추가로 `openai`(OpenAI 공식 SDK), `@vercel/blob`(단어장 저장), `xlsx`(SheetJS — 엑셀/CSV 업로드 파싱)를 새로 설치한다.

## Global Constraints

- 개인정보(이름 제외 학번 등)를 다루지 않는다 — 설계 문서 결정에 따라 이 기능은 학번을 아예 조회/저장하지 않고 이름만 쓴다.
- 학생 답안·이름은 요청 처리 중에만 서버 메모리에 있고 응답 후 저장하지 않는다. 저장되는 건 반+데이별 단어장(개인정보 아님)뿐이다.
- OpenAI API 키는 서버 코드(API 라우트/`lib`)에서만 쓰고 브라우저에 노출하지 않는다.
- 단어장에 명시적으로 나열되지 않은 뜻은 정답으로 인정하지 않는다.
- 미응답(빈칸)은 자동 오답 처리한다 (OpenAI 호출 없이 즉시 오답 판정).
- 채점 판정 기준(그대로 프롬프트에 반영):
  - 표현만 다르고 품사·의미가 같으면 정답 (예: potential="잠재적인"인데 "잠재의"라고 써도 정답).
  - 품사가 명백히 다르면 오답 (예: brighten(동사)의 답으로 "밝다"(형용사) 쓰면 오답).
  - 복합명사/구의 일부 의미 요소가 빠지면 오답 (예: slow reader="느리게 읽는 사람"인데 "느리다"만 쓰면 오답).
  - 단어장에 없는 뜻은 오답 (예: ship의 실제 뜻 "배"가 있어도 단어장에 "배송하다"만 있으면 "배"는 오답).
- 같은 단어를 10명 이상이 틀리면 결과 화면 상단에 `단어 | 오답 인원 | 공통 오답` 경고 행으로 표시한다.
- **승인 필요:** `openai`, `@vercel/blob`, `xlsx` 3개 패키지를 새로 설치한다 (Task 1·3·5에서 npm install 실행 전 사용자에게 한국어로 안내하고 승인받는다).
- **승인 필요:** `OPENAI_API_KEY` 환경변수(로컬 `.env.local` + Vercel)와 Vercel Blob 저장소 연결(및 그로 인해 생기는 `BLOB_READ_WRITE_TOKEN` 환경변수)은 사용자가 직접 값을 발급/등록해야 한다.
- 라이브러리(`openai`, `@vercel/blob`, `xlsx`)의 정확한 함수 시그니처는 설치된 버전의 실제 타입 정의를 기준으로 한다 — 이 계획의 코드는 각 라이브러리의 공식 문서 기준 표준 사용법이며, 만약 설치된 버전에서 시그니처가 다르면 그 타입에 맞게 조정한다 (로직 자체는 바꾸지 않는다).

---

## File Structure

```
vocab-web/
  lib/
    grading/
      classes.ts               # 반 목록(10개)과 데이(1~15) 상수
      types.ts                 # WordEntry, WordList, StudentAnswerRow, WordVerdict, StudentGradeResult 등 공유 타입
      wordlist.ts               # 단어장 CSV/엑셀 파싱 + Vercel Blob 저장/조회
      wordlist.test.ts
      answers-file.ts            # 답안 엑셀/CSV 업로드 파싱 (이름 + 답 30개)
      answers-file.test.ts
      grade-student.ts           # OpenAI로 학생 1명 채점
      grade-student.test.ts
      aggregate.ts               # 반 전체 오답 집계 (10명 이상 경고)
      aggregate.test.ts
  app/
    api/
      grading/
        wordlist/route.ts        # GET(조회)/PUT(등록·수정) — 단어장
        grade/route.ts           # POST — 답안 업로드 받아 채점 실행
    grading/
      page.tsx                   # 반+데이 선택 → 단어장 관리 → 답안 업로드 → 결과, 4단계 클라이언트 화면
  app/page.tsx                   # 기존 홈 화면의 "/grading" 링크는 이미 있음 (수정 없음)
```

---

### Task 1: 단어장 타입 + CSV/엑셀 파싱 + Vercel Blob 저장·조회

**Files:**
- Create: `lib/grading/classes.ts`
- Create: `lib/grading/types.ts`
- Create: `lib/grading/wordlist.ts`
- Test: `lib/grading/wordlist.test.ts`

**Interfaces:**
- Consumes: 없음 (1단계 완료 상태 위에서 새로 시작).
- Produces: `CLASS_OPTIONS`, `DAY_OPTIONS`, `WordEntry`, `WordList`, `parseWordListRows(rows: string[][]): WordList`, `saveWordList(classId: string, day: number, list: WordList): Promise<void>`, `loadWordList(classId: string, day: number): Promise<WordList | null>` — Task 3(채점), Task 5(API 라우트), Task 6(화면)에서 그대로 쓴다.

- [ ] **Step 1: 사용자에게 패키지 설치 승인 요청**

사용자에게 "단어장을 저장할 Vercel Blob 패키지(`@vercel/blob`)를 설치하겠습니다. 진행할까요?"라고 한국어로 물어 승인받는다.

- [ ] **Step 2: lib/grading/classes.ts 작성**

```ts
export const CLASS_OPTIONS = [
  { id: "toeic-basic-am", label: "토익 기초 오전" },
  { id: "toeic-basic-pm", label: "토익 기초 오후" },
  { id: "toeic-mid-am", label: "토익 중급 오전" },
  { id: "toeic-mid-pm", label: "토익 중급 오후" },
  { id: "toeic-adv-am", label: "토익 실전 오전" },
  { id: "toeic-adv-pm", label: "토익 실전 오후" },
  { id: "opic-mid-am", label: "오픽 중급 오전" },
  { id: "opic-mid-pm", label: "오픽 중급 오후" },
  { id: "opic-adv-am", label: "오픽 실전 오전" },
  { id: "opic-adv-pm", label: "오픽 실전 오후" },
] as const;

export const DAY_OPTIONS: number[] = Array.from({ length: 15 }, (_, i) => i + 1);
```

- [ ] **Step 3: lib/grading/types.ts 작성**

```ts
export interface WordEntry {
  word: string;
  meanings: string[];
}

export type WordList = WordEntry[];

export interface StudentAnswerRow {
  name: string;
  answers: string[];
}

export interface WordVerdict {
  word: string;
  studentAnswer: string;
  correct: boolean;
  ambiguous: boolean;
  reasoning?: string;
}

export interface StudentGradeResult {
  name: string;
  verdicts: WordVerdict[];
  manualCheckRequired: boolean;
}
```

- [ ] **Step 4: 실패하는 테스트 작성 (lib/grading/wordlist.test.ts)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseWordListRows, saveWordList, loadWordList } from "./wordlist";
import * as blob from "@vercel/blob";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  head: vi.fn(),
}));

describe("parseWordListRows", () => {
  it("parses rows into WordEntry objects, trimming and dropping empty meanings", () => {
    const rows = [
      ["potential", "잠재적인", "잠재의", "", ""],
      ["account", "계정", "", "", ""],
    ];
    expect(parseWordListRows(rows)).toEqual([
      { word: "potential", meanings: ["잠재적인", "잠재의"] },
      { word: "account", meanings: ["계정"] },
    ]);
  });

  it("skips rows with an empty word cell", () => {
    const rows = [["", "무시됨", "", "", ""]];
    expect(parseWordListRows(rows)).toEqual([]);
  });
});

describe("saveWordList", () => {
  beforeEach(() => {
    vi.mocked(blob.put).mockClear();
  });

  it("calls put with the class+day pathname and JSON body", async () => {
    const list = [{ word: "potential", meanings: ["잠재적인"] }];
    await saveWordList("toeic-mid-am", 4, list);
    expect(blob.put).toHaveBeenCalledWith(
      "wordlists/toeic-mid-am/day-4.json",
      JSON.stringify(list),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    );
  });
});

describe("loadWordList", () => {
  beforeEach(() => {
    vi.mocked(blob.head).mockReset();
    vi.unstubAllGlobals();
  });

  it("fetches and parses the word list when it exists", async () => {
    const list = [{ word: "potential", meanings: ["잠재적인"] }];
    vi.mocked(blob.head).mockResolvedValue({
      url: "https://blob.example/wordlists/toeic-mid-am/day-4.json",
    } as Awaited<ReturnType<typeof blob.head>>);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => list })
    );

    const result = await loadWordList("toeic-mid-am", 4);
    expect(result).toEqual(list);
    expect(blob.head).toHaveBeenCalledWith("wordlists/toeic-mid-am/day-4.json");
  });

  it("returns null when the word list does not exist", async () => {
    vi.mocked(blob.head).mockRejectedValue(new Error("not found"));
    const result = await loadWordList("toeic-mid-am", 4);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 5: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/grading/wordlist.ts` 모듈이 없어서 import 에러, `@vercel/blob` 패키지도 아직 없어서 에러.

- [ ] **Step 6: 패키지 설치 (Step 1에서 승인받은 뒤)**

Run: `npm install @vercel/blob`

- [ ] **Step 7: lib/grading/wordlist.ts 최소 구현**

```ts
import { put, head } from "@vercel/blob";
import type { WordList } from "./types";

function blobPathname(classId: string, day: number): string {
  return `wordlists/${classId}/day-${day}.json`;
}

export function parseWordListRows(rows: string[][]): WordList {
  return rows
    .filter((row) => (row[0] ?? "").trim() !== "")
    .map((row) => ({
      word: row[0].trim(),
      meanings: row
        .slice(1, 5)
        .map((m) => (m ?? "").trim())
        .filter((m) => m !== ""),
    }));
}

export async function saveWordList(
  classId: string,
  day: number,
  list: WordList
): Promise<void> {
  await put(blobPathname(classId, day), JSON.stringify(list), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function loadWordList(
  classId: string,
  day: number
): Promise<WordList | null> {
  try {
    const info = await head(blobPathname(classId, day));
    const response = await fetch(info.url);
    return (await response.json()) as WordList;
  } catch {
    return null;
  }
}
```

- [ ] **Step 8: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이 파일의 5개 테스트 모두 통과 (기존 1단계 테스트 8개 포함 총 13개).

- [ ] **Step 9: Commit**

```bash
git add lib/grading/classes.ts lib/grading/types.ts lib/grading/wordlist.ts lib/grading/wordlist.test.ts package.json package-lock.json
git commit -m "단어장 타입, 파싱, Vercel Blob 저장/조회 추가"
```

---

### Task 2: 답안 파일 파싱 (엑셀/CSV 업로드 → 이름+답안 배열)

**Files:**
- Create: `lib/grading/answers-file.ts`
- Test: `lib/grading/answers-file.test.ts`

**Interfaces:**
- Consumes: Task 1의 `StudentAnswerRow` 타입.
- Produces: `parseAnswerFile(buffer: ArrayBuffer): StudentAnswerRow[]` — Task 5(API 라우트)에서 그대로 쓴다. 입력 파일은 1행에 헤더 없이, A열=이름, B열부터 30칸=단어 순서대로의 답안이라고 가정한다 (기존 "보카테스트" 탭 응답 행 구조 중 이름·답안 부분만 반영 — 타임스탬프/학번 열은 이 기능에서 쓰지 않는다).

- [ ] **Step 1: 사용자에게 패키지 설치 승인 요청**

사용자에게 "엑셀/CSV 파일을 읽기 위한 `xlsx` 패키지를 설치하겠습니다. 진행할까요?"라고 한국어로 물어 승인받는다.

- [ ] **Step 2: 실패하는 테스트 작성 (lib/grading/answers-file.test.ts)**

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseAnswerFile } from "./answers-file";

function makeWorkbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const array = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return array as ArrayBuffer;
}

describe("parseAnswerFile", () => {
  it("parses name + answers from each row", () => {
    const buffer = makeWorkbookBuffer([
      ["박성재", "잠재적인", "계정"],
      ["이주호", "잠재의", "계좌"],
    ]);

    expect(parseAnswerFile(buffer)).toEqual([
      { name: "박성재", answers: ["잠재적인", "계정"] },
      { name: "이주호", answers: ["잠재의", "계좌"] },
    ]);
  });

  it("treats a missing cell as an empty-string answer", () => {
    const buffer = makeWorkbookBuffer([["김대연", "잠재적인", ""]]);
    expect(parseAnswerFile(buffer)).toEqual([
      { name: "김대연", answers: ["잠재적인", ""] },
    ]);
  });

  it("skips rows with an empty name cell", () => {
    const buffer = makeWorkbookBuffer([["", "무시됨"]]);
    expect(parseAnswerFile(buffer)).toEqual([]);
  });
});
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/grading/answers-file.ts` 모듈이 없고 `xlsx` 패키지도 없어서 에러.

- [ ] **Step 4: 패키지 설치**

Run: `npm install xlsx`

- [ ] **Step 5: lib/grading/answers-file.ts 최소 구현**

```ts
import * as XLSX from "xlsx";
import type { StudentAnswerRow } from "./types";

export function parseAnswerFile(buffer: ArrayBuffer): StudentAnswerRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
  });

  return rows
    .filter((row) => String(row[0] ?? "").trim() !== "")
    .map((row) => ({
      name: String(row[0]).trim(),
      answers: row.slice(1).map((cell) => String(cell ?? "").trim()),
    }));
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이 파일의 3개 테스트 모두 통과.

- [ ] **Step 7: Commit**

```bash
git add lib/grading/answers-file.ts lib/grading/answers-file.test.ts package.json package-lock.json
git commit -m "답안 엑셀/CSV 파일 파싱 추가"
```

---

### Task 3: 채점 로직 (OpenAI로 학생 1명 채점)

**Files:**
- Create: `lib/grading/grade-student.ts`
- Test: `lib/grading/grade-student.test.ts`

**Interfaces:**
- Consumes: Task 1의 `WordList`, `WordVerdict`, `StudentGradeResult` 타입.
- Produces: `gradeStudent(client: OpenAI, name: string, wordList: WordList, answers: string[]): Promise<StudentGradeResult>` — Task 5(API 라우트)에서 학생별로 호출한다.

- [ ] **Step 1: 사용자에게 패키지 설치 승인 요청**

사용자에게 "OpenAI 채점 호출을 위한 `openai` 패키지를 설치하겠습니다. 진행할까요?"라고 한국어로 물어 승인받는다.

- [ ] **Step 2: 실패하는 테스트 작성 (lib/grading/grade-student.test.ts)**

```ts
import { describe, it, expect, vi } from "vitest";
import { gradeStudent } from "./grade-student";
import type { WordList } from "./types";

function makeMockClient(responseText: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: responseText } }],
        }),
      },
    },
  } as unknown as import("openai").default;
}

const wordList: WordList = [
  { word: "potential", meanings: ["잠재적인"] },
  { word: "brighten", meanings: ["밝아지다"] },
];

describe("gradeStudent", () => {
  it("marks blank answers incorrect without calling the API for that word", async () => {
    const client = makeMockClient(
      JSON.stringify([
        { word: "potential", correct: true, ambiguous: false },
      ])
    );

    const result = await gradeStudent(client, "박성재", wordList, [
      "잠재적인",
      "",
    ]);

    const brightenVerdict = result.verdicts.find(
      (v) => v.word === "brighten"
    );
    expect(brightenVerdict).toEqual({
      word: "brighten",
      studentAnswer: "",
      correct: false,
      ambiguous: false,
    });
  });

  it("parses correct/ambiguous verdicts from a well-formed API response", async () => {
    const client = makeMockClient(
      JSON.stringify([
        { word: "potential", correct: true, ambiguous: false },
        {
          word: "brighten",
          correct: false,
          ambiguous: true,
          reasoning: "품사가 달라 오답으로 판단",
        },
      ])
    );

    const result = await gradeStudent(client, "이주호", wordList, [
      "잠재의",
      "밝다",
    ]);

    expect(result.manualCheckRequired).toBe(false);
    expect(result.verdicts).toEqual([
      {
        word: "potential",
        studentAnswer: "잠재의",
        correct: true,
        ambiguous: false,
      },
      {
        word: "brighten",
        studentAnswer: "밝다",
        correct: false,
        ambiguous: true,
        reasoning: "품사가 달라 오답으로 판단",
      },
    ]);
  });

  it("marks the student for manual check when the API response is not valid JSON", async () => {
    const client = makeMockClient("이건 JSON이 아님");

    const result = await gradeStudent(client, "김대연", wordList, [
      "잠재적인",
      "밝아지다",
    ]);

    expect(result.manualCheckRequired).toBe(true);
  });
});
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/grading/grade-student.ts` 모듈이 없고 `openai` 패키지도 없어서 에러.

- [ ] **Step 4: 패키지 설치**

Run: `npm install openai`

- [ ] **Step 5: lib/grading/grade-student.ts 최소 구현**

```ts
import type OpenAI from "openai";
import type { WordList, WordVerdict, StudentGradeResult } from "./types";

const GRADING_CRITERIA = `단어 시험 채점 기준:
- 표현만 다르고 품사·의미가 같으면 정답 (예: "잠재적인" 정답에 "잠재의"라고 써도 정답).
- 품사가 명백히 다르면 오답 (예: 동사 뜻 자리에 형용사/상태를 나타내는 답을 쓰면 오답).
- 복합명사/구의 일부 의미 요소가 빠지면 오답.
- 아래 나열된 뜻 외의 뜻은 정답으로 인정하지 않는다.`;

function buildPrompt(
  wordList: WordList,
  wordsToGrade: { word: string; meanings: string[]; studentAnswer: string }[]
): string {
  const wordListText = wordsToGrade
    .map(
      (w) =>
        `- 단어: ${w.word} / 정답으로 인정되는 뜻: ${w.meanings.join(", ")} / 학생 답: "${w.studentAnswer}"`
    )
    .join("\n");

  return `${GRADING_CRITERIA}

아래 단어들을 각각 채점해서 JSON 배열로만 답해라. 각 항목은 {"word": string, "correct": boolean, "ambiguous": boolean, "reasoning": string(선택, ambiguous가 true일 때만)} 형태여야 한다.

${wordListText}`;
}

export async function gradeStudent(
  client: OpenAI,
  name: string,
  wordList: WordList,
  answers: string[]
): Promise<StudentGradeResult> {
  const verdicts: WordVerdict[] = [];
  const wordsToGrade: {
    word: string;
    meanings: string[];
    studentAnswer: string;
  }[] = [];

  wordList.forEach((entry, index) => {
    const studentAnswer = (answers[index] ?? "").trim();
    if (studentAnswer === "") {
      verdicts.push({
        word: entry.word,
        studentAnswer: "",
        correct: false,
        ambiguous: false,
      });
    } else {
      wordsToGrade.push({
        word: entry.word,
        meanings: entry.meanings,
        studentAnswer,
      });
    }
  });

  if (wordsToGrade.length === 0) {
    return { name, verdicts, manualCheckRequired: false };
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: buildPrompt(wordList, wordsToGrade) }],
  });

  const content = completion.choices[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content) as {
      word: string;
      correct: boolean;
      ambiguous: boolean;
      reasoning?: string;
    }[];

    for (const item of parsed) {
      const matched = wordsToGrade.find((w) => w.word === item.word);
      verdicts.push({
        word: item.word,
        studentAnswer: matched?.studentAnswer ?? "",
        correct: item.correct,
        ambiguous: item.ambiguous,
        ...(item.ambiguous && item.reasoning
          ? { reasoning: item.reasoning }
          : {}),
      });
    }

    return { name, verdicts, manualCheckRequired: false };
  } catch {
    return { name, verdicts, manualCheckRequired: true };
  }
}
```

- [ ] **Step 6: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이 파일의 3개 테스트 모두 통과.

- [ ] **Step 7: Commit**

```bash
git add lib/grading/grade-student.ts lib/grading/grade-student.test.ts package.json package-lock.json
git commit -m "OpenAI 기반 학생별 채점 로직 추가"
```

---

### Task 4: 반 전체 오답 집계 (10명 이상 공통 오답 경고)

**Files:**
- Create: `lib/grading/aggregate.ts`
- Test: `lib/grading/aggregate.test.ts`

**Interfaces:**
- Consumes: Task 1의 `StudentGradeResult` 타입.
- Produces: `aggregateResults(results: StudentGradeResult[]): { warnings: { word: string; count: number; commonWrongAnswer: string }[]; students: { name: string; wrongWords: string[]; manualCheckRequired: boolean }[] }` — Task 5(API 라우트)와 Task 6(결과 화면)에서 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성 (lib/grading/aggregate.test.ts)**

```ts
import { describe, it, expect } from "vitest";
import { aggregateResults } from "./aggregate";
import type { StudentGradeResult } from "./types";

function makeResult(
  name: string,
  verdicts: { word: string; studentAnswer: string; correct: boolean }[]
): StudentGradeResult {
  return {
    name,
    verdicts: verdicts.map((v) => ({ ...v, ambiguous: false })),
    manualCheckRequired: false,
  };
}

describe("aggregateResults", () => {
  it("lists each student's wrong words", () => {
    const results = [
      makeResult("박성재", [
        { word: "potential", studentAnswer: "잠재적인", correct: true },
        { word: "brighten", studentAnswer: "밝다", correct: false },
      ]),
      makeResult("이주호", [
        { word: "potential", studentAnswer: "잠재의", correct: true },
        { word: "brighten", studentAnswer: "밝아지다", correct: true },
      ]),
    ];

    const { students } = aggregateResults(results);
    expect(students).toEqual([
      { name: "박성재", wrongWords: ["brighten"], manualCheckRequired: false },
      { name: "이주호", wrongWords: [], manualCheckRequired: false },
    ]);
  });

  it("adds a warning when 10 or more students miss the same word, using the most common wrong answer", () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult(`학생${i + 1}`, [
        {
          word: "brighten",
          studentAnswer: i < 7 ? "밝다" : "빛나다",
          correct: false,
        },
      ])
    );

    const { warnings } = aggregateResults(results);
    expect(warnings).toEqual([
      { word: "brighten", count: 10, commonWrongAnswer: "밝다" },
    ]);
  });

  it("does not warn when fewer than 10 students miss the same word", () => {
    const results = Array.from({ length: 9 }, (_, i) =>
      makeResult(`학생${i + 1}`, [
        { word: "brighten", studentAnswer: "밝다", correct: false },
      ])
    );

    const { warnings } = aggregateResults(results);
    expect(warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test`
Expected: FAIL — `lib/grading/aggregate.ts` 모듈이 없어서 import 에러.

- [ ] **Step 3: lib/grading/aggregate.ts 최소 구현**

```ts
import type { StudentGradeResult } from "./types";

export interface WrongWordWarning {
  word: string;
  count: number;
  commonWrongAnswer: string;
}

export interface StudentSummary {
  name: string;
  wrongWords: string[];
  manualCheckRequired: boolean;
}

export interface AggregatedResults {
  warnings: WrongWordWarning[];
  students: StudentSummary[];
}

export function aggregateResults(
  results: StudentGradeResult[]
): AggregatedResults {
  const students: StudentSummary[] = results.map((result) => ({
    name: result.name,
    wrongWords: result.verdicts
      .filter((v) => !v.correct)
      .map((v) => v.word),
    manualCheckRequired: result.manualCheckRequired,
  }));

  const wrongAnswersByWord = new Map<string, string[]>();
  for (const result of results) {
    for (const verdict of result.verdicts) {
      if (verdict.correct) continue;
      const list = wrongAnswersByWord.get(verdict.word) ?? [];
      list.push(verdict.studentAnswer);
      wrongAnswersByWord.set(verdict.word, list);
    }
  }

  const warnings: WrongWordWarning[] = [];
  for (const [word, wrongAnswers] of wrongAnswersByWord) {
    if (wrongAnswers.length < 10) continue;

    const counts = new Map<string, number>();
    for (const answer of wrongAnswers) {
      counts.set(answer, (counts.get(answer) ?? 0) + 1);
    }
    const [commonWrongAnswer] = [...counts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0];

    warnings.push({
      word,
      count: wrongAnswers.length,
      commonWrongAnswer,
    });
  }

  return { warnings, students };
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test`
Expected: PASS — 이 파일의 3개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add lib/grading/aggregate.ts lib/grading/aggregate.test.ts
git commit -m "반 전체 오답 집계 및 공통 오답 경고 로직 추가"
```

---

### Task 5: API 라우트 (단어장 CRUD + 채점 실행)

**Files:**
- Create: `app/api/grading/wordlist/route.ts`
- Create: `app/api/grading/grade/route.ts`

**Interfaces:**
- Consumes: Task 1의 `parseWordListRows`/`saveWordList`/`loadWordList`, Task 2의 `parseAnswerFile`, Task 3의 `gradeStudent`, Task 4의 `aggregateResults`.
- Produces: `GET /api/grading/wordlist?classId=&day=` → `WordList | null`. `PUT /api/grading/wordlist` (JSON body `{ classId, day, rows }`) → 저장 후 `{ ok: true }`. `POST /api/grading/grade` (multipart form-data: `classId`, `day`, `file`) → `{ warnings, students }` 또는 단어장 없음/답안 개수 불일치 에러. Task 6(화면)에서 이 3개 엔드포인트를 호출한다.

- [ ] **Step 1: app/api/grading/wordlist/route.ts 작성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { parseWordListRows, saveWordList, loadWordList } from "@/lib/grading/wordlist";

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get("classId");
  const dayParam = request.nextUrl.searchParams.get("day");
  const day = dayParam ? Number(dayParam) : NaN;

  if (!classId || Number.isNaN(day)) {
    return NextResponse.json(
      { error: "classId와 day가 필요합니다." },
      { status: 400 }
    );
  }

  const wordList = await loadWordList(classId, day);
  return NextResponse.json({ wordList });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { classId, day, rows } = body as {
    classId?: string;
    day?: number;
    rows?: string[][];
  };

  if (!classId || typeof day !== "number" || !Array.isArray(rows)) {
    return NextResponse.json(
      { error: "classId, day, rows가 필요합니다." },
      { status: 400 }
    );
  }

  const wordList = parseWordListRows(rows);
  await saveWordList(classId, day, wordList);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: app/api/grading/grade/route.ts 작성**

```ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { loadWordList } from "@/lib/grading/wordlist";
import { parseAnswerFile } from "@/lib/grading/answers-file";
import { gradeStudent } from "@/lib/grading/grade-student";
import { aggregateResults } from "@/lib/grading/aggregate";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const classId = formData.get("classId");
  const dayValue = formData.get("day");
  const file = formData.get("file");

  if (
    typeof classId !== "string" ||
    typeof dayValue !== "string" ||
    !(file instanceof File)
  ) {
    return NextResponse.json(
      { error: "classId, day, file이 필요합니다." },
      { status: 400 }
    );
  }

  const day = Number(dayValue);
  const wordList = await loadWordList(classId, day);
  if (!wordList) {
    return NextResponse.json(
      { error: "먼저 단어장을 등록해주세요." },
      { status: 404 }
    );
  }

  const buffer = await file.arrayBuffer();
  const studentRows = parseAnswerFile(buffer);

  const mismatched = studentRows.filter(
    (row) => row.answers.length !== wordList.length
  );

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const gradeResults = await Promise.all(
    studentRows.map((row) =>
      gradeStudent(client, row.name, wordList, row.answers)
    )
  );

  const aggregated = aggregateResults(gradeResults);

  return NextResponse.json({
    ...aggregated,
    answerCountMismatch: mismatched.map((row) => row.name),
  });
}
```

- [ ] **Step 3: 빌드로 타입 오류 없는지 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 4: Commit**

```bash
git add app/api/grading/wordlist/route.ts app/api/grading/grade/route.ts
git commit -m "단어장 CRUD 및 채점 실행 API 라우트 추가"
```

---

### Task 6: 화면 UI (반+데이 선택 → 단어장 관리 → 답안 업로드 → 결과)

**Files:**
- Create: `app/grading/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `CLASS_OPTIONS`, `DAY_OPTIONS`. Task 5의 `GET/PUT /api/grading/wordlist`, `POST /api/grading/grade`.
- Produces: `/grading` 화면. 1단계 계획의 미들웨어 게이트가 이미 이 경로를 보호하므로 별도 인증 코드는 필요 없다.

- [ ] **Step 1: app/grading/page.tsx 작성**

```tsx
"use client";

import { useState } from "react";
import { CLASS_OPTIONS, DAY_OPTIONS } from "@/lib/grading/classes";

type Step = "select" | "wordlist" | "answers" | "results";

interface WarningRow {
  word: string;
  count: number;
  commonWrongAnswer: string;
}

interface StudentRow {
  name: string;
  wrongWords: string[];
  manualCheckRequired: boolean;
}

export default function GradingPage() {
  const [step, setStep] = useState<Step>("select");
  const [classId, setClassId] = useState(CLASS_OPTIONS[0].id);
  const [day, setDay] = useState(DAY_OPTIONS[0]);
  const [wordListText, setWordListText] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  async function loadWordList() {
    setError("");
    const res = await fetch(
      `/api/grading/wordlist?classId=${classId}&day=${day}`
    );
    const data = await res.json();
    if (data.wordList) {
      setWordListText(
        data.wordList
          .map(
            (entry: { word: string; meanings: string[] }) =>
              `${entry.word}\t${entry.meanings.join("\t")}`
          )
          .join("\n")
      );
    } else {
      setWordListText("");
    }
    setStep("wordlist");
  }

  async function saveWordList() {
    setError("");
    const rows = wordListText
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.split("\t"));

    const res = await fetch("/api/grading/wordlist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, day, rows }),
    });

    if (!res.ok) {
      setError("단어장 저장에 실패했습니다.");
      return;
    }
    setStep("answers");
  }

  async function submitAnswers(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fileInput = e.currentTarget.elements.namedItem(
      "file"
    ) as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("답안 파일을 선택해주세요.");
      return;
    }

    const formData = new FormData();
    formData.set("classId", classId);
    formData.set("day", String(day));
    formData.set("file", file);

    const res = await fetch("/api/grading/grade", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "채점에 실패했습니다.");
      return;
    }

    setWarnings(data.warnings);
    setStudents(data.students);
    setStep("results");
  }

  return (
    <main>
      <h1>단어 시험 채점</h1>

      {step === "select" && (
        <section>
          <label>
            반
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            데이
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  DAY {d}
                </option>
              ))}
            </select>
          </label>
          <button onClick={loadWordList}>다음</button>
        </section>
      )}

      {step === "wordlist" && (
        <section>
          <p>
            단어장 (한 줄에 하나씩, 영단어와 뜻들을 탭으로 구분): 영단어[Tab]뜻1[Tab]뜻2...
          </p>
          <textarea
            value={wordListText}
            onChange={(e) => setWordListText(e.target.value)}
            rows={15}
            cols={60}
          />
          <button onClick={saveWordList}>저장하고 다음</button>
        </section>
      )}

      {step === "answers" && (
        <section>
          <form onSubmit={submitAnswers}>
            <input type="file" name="file" accept=".xlsx,.csv" />
            <button type="submit">채점하기</button>
          </form>
        </section>
      )}

      {step === "results" && (
        <section>
          {warnings.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>단어</th>
                  <th>오답 인원</th>
                  <th>공통 오답</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((w) => (
                  <tr key={w.word}>
                    <td>{w.word}</td>
                    <td>{w.count}</td>
                    <td>{w.commonWrongAnswer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>틀린 단어</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>
                    {s.manualCheckRequired
                      ? "수동 확인 필요"
                      : s.wrongWords.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
git add app/grading/page.tsx
git commit -m "단어 시험 채점 화면 추가"
```

---

### Task 7: 수동 확인 및 배포 설정

**Files:**
- Modify: 없음 (환경변수/실제 확인만 진행, 코드 변경 없음)

**Interfaces:**
- Consumes: Task 1~6에서 만든 전체 기능.
- Produces: 실제로 동작이 확인된 `/grading` 기능.

- [ ] **Step 1: 로컬 환경변수 준비 (사용자 승인 및 값 입력 필요)**

사용자에게 "로컬 테스트를 위해 `.env.local`에 `OPENAI_API_KEY`와 `BLOB_READ_WRITE_TOKEN` 값을 넣어주세요"라고 요청한다. `OPENAI_API_KEY`는 OpenAI 대시보드에서, `BLOB_READ_WRITE_TOKEN`은 Vercel 프로젝트의 Storage 탭에서 Blob 저장소를 만들면 발급된다.

```
SHARED_PASSWORD=(1단계에서 이미 설정됨)
OPENAI_API_KEY=사용자가_발급받은_값
BLOB_READ_WRITE_TOKEN=사용자가_발급받은_값
```

- [ ] **Step 2: 전체 흐름 수동 확인**

Run: `npm run dev`

브라우저에서 확인 (로그인 후):
1. `/grading` 접속 → 반+데이 선택 화면이 보이는지 확인.
2. 아무 반+DAY 선택 후 "다음" → 단어장 입력 화면에서 몇 개 단어(예: `potential[Tab]잠재적인`, `brighten[Tab]밝아지다`)를 입력하고 저장.
3. 답안 파일(이름+답 2개 들어있는 엑셀/CSV, 예: `박성재,잠재적인,밝다`)을 업로드해서 채점 실행.
4. 결과 화면에서 박성재가 `brighten`을 틀린 것으로 나오는지 확인 (품사가 다른 오답 사례).
5. 같은 단어장으로 다시 접속했을 때 저장했던 단어장이 그대로 불러와지는지 확인 (Vercel Blob 저장 확인).

Expected: 5가지 모두 통과. 확인 후 서버 종료(Ctrl+C).

- [ ] **Step 3: 빌드 최종 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 4: Vercel 환경변수 등록 (사용자 승인 필요)**

사용자에게 "Vercel 프로젝트 설정에 `OPENAI_API_KEY`를 등록하고, Storage 탭에서 Blob 저장소를 만들어 연결해주세요 (연결하면 `BLOB_READ_WRITE_TOKEN`은 자동으로 등록됩니다)"라고 안내한다.

- [ ] **Step 5: 배포 후 수동 확인**

Vercel이 배포한 URL에서 Step 2와 동일한 5가지를 다시 확인한다.

Expected: 로컬과 동일하게 동작.

- [ ] **Step 6: Commit (변경 사항이 있는 경우에만)**

이 Task는 대부분 환경 설정/수동 확인이라 코드 변경이 없을 수 있다. 코드 변경이 없으면 커밋하지 않는다.

---

## Self-Review 메모

- **스펙 커버리지:** 설계 문서의 화면 구성 5개(비밀번호는 1단계에서 이미 구현, 반+데이 선택/단어장 관리/답안 입력/결과 화면)는 Task 1~6에서 구현. 채점 판정 기준은 Global Constraints와 Task 3 프롬프트에 반영. 오답 10명 이상 경고는 Task 4. 개인정보 미저장은 이번 계획에 학번/연락처를 다루는 코드가 아예 없어 자동 충족. **의도된 범위 밖:** 구글시트 링크 붙여넣기(사용자 결정으로 이번 계획에서 제외, 파일 업로드만 구현), 이미지 답안지 채점(설계 문서에서도 범위 밖으로 명시).
- **플레이스홀더 스캔:** 모든 Step에 실제 코드/명령어 포함 확인 완료. 라이브러리 시그니처의 불확실성은 Global Constraints에 명시적으로 밝혀뒀음 (숨겨진 가정이 아님).
- **타입 일관성:** `WordList`, `WordEntry`, `StudentAnswerRow`, `WordVerdict`, `StudentGradeResult` 시그니처가 Task 1 정의와 Task 2·3·4·5 사용처에서 동일함을 확인 완료. `parseWordListRows`/`saveWordList`/`loadWordList`(Task 1), `parseAnswerFile`(Task 2), `gradeStudent`(Task 3), `aggregateResults`(Task 4) 모두 Task 5에서 정확히 같은 이름/시그니처로 import됨을 확인.
