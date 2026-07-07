// 반 전체 학생의 채점 결과를 집계하고 공통 오답 경고를 생성하는 함수
import type { StudentGradeResult } from "./types";

export interface WrongWordWarning {
  word: string;
  count: number;
  commonWrongAnswer: string;
}

export interface StudentSummary {
  name: string;
  wrongWords: string[];
  manualCheckRequired: boolean;
}

export interface AggregatedResults {
  warnings: WrongWordWarning[];
  students: StudentSummary[];
}

export function aggregateResults(
  results: StudentGradeResult[]
): AggregatedResults {
  const students: StudentSummary[] = results.map((result) => ({
    name: result.name,
    wrongWords: result.verdicts
      .filter((v) => !v.correct)
      .map((v) => v.word),
    manualCheckRequired: result.manualCheckRequired,
  }));

  const wrongAnswersByWord = new Map<string, string[]>();
  for (const result of results) {
    for (const verdict of result.verdicts) {
      if (verdict.correct) continue;
      const list = wrongAnswersByWord.get(verdict.word) ?? [];
      list.push(verdict.studentAnswer);
      wrongAnswersByWord.set(verdict.word, list);
    }
  }

  const warnings: WrongWordWarning[] = [];
  for (const [word, wrongAnswers] of wrongAnswersByWord) {
    if (wrongAnswers.length < 10) continue;

    const counts = new Map<string, number>();
    for (const answer of wrongAnswers) {
      counts.set(answer, (counts.get(answer) ?? 0) + 1);
    }
    // 동점 시 먼저 나타난 오답을 선택 (Array.prototype.sort는 ES2019부터 안정정렬이고, Map 삽입 순서를 유지하므로)
    const [commonWrongAnswer] = [...counts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0];

    warnings.push({
      word,
      count: wrongAnswers.length,
      commonWrongAnswer,
    });
  }

  return { warnings, students };
}
