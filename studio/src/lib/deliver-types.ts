// 홍보자료 내보내기(PDF·Word·PPT·Excel·ZIP)와 이메일 발송의 공용 계약 (클라이언트·서버 공용, 비밀정보 없음)
// 소유: PM(개발자 A). 내보내기 담당과 이메일 담당은 이 파일을 읽기만 하고, 바꿔야 하면 PM에게 요청한다.
import type { GenerateSuccess } from "./api-types";

/** 수신 고객 정보 (FR-MAIL-01). 이메일만 필수, 나머지는 선택. AI에는 보내지 않는다. */
export interface RecipientInfo {
  name: string; // 이름
  company: string; // 회사명
  title: string; // 직함
  department: string; // 부서명
  email: string; // 이메일 (필수)
  phone: string; // 연락처
}

export const EMPTY_RECIPIENT: RecipientInfo = {
  name: "",
  company: "",
  title: "",
  department: "",
  email: "",
  phone: "",
};

/** 내보내기 형식 */
export type ExportFormat = "pdf" | "docx" | "pptx" | "xlsx" | "zip";

/**
 * POST /api/export 요청 본문 (JSON).
 * - generation: /api/generate 성공 응답 그대로
 * - recipient: 있으면 PDF 표지·인사말에 고객 맞춤 정보로 사용
 * - cardPngDataUrl: 카드뉴스 1080×1350 PNG(data:image/png;base64,...) — 화면에서 편집한 카드 그대로. PDF·PPT·ZIP에 삽입
 * - generation.result: AI 응답(campaign은 CEO 영업 사각지대 형식일 때만 있음, differentiators는 1~3개)
 * - photoDataUrl: 업로드한 현장 사진(data:image/jpeg|png|webp;base64,...) — 선택
 * 응답: 성공 시 해당 파일 바이너리(Content-Type, Content-Disposition 포함), 실패 시 ApiErrorBody(JSON)
 */
/** 내보내기 용도(이력 구분용): 다운로드 / 화면 미리보기 / 메일 첨부 */
export type ExportPurpose = "download" | "preview" | "email";

export interface ExportRequest {
  format: ExportFormat;
  purpose?: ExportPurpose;
  generation: GenerateSuccess;
  recipient?: RecipientInfo;
  cardPngDataUrl?: string;
  photoDataUrl?: string;
}

/**
 * POST /api/email 요청 본문 (JSON).
 * - pdfBase64: /api/export(format=pdf)로 만든 PDF를 base64로(데이터 URL 접두어 없이)
 * - subject, body: 사용자가 미리보기에서 확인·수정한 제목과 본문(평문)
 * 응답: { ok: true, messageId } 또는 ApiErrorBody
 */
export interface EmailRequest {
  recipient: RecipientInfo;
  subject: string;
  body: string;
  pdfBase64: string;
  pdfFilename: string;
  /** DB 이력 연결용(선택): /api/generate 응답 meta.generationId */
  generationId?: string;
}

export interface EmailSuccess {
  ok: true;
  messageId: string;
  acceptedTo: string;
}
