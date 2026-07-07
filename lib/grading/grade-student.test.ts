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

function makeThrowingClient() {
  return {
    chat: {
      completions: {
        create: vi.fn().mockRejectedValue(new Error("rate limit exceeded")),
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

  it("marks the student for manual check when the API call itself throws, without rejecting", async () => {
    const client = makeThrowingClient();

    const result = await gradeStudent(client, "박성재", wordList, [
      "잠재적인",
      "밝다",
    ]);

    expect(result.manualCheckRequired).toBe(true);
  });

  it("parses a response wrapped in a markdown ```json code block", async () => {
    const client = makeMockClient(
      "```json\n" +
        JSON.stringify([
          { word: "potential", correct: true, ambiguous: false },
          { word: "brighten", correct: false, ambiguous: false },
        ]) +
        "\n```"
    );

    const result = await gradeStudent(client, "박성재", wordList, [
      "잠재적인",
      "밝다",
    ]);

    expect(result.manualCheckRequired).toBe(false);
    expect(result.verdicts).toEqual([
      {
        word: "potential",
        studentAnswer: "잠재적인",
        correct: true,
        ambiguous: false,
      },
      {
        word: "brighten",
        studentAnswer: "밝다",
        correct: false,
        ambiguous: false,
      },
    ]);
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

  it("marks the student for manual check when the response array is missing a requested word", async () => {
    const client = makeMockClient(
      JSON.stringify([{ word: "potential", correct: true, ambiguous: false }])
    );

    const result = await gradeStudent(client, "정지훈", wordList, [
      "잠재적인",
      "밝아지다",
    ]);

    expect(result.manualCheckRequired).toBe(true);
  });

  it("marks the student for manual check when the response is a non-array JSON value", async () => {
    const client = makeMockClient(JSON.stringify({}));

    const result = await gradeStudent(client, "한소희", wordList, [
      "잠재적인",
      "밝아지다",
    ]);

    expect(result.manualCheckRequired).toBe(true);
  });

  it("marks the student for manual check when correct/ambiguous is a non-boolean type", async () => {
    const client = makeMockClient(
      JSON.stringify([
        { word: "potential", correct: "true", ambiguous: false },
        { word: "brighten", correct: true, ambiguous: false },
      ])
    );

    const result = await gradeStudent(client, "이서연", wordList, [
      "잠재적인",
      "밝아지다",
    ]);

    expect(result.manualCheckRequired).toBe(true);
  });

  it("omits reasoning when the API returns a non-string reasoning value", async () => {
    const client = makeMockClient(
      JSON.stringify([
        { word: "potential", correct: true, ambiguous: false },
        {
          word: "brighten",
          correct: false,
          ambiguous: true,
          reasoning: 12345,
        },
      ])
    );

    const result = await gradeStudent(client, "최유진", wordList, [
      "잠재적인",
      "밝다",
    ]);

    expect(result.manualCheckRequired).toBe(false);
    const brightenVerdict = result.verdicts.find(
      (v) => v.word === "brighten"
    );
    expect(brightenVerdict).toEqual({
      word: "brighten",
      studentAnswer: "밝다",
      correct: false,
      ambiguous: true,
    });
  });

  it("resolves duplicate words at different positions independently when their answers match", async () => {
    const duplicateWordList: WordList = [
      { word: "brighten", meanings: ["밝아지다"] },
      { word: "potential", meanings: ["잠재적인"] },
      { word: "brighten", meanings: ["밝아지다"] },
    ];
    const client = makeMockClient(
      JSON.stringify([
        { word: "brighten", correct: true, ambiguous: false },
        { word: "potential", correct: true, ambiguous: false },
      ])
    );

    const result = await gradeStudent(client, "정하윤", duplicateWordList, [
      "밝아지다",
      "잠재적인",
      "밝아지다",
    ]);

    expect(result.manualCheckRequired).toBe(false);
    expect(result.verdicts).toEqual([
      {
        word: "brighten",
        studentAnswer: "밝아지다",
        correct: true,
        ambiguous: false,
      },
      {
        word: "potential",
        studentAnswer: "잠재적인",
        correct: true,
        ambiguous: false,
      },
      {
        word: "brighten",
        studentAnswer: "밝아지다",
        correct: true,
        ambiguous: false,
      },
    ]);
  });

  it("falls back to manual check when duplicate word positions have different answers and the response can't be matched unambiguously", async () => {
    const duplicateWordList: WordList = [
      { word: "brighten", meanings: ["밝아지다"] },
      { word: "potential", meanings: ["잠재적인"] },
      { word: "brighten", meanings: ["밝아지다"] },
    ];
    const client = makeMockClient(
      JSON.stringify([
        { word: "brighten", correct: true, ambiguous: false },
        { word: "potential", correct: true, ambiguous: false },
      ])
    );

    const result = await gradeStudent(client, "정하윤", duplicateWordList, [
      "밝아지다",
      "잠재적인",
      "밝다",
    ]);

    expect(result.manualCheckRequired).toBe(true);
  });

  it("keeps verdicts in wordList order regardless of the model's response order or blank-answer positions", async () => {
    const mixedWordList: WordList = [
      { word: "A", meanings: ["에이"] },
      { word: "B", meanings: ["비"] },
      { word: "C", meanings: ["씨"] },
    ];
    const client = makeMockClient(
      JSON.stringify([
        { word: "C", correct: true, ambiguous: false },
        { word: "A", correct: true, ambiguous: false },
      ])
    );

    const result = await gradeStudent(client, "김민준", mixedWordList, [
      "에이",
      "",
      "씨",
    ]);

    expect(result.verdicts.map((v) => v.word)).toEqual(["A", "B", "C"]);
  });
});
