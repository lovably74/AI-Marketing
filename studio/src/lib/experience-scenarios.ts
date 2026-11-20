import { BLIND_SPOTS } from "./constants";

type Scenario = {
  title: string;
  summary: string;
  conversation: string;
  situation: string;
  checks: readonly [string, ...string[]];
  features: readonly { title: string; benefit: string }[];
};

export const EXPERIENCE_SCENARIOS = {
  opportunity: {
    title: "견적 요청 후 후속조치 누락",
    summary: "고객에게 다시 연락하기로 한 견적 요청을 어디에서 확인하시나요?",
    conversation: "사무실 이전 전에 전화 회선을 추가하려고 합니다. 금요일까지 견적을 받아볼 수 있을까요?",
    situation: "상담원이 견적을 보내기로 했습니다. 통화는 마쳤지만 후속 연락 일정과 처리 상태를 공유 기록에서 찾기 어렵습니다.",
    checks: ["요청한 품목과 회신 기한이 무엇인가요?", "견적 발송 담당자가 지정됐나요?", "발송 여부와 다음 연락 일정이 기록됐나요?"],
    features: [
      { title: "AI 통화 녹취·요약", benefit: "기록된 통화에서 고객의 요청과 회신 약속을 확인할 수 있습니다." },
      { title: "AI 경영분석 · 미결 상담", benefit: "보고서에서 근거 상담, 견적 요청, 권장 후속조치와 기록된 진행 상태를 살펴볼 수 있습니다." },
    ],
  },
  complaint: {
    title: "반복적인 고객 불만",
    summary: "담당자가 달라도 같은 문제로 다시 연락한 고객을 알아볼 수 있나요?",
    conversation: "지난번에도 전화가 끊긴다고 말씀드렸는데 오늘 또 같은 문제가 생겼습니다.",
    situation: "고객이 같은 문제를 다른 담당자에게 설명했습니다. 담당자별로 상담이 흩어져 원인과 조치 이력이 한눈에 보이지 않습니다.",
    checks: ["이전에 어떤 증상과 조치가 기록됐나요?", "다른 상담에서도 같은 유형의 불만이 있었나요?", "조치 결과와 고객에게 한 안내를 누가 확인하나요?"],
    features: [
      { title: "상담 이력·통화요약 검색", benefit: "고객별 이력에서 이전에 어떤 문제를 알렸고 어떤 안내를 받았는지 확인할 수 있습니다." },
      { title: "AI 경영분석 · 고객의견", benefit: "고객의견을 이슈별로 살펴보고 반복 이슈와 근거 상담을 검토할 수 있습니다." },
    ],
  },
  handoff: {
    title: "직원 변경에 따른 고객 상담 기록 단절",
    summary: "담당자가 바뀌면 고객과 합의한 내용을 어디에서 찾아야 하나요?",
    conversation: "이전 담당자와 설치 일정과 추가 요청 사항을 얘기했는데 새 담당자분도 알고 계신가요?",
    situation: "인수인계 메모에는 고객 이름만 남았습니다. 새 담당자는 이전에 합의한 내용과 남은 일을 확인해야 합니다.",
    checks: ["이전 담당자가 고객과 무엇을 약속했나요?", "어떤 내용이 고객별 상담 이력에 등록됐나요?", "다음 조치는 누가 언제 맡기로 했나요?"],
    features: [
      { title: "CRM 고객별 상담·통화 이력", benefit: "새 담당자가 고객별 화면에서 저장된 상담과 통화 이력을 찾아볼 수 있습니다." },
      { title: "통화 녹취·화자별 기록", benefit: "기록된 대화와 요약을 확인해 고객의 요청과 내부 인수인계 내용을 맞춰볼 수 있습니다." },
    ],
  },
} satisfies Record<(typeof BLIND_SPOTS)[number]["id"], Scenario>;
