// 단어장 CSV/엑셀 행 파싱, Vercel Blob 저장/조회
import { put, head, BlobNotFoundError } from "@vercel/blob";
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
  // 저장된 적이 없는 것(null 반환)과 네트워크/서버 오류(에러를 그대로 던짐)를
  // 구분해야, 호출 쪽에서 "단어장 없음"과 "일시적 조회 실패"를 다르게 처리할 수 있다.
  let info;
  try {
    info = await head(blobPathname(classId, day));
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }

  const response = await fetch(info.url);
  if (!response.ok) {
    throw new Error(`단어장 조회 실패: ${response.status}`);
  }
  return (await response.json()) as WordList;
}
