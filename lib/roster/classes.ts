// 반 유형 상수 및 정의
export interface ClassTypeDef {
  id: string;
  label: string;
  amRawName: string;
  pmRawName: string;
  amDisplayName: string;
  pmDisplayName: string;
}

export const CLASS_TYPES: ClassTypeDef[] = [
  {
    id: "toeic-basic",
    label: "토익 기초",
    amRawName: "기초 오전",
    pmRawName: "기초 오후",
    amDisplayName: "토익 기초 오전",
    pmDisplayName: "토익 기초 오후",
  },
  {
    id: "toeic-mid",
    label: "토익 중급",
    amRawName: "중급 오전",
    pmRawName: "중급 오후",
    amDisplayName: "토익 중급 오전",
    pmDisplayName: "토익 중급 오후",
  },
  {
    id: "toeic-adv",
    label: "토익 실전",
    amRawName: "실전 오전",
    pmRawName: "실전 오후",
    amDisplayName: "토익 실전 오전",
    pmDisplayName: "토익 실전 오후",
  },
  {
    id: "opic-mid",
    label: "오픽 중급",
    amRawName: "오픽 중급 오전",
    pmRawName: "오픽 중급 오후",
    amDisplayName: "오픽 중급 오전",
    pmDisplayName: "오픽 중급 오후",
  },
  {
    id: "opic-adv",
    label: "오픽 실전",
    amRawName: "오픽 실전 오전",
    pmRawName: "오픽 실전 오후",
    amDisplayName: "오픽 실전 오전",
    pmDisplayName: "오픽 실전 오후",
  },
];
