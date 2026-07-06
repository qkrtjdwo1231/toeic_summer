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
  const verdicts: WordVerdict[] = [];
  const wordsToGrade: {
    word: string;
    meanings: string[];
    studentAnswer: string;
  }[] = [];

  wordList.forEach((entry, index) => {
    const studentAnswer = (answers[index] ?? "").trim();
    if (studentAnswer === "") {
      verdicts.push({
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

  if (wordsToGrade.length === 0) {
    return { name, verdicts, manualCheckRequired: false };
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: buildPrompt(wordList, wordsToGrade) }],
  });

  const content = completion.choices[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content) as {
      word: string;
      correct: boolean;
      ambiguous: boolean;
      reasoning?: string;
    }[];

    for (const item of parsed) {
      const matched = wordsToGrade.find((w) => w.word === item.word);
      verdicts.push({
        word: item.word,
        studentAnswer: matched?.studentAnswer ?? "",
        correct: item.correct,
        ambiguous: item.ambiguous,
        ...(item.ambiguous && item.reasoning
          ? { reasoning: item.reasoning }
          : {}),
      });
    }

    return { name, verdicts, manualCheckRequired: false };
  } catch {
    return { name, verdicts, manualCheckRequired: true };
  }
}
