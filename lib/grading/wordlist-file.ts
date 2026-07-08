// 엑셀/CSV 단어장 파일을 읽어 [단어, 뜻1~5] 행 배열로 변환
import * as XLSX from "xlsx";

const MEANING_COLUMN_COUNT = 5;

export function parseWordListFile(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
  });

  return rows
    .filter((row) => String(row[0] ?? "").trim() !== "")
    .map((row) => {
      const word = String(row[0]).trim();
      const meanings = Array.from({ length: MEANING_COLUMN_COUNT }, (_, i) =>
        String(row[i + 1] ?? "").trim()
      );
      return [word, ...meanings];
    });
}
