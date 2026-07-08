// 명단 파일 파싱 테스트
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseRosterHeaders,
  findApplicationColumnIndex,
  parseRosterRows,
  RosterFormatError,
} from "./roster-file";

const HEADER_ROW = [
  "구분",
  "회원번호",
  "학번",
  "이름",
  "대학",
  "학과",
  "학년",
  "전화번호",
  "1기 신청",
  "2기신청",
];

function makeRosterBuffer(
  headerRow: string[],
  dataRows: (string | number)[][]
): ArrayBuffer {
  const rows = [
    ["더미0"],
    ["더미1"],
    ["더미2"],
    ["더미3"],
    headerRow,
    ...dataRows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "1기 전체");
  const array = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return array as ArrayBuffer;
}

describe("parseRosterHeaders", () => {
  it("returns the trimmed header row (row index 4)", () => {
    const buffer = makeRosterBuffer(HEADER_ROW, [
      [1, "M001", 2023000001, "박성재", "전자정보대학", "소프트웨어학부", 3, "010-1111-2222", "중급 오전", ""],
    ]);
    expect(parseRosterHeaders(buffer)).toEqual(HEADER_ROW);
  });

  it("throws RosterFormatError when the file has fewer than 5 rows", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([["구분", "이름"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    const buffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;

    expect(() => parseRosterHeaders(buffer)).toThrow(RosterFormatError);
  });
});

describe("findApplicationColumnIndex", () => {
  it("finds the single column containing '1기'", () => {
    expect(findApplicationColumnIndex(HEADER_ROW, "1")).toBe(8);
  });

  it("finds the single column containing '2기'", () => {
    expect(findApplicationColumnIndex(HEADER_ROW, "2")).toBe(9);
  });

  it("returns null when there is no matching column", () => {
    const headers = ["구분", "이름", "학과"];
    expect(findApplicationColumnIndex(headers, "1")).toBeNull();
  });

  it("returns null when multiple columns match (ambiguous)", () => {
    const headers = ["구분", "1기 신청", "1기 확인", "2기신청"];
    expect(findApplicationColumnIndex(headers, "1")).toBeNull();
  });
});

describe("parseRosterRows", () => {
  it("extracts fields at the fixed column positions and trims them", () => {
    const buffer = makeRosterBuffer(HEADER_ROW, [
      [1, "M001", 2023000001, " 박성재 ", "전자정보대학", " 소프트웨어학부 ", 3, " 010-1111-2222 ", "중급 오전", ""],
    ]);

    expect(parseRosterRows(buffer, 8)).toEqual([
      {
        studentId: "2023000001",
        name: "박성재",
        department: "소프트웨어학부",
        grade: 3,
        phone: "010-1111-2222",
        appliedClass: "중급 오전",
      },
    ]);
  });

  it("keeps an empty appliedClass when the application cell is blank", () => {
    const buffer = makeRosterBuffer(HEADER_ROW, [
      [1, "M002", 2024000002, "박신영", "농업생명환경대학", "식물자원학과", 3, "010-2222-3333", "", "중급 오전"],
    ]);

    const result = parseRosterRows(buffer, 8);
    expect(result[0].appliedClass).toBe("");
  });

  it("skips rows with an empty name cell", () => {
    const buffer = makeRosterBuffer(HEADER_ROW, [
      [1, "M003", 2024000003, "", "농업생명환경대학", "식물자원학과", 3, "010-3333-4444", "중급 오전", ""],
    ]);

    expect(parseRosterRows(buffer, 8)).toEqual([]);
  });
});
