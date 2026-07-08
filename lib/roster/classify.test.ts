// 반 유형별 학생 분류 로직 테스트
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
