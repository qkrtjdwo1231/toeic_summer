// 문서와 분류 결과 비교해서 인원수/이름 불일치 검증
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
