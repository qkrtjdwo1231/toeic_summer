// 명단 문서 생성과 관련된 공유 타입
import type { ClassTypeDef } from "./classes";

export interface RawRosterRow {
  studentId: string;
  name: string;
  department: string;
  grade: number;
  phone: string;
  appliedClass: string;
}

export interface ClassifiedClassType {
  classType: ClassTypeDef;
  am: RawRosterRow[];
  pm: RawRosterRow[];
}

export interface PrintAttendanceRow {
  no: number;
  department: string;
  name: string;
  phone: string;
}

export interface OnlineAttendanceRow {
  no: number;
  grade: number;
  studentId: string;
  className: string;
  name: string;
  phone: string;
}

export interface CounselingLogRow {
  name: string;
  department: string;
}

export interface TextbookRow {
  no: number;
  name: string;
  department: string;
  studentId: string;
  phone: string;
}

export interface ClassTypeDocuments {
  classType: ClassTypeDef;
  printAttendanceAm: PrintAttendanceRow[];
  printAttendancePm: PrintAttendanceRow[];
  onlineAttendanceAm: OnlineAttendanceRow[];
  onlineAttendancePm: OnlineAttendanceRow[];
  counselingLogAm: CounselingLogRow[];
  counselingLogPm: CounselingLogRow[];
  textbookAm: TextbookRow[];
  textbookPm: TextbookRow[];
}

export type DocType =
  | "printAttendance"
  | "onlineAttendance"
  | "counselingLog"
  | "textbook";

export interface MismatchWarning {
  classTypeId: string;
  session: "am" | "pm";
  docType: DocType;
  missingNames: string[];
}
