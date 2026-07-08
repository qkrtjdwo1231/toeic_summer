// 인원수/이름 검증 로직 테스트
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

  it("warns for every docType/session combination when the document set for a class type is entirely missing", () => {
    const warnings = verifyDocuments(classified, []);

    expect(warnings).toHaveLength(8);
    for (const warning of warnings) {
      expect(warning.classTypeId).toBe("toeic-mid");
      const expectedNames = warning.session === "am" ? ["박성재", "이주호"] : [];
      expect(warning.missingNames).toEqual(expectedNames);
    }
  });
});
