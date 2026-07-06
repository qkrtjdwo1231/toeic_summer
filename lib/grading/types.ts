// 단어장/학생 답안/채점 결과에 쓰이는 공용 타입 정의
export interface WordEntry {
  word: string;
  meanings: string[];
}

export type WordList = WordEntry[];

export interface StudentAnswerRow {
  name: string;
  answers: string[];
}

export interface WordVerdict {
  word: string;
  studentAnswer: string;
  correct: boolean;
  ambiguous: boolean;
  reasoning?: string;
}

export interface StudentGradeResult {
  name: string;
  verdicts: WordVerdict[];
  manualCheckRequired: boolean;
}
