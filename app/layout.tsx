import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "단어장 웹",
  description: "단어 시험 채점 및 반 명단 문서 자동화 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
