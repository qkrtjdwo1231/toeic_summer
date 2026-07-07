"use client";
// 반+데이 선택 → 단어장 관리 → 답안 업로드 → 결과 확인의 4단계 채점 화면

import { useState } from "react";
import { CLASS_OPTIONS, DAY_OPTIONS } from "@/lib/grading/classes";

type Step = "select" | "wordlist" | "answers" | "results";

interface WarningRow {
  word: string;
  count: number;
  commonWrongAnswer: string;
}

interface StudentRow {
  name: string;
  wrongWords: string[];
  manualCheckRequired: boolean;
}

export default function GradingPage() {
  const [step, setStep] = useState<Step>("select");
  const [classId, setClassId] = useState<string>(CLASS_OPTIONS[0].id);
  const [day, setDay] = useState(DAY_OPTIONS[0]);
  const [wordListText, setWordListText] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function loadWordList() {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/grading/wordlist?classId=${classId}&day=${day}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "단어장을 불러오지 못했습니다.");
        return;
      }

      if (data.wordList) {
        setWordListText(
          data.wordList
            .map(
              (entry: { word: string; meanings: string[] }) =>
                `${entry.word}\t${entry.meanings.join("\t")}`
            )
            .join("\n")
        );
      } else {
        setWordListText("");
      }
      setStep("wordlist");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveWordList() {
    setError("");
    setIsLoading(true);
    try {
      const rows = wordListText
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => line.split("\t"));

      const res = await fetch("/api/grading/wordlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, day, rows }),
      });

      if (!res.ok) {
        setError("단어장 저장에 실패했습니다.");
        return;
      }
      setStep("answers");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswers(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const fileInput = e.currentTarget.elements.namedItem(
        "file"
      ) as HTMLInputElement;
      const file = fileInput.files?.[0];
      if (!file) {
        setError("답안 파일을 선택해주세요.");
        return;
      }

      const formData = new FormData();
      formData.set("classId", classId);
      formData.set("day", String(day));
      formData.set("file", file);

      const res = await fetch("/api/grading/grade", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "채점에 실패했습니다.");
        return;
      }

      setWarnings(data.warnings);
      setStudents(data.students);
      setStep("results");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main>
      <h1>단어 시험 채점</h1>

      {step === "select" && (
        <section>
          <label>
            반
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            데이
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  DAY {d}
                </option>
              ))}
            </select>
          </label>
          <button onClick={loadWordList} disabled={isLoading}>
            {isLoading ? "처리 중..." : "다음"}
          </button>
        </section>
      )}

      {step === "wordlist" && (
        <section>
          <p>
            단어장 (한 줄에 하나씩, 영단어와 뜻들을 탭으로 구분): 영단어[Tab]뜻1[Tab]뜻2...
          </p>
          <textarea
            value={wordListText}
            onChange={(e) => setWordListText(e.target.value)}
            rows={15}
            cols={60}
          />
          <button onClick={saveWordList} disabled={isLoading}>
            {isLoading ? "처리 중..." : "저장하고 다음"}
          </button>
        </section>
      )}

      {step === "answers" && (
        <section>
          <form onSubmit={submitAnswers}>
            <input type="file" name="file" accept=".xlsx,.csv" disabled={isLoading} />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "처리 중..." : "채점하기"}
            </button>
          </form>
        </section>
      )}

      {step === "results" && (
        <section>
          {warnings.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>단어</th>
                  <th>오답 인원</th>
                  <th>공통 오답</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((w) => (
                  <tr key={w.word}>
                    <td>{w.word}</td>
                    <td>{w.count}</td>
                    <td>{w.commonWrongAnswer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>틀린 단어</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>
                    {s.manualCheckRequired
                      ? "수동 확인 필요"
                      : s.wrongWords.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {error && <p role="alert">{error}</p>}
    </main>
  );
}
