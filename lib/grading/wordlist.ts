// 단어장 CSV/엑셀 행 파싱, Vercel Blob 저장/조회
import { put, head } from "@vercel/blob";
import type { WordList } from "./types";

function blobPathname(classId: string, day: number): string {
  return `wordlists/${classId}/day-${day}.json`;
}

export function parseWordListRows(rows: string[][]): WordList {
  return rows
    .filter((row) => (row[0] ?? "").trim() !== "")
    .map((row) => ({
      word: row[0].trim(),
      meanings: row
        .slice(1, 5)
        .map((m) => (m ?? "").trim())
        .filter((m) => m !== ""),
    }));
}

export async function saveWordList(
  classId: string,
  day: number,
  list: WordList
): Promise<void> {
  await put(blobPathname(classId, day), JSON.stringify(list), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function loadWordList(
  classId: string,
  day: number
): Promise<WordList | null> {
  try {
    const info = await head(blobPathname(classId, day));
    const response = await fetch(info.url);
    return (await response.json()) as WordList;
  } catch {
    return null;
  }
}
