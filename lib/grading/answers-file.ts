// 엑셀/CSV 답안 파일에서 학생 이름+답안 배열을 추출하는 파서
import * as XLSX from "xlsx";
import type { StudentAnswerRow } from "./types";

export function parseAnswerFile(buffer: ArrayBuffer): StudentAnswerRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
  });

  return rows
    .filter((row) => String(row[0] ?? "").trim() !== "")
    .map((row) => ({
      name: String(row[0]).trim(),
      answers: row.slice(1).map((cell) => String(cell ?? "").trim()),
    }));
}
