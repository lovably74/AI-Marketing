// 이미지 검사 (클라이언트·서버 공용). 매직바이트로 실제 형식을 확인한다.
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, type AllowedImageType } from "./constants";

/** 파일 앞부분 바이트로 실제 이미지 형식을 판별한다. 알 수 없으면 null */
export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageCheckResult =
  | { ok: true; mimeType: AllowedImageType }
  | { ok: false; code: "INVALID_IMAGE" | "IMAGE_TOO_LARGE"; message: string };

/**
 * 선언된 MIME 형식, 매직바이트, 크기를 함께 검사한다.
 * @param declaredType 브라우저/폼이 알려 준 MIME 형식
 * @param size 파일 크기(바이트)
 * @param head 파일 앞부분 바이트(최소 12바이트 권장)
 */
export function checkImage(declaredType: string, size: number, head: Uint8Array): ImageCheckResult {
  if (size <= 0) {
    return { ok: false, code: "INVALID_IMAGE", message: "빈 파일입니다. 사진을 다시 선택해 주세요." };
  }
  if (size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      code: "IMAGE_TOO_LARGE",
      message: `사진 크기가 너무 큽니다(${(size / 1024 / 1024).toFixed(2)}MB). 최대 8MB까지 올릴 수 있습니다.`,
    };
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(declaredType)) {
    return {
      ok: false,
      code: "INVALID_IMAGE",
      message: "JPG, PNG, WebP 형식의 사진만 올릴 수 있습니다.",
    };
  }
  const detected = detectImageType(head);
  if (!detected) {
    return {
      ok: false,
      code: "INVALID_IMAGE",
      message: "이미지 파일 내용을 확인할 수 없습니다. JPG, PNG, WebP 사진인지 확인해 주세요.",
    };
  }
  if (detected !== declaredType) {
    return {
      ok: false,
      code: "INVALID_IMAGE",
      message: `파일 확장자/형식(${declaredType})과 실제 내용(${detected})이 다릅니다.`,
    };
  }
  return { ok: true, mimeType: detected };
}
