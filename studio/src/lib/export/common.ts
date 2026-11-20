// 내보내기 공용 유틸 (서버 전용): 파일명, 데이터 URL 해석, 연락처, 고객 맞춤 인사말
import type { GeneratedContent } from "../ai/schema";
import { BLIND_SPOTS } from "../constants";
import type { ExportFormat, RecipientInfo } from "../deliver-types";

export const BRAND = {
  navy: "#0B1736",
  blue: "#2F5BEA",
  light: "#6C9AFF",
  orange: "#FF8A3D",
} as const;

export const CONTACT = {
  homepage: "www.tlinkcrm.com",
  phone: "1877-3836",
  center: "https://www.tlinkcrm.com/center.php",
} as const;

export const AI_NOTICE = "AI 생성 콘텐츠입니다. 담당자 확인 후 사용하세요.";

export const MIME: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

const KIND: Record<ExportFormat, string> = {
  pdf: "brochure",
  docx: "blog",
  pptx: "promo",
  xlsx: "analysis",
  zip: "all",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYYMMDD-HHmm (서버 로컬 시각) */
export function stamp(d = new Date()): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** tlink-<종류>-YYYYMMDD-HHmm.<ext> */
export function exportFilename(format: ExportFormat, d = new Date(), kind = KIND[format]): string {
  return `tlink-${kind}-${stamp(d)}.${format}`;
}

/** RFC 5987 filename* 포함 Content-Disposition */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export interface DecodedImage {
  mime: "image/png" | "image/jpeg" | "image/webp";
  buffer: Buffer;
}

const DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/;

/** 데이터 URL → 버퍼. 형식이 맞지 않으면 null */
export function decodeDataUrl(url: string | undefined): DecodedImage | null {
  if (!url) return null;
  const m = DATA_URL_RE.exec(url);
  if (!m) return null;
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length === 0) return null;
  return { mime: m[1] as DecodedImage["mime"], buffer };
}

/** 고객 맞춤 호칭. 예: "○○회사 ○○부서 홍길동 팀장님께" */
export function greetingLine(r?: RecipientInfo): string {
  if (!r) return "고객님께 드리는 티링크 소개 자료";
  const parts = [r.company, r.department, r.name, r.title].map((s) => s?.trim()).filter(Boolean);
  if (parts.length === 0) return "고객님께 드리는 티링크 소개 자료";
  const last = r.title?.trim() || r.name?.trim();
  return `${parts.join(" ")}${last ? "님께" : " 귀하"}`;
}

/** 해시태그 정규화(# 접두어) */
export const tag = (h: string) => (h.startsWith("#") ? h : `#${h}`);

/** 블로그 본문 → 단락 배열([이미지: ...] 자리표시자 제외) */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((s) => s.trim())
    .filter((s) => s && !/^\[이미지:.*\]$/.test(s));
}

/** CEO 영업 사각지대 항목(내보내기용으로 펼친 형태). AI 응답에 campaign이 없으면 빈 배열 */
export interface BlindSpotRow {
  label: string;
  headline: string;
  hypothesis: string;
  question: string;
  benefit: string;
  copy: string;
  /** 관련 기술 강점 이름. 근거가 없으면(0) 빈 문자열 */
  relatedFeature: string;
}

export const BLIND_SPOT_NOTICE = "아래 내용은 사진과 입력 정보로 세운 가설이며, 실제 발생 여부는 현장 확인이 필요합니다.";

export function blindSpotRows(result: GeneratedContent): BlindSpotRow[] {
  const c = result.campaign;
  if (!c) return [];
  return BLIND_SPOTS.map(({ id, label }, i) => {
    const s = c.blindSpots[id];
    const feature = s.relatedFeature > 0 ? result.differentiators[s.relatedFeature - 1]?.feature ?? "" : "";
    return {
      label,
      headline: result.headlines[i] ?? "",
      hypothesis: s.hypothesis,
      question: s.question,
      benefit: s.benefit,
      copy: s.copy,
      relatedFeature: feature,
    };
  });
}
