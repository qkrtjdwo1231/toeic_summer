// 채점 화면에서 쓰는 반(class)/일차(day) 선택지 정의
export const CLASS_OPTIONS = [
  { id: "toeic-basic-am", label: "토익 기초 오전" },
  { id: "toeic-basic-pm", label: "토익 기초 오후" },
  { id: "toeic-mid-am", label: "토익 중급 오전" },
  { id: "toeic-mid-pm", label: "토익 중급 오후" },
  { id: "toeic-adv-am", label: "토익 실전 오전" },
  { id: "toeic-adv-pm", label: "토익 실전 오후" },
  { id: "opic-mid-am", label: "오픽 중급 오전" },
  { id: "opic-mid-pm", label: "오픽 중급 오후" },
  { id: "opic-adv-am", label: "오픽 실전 오전" },
  { id: "opic-adv-pm", label: "오픽 실전 오후" },
] as const;

export const DAY_OPTIONS: number[] = Array.from({ length: 15 }, (_, i) => i + 1);
