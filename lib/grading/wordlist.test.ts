// 단어장 파싱 및 Vercel Blob 저장/조회 함수 테스트
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseWordListRows, saveWordList, loadWordList } from "./wordlist";
import * as blob from "@vercel/blob";

vi.mock("@vercel/blob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vercel/blob")>();
  return { ...actual, put: vi.fn(), head: vi.fn() };
});

describe("parseWordListRows", () => {
  it("parses rows into WordEntry objects, trimming and dropping empty meanings", () => {
    const rows = [
      ["potential", "잠재적인", "잠재의", "", ""],
      ["account", "계정", "", "", ""],
    ];
    expect(parseWordListRows(rows)).toEqual([
      { word: "potential", meanings: ["잠재적인", "잠재의"] },
      { word: "account", meanings: ["계정"] },
    ]);
  });

  it("skips rows with an empty word cell", () => {
    const rows = [["", "무시됨", "", "", ""]];
    expect(parseWordListRows(rows)).toEqual([]);
  });

  it("parses up to 5 meanings and drops any beyond that", () => {
    const rows = [
      ["multi", "뜻1", "뜻2", "뜻3", "뜻4", "뜻5", "뜻6(무시됨)"],
    ];
    expect(parseWordListRows(rows)).toEqual([
      { word: "multi", meanings: ["뜻1", "뜻2", "뜻3", "뜻4", "뜻5"] },
    ]);
  });
});

describe("saveWordList", () => {
  beforeEach(() => {
    vi.mocked(blob.put).mockClear();
  });

  it("calls put with the class+day pathname and JSON body", async () => {
    const list = [{ word: "potential", meanings: ["잠재적인"] }];
    await saveWordList("toeic-mid-am", 4, list);
    expect(blob.put).toHaveBeenCalledWith(
      "wordlists/toeic-mid-am/day-4.json",
      JSON.stringify(list),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    );
  });
});

describe("loadWordList", () => {
  beforeEach(() => {
    vi.mocked(blob.head).mockReset();
    vi.unstubAllGlobals();
  });

  it("fetches and parses the word list when it exists", async () => {
    const list = [{ word: "potential", meanings: ["잠재적인"] }];
    vi.mocked(blob.head).mockResolvedValue({
      url: "https://blob.example/wordlists/toeic-mid-am/day-4.json",
    } as Awaited<ReturnType<typeof blob.head>>);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => list })
    );

    const result = await loadWordList("toeic-mid-am", 4);
    expect(result).toEqual(list);
    expect(blob.head).toHaveBeenCalledWith("wordlists/toeic-mid-am/day-4.json");
  });

  it("returns null when the word list does not exist", async () => {
    vi.mocked(blob.head).mockRejectedValue(
      new blob.BlobNotFoundError()
    );
    const result = await loadWordList("toeic-mid-am", 4);
    expect(result).toBeNull();
  });

  it("propagates a non-not-found error instead of silently returning null", async () => {
    vi.mocked(blob.head).mockRejectedValue(new Error("network error"));
    await expect(loadWordList("toeic-mid-am", 4)).rejects.toThrow(
      "network error"
    );
  });

  it("throws when the blob URL fetch responds with a non-ok status", async () => {
    vi.mocked(blob.head).mockResolvedValue({
      url: "https://blob.example/wordlists/toeic-mid-am/day-4.json",
    } as Awaited<ReturnType<typeof blob.head>>);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );

    await expect(loadWordList("toeic-mid-am", 4)).rejects.toThrow(
      "단어장 조회 실패"
    );
  });
});
