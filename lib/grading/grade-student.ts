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

type WordToGrade = {
  index: number;
  word: string;
  meanings: string[];
  studentAnswer: string;
};

export async function gradeStudent(
  client: OpenAI,
  name: string,
  wordList: WordList,
  answers: string[]
): Promise<StudentGradeResult> {
  // wordList에 같은 단어가 중복될 수 있으므로, 단어 문자열이 아니라 위치(index)로 추적한다.
  const blankVerdicts = new Map<number, WordVerdict>();
  const wordsToGrade: WordToGrade[] = [];

  wordList.forEach((entry, index) => {
    const studentAnswer = (answers[index] ?? "").trim();
    if (studentAnswer === "") {
      blankVerdicts.set(index, {
        word: entry.word,
        studentAnswer: "",
        correct: false,
        ambiguous: false,
      });
    } else {
      wordsToGrade.push({
        index,
        word: entry.word,
        meanings: entry.meanings,
        studentAnswer,
      });
    }
  });

  // wordList 순서를 그대로 따르도록 blank 채점 결과와 모델 채점 결과를 병합한다.
  const orderedVerdicts = (graded: Map<number, WordVerdict>): WordVerdict[] =>
    wordList
      .map((_entry, index) => blankVerdicts.get(index) ?? graded.get(index))
      .filter((v): v is WordVerdict => v !== undefined);

  if (wordsToGrade.length === 0) {
    return {
      name,
      verdicts: orderedVerdicts(new Map()),
      manualCheckRequired: false,
    };
  }

  // API 호출 자체가 실패해도(레이트리밋/네트워크 등) 이 학생만 수동 확인으로 표시하고,
  // Promise.all로 묶인 반 전체 채점이 함께 실패하지 않도록 한다.
  let rawContent: string;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: buildPrompt(wordList, wordsToGrade) },
      ],
    });
    rawContent = completion.choices[0]?.message?.content ?? "";
  } catch {
    return {
      name,
      verdicts: orderedVerdicts(new Map()),
      manualCheckRequired: true,
    };
  }

  // gpt-4o-mini는 지시해도 응답을 ```json ... ``` 코드블록으로 감싸는 경우가 많아 벗겨낸다.
  const content = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

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

  // 모델 응답은 단어 문자열 하나당 최대 한 개의 채점 항목만 준다.
  const responseByWord = new Map<
    string,
    { correct: boolean; ambiguous: boolean; reasoning?: string }
  >();
  for (const item of parsed) {
    if (item === null || typeof item !== "object") continue;
    const typed = item as {
      word?: unknown;
      correct?: unknown;
      ambiguous?: unknown;
      reasoning?: unknown;
    };
    if (
      typeof typed.word === "string" &&
      typeof typed.correct === "boolean" &&
      typeof typed.ambiguous === "boolean"
    ) {
      responseByWord.set(typed.word, {
        correct: typed.correct,
        ambiguous: typed.ambiguous,
        ...(typed.ambiguous && typeof typed.reasoning === "string"
          ? { reasoning: typed.reasoning }
          : {}),
      });
    }
  }

  // 같은 단어가 wordList의 여러 위치에 등장할 수 있으므로, 단어별로 채점 대상 위치들을 모아둔다.
  const positionsByWord = new Map<string, WordToGrade[]>();
  for (const w of wordsToGrade) {
    const positions = positionsByWord.get(w.word) ?? [];
    positions.push(w);
    positionsByWord.set(w.word, positions);
  }

  const gradedVerdicts = new Map<number, WordVerdict>();
  for (const [word, positions] of positionsByWord) {
    const response = responseByWord.get(word);
    if (!response) continue;

    // 같은 단어가 여러 위치에 있을 때, 학생 답이 모두 같으면 같은 채점 결과를 적용해도 안전하다.
    // 답이 서로 다르면 응답이 어느 위치를 가리키는지 알 수 없으므로 매칭하지 않는다.
    const sameAnswer = positions.every(
      (p) => p.studentAnswer === positions[0].studentAnswer
    );
    if (positions.length > 1 && !sameAnswer) continue;

    for (const p of positions) {
      gradedVerdicts.set(p.index, {
        word: p.word,
        studentAnswer: p.studentAnswer,
        correct: response.correct,
        ambiguous: response.ambiguous,
        ...(response.reasoning ? { reasoning: response.reasoning } : {}),
      });
    }
  }

  // 요청한 위치 중 하나라도 유효한 채점 결과가 없으면 전체를 수동 확인 대상으로 처리한다.
  const allGraded = wordsToGrade.every((w) => gradedVerdicts.has(w.index));
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
