// 반 명단 파일을 업로드받아 학급별 문서를 생성하는 API 라우트
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
