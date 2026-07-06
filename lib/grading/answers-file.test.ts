// 답안 엑셀/CSV 파일 파싱 함수(parseAnswerFile) 테스트
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseAnswerFile } from "./answers-file";

function makeWorkbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const array = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return array as ArrayBuffer;
}

describe("parseAnswerFile", () => {
  it("parses name + answers from each row", () => {
    const buffer = makeWorkbookBuffer([
      ["박성재", "잠재적인", "계정"],
      ["이주호", "잠재의", "계좌"],
    ]);

    expect(parseAnswerFile(buffer)).toEqual([
      { name: "박성재", answers: ["잠재적인", "계정"] },
      { name: "이주호", answers: ["잠재의", "계좌"] },
    ]);
  });

  it("treats a missing cell as an empty-string answer", () => {
    const buffer = makeWorkbookBuffer([["김대연", "잠재적인", ""]]);
    expect(parseAnswerFile(buffer)).toEqual([
      { name: "김대연", answers: ["잠재적인", ""] },
    ]);
  });

  it("skips rows with an empty name cell", () => {
    const buffer = makeWorkbookBuffer([["", "무시됨"]]);
    expect(parseAnswerFile(buffer)).toEqual([]);
  });
});
