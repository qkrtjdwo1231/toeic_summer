import { describe, it, expect, vi } from "vitest";
import { gradeStudent } from "./grade-student";
import type { WordList } from "./types";

function makeMockClient(responseText: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: responseText } }],
        }),
      },
    },
  } as unknown as import("openai").default;
}

const wordList: WordList = [
  { word: "potential", meanings: ["잠재적인"] },
  { word: "brighten", meanings: ["밝아지다"] },
];

describe("gradeStudent", () => {
  it("marks blank answers incorrect without calling the API for that word", async () => {
    const client = makeMockClient(
      JSON.stringify([
        { word: "potential", correct: true, ambiguous: false },
      ])
    );

    const result = await gradeStudent(client, "박성재", wordList, [
      "잠재적인",
      "",
    ]);

    const brightenVerdict = result.verdicts.find(
      (v) => v.word === "brighten"
    );
    expect(brightenVerdict).toEqual({
      word: "brighten",
      studentAnswer: "",
      correct: false,
      ambiguous: false,
    });
  });

  it("parses correct/ambiguous verdicts from a well-formed API response", async () => {
    const client = makeMockClient(
      JSON.stringify([
        { word: "potential", correct: true, ambiguous: false },
        {
          word: "brighten",
          correct: false,
          ambiguous: true,
          reasoning: "품사가 달라 오답으로 판단",
        },
      ])
    );

    const result = await gradeStudent(client, "이주호", wordList, [
      "잠재의",
      "밝다",
    ]);

    expect(result.manualCheckRequired).toBe(false);
    expect(result.verdicts).toEqual([
      {
        word: "potential",
        studentAnswer: "잠재의",
        correct: true,
        ambiguous: false,
      },
      {
        word: "brighten",
        studentAnswer: "밝다",
        correct: false,
        ambiguous: true,
        reasoning: "품사가 달라 오답으로 판단",
      },
    ]);
  });

  it("marks the student for manual check when the API response is not valid JSON", async () => {
    const client = makeMockClient("이건 JSON이 아님");

    const result = await gradeStudent(client, "김대연", wordList, [
      "잠재적인",
      "밝아지다",
    ]);

    expect(result.manualCheckRequired).toBe(true);
  });
});
