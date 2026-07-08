"use client";
// 업로드 → 컬럼 수동선택(필요 시) → 결과 확인의 3단계 반 명단 문서 자동화 화면

import { useState } from "react";
import { CLASS_TYPES } from "@/lib/roster/classes";
import type { ClassTypeDocuments, MismatchWarning } from "@/lib/roster/types";

type Step = "upload" | "columnSelect" | "results";

// 문서 타입을 한국어로 표시하기 위한 매핑
const DOC_TYPE_LABELS: Record<string, string> = {
  printAttendance: "인쇄용 출석부",
  onlineAttendance: "온라인 출석부",
  counselingLog: "관리일지",
  textbook: "교재배부명단",
};

export default function RosterPage() {
  const [step, setStep] = useState<Step>("upload");
  const [term, setTerm] = useState<"1" | "2">("1");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnIndex, setColumnIndex] = useState<number>(0);
  const [documents, setDocuments] = useState<ClassTypeDocuments[]>([]);
  const [warnings, setWarnings] = useState<MismatchWarning[]>([]);
  const [selectedClassTypeId, setSelectedClassTypeId] = useState<string>("all");
  const [error, setError] = useState("");

  async function submitUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("명단 파일을 선택해주세요.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("term", term);

    const res = await fetch("/api/roster/generate", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "명단 처리에 실패했습니다.");
      return;
    }

    if (data.status === "needs_column_selection") {
      setHeaders(data.headers);
      setStep("columnSelect");
      return;
    }

    setDocuments(data.documents);
    setWarnings(data.warnings);
    setStep("results");
  }

  async function submitColumnSelection() {
    setError("");
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("term", term);
    formData.set("columnIndex", String(columnIndex));

    const res = await fetch("/api/roster/generate", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "명단 처리에 실패했습니다.");
      return;
    }

    setDocuments(data.documents);
    setWarnings(data.warnings);
    setStep("results");
  }

  const visibleDocuments =
    selectedClassTypeId === "all"
      ? documents
      : documents.filter((d) => d.classType.id === selectedClassTypeId);

  return (
    <main>
      <h1>반 명단 문서 자동화</h1>

      {step === "upload" && (
        <form onSubmit={submitUpload}>
          <label>
            기수
            <select value={term} onChange={(e) => setTerm(e.target.value as "1" | "2")}>
              <option value="1">1기</option>
              <option value="2">2기</option>
            </select>
          </label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit">문서 생성</button>
        </form>
      )}

      {step === "columnSelect" && (
        <section>
          <p>신청 컬럼을 자동으로 찾지 못했습니다. 아래 헤더 목록에서 직접 선택해주세요.</p>
          <select
            value={columnIndex}
            onChange={(e) => setColumnIndex(Number(e.target.value))}
          >
            {headers.map((header, index) => (
              <option key={index} value={index}>
                {index}: {header}
              </option>
            ))}
          </select>
          <button onClick={submitColumnSelection}>이 컬럼으로 진행</button>
        </section>
      )}

      {step === "results" && (
        <section>
          <label>
            반 선택
            <select
              value={selectedClassTypeId}
              onChange={(e) => setSelectedClassTypeId(e.target.value)}
            >
              <option value="all">전체 반 보기</option>
              {CLASS_TYPES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {warnings.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>반</th>
                  <th>세션</th>
                  <th>문서</th>
                  <th>누락된 학생</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((w, i) => (
                  <tr key={i}>
                    <td>{CLASS_TYPES.find((c) => c.id === w.classTypeId)?.label ?? w.classTypeId}</td>
                    <td>{w.session === "am" ? "오전" : "오후"}</td>
                    <td>{DOC_TYPE_LABELS[w.docType] ?? w.docType}</td>
                    <td>{w.missingNames.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {visibleDocuments.map((doc) => (
            <div key={doc.classType.id}>
              <h2>{doc.classType.label}</h2>

              <h3>인쇄용 출석부 (오전)</h3>
              <table>
                <thead>
                  <tr>
                    <th>NO</th>
                    <th>학과</th>
                    <th>이름</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.printAttendanceAm.map((r) => (
                    <tr key={r.no}>
                      <td>{r.no}</td>
                      <td>{r.department}</td>
                      <td>{r.name}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>인쇄용 출석부 (오후)</h3>
              <table>
                <thead>
                  <tr>
                    <th>NO</th>
                    <th>학과</th>
                    <th>이름</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.printAttendancePm.map((r) => (
                    <tr key={r.no}>
                      <td>{r.no}</td>
                      <td>{r.department}</td>
                      <td>{r.name}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>온라인 출석부</h3>
              <table>
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>학년</th>
                    <th>학번</th>
                    <th>수강반</th>
                    <th>성명</th>
                    <th>연락처</th>
                    <th></th>
                    <th>번호</th>
                    <th>학년</th>
                    <th>학번</th>
                    <th>수강반</th>
                    <th>성명</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({
                    length: Math.max(
                      doc.onlineAttendanceAm.length,
                      doc.onlineAttendancePm.length
                    ),
                  }).map((_, i) => {
                    const am = doc.onlineAttendanceAm[i];
                    const pm = doc.onlineAttendancePm[i];
                    return (
                      <tr key={i}>
                        <td>{am?.no ?? ""}</td>
                        <td>{am?.grade ?? ""}</td>
                        <td>{am?.studentId ?? ""}</td>
                        <td>{am?.className ?? ""}</td>
                        <td>{am?.name ?? ""}</td>
                        <td>{am?.phone ?? ""}</td>
                        <td></td>
                        <td>{pm?.no ?? ""}</td>
                        <td>{pm?.grade ?? ""}</td>
                        <td>{pm?.studentId ?? ""}</td>
                        <td>{pm?.className ?? ""}</td>
                        <td>{pm?.name ?? ""}</td>
                        <td>{pm?.phone ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <h3>관리일지 (오전)</h3>
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>학과</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.counselingLogAm.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>관리일지 (오후)</h3>
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>학과</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.counselingLogPm.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>교재배부명단 (오전)</h3>
              <table>
                <thead>
                  <tr>
                    <th>연번</th>
                    <th>이름</th>
                    <th>학과</th>
                    <th>학번</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.textbookAm.map((r) => (
                    <tr key={r.no}>
                      <td>{r.no}</td>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                      <td>{r.studentId}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>교재배부명단 (오후)</h3>
              <table>
                <thead>
                  <tr>
                    <th>연번</th>
                    <th>이름</th>
                    <th>학과</th>
                    <th>학번</th>
                    <th>연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.textbookPm.map((r) => (
                    <tr key={r.no}>
                      <td>{r.no}</td>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                      <td>{r.studentId}</td>
                      <td>{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {error && <p role="alert">{error}</p>}
    </main>
  );
}
