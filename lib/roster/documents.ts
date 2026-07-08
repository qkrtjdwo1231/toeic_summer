// 반 유형별 4종 문서 생성 로직
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
