// OpenAI를 이용해 학생 1명의 답안을 채점하는 로직
import type OpenAI from "openai";
import type { WordList, WordVerdict, StudentGradeResult } from "./types";

const GRADING_CRITERIA = `단어 시험 채점 기준:
- 표현만 다르고 품사·의미가 같으면 정답 (예: "잠재적인" 정답에 "잠재의"라고 써도 정답).
- 품사가 명백히 다르면 오답 (예: 동사 뜻 자리에 형용사/상태를 나타내는 답을 쓰면 오답).
- 복합명사/구의 일부 의미 요소가 빠지면 오답.
- 아래 나열된 뜻 외의 뜻은 정답으로 인정하지 않는다.`;

function buildPrompt(
  wordList: WordList,
  wordsToGrade: { word: string; meanings: string[]; studentAnswer: string }[]
): string {
  const wordListText = wordsToGrade
    .map(
      (w) =>
        `- 단어: ${w.word} / 정답으로 인정되는 뜻: ${w.meanings.join(", ")} / 학생 답: "${w.studentAnswer}"`
    )
    .join("\n");

  return `${GRADING_CRITERIA}

아래 단어들을 각각 채점해서 JSON 배열로만 답해라. 각 항목은 {"word": string, "correct": boolean, "ambiguous": boolean, "reasoning": string(선택, ambiguous가 true일 때만)} 형태여야 한다.

${wordListText}`;
}

export async function gradeStudent(
  client: OpenAI,
  name: string,
  wordList: WordList,
  answers: string[]
): Promise<StudentGradeResult> {
  const blankVerdicts = new Map<string, WordVerdict>();
  const wordsToGrade: {
    word: string;
    meanings: string[];
    studentAnswer: string;
  }[] = [];

  wordList.forEach((entry, index) => {
    const studentAnswer = (answers[index] ?? "").trim();
    if (studentAnswer === "") {
      blankVerdicts.set(entry.word, {
        word: entry.word,
        studentAnswer: "",
        correct: false,
        ambiguous: false,
      });
    } else {
      wordsToGrade.push({
        word: entry.word,
        meanings: entry.meanings,
        studentAnswer,
      });
    }
  });

  // wordList 순서를 그대로 따르도록 blank 채점 결과와 모델 채점 결과를 병합한다.
  const orderedVerdicts = (graded: Map<string, WordVerdict>): WordVerdict[] =>
    wordList
      .map((entry) => blankVerdicts.get(entry.word) ?? graded.get(entry.word))
      .filter((v): v is WordVerdict => v !== undefined);

  if (wordsToGrade.length === 0) {
    return {
      name,
      verdicts: orderedVerdicts(new Map()),
      manualCheckRequired: false,
    };
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: buildPrompt(wordList, wordsToGrade) }],
  });

  const content = completion.choices[0]?.message?.content ?? "";

  // 응답이 JSON 파싱에 실패하면 blank 채점 결과만 남기고 수동 확인이 필요함을 표시한다.
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      name,
      verdicts: orderedVerdicts(new Map()),
      manualCheckRequired: true,
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      name,
      verdicts: orderedVerdicts(new Map()),
      manualCheckRequired: true,
    };
  }

  const gradedVerdicts = new Map<string, WordVerdict>();
  for (const item of parsed) {
    if (item === null || typeof item !== "object") continue;
    const typed = item as {
      word?: unknown;
      correct?: unknown;
      ambiguous?: unknown;
      reasoning?: string;
    };
    if (
      typeof typed.word === "string" &&
      typeof typed.correct === "boolean" &&
      typeof typed.ambiguous === "boolean"
    ) {
      const matched = wordsToGrade.find((w) => w.word === typed.word);
      gradedVerdicts.set(typed.word, {
        word: typed.word,
        studentAnswer: matched?.studentAnswer ?? "",
        correct: typed.correct,
        ambiguous: typed.ambiguous,
        ...(typed.ambiguous && typed.reasoning
          ? { reasoning: typed.reasoning }
          : {}),
      });
    }
  }

  // 요청한 단어 중 하나라도 유효한 채점 결과가 없으면 전체를 수동 확인 대상으로 처리한다.
  const allGraded = wordsToGrade.every((w) => gradedVerdicts.has(w.word));
  if (!allGraded) {
    return {
      name,
      verdicts: orderedVerdicts(new Map()),
      manualCheckRequired: true,
    };
  }

  return {
    name,
    verdicts: orderedVerdicts(gradedVerdicts),
    manualCheckRequired: false,
  };
}
