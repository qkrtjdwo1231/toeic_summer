// 명단 파일 파싱 (Excel XLSX 형식)
import * as XLSX from "xlsx";
import type { RawRosterRow } from "./types";

export const HEADER_ROW_INDEX = 4;
export const DATA_START_ROW_INDEX = 5;

const STUDENT_ID_COL = 2;
const NAME_COL = 3;
const DEPARTMENT_COL = 5;
const GRADE_COL = 6;
const PHONE_COL = 7;

export class RosterFormatError extends Error {}

function readSheetRows(buffer: ArrayBuffer): (string | number)[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
}

export function parseRosterHeaders(buffer: ArrayBuffer): string[] {
  const rows = readSheetRows(buffer);
  if (rows.length <= HEADER_ROW_INDEX) {
    throw new RosterFormatError("헤더 행을 찾을 수 없습니다.");
  }
  return rows[HEADER_ROW_INDEX].map((cell) => String(cell ?? "").trim());
}

export function findApplicationColumnIndex(
  headers: string[],
  term: "1" | "2"
): number | null {
  const keyword = `${term}기`;
  const matches = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.includes(keyword));
  return matches.length === 1 ? matches[0].index : null;
}

export function parseRosterRows(
  buffer: ArrayBuffer,
  applicationColumnIndex: number
): RawRosterRow[] {
  const rows = readSheetRows(buffer);
  if (rows.length <= HEADER_ROW_INDEX) {
    throw new RosterFormatError("헤더 행을 찾을 수 없습니다.");
  }

  return rows
    .slice(DATA_START_ROW_INDEX)
    .filter((row) => String(row[NAME_COL] ?? "").trim() !== "")
    .map((row) => ({
      studentId: String(row[STUDENT_ID_COL] ?? "").trim(),
      name: String(row[NAME_COL]).trim(),
      department: String(row[DEPARTMENT_COL] ?? "").trim(),
      grade: Number(row[GRADE_COL]) || 0,
      phone: String(row[PHONE_COL] ?? "").trim(),
      appliedClass: String(row[applicationColumnIndex] ?? "").trim(),
    }));
}
