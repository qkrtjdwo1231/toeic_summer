<!-- vocab-web: 단어장 입력 화면 개선(표 형식 전환 + 이미지/엑셀 불러오기) 구현 계획 -->
# 단어장 입력 화면 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 배포된 `/grading` 기능의 단어장 입력 화면을 텍스트 칸에서 표(테이블) 형식으로 바꾸고, 단어장을 이미지(사진)나 엑셀/CSV 파일로 불러올 수 있게 한다.

**Architecture:** 단어당 인정되는 뜻을 최대 5개로 늘린다. 화면의 단어장 상태를 문자열 하나에서 "행 배열"(`[단어, 뜻1, 뜻2, 뜻3, 뜻4, 뜻5]`)로 바꾸고, 표 UI(각 칸이 독립된 입력 상자)로 렌더링한다. 새 API(`POST /api/grading/wordlist/extract`)가 업로드된 파일을 받아 이미지면 OpenAI 이미지 인식(gpt-4o-mini), 엑셀/CSV면 표 변환을 거쳐 같은 행 배열 형태로 돌려주고, 화면은 이 결과로 표를 통째로 교체한다. 자동 저장은 하지 않고 표에만 채워 넣어, 선생님이 확인/수정 후 기존과 동일한 저장 버튼을 눌러야 실제로 반영된다.

**Tech Stack:** 기존(Next.js 15, TypeScript, Vitest, `openai`, `xlsx`)을 그대로 쓴다. 새 패키지 설치가 필요 없다 (이미지 인식은 이미 설치된 `openai` 패키지의 멀티모달 입력 기능을 쓴다).

## Global Constraints

- 단어당 인정되는 뜻은 최대 5개(기존 4개 → 5개). `lib/grading/wordlist.ts`의 `parseWordListRows`가 `row.slice(1, 6)`으로 5개까지 받도록 변경한다.
- 새로 만드는 파일(엑셀 파싱, OCR)이 반환하는 행 형태는 항상 `[단어, 뜻1, 뜻2, 뜻3, 뜻4, 뜻5]` 6칸짜리 문자열 배열이다. 뜻이 모자라면 빈 문자열로 채우고, 5개를 넘으면 초과분은 버린다.
- 이미지/엑셀 업로드 결과는 화면의 표 상태만 통째로 교체하고, 자동으로 저장하지 않는다. 기존과 동일하게 "저장하고 다음" 버튼을 눌러야 `PUT /api/grading/wordlist`가 호출된다.
- 파일 종류 판별: MIME 타입이 `image/`로 시작하면 이미지, 파일 이름이 `.xlsx` 또는 `.csv`로 끝나면 엑셀/CSV. 둘 다 아니면 400 에러.
- 실패해도(이미지 인식 실패, 엑셀 형식 오류 등) 화면의 기존 표 내용은 그대로 유지된다 — 에러 메시지만 보여주고 표를 건드리지 않는다.
- OpenAI API 키는 서버 코드(API 라우트/`lib`)에서만 쓰고 브라우저에 노출하지 않는다 (기존 채점 기능과 동일한 원칙).
- `/api/grading/wordlist/extract`, `app/grading/page.tsx`는 이미 미들웨어가 보호하는 경로이므로 별도 인증 코드가 필요 없다.

---

## File Structure

```
vocab-web/
  lib/
    grading/
      wordlist.ts                 # 수정 — parseWordListRows가 뜻 5개까지 받도록 변경
      wordlist.test.ts            # 수정 — 5개 뜻 테스트 추가
      wordlist-file.ts            # 신규 — 엑셀/CSV 단어장 파일 파싱
      wordlist-file.test.ts
      wordlist-ocr.ts             # 신규 — OpenAI 이미지 인식으로 단어장 사진 읽기
      wordlist-ocr.test.ts
  app/
    api/
      grading/
        wordlist/
          extract/route.ts        # 신규 — 이미지/엑셀 파일을 받아 행 배열로 변환하는 API
    grading/
      page.tsx                    # 수정 — 단어장 입력을 텍스트 칸 → 표 UI로 전환, 파일 업로드 추가
```

---

### Task 1: `parseWordListRows`가 뜻 5개까지 받도록 변경

**Files:**
- Modify: `lib/grading/wordlist.ts`
- Modify: `lib/grading/wordlist.test.ts`

**Interfaces:**
- Consumes: 없음 (기존 함수 시그니처 그대로, 내부 슬라이스 범위만 변경).
- Produces: `parseWordListRows(rows: string[][]): WordList` — 이제 `row[1]`~`row[5]`(5칸)까지를 뜻으로 인식한다. Task 5(화면)에서 저장 시 그대로 쓰인다.

- [ ] **Step 1: 실패하는 테스트 추가 (lib/grading/wordlist.test.ts)**

`describe("parseWordListRows", ...)` 블록 안, 기존 `it("skips rows with an empty word cell", ...)` 다음에 아래 테스트를 추가한다.

```ts
  it("parses up to 5 meanings and drops any beyond that", () => {
    const rows = [
      ["multi", "뜻1", "뜻2", "뜻3", "뜻4", "뜻5", "뜻6(무시됨)"],
    ];
    expect(parseWordListRows(rows)).toEqual([
      { word: "multi", meanings: ["뜻1", "뜻2", "뜻3", "뜻4", "뜻5"] },
    ]);
  });
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test -- lib/grading/wordlist.test.ts`
Expected: FAIL — 새로 추가한 테스트가 `meanings: ["뜻1", "뜻2", "뜻3", "뜻4"]`(4개)만 반환해서 5개를 기대하는 assertion과 불일치.

- [ ] **Step 3: lib/grading/wordlist.ts 수정**

`parseWordListRows` 안의 `row.slice(1, 5)`를 `row.slice(1, 6)`으로 바꾼다.

```ts
export function parseWordListRows(rows: string[][]): WordList {
  return rows
    .filter((row) => (row[0] ?? "").trim() !== "")
    .map((row) => ({
      word: row[0].trim(),
      meanings: row
        .slice(1, 6)
        .map((m) => (m ?? "").trim())
        .filter((m) => m !== ""),
    }));
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test -- lib/grading/wordlist.test.ts`
Expected: PASS — `wordlist.test.ts`의 모든 테스트(기존 8개 + 신규 1개 = 9개) 통과.

- [ ] **Step 5: 전체 테스트 실행**

Run: `npm test`
Expected: PASS — 전체 테스트(기존 54개 + 신규 1개 = 55개) 통과, 회귀 없음.

- [ ] **Step 6: Commit**

```bash
git add lib/grading/wordlist.ts lib/grading/wordlist.test.ts
git commit -m "단어장: 뜻을 최대 5개까지 받도록 변경"
```

---

### Task 2: 엑셀/CSV 단어장 파일 파싱

**Files:**
- Create: `lib/grading/wordlist-file.ts`
- Test: `lib/grading/wordlist-file.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces: `parseWordListFile(buffer: ArrayBuffer): string[][]` — 각 행이 `[단어, 뜻1, 뜻2, 뜻3, 뜻4, 뜻5]`(6칸, 모자란 뜻은 빈 문자열) 형태. Task 4(API 라우트)에서 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성 (lib/grading/wordlist-file.test.ts)**

```ts
// 엑셀/CSV 단어장 파일 파싱 테스트
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseWordListFile } from "./wordlist-file";

function makeWorkbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const array = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return array as ArrayBuffer;
}

describe("parseWordListFile", () => {
  it("extracts word and up to 5 meaning columns per row", () => {
    const buffer = makeWorkbookBuffer([
      ["potential", "잠재적인", "잠재의"],
      ["book", "책", "예약하다", "", "", ""],
    ]);

    expect(parseWordListFile(buffer)).toEqual([
      ["potential", "잠재적인", "잠재의", "", "", ""],
      ["book", "책", "예약하다", "", "", ""],
    ]);
  });

  it("pads missing meaning columns with empty strings", () => {
    const buffer = makeWorkbookBuffer([["account", "계정"]]);
    expect(parseWordListFile(buffer)).toEqual([
      ["account", "계정", "", "", "", ""],
    ]);
  });

  it("ignores meaning columns beyond the 5th", () => {
    const buffer = makeWorkbookBuffer([
      ["multi", "뜻1", "뜻2", "뜻3", "뜻4", "뜻5", "뜻6(무시됨)"],
    ]);
    expect(parseWordListFile(buffer)).toEqual([
      ["multi", "뜻1", "뜻2", "뜻3", "뜻4", "뜻5"],
    ]);
  });

  it("skips rows with an empty word cell", () => {
    const buffer = makeWorkbookBuffer([["", "무시됨"]]);
    expect(parseWordListFile(buffer)).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test -- lib/grading/wordlist-file.test.ts`
Expected: FAIL — `lib/grading/wordlist-file.ts` 모듈이 없어서 import 에러.

- [ ] **Step 3: lib/grading/wordlist-file.ts 작성**

```ts
// 엑셀/CSV 단어장 파일을 읽어 [단어, 뜻1~5] 행 배열로 변환
import * as XLSX from "xlsx";

const MEANING_COLUMN_COUNT = 5;

export function parseWordListFile(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
  });

  return rows
    .filter((row) => String(row[0] ?? "").trim() !== "")
    .map((row) => {
      const word = String(row[0]).trim();
      const meanings = Array.from({ length: MEANING_COLUMN_COUNT }, (_, i) =>
        String(row[i + 1] ?? "").trim()
      );
      return [word, ...meanings];
    });
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test -- lib/grading/wordlist-file.test.ts`
Expected: PASS — 이 파일의 4개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add lib/grading/wordlist-file.ts lib/grading/wordlist-file.test.ts
git commit -m "엑셀/CSV 단어장 파일 파싱 추가"
```

---

### Task 3: 이미지 인식으로 단어장 사진 읽기

**Files:**
- Create: `lib/grading/wordlist-ocr.ts`
- Test: `lib/grading/wordlist-ocr.test.ts`

**Interfaces:**
- Consumes: 없음 (OpenAI 클라이언트는 호출부에서 주입받는다, 기존 `gradeStudent`와 동일한 패턴).
- Produces: `extractWordListFromImage(client: OpenAI, buffer: ArrayBuffer, mimeType: string): Promise<string[][]>`, `WordListOcrError` — Task 4(API 라우트)에서 그대로 쓴다. 반환 행 형태는 Task 2와 동일하게 `[단어, 뜻1, 뜻2, 뜻3, 뜻4, 뜻5]`.

- [ ] **Step 1: 실패하는 테스트 작성 (lib/grading/wordlist-ocr.test.ts)**

```ts
// 이미지 인식으로 단어장 사진을 읽는 로직 테스트
import { describe, it, expect, vi } from "vitest";
import { extractWordListFromImage, WordListOcrError } from "./wordlist-ocr";

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

describe("extractWordListFromImage", () => {
  it("parses a well-formed JSON response into padded rows", async () => {
    const client = makeMockClient(
      JSON.stringify([
        { word: "potential", meanings: ["잠재적인"] },
        { word: "book", meanings: ["책", "예약하다"] },
      ])
    );

    const result = await extractWordListFromImage(
      client,
      new ArrayBuffer(0),
      "image/png"
    );

    expect(result).toEqual([
      ["potential", "잠재적인", "", "", "", ""],
      ["book", "책", "예약하다", "", "", ""],
    ]);
  });

  it("strips markdown code block wrapping before parsing", async () => {
    const client = makeMockClient(
      "```json\n" +
        JSON.stringify([{ word: "account", meanings: ["계정"] }]) +
        "\n```"
    );

    const result = await extractWordListFromImage(
      client,
      new ArrayBuffer(0),
      "image/png"
    );

    expect(result).toEqual([["account", "계정", "", "", "", ""]]);
  });

  it("drops meanings beyond the 5th", async () => {
    const client = makeMockClient(
      JSON.stringify([
        { word: "multi", meanings: ["뜻1", "뜻2", "뜻3", "뜻4", "뜻5", "뜻6"] },
      ])
    );

    const result = await extractWordListFromImage(
      client,
      new ArrayBuffer(0),
      "image/png"
    );

    expect(result).toEqual([["multi", "뜻1", "뜻2", "뜻3", "뜻4", "뜻5"]]);
  });

  it("throws WordListOcrError when the response is not valid JSON", async () => {
    const client = makeMockClient("이건 JSON이 아님");

    await expect(
      extractWordListFromImage(client, new ArrayBuffer(0), "image/png")
    ).rejects.toThrow(WordListOcrError);
  });

  it("throws WordListOcrError when no valid word entries are found", async () => {
    const client = makeMockClient(JSON.stringify([{ notWord: "x" }]));

    await expect(
      extractWordListFromImage(client, new ArrayBuffer(0), "image/png")
    ).rejects.toThrow(WordListOcrError);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test -- lib/grading/wordlist-ocr.test.ts`
Expected: FAIL — `lib/grading/wordlist-ocr.ts` 모듈이 없어서 import 에러.

- [ ] **Step 3: lib/grading/wordlist-ocr.ts 작성**

```ts
// OpenAI 이미지 인식으로 단어장 사진을 읽어 [단어, 뜻1~5] 행 배열로 변환
import type OpenAI from "openai";

const MEANING_COLUMN_COUNT = 5;

export class WordListOcrError extends Error {}

const OCR_PROMPT = `사진 속 영단어 단어장을 읽어서 각 단어와 뜻을 추출해라.
- 각 단어에 뜻이 여러 개면 모두 포함하되, 단어당 최대 5개까지만 적어라.
- 사진에서 읽을 수 없거나 확신할 수 없는 단어는 포함하지 마라.
- 아래 JSON 배열 형식으로만 답해라. 다른 설명은 쓰지 마라.
[{"word": string, "meanings": string[]}]`;

export async function extractWordListFromImage(
  client: OpenAI,
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string[][]> {
  const base64 = Buffer.from(buffer).toString("base64");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";
  const content = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new WordListOcrError("이미지 인식 결과를 해석하지 못했습니다.");
  }

  if (!Array.isArray(parsed)) {
    throw new WordListOcrError("이미지 인식 결과를 해석하지 못했습니다.");
  }

  const rows: string[][] = [];
  for (const item of parsed) {
    if (item === null || typeof item !== "object") continue;
    const typed = item as { word?: unknown; meanings?: unknown };
    if (typeof typed.word !== "string" || typed.word.trim() === "") continue;
    if (!Array.isArray(typed.meanings)) continue;

    const meanings = typed.meanings.filter(
      (m): m is string => typeof m === "string" && m.trim() !== ""
    );
    const paddedMeanings = Array.from(
      { length: MEANING_COLUMN_COUNT },
      (_, i) => meanings[i]?.trim() ?? ""
    );
    rows.push([typed.word.trim(), ...paddedMeanings]);
  }

  if (rows.length === 0) {
    throw new WordListOcrError("이미지에서 단어를 인식하지 못했습니다.");
  }

  return rows;
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npm test -- lib/grading/wordlist-ocr.test.ts`
Expected: PASS — 이 파일의 5개 테스트 모두 통과.

- [ ] **Step 5: Commit**

```bash
git add lib/grading/wordlist-ocr.ts lib/grading/wordlist-ocr.test.ts
git commit -m "OpenAI 이미지 인식으로 단어장 사진 읽기 추가"
```

---

### Task 4: API 라우트 (이미지/엑셀 단어장 파일 → 행 배열)

**Files:**
- Create: `app/api/grading/wordlist/extract/route.ts`

**Interfaces:**
- Consumes: Task 2의 `parseWordListFile`, Task 3의 `extractWordListFromImage`/`WordListOcrError`.
- Produces: `POST /api/grading/wordlist/extract` (multipart form-data: `file`) → 성공 시 `{ rows: string[][] }`, 실패 시 `{ error: string }` + 4xx/5xx. Task 5(화면)에서 이 엔드포인트를 호출한다.

- [ ] **Step 1: app/api/grading/wordlist/extract/route.ts 작성**

```ts
// 단어장 이미지/엑셀 파일을 읽어 표 형태의 행 배열로 변환하는 API
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { parseWordListFile } from "@/lib/grading/wordlist-file";
import {
  extractWordListFromImage,
  WordListOcrError,
} from "@/lib/grading/wordlist-ocr";

const EXCEL_EXTENSIONS = [".xlsx", ".csv"];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file이 필요합니다." },
      { status: 400 }
    );
  }

  const buffer = await file.arrayBuffer();
  const isImage = file.type.startsWith("image/");
  const isExcel = EXCEL_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext)
  );

  if (isImage) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const rows = await extractWordListFromImage(client, buffer, file.type);
      return NextResponse.json({ rows });
    } catch (error) {
      if (error instanceof WordListOcrError) {
        return NextResponse.json(
          {
            error:
              "이미지를 인식하지 못했습니다. 다시 시도하거나 직접 입력해주세요.",
          },
          { status: 500 }
        );
      }
      throw error;
    }
  }

  if (isExcel) {
    const rows = parseWordListFile(buffer);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "엑셀 형식을 확인해주세요." },
        { status: 400 }
      );
    }
    return NextResponse.json({ rows });
  }

  return NextResponse.json(
    { error: "이미지 또는 엑셀/CSV 파일만 업로드할 수 있습니다." },
    { status: 400 }
  );
}
```

- [ ] **Step 2: 빌드로 타입 오류 없는지 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 3: Commit**

```bash
git add app/api/grading/wordlist/extract/route.ts
git commit -m "단어장 이미지/엑셀 파일 인식 API 라우트 추가"
```

---

### Task 5: 화면 UI — 단어장 입력을 표 형식으로 전환 + 파일 업로드 추가

**Files:**
- Modify: `app/grading/page.tsx`

**Interfaces:**
- Consumes: Task 4의 `POST /api/grading/wordlist/extract`. 기존 `GET`/`PUT /api/grading/wordlist`는 그대로 쓴다 (API 자체는 변경 없음, `PUT`이 받는 `rows: string[][]` 형태에 화면이 맞춰서 보낸다).
- Produces: `/grading` 화면의 단어장 입력 단계가 표 UI로 바뀐다. 다른 단계(반+데이 선택/답안 업로드/결과)는 기존과 동일하게 유지한다.

- [ ] **Step 1: app/grading/page.tsx 전체 교체**

파일 전체를 아래 내용으로 교체한다 (기존 `select`/`answers`/`results` 단계 로직과 `effectiveWrongWords`는 그대로 유지하고, `wordlist` 단계 관련 상태와 렌더링만 표 UI로 바뀐 것에 유의).

```tsx
"use client";
// 반+데이 선택 → 단어장 관리(표 UI) → 답안 업로드 → 결과 확인의 4단계 채점 화면

import { useState } from "react";
import { CLASS_OPTIONS, DAY_OPTIONS } from "@/lib/grading/classes";

type Step = "select" | "wordlist" | "answers" | "results";

const MEANING_COLUMN_COUNT = 5;
const EMPTY_WORD_ROW = ["", "", "", "", "", ""];

interface WarningRow {
  word: string;
  count: number;
  commonWrongAnswer: string;
}

interface AmbiguousItem {
  word: string;
  studentAnswer: string;
  correct: boolean;
  reasoning?: string;
}

interface StudentRow {
  name: string;
  wrongWords: string[];
  manualCheckRequired: boolean;
  ambiguousItems: AmbiguousItem[];
}

export default function GradingPage() {
  const [step, setStep] = useState<Step>("select");
  const [classId, setClassId] = useState<string>(CLASS_OPTIONS[0].id);
  const [day, setDay] = useState(DAY_OPTIONS[0]);
  const [wordListRows, setWordListRows] = useState<string[][]>([
    EMPTY_WORD_ROW,
  ]);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [answerCountMismatch, setAnswerCountMismatch] = useState<string[]>([]);
  // 애매 항목에 대한 교사의 정답/오답 뒤집기 결정. 키: "학생 이름::단어".
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  function effectiveWrongWords(student: StudentRow): string[] {
    const wrongWords = new Set(student.wrongWords);
    for (const item of student.ambiguousItems) {
      const key = `${student.name}::${item.word}`;
      const isCorrect = key in overrides ? overrides[key] : item.correct;
      if (isCorrect) {
        wrongWords.delete(item.word);
      } else {
        wrongWords.add(item.word);
      }
    }
    return [...wrongWords];
  }

  async function loadWordList() {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/grading/wordlist?classId=${classId}&day=${day}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "단어장을 불러오지 못했습니다.");
        return;
      }

      if (data.wordList && data.wordList.length > 0) {
        setWordListRows(
          data.wordList.map((entry: { word: string; meanings: string[] }) => [
            entry.word,
            ...Array.from(
              { length: MEANING_COLUMN_COUNT },
              (_, i) => entry.meanings[i] ?? ""
            ),
          ])
        );
      } else {
        setWordListRows([EMPTY_WORD_ROW]);
      }
      setStep("wordlist");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveWordList() {
    setError("");
    setIsLoading(true);
    try {
      const rows = wordListRows
        .filter((row) => row[0].trim() !== "")
        .map((row) => row.map((cell) => cell.trim()));

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
    } finally {
      setIsLoading(false);
    }
  }

  function updateWordListCell(
    rowIndex: number,
    colIndex: number,
    value: string
  ) {
    setWordListRows((prev) =>
      prev.map((row, i) =>
        i === rowIndex
          ? row.map((cell, j) => (j === colIndex ? value : cell))
          : row
      )
    );
  }

  function addWordListRow() {
    setWordListRows((prev) => [...prev, [...EMPTY_WORD_ROW]]);
  }

  function removeWordListRow(rowIndex: number) {
    setWordListRows((prev) => prev.filter((_, i) => i !== rowIndex));
  }

  async function handleWordListFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch("/api/grading/wordlist/extract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "파일을 처리하지 못했습니다.");
        return;
      }

      setWordListRows(data.rows);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswers(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
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
      setAnswerCountMismatch(data.answerCountMismatch ?? []);
      setOverrides({});
      setStep("results");
    } finally {
      setIsLoading(false);
    }
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
          <button onClick={loadWordList} disabled={isLoading}>
            {isLoading ? "처리 중..." : "다음"}
          </button>
        </section>
      )}

      {step === "wordlist" && (
        <section>
          <p>단어장 (영단어 1개당 뜻은 최대 5개까지 입력할 수 있습니다)</p>
          <label>
            파일에서 불러오기 (이미지 또는 엑셀/CSV)
            <input
              type="file"
              accept="image/*,.xlsx,.csv"
              onChange={handleWordListFile}
              disabled={isLoading}
            />
          </label>
          <table>
            <thead>
              <tr>
                <th>영단어</th>
                <th>뜻1</th>
                <th>뜻2</th>
                <th>뜻3</th>
                <th>뜻4</th>
                <th>뜻5</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wordListRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <td key={colIndex}>
                      <input
                        value={cell}
                        onChange={(e) =>
                          updateWordListCell(
                            rowIndex,
                            colIndex,
                            e.target.value
                          )
                        }
                        disabled={isLoading}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      onClick={() => removeWordListRow(rowIndex)}
                      disabled={isLoading}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addWordListRow} disabled={isLoading}>
            단어 추가
          </button>
          <button onClick={saveWordList} disabled={isLoading}>
            {isLoading ? "처리 중..." : "저장하고 다음"}
          </button>
        </section>
      )}

      {step === "answers" && (
        <section>
          <form onSubmit={submitAnswers}>
            <input type="file" name="file" accept=".xlsx,.csv" disabled={isLoading} />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "처리 중..." : "채점하기"}
            </button>
          </form>
        </section>
      )}

      {step === "results" && (
        <section>
          {answerCountMismatch.length > 0 && (
            <p role="alert">
              답안 개수가 단어장과 맞지 않는 학생: {answerCountMismatch.join(", ")}{" "}
              — 채점 결과가 부정확할 수 있으니 답안 파일을 확인해주세요.
            </p>
          )}
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
          {students.some((s) => s.ambiguousItems.length > 0) && (
            <section>
              <h2>애매한 항목 검토</h2>
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>단어</th>
                    <th>학생 답</th>
                    <th>AI 판단 이유</th>
                    <th>정답으로 처리</th>
                  </tr>
                </thead>
                <tbody>
                  {students.flatMap((s) =>
                    s.ambiguousItems.map((item) => {
                      const key = `${s.name}::${item.word}`;
                      const isCorrect =
                        key in overrides ? overrides[key] : item.correct;
                      return (
                        <tr key={key}>
                          <td>{s.name}</td>
                          <td>{item.word}</td>
                          <td>{item.studentAnswer}</td>
                          <td>{item.reasoning ?? ""}</td>
                          <td>
                            <input
                              type="checkbox"
                              checked={isCorrect}
                              onChange={() =>
                                setOverrides((prev) => ({
                                  ...prev,
                                  [key]: !isCorrect,
                                }))
                              }
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </section>
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
                      : effectiveWrongWords(s).join(", ")}
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
git commit -m "단어장 입력 화면을 표 형식으로 전환하고 파일 업로드 추가"
```

---

### Task 6: 수동 확인 (실제 이미지/엑셀 파일로 전체 흐름 검증)

**Files:**
- Modify: 없음 (실제 확인만 진행, 코드 변경 없음)

**Interfaces:**
- Consumes: Task 1~5에서 만든 전체 기능.
- Produces: 실제로 동작이 확인된 단어장 입력 개선 기능.

- [ ] **Step 1: 로컬 서버 실행**

Run: `npm run dev`

- [ ] **Step 2: 표 UI 기본 동작 확인**

브라우저에서 확인 (로그인 후):
1. `/grading` 접속 → 반+데이 선택 후 "다음" → 단어장 입력 화면에 빈 행 1개짜리 표가 보이는지 확인.
2. "단어 추가"를 2번 눌러 행이 늘어나는지, 각 셀에 타이핑이 되는지 확인.
3. 아무 행이나 "삭제"를 눌러 그 행만 없어지는지 확인.
4. 단어(`potential`)와 뜻 5개(예: `잠재적인`,`잠재의`,`가능성이 있는`,`잠재력이 있는`,`장래성 있는`)를 입력하고 "저장하고 다음" → 뒤로 가서 같은 반+데이를 다시 선택했을 때 5개 뜻이 모두 저장되어 있는지 확인.

Expected: 4가지 모두 통과.

- [ ] **Step 3: 엑셀 파일 업로드 확인**

1. 아무 스프레드시트 프로그램으로 A열=단어, B~F열=뜻인 작은 xlsx 파일(2~3개 단어)을 만든다.
2. 단어장 입력 화면에서 "파일에서 불러오기"로 이 파일을 선택한다.
3. 표가 파일 내용으로 통째로 교체되는지 확인한다.
4. 단어 칸이 모두 빈 엑셀 파일을 만들어 업로드해보고 "엑셀 형식을 확인해주세요" 에러가 뜨는지, 기존 표 내용이 사라지지 않는지 확인한다.

Expected: 4가지 모두 통과.

- [ ] **Step 4: 이미지 업로드(OCR) 확인**

1. 단어 3~5개와 뜻이 적힌 간단한 이미지 파일(사진 또는 스크린샷)을 준비한다.
2. "파일에서 불러오기"로 이 이미지를 선택한다.
3. 표가 이미지에서 읽은 단어/뜻으로 채워지는지 확인한다 (완벽하지 않을 수 있으므로, 대체로 맞게 읽혔는지 눈으로 확인).
4. 글자를 알아볼 수 없는 이미지(예: 빈 흰색 이미지)를 업로드해보고 "이미지를 인식하지 못했습니다" 에러가 뜨는지, 기존 표 내용이 사라지지 않는지 확인한다.

Expected: 4가지 모두 통과. (OCR은 AI 판단이라 100% 정확하지 않을 수 있음 — 완전히 틀린 결과가 아니라 "대체로 맞는" 수준이면 통과로 본다.)

- [ ] **Step 5: 빌드 최종 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 완료.

- [ ] **Step 6: Commit (변경 사항이 있는 경우에만)**

이 Task는 수동 확인이라 코드 변경이 없을 수 있다. 코드 변경이 없으면 커밋하지 않는다.

---

## Self-Review 메모

- **스펙 커버리지:** 설계 문서의 표 형식 전환(섹션 1)은 Task 1(뜻 5개) + Task 5(화면). 이미지/엑셀 불러오기(섹션 2)는 Task 2(엑셀)/Task 3(이미지)/Task 4(API)/Task 5(화면 연동). 오류 처리(섹션 3)는 Task 4(에러 응답) + Task 5(에러 시 표 유지, 실제로 `setError`만 하고 `setWordListRows`를 호출하지 않아 자동으로 보장됨). **의도된 범위 밖:** 이미지 여러 장 합치기, 표 행 드래그 재정렬 — 설계 문서에서 이미 범위 밖으로 명시됨.
- **플레이스홀더 스캔:** 모든 Step에 실제 코드/명령어 포함 확인 완료.
- **타입 일관성:** `parseWordListFile`(Task 2), `extractWordListFromImage`/`WordListOcrError`(Task 3) 모두 Task 4에서 정확히 같은 이름/시그니처로 import됨을 확인. 두 함수 모두 `string[][]`(6칸: 단어+뜻5) 형태를 반환해서 Task 5의 `setWordListRows(data.rows)`와 그대로 맞물림을 확인. `lib/grading/wordlist.ts`의 `parseWordListRows`(Task 1에서 5개로 확장)는 Task 5의 `saveWordList`가 보내는 `rows: string[][]`를 그대로 받는 기존 `PUT /api/grading/wordlist` 라우트에서 이미 쓰이고 있어 별도 연결 작업이 필요 없음을 확인.
