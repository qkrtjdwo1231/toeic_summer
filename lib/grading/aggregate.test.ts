import { describe, it, expect } from "vitest";
import { aggregateResults } from "./aggregate";
import type { StudentGradeResult } from "./types";

function makeResult(
  name: string,
  verdicts: { word: string; studentAnswer: string; correct: boolean }[]
): StudentGradeResult {
  return {
    name,
    verdicts: verdicts.map((v) => ({ ...v, ambiguous: false })),
    manualCheckRequired: false,
  };
}

describe("aggregateResults", () => {
  it("lists each student's wrong words", () => {
    const results = [
      makeResult("박성재", [
        { word: "potential", studentAnswer: "잠재적인", correct: true },
        { word: "brighten", studentAnswer: "밝다", correct: false },
      ]),
      makeResult("이주호", [
        { word: "potential", studentAnswer: "잠재의", correct: true },
        { word: "brighten", studentAnswer: "밝아지다", correct: true },
      ]),
    ];

    const { students } = aggregateResults(results);
    expect(students).toEqual([
      { name: "박성재", wrongWords: ["brighten"], manualCheckRequired: false },
      { name: "이주호", wrongWords: [], manualCheckRequired: false },
    ]);
  });

  it("adds a warning when 10 or more students miss the same word, using the most common wrong answer", () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult(`학생${i + 1}`, [
        {
          word: "brighten",
          studentAnswer: i < 7 ? "밝다" : "빛나다",
          correct: false,
        },
      ])
    );

    const { warnings } = aggregateResults(results);
    expect(warnings).toEqual([
      { word: "brighten", count: 10, commonWrongAnswer: "밝다" },
    ]);
  });

  it("does not warn when fewer than 10 students miss the same word", () => {
    const results = Array.from({ length: 9 }, (_, i) =>
      makeResult(`학생${i + 1}`, [
        { word: "brighten", studentAnswer: "밝다", correct: false },
      ])
    );

    const { warnings } = aggregateResults(results);
    expect(warnings).toEqual([]);
  });

  it("resolves ties in wrong-answer count by selecting the first-seen answer", () => {
    // 10 students miss the same word: 5 answer "밝다", 5 answer "빛나다"
    // Both have equal count, so the first-seen answer ("밝다") should be selected
    const results = Array.from({ length: 10 }, (_, i) =>
      makeResult(`학생${i + 1}`, [
        {
          word: "brighten",
          studentAnswer: i < 5 ? "밝다" : "빛나다",
          correct: false,
        },
      ])
    );

    const { warnings } = aggregateResults(results);
    expect(warnings).toEqual([
      { word: "brighten", count: 10, commonWrongAnswer: "밝다" },
    ]);
  });
});
