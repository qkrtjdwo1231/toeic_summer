// 단어장 조회(GET)/저장(PUT) API 라우트
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

  try {
    const wordList = await loadWordList(classId, day);
    return NextResponse.json({ wordList });
  } catch {
    return NextResponse.json(
      { error: "단어장 조회에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 형식입니다." },
      { status: 400 }
    );
  }

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
  if (wordList.length === 0) {
    return NextResponse.json(
      { error: "단어장이 비어있습니다." },
      { status: 400 }
    );
  }
  await saveWordList(classId, day, wordList);
  return NextResponse.json({ ok: true });
}
