// 기본 메일 제목·본문 생성 (순수 함수, 클라이언트·서버 공용, 비밀정보 없음)
import type { GenerateSuccess } from "@/lib/api-types";
import { BLIND_SPOTS, OFFICIAL_HOMEPAGE, OFFICIAL_PHONE } from "@/lib/constants";
import type { RecipientInfo } from "@/lib/deliver-types";

export const MAX_EMAIL_SUBJECT_LENGTH = 200;
export const MAX_EMAIL_BODY_LENGTH = 5000;
export const MAX_EMAIL_PDF_BYTES = 15 * 1024 * 1024;

/** 줄바꿈·제어문자를 공백으로 바꿔 한 줄로 만든다(헤더 인젝션 방지) */
function oneLine(s: string): string {
  return s.replace(/[\r\n\t\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

/** 기본 제목: "[티링크 비즈레코딩] {AI 블로그 제목 또는 카드 제목}" */
export function composeSubject(generation: GenerateSuccess, recipient?: RecipientInfo): string {
  const r = generation.result;
  const topic = oneLine(r.blogTitle || r.cardHeadline || "");
  // 고객 맞춤: 회사명이 있으면 "[티링크 비즈레코딩] {회사} 귀하 — {주제}"
  const company = recipient ? oneLine(recipient.company) : "";
  const head = company ? `[티링크 비즈레코딩] ${company} 귀하` : "[티링크 비즈레코딩]";
  const subject = topic
    ? `${head}${company ? " — " : " "}${topic}`
    : `${head} 소개 자료를 보내 드립니다`;
  return subject.slice(0, MAX_EMAIL_SUBJECT_LENGTH);
}

/** 인사말 대상: "{회사} {부서} {이름} {직함}님" — 빈 필드는 생략 */
export function composeAddressee(recipient: RecipientInfo): string {
  const name = oneLine(recipient.name);
  const title = oneLine(recipient.title);
  const parts = [oneLine(recipient.company), oneLine(recipient.department), name, title].filter(Boolean);
  if (parts.length === 0) return "고객님";
  // 이름·직함이 모두 없으면 "{회사} {부서} 담당자님"
  if (!name && !title) return `${parts.join(" ")} 담당자님`;
  return `${parts.join(" ")}님`;
}

/** 기본 본문(평문) */
export function composeBody(generation: GenerateSuccess, recipient: RecipientInfo): string {
  const r = generation.result;
  const lines: string[] = [];
  lines.push(`${composeAddressee(recipient)}께`);
  lines.push("");
  lines.push("안녕하세요, 티링크입니다.");
  lines.push("기업용 통화녹음·영업관리 솔루션 티링크 비즈레코딩 소개 자료를 보내 드립니다.");
  lines.push("");
  const subtext = oneLine(r.cardSubtext ?? "");
  const headline = oneLine(r.cardHeadline ?? "");
  if (headline) lines.push(`■ ${headline}`);
  if (subtext) lines.push(subtext);
  const cta = oneLine(r.cta ?? "");
  if (cta) lines.push(`→ ${cta}`);
  if (headline || subtext || cta) lines.push("");
  // CEO 영업 사각지대 형식이면 대표가 확인해 볼 질문을 덧붙인다(가설이므로 단정하지 않는다)
  const questions = r.campaign
    ? BLIND_SPOTS.map(({ id }) => oneLine(r.campaign!.blindSpots[id].question)).filter(Boolean)
    : [];
  if (questions.length) {
    lines.push("대표님께서 한번 확인해 보실 만한 질문을 정리했습니다.");
    for (const q of questions) lines.push(`- ${q}`);
    lines.push("");
  }
  lines.push("첨부한 PDF에서 자세한 내용을 확인하실 수 있습니다.");
  lines.push("궁금하신 점은 아래 연락처로 편하게 문의해 주세요.");
  lines.push("");
  lines.push("감사합니다.");
  lines.push("");
  lines.push("티링크(T-LINK)");
  lines.push(`대표전화 ${OFFICIAL_PHONE}`);
  lines.push(OFFICIAL_HOMEPAGE);
  return lines.join("\n").slice(0, MAX_EMAIL_BODY_LENGTH);
}

/** 간단한 이메일 형식 검사(클라이언트 표시용, 서버는 Zod로 다시 검사) */
export function isValidEmail(email: string): boolean {
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(email.trim());
}
