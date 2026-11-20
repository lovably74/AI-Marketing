// 클라이언트·서버 공용 상수 (비밀정보 없음)

/** 업로드 이미지 최대 크기: 8MB */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** 제품 주요 정보 최대 길이 */
export const MAX_PRODUCT_INFO_LENGTH = 3000;

/** 제품명 최대 길이 */
export const MAX_PRODUCT_NAME_LENGTH = 100;
export const MAX_INDUSTRY_LENGTH = 80;

/** AI 호출 전체 타임아웃(재시도 포함): 90초 */
export const AI_TIMEOUT_MS = 90_000;

/** 허용 이미지 MIME 형식 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** 타깃 고객 선택지 (FR-IN-05) */
export const TARGET_CUSTOMERS = [
  "영업을 직접 관리하는 중소기업 대표",
  "중견기업 경영진",
  "영업본부장",
  "고객센터 운영책임자",
  "일반 기업 고객",
  "영업조직",
  "콜센터·고객센터",
  "보험·금융",
  "부동산·중개",
  "병의원",
] as const;
export const DEFAULT_TARGET_CUSTOMER = TARGET_CUSTOMERS[0];

/** [티링크 기본값 불러오기]로 채우는 값 (FR-IN-04). 지식베이스 F001~F010 요약 */
export const DEFAULT_PRODUCT_NAME = "티링크 비즈레코딩";
export const DEFAULT_PRODUCT_INFO = [
  "티링크 비즈레코딩은 기업용 통화녹음·영업관리 솔루션입니다.",
  "- 사무실 인터넷전화, 외근 휴대폰, PC 소프트폰 통화 이력을 하나의 서버에 고객별 이력으로 통합합니다(LG·SK·KT 회선 호환).",
  "- 통화녹음과 녹취 관리(검색·재생, 휴대폰 녹음 자동전송, 대면 녹취).",
  "- STT 문자변환으로 고객/상담원 발화를 구분해 텍스트로 보여 줍니다.",
  "- 모든 통화에 AI 한줄요약·키워드·화자별 대화가 자동 기록됩니다.",
  "- 티링크노트 CRM에서 고객별 상담·통화·문자·주문 이력을 확인합니다.",
  "- 영업사원별 통화량, 응답률, 평균 통화시간, 상담 통계를 제공합니다.",
  "- AI 종합리포트(옵션): 경영 분석 대시보드(CEO 5분 브리핑, RED 알림), 미결 상담·후속조치 추적, 상담원 역량평가, 신입 교육자료.",
  "- 보안: AES256 녹취파일 암호화, 상담원·매니저 권한, 재생 사유 입력, 사용 이력 조회.",
].join("\n");

/** 공식 연락처 (카드뉴스 하단 표시) */
export const OFFICIAL_HOMEPAGE = "www.tlinkcrm.com";
export const OFFICIAL_PHONE = "1877-3836";
export const OFFICIAL_REPORT_URL = "https://www.tlinkcrm.com/management.php";
export const OFFICIAL_INQUIRY_URL = "https://www.tlinkcrm.com/center.php";
export const EXPERIENCE_PATH = "/experience";
export const EXPERIENCE_CTA = "30초 영업 사각지대 체험하기";
export const REPORT_CTA = "AI 경영분석 보고서 예시 보기";

export const BLIND_SPOTS = [
  { id: "opportunity", label: "놓친 영업기회" },
  { id: "complaint", label: "반복적인 고객 불만" },
  { id: "handoff", label: "영업 보고의 공백" },
] as const;

export const CAMPAIGN_HEADLINE_LENGTH = 60;
export const CAMPAIGN_COPY_LENGTH = 160;
export const CAMPAIGN_CTA_LENGTH = 48;

/** 오류 코드 */
export const ERROR_CODES = [
  "INVALID_INPUT",
  "INVALID_IMAGE",
  "IMAGE_TOO_LARGE",
  "MODEL_NOT_FOUND",
  "MISSING_API_KEY",
  "PROVIDER_ERROR",
  "INVALID_AI_RESPONSE",
  "TIMEOUT",
  "UNAUTHORIZED",
  "ADMIN_TOKEN_NOT_SET",
  "CONFIG_ERROR",
  "INTERNAL_ERROR",
  "EXPORT_FAILED",
  "SMTP_NOT_CONFIGURED",
  "EMAIL_SEND_FAILED",
  "RATE_LIMITED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
