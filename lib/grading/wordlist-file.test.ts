// 엑셀/CSV 단어장 파일 파싱 테스트
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseWordListFile } from "./wordlist-file";

function makeWorkbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const array = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return array as ArrayBuffer;
}

describe("parseWordListFile", () => {
  it("extracts word and up to 5 meaning columns per row", () => {
    const buffer = makeWorkbookBuffer([
      ["potential", "잠재적인", "잠재의"],
      ["book", "책", "예약하다", "", "", ""],
    ]);

    expect(parseWordListFile(buffer)).toEqual([
      ["potential", "잠재적인", "잠재의", "", "", ""],
      ["book", "책", "예약하다", "", "", ""],
    ]);
  });

  it("pads missing meaning columns with empty strings", () => {
    const buffer = makeWorkbookBuffer([["account", "계정"]]);
    expect(parseWordListFile(buffer)).toEqual([
      ["account", "계정", "", "", "", ""],
    ]);
  });

  it("ignores meaning columns beyond the 5th", () => {
    const buffer = makeWorkbookBuffer([
      ["multi", "뜻1", "뜻2", "뜻3", "뜻4", "뜻5", "뜻6(무시됨)"],
    ]);
    expect(parseWordListFile(buffer)).toEqual([
      ["multi", "뜻1", "뜻2", "뜻3", "뜻4", "뜻5"],
    ]);
  });

  it("skips rows with an empty word cell", () => {
    const buffer = makeWorkbookBuffer([["", "무시됨"]]);
    expect(parseWordListFile(buffer)).toEqual([]);
  });
});
