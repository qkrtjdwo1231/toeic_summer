// 반 유형별 문서 생성 로직 테스트
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
