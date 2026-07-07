// 학생 답안 파일을 업로드받아 OpenAI로 채점하고 결과를 집계해 반환하는 API 라우트
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { loadWordList } from "@/lib/grading/wordlist";
import { parseAnswerFile } from "@/lib/grading/answers-file";
import { gradeStudent } from "@/lib/grading/grade-student";
import { aggregateResults } from "@/lib/grading/aggregate";

export async function POST(request: NextRequest) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청 형식입니다." },
      { status: 400 }
    );
  }

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
